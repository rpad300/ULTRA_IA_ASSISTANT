using System;
using System.Buffers;
using System.Threading;
using System.Threading.Tasks;
using System.Text;
using System.Text.Json;
using System.Collections.Generic;
using System.Linq;
using WebSocket4Net;

namespace AudioStreamingService
{
    /// <summary>
    /// WebSocket client that connects directly to AssemblyAI Universal Streaming API.
    /// Handles audio streaming and receives transcriptions.
    /// Uses WebSocket4Net for reliable custom header support.
    /// </summary>
    public class AssemblyAIWebSocketClient : IDisposable
    {
        private WebSocket4Net.WebSocket? ws;
        private readonly string apiKey;
        private readonly string? language;
        private readonly List<string>? keytermsPrompt;
        private volatile bool isConnected = false;
        private readonly TaskCompletionSource<bool> connectionTcs = new TaskCompletionSource<bool>();
        private readonly CancellationTokenSource cts = new CancellationTokenSource();
        private readonly SemaphoreSlim signal = new SemaphoreSlim(0);
        
        // Async Send Queue
        private readonly System.Collections.Concurrent.ConcurrentQueue<ArraySegment<byte>> audioQueue = new System.Collections.Concurrent.ConcurrentQueue<ArraySegment<byte>>(); 
        private readonly System.Collections.Concurrent.ConcurrentQueue<string> messageQueue = new System.Collections.Concurrent.ConcurrentQueue<string>();

        public event EventHandler<Dictionary<string, object>>? TranscriptReceived;
        public event EventHandler<string>? ConnectionStatusChanged;

        public bool IsConnected => isConnected;

        public AssemblyAIWebSocketClient(string apiKey, string? language, List<string>? keytermsPrompt)
        {
            this.apiKey = apiKey;
            this.language = language;
            this.keytermsPrompt = keytermsPrompt;
            
            // Start Send Loop
            _ = Task.Factory.StartNew(SendLoop, cts.Token, TaskCreationOptions.LongRunning, TaskScheduler.Default);
        }

        public async Task ConnectAsync()
        {
            try
            {
                var sampleRate = 16000;
                // SOTA Upgrade: v3 Universal Streaming
                var url = $"wss://streaming.assemblyai.com/v3/ws?sample_rate={sampleRate}&encoding=pcm_s16le";
                
                // Force Model
                url += "&speech_model=universal-streaming-multilingual";
                
                // Force Language (ignoring "auto" logic for this debug step)
                url += "&language_code=pt";

                if (keytermsPrompt != null && keytermsPrompt.Count > 0)
                {
                    var terms = Uri.EscapeDataString(string.Join(",", keytermsPrompt));
                    url += $"&word_boost={terms}";
                }

                var headers = new List<KeyValuePair<string, string>>
                {
                     new KeyValuePair<string, string>("Authorization", apiKey)
                };
            
                ws = new WebSocket4Net.WebSocket(url, "", null, headers);
                
                ws.Opened += (s, e) => 
                {
                    isConnected = true;
                    connectionTcs.TrySetResult(true);
                    ConnectionStatusChanged?.Invoke(this, "Connected");
                };

                ws.Closed += (s, e) => 
                {
                    isConnected = false;
                    ConnectionStatusChanged?.Invoke(this, "Disconnected");
                };

                ws.Error += (s, e) => 
                {
                    ConnectionStatusChanged?.Invoke(this, $"Error: {e.Exception.Message}");
                };

                ws.MessageReceived += (s, e) =>
                {
                     try
                     {
                         var json = JsonSerializer.Deserialize<Dictionary<string, object>>(e.Message);
                         if (json != null)
                         {
                             TranscriptReceived?.Invoke(this, json);
                         }
                     }
                     catch (Exception ex) 
                     {
                         ConnectionStatusChanged?.Invoke(this, $"Parse Error: {ex.Message}");
                     }
                };

                ws.Open();
                await connectionTcs.Task;
            }
            catch (Exception ex)
            {
                ConnectionStatusChanged?.Invoke(this, $"Connection Failed: {ex.Message}");
                throw;
            }
        }

        private async Task SendLoop()
        {
            while (!cts.Token.IsCancellationRequested)
            {
                try 
                {
                    await signal.WaitAsync(500, cts.Token);
                } 
                catch (OperationCanceledException) 
                { 
                    break;
                }

                if (cts.Token.IsCancellationRequested) break;
                if (ws == null || ws.State != WebSocket4Net.WebSocketState.Open) continue;

                // Priority 1: Control Messages
                while (messageQueue.TryDequeue(out string? msg))
                {
                    ws.Send(msg);
                }

                // Priority 2: Audio Data
                int processed = 0;
                while (audioQueue.TryDequeue(out ArraySegment<byte> segment) && processed < 50) 
                {
                    if (segment.Array != null) 
                    {
                        ws.Send(segment.Array, segment.Offset, segment.Count);
                        // SOTA: Return buffer to pool after valid send
                        ArrayPool<byte>.Shared.Return(segment.Array);
                    }
                    processed++;
                }
             }
        }

        public void SendAudioData(ArraySegment<byte> audioSegment)
        {
            if (audioSegment.Array == null || audioSegment.Count == 0) return;
            
            // Drop if queue too full (Real-time preference)
            if (audioQueue.Count > 500) 
            {
                // Recycle explicitly if we drop it, otherwise leak!
                ArrayPool<byte>.Shared.Return(audioSegment.Array);
                return;
            }
            
            audioQueue.Enqueue(audioSegment);
            signal.Release();
        }
        
        public void SendTerminate()
        {
            var msg = JsonSerializer.Serialize(new Dictionary<string, bool> { { "terminate_session", true } });
            messageQueue.Enqueue(msg);
            signal.Release();
        }
        
        public void SendForceEndpoint()
        {
             var msg = JsonSerializer.Serialize(new Dictionary<string, bool> { { "force_end_utterance", true } });
             messageQueue.Enqueue(msg);
             signal.Release();
        }
        
        public void Disconnect()
        {
            try { ws?.Close(); } catch {}
            isConnected = false;
            ConnectionStatusChanged?.Invoke(this, "Disconnected");
        }
        
        public void Dispose()
        {
            cts.Cancel();
            Disconnect();
            ws?.Dispose();
            cts.Dispose();
            signal.Dispose();
        }
    }
}
