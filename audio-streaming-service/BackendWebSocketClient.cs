using WebSocket4Net;
using System;
using System.Threading;
using System.Threading.Tasks;
using System.Text.Json;

namespace AudioStreamingService
{
    /// <summary>
    /// WebSocket client that sends transcriptions and status updates to the backend.
    /// The backend then forwards these to the frontend.
    /// Uses WebSocket4Net for better .NET 8 compatibility.
    /// </summary>
    /// <summary>
    /// WebSocket client that sends transcriptions and status updates to the backend.
    /// Features: Auto-reconnect, Async Send Queue (Non-blocking).
    /// </summary>
    public class BackendWebSocketClient : IDisposable
    {
        private WebSocket4Net.WebSocket? ws;
        private readonly string url;
        private volatile bool isConnected = false; // Thread-safe flag
        private readonly CancellationTokenSource cts = new CancellationTokenSource();
        private readonly System.Collections.Concurrent.ConcurrentQueue<string> sendQueue = new System.Collections.Concurrent.ConcurrentQueue<string>();
        private readonly SemaphoreSlim signal = new SemaphoreSlim(0);
        
        public event EventHandler<string>? ConnectionStatusChanged;
        public event EventHandler<string>? ErrorOccurred;
        
        public bool IsConnected => isConnected; // Read raw flag for speed
        
        private readonly Action<string> _logInfo;
        private readonly Action<string, Exception?> _logError;

        public BackendWebSocketClient(string backendUrl, Action<string> logInfo, Action<string, Exception?> logError)
        {
            url = backendUrl;
            _logInfo = logInfo;
            _logError = logError;
            
            // Start background tasks
            Task.Run(ConnectionLoop, cts.Token);
            Task.Run(SendLoop, cts.Token);
            Task.Run(KeepAliveLoop, cts.Token);
        }

        // Removed explicit ConnectAsync - it's handled by the loop now
        // But kept for compatibility if needed, though it just ensures the loop is running
        public Task ConnectAsync() => Task.CompletedTask; 

        private async Task KeepAliveLoop()
        {
            while (!cts.Token.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(5000, cts.Token); // 5 seconds heartbeat
                    if (isConnected)
                    {
                        var ping = new { type = "ping", timestamp = DateTime.UtcNow };
                        string json = JsonSerializer.Serialize(ping);
                        sendQueue.Enqueue(json);
                        signal.Release();
                    }
                }
                catch
                {
                    // Ignore errors, likely cancellation
                }
            }
        } 

        private async Task ConnectionLoop()
        {
            while (!cts.Token.IsCancellationRequested)
            {
                if (isConnected)
                {
                    await Task.Delay(1000, cts.Token);
                    continue;
                }

                try
                {
                    // Console.WriteLine($"[Backend] Connecting to: {url}");
                    ConnectInternal();

                    // Wait for connection or timeout (5s)
                    int retries = 0;
                    while (!isConnected && retries < 50)
                    {
                        await Task.Delay(100, cts.Token);
                        retries++;
                    }
                }
                catch (Exception)
                {
                    // Silent retry wait
                    // Console.WriteLine($"[Backend] Connection attempt failed: {ex.Message}");
                }

                if (!isConnected)
                {
                    // Exponential backoff or fixed delay? Fixed 3s is fine for local dev
                    await Task.Delay(3000, cts.Token); 
                }
            }
        }

        public string? CurrentSessionId { get; set; }

        private void ConnectInternal()
        {
            if (ws != null)
            {
                ws.Opened -= OnOpened;
                ws.Closed -= OnClosed;
                ws.Error -= OnError;
                ws.Dispose();
            }

            ws = new WebSocket4Net.WebSocket(url);
            ws.Opened += OnOpened;
            ws.Closed += OnClosed;
            ws.Error += OnError;
            ws.Open();
        }

        private void OnOpened(object? sender, EventArgs e)
        {
            isConnected = true;
            _logInfo("[Backend] WebSocket Connected");
            ConnectionStatusChanged?.Invoke(this, "Connected");
            
            if (!string.IsNullOrEmpty(CurrentSessionId))
            {
                _logInfo($"[Backend] Resending Session ID on Connect: {CurrentSessionId}");
                var payload = System.Text.Json.JsonSerializer.Serialize(new { type = "session_update", session_id = CurrentSessionId });
                ws?.Send(payload);
            }
        }

        private void OnClosed(object? sender, EventArgs e)
        {
            bool wasConnected = isConnected;
            isConnected = false;
            if (wasConnected)
            {
                _logInfo("[Backend] WebSocket Closed");
                ConnectionStatusChanged?.Invoke(this, "Disconnected");
            }
        }

        private void OnError(object? sender, SuperSocket.ClientEngine.ErrorEventArgs e)
        {
            // Just log, the closed event or watchdog will handle reconnect
            _logError($"[Backend] WebSocket Error: {e.Exception.Message}", e.Exception);
            ErrorOccurred?.Invoke(this, e.Exception.Message);
        }

        private readonly System.Collections.Concurrent.ConcurrentQueue<byte[]> audioQueue = new System.Collections.Concurrent.ConcurrentQueue<byte[]>();

        // ...

        private async Task SendLoop()
        {
            while (!cts.Token.IsCancellationRequested)
            {
                try
                {
                    try 
                    {
                        await signal.WaitAsync(500, cts.Token);
                    }
                    catch (OperationCanceledException) { break; }

                    if (isConnected && ws != null && ws.State == WebSocketState.Open)
                    {
                        // 1. Send Control Messages
                        while (sendQueue.TryDequeue(out string? json))
                        {
                            if (json != null) 
                            {
                                ws?.Send(json);
                                if (json.Contains("session_update")) _logInfo($"[Backend] Sent: {json}");
                            }
                        }

                        // 2. Send Audio Data
                        // Process in chunks to avoid blocking too long
                        int processed = 0;
                        while (audioQueue.TryDequeue(out byte[]? data) && processed < 50)
                        {
                            if (data != null) ws?.Send(data, 0, data.Length);
                            processed++;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logError($"[Backend] Send Loop Error: {ex.Message}", ex);
                    // If error is critical, force reconnect?
                    if (ex is System.IO.IOException || ex is System.Net.Sockets.SocketException)
                    {
                         isConnected = false; // Force reconnect loop to notice
                    }
                }
            }
        }

        public void SendAudio(byte[] data)
        {
            if (data == null || data.Length == 0) return;
            // Dropping if full policy? 
            if (audioQueue.Count > 500) return; 
            
            audioQueue.Enqueue(data);
            signal.Release();
        }
        
        public void SendTranscript(object transcript)
        {
            // Non-blocking enqueue
            try
            {
                string json = JsonSerializer.Serialize(transcript);
                sendQueue.Enqueue(json);
                signal.Release(); // Wake up sender
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Backend] Error queuing transcript: {ex.Message}");
            }
        }
        
        public void SendStatus(object status)
        {
            try
            {
                string json = JsonSerializer.Serialize(status);
                sendQueue.Enqueue(json);
                signal.Release();
            }
            catch (Exception ex)
            {
                 Console.WriteLine($"[Backend] Error queuing status: {ex.Message}");
            }
        }
        
        public void SendMessage(string json)
        {
            if (string.IsNullOrEmpty(json)) return;
            sendQueue.Enqueue(json);
            signal.Release();
        }

        public void Disconnect()
        {
            // Stop logic is usually Dispose for this service
        }
        
        public void Dispose()
        {
            cts.Cancel();
            try { ws?.Close(); } catch {}
            try { ws?.Dispose(); } catch {}
            cts.Dispose();
            signal.Dispose();
        }
    }
}
