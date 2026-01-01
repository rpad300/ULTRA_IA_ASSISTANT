using System.Collections.Concurrent;
using System.Buffers;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NAudio.CoreAudioApi;

namespace AudioStreamingService;

public class AudioStreamingWorker : BackgroundService
{
    private readonly ILogger<AudioStreamingWorker> _logger;

    private AssemblyAIWebSocketClient? _assemblyAIClient;
    private BackendWebSocketClient? _backendClient;

    // Configuration
    private string? _assemblyAIApiKey;
    private string? _language;
    private List<string>? _keytermsPrompt;
    private string? _sessionId;
    private bool _isCapturing;

    // Device Selection
    private string? _microphoneDeviceId;
    private string? _systemDeviceId;
    
    // Debug Audio Writer
    private NAudio.Wave.WaveFileWriter? _debugWriter;

    private float _digitalGain = 5.0f; // Default gain
    
    public void SetGain(float gain)
    {
        _digitalGain = Math.Clamp(gain, 1.0f, 20.0f); // Safety limits
        _logger.LogInformation($"Digital Gain updated to: {_digitalGain:F1}x");
        if (_mixerProvider != null) _mixerProvider.DigitalGain = _digitalGain;
    }

    public AudioStreamingWorker(ILogger<AudioStreamingWorker> logger)
    {
        _logger = logger;
    }

    // ... (ExecuteAsync remains same) ... Use existing code for lines 42-74

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Audio Streaming Worker started.");

        // Initialize Backend Client (Persistent connection)
        try
        {
            _backendClient = new BackendWebSocketClient(
                "ws://localhost:8000/api/ws/native-transcription",
                msg => _logger.LogInformation(msg),
                (msg, ex) => _logger.LogError(ex, msg)
            );
            _backendClient.ConnectionStatusChanged += (s, status) => _logger.LogInformation($"Backend: {status}");
            _backendClient.ErrorOccurred += (s, err) => _logger.LogError($"Backend Error: {err}");
            
            // Initial connect
            await _backendClient.ConnectAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize backend client.");
        }

        // Keep the service alive
        try 
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (TaskCanceledException)
        {
            _logger.LogInformation("Worker stopping...");
        }
    }

    // Audio Pipeline
    private AudioPipeline.AudioMixerProvider? _mixerProvider;
    private AudioPipeline.WasapiSystemSource? _systemSource;
    private AudioPipeline.WasapiMicrophoneSource? _micSource;

    // Levels Cache for API
    private float _micLevel;
    private float _sysLevel;

    public void SetConfiguration(string apiKey, string? lang, List<string>? keyterms, string? sessId, string? micId, string? sysId)
    {
        _assemblyAIApiKey = apiKey;
        _language = lang;
        _keytermsPrompt = keyterms;
        _sessionId = sessId;
        _microphoneDeviceId = micId;
        _systemDeviceId = sysId;
        
        _logger.LogInformation($"Configuration updated. Session: {_sessionId}, Mic: {_microphoneDeviceId ?? "Default"}, Sys: {_systemDeviceId ?? "Default"}");
    }

    public async Task StartStreamingAsync()
    {
        if (string.IsNullOrEmpty(_assemblyAIApiKey)) throw new InvalidOperationException("API Key not set.");
        if (_isCapturing) return;

        _logger.LogInformation($"Starting Audio Pipeline... Digital Gain: {_digitalGain:F1}x");

        // 1. Cleanup Old
        CleanupPipeline();
        CleanupAssemblyAI();

        // 2. Initialize Pipeline Components
        _mixerProvider = new AudioPipeline.AudioMixerProvider();
        _mixerProvider.DigitalGain = _digitalGain;
        _mixerProvider.AudioDataAvailable += (s, data) => OnAudioDataReceived(data);
        _mixerProvider.ErrorOccurred += (s, err) => _logger.LogError($"Mixer Error: {err}");
        
        // System Source
        _systemSource = new AudioPipeline.WasapiSystemSource(_systemDeviceId);
        _systemSource.Initialize(); 
        _systemSource.ErrorOccurred += (s, e) => _logger.LogError($"System Audio Error: {e}");
        _systemSource.AudioDataAvailable += (s, data) => _sysLevel = _systemSource.AudioLevel; 
        
        // Mic Source
        _micSource = new AudioPipeline.WasapiMicrophoneSource(_microphoneDeviceId);
        _micSource.Initialize(); 
        _micSource.ErrorOccurred += (s, e) => _logger.LogError($"Microphone Error: {e}");
        _micSource.AudioDataAvailable += (s, data) => _micLevel = _micSource.AudioLevel; 

        // 3. Connect to Mixer
        _mixerProvider.AddSource(_systemSource);
        _mixerProvider.AddSource(_micSource);
        
        // 4. Start Mixer Processing Loop (SOTA)
        // _captureTokenSource is now internal to Mixer mostly, 
        // but we keep it for Stop synchronization if needed.
        _captureTokenSource = new CancellationTokenSource(); 
        await _mixerProvider.StartAsync(); // SOTA API

        // 5. Connect AssemblyAI
        _assemblyAIClient = new AssemblyAIWebSocketClient(_assemblyAIApiKey, _language, _keytermsPrompt);
        _assemblyAIClient.TranscriptReceived += OnTranscriptReceived;
        _assemblyAIClient.ConnectionStatusChanged += (s, status) => _logger.LogInformation($"AssemblyAI: {status}");
        await _assemblyAIClient.ConnectAsync();

        // 6. Start Sources
        _systemSource.Start();
        _micSource.Start();
        
        // Debug Recording
        StartDebugRecording();


        // NOTIFY BACKEND of Session ID for routing
        if (!string.IsNullOrEmpty(_sessionId)) 
        {
            var sessionPayload = new { type = "session_update", session_id = _sessionId };
            var jsonPayload = System.Text.Json.JsonSerializer.Serialize(sessionPayload);
            
            if (_backendClient != null)
            {
                _logger.LogInformation($"[Worker] Sending Session Update: {jsonPayload}");
                _backendClient.CurrentSessionId = _sessionId;
                _backendClient.SendMessage(jsonPayload);
            }
        }

        _isCapturing = true;
        _logger.LogInformation("Streaming Started.");
    }

    private CancellationTokenSource? _captureTokenSource;

    public void StopStreaming()
    {
        _logger.LogInformation("Stopping Streaming...");
        _isCapturing = false;
        _sessionId = null; 
        if (_backendClient != null) _backendClient.CurrentSessionId = null;
        
        _captureTokenSource?.Cancel();
        
        // SOTA: Stop mixer explicitly
        _mixerProvider?.Stop();

        CleanupPipeline();
        CleanupAssemblyAI();
        StopDebugRecording();
        
        _logger.LogInformation("Streaming Stopped.");
    }

    private int _audioChunksLogCounter = 0;
    private void OnAudioDataReceived(ArraySegment<byte> segment)
    {
        // SOTA Lifecycle: 'segment.Array' is RENTED.
        // We MUST Return it.
        
        if (segment.Array == null) return;
        
        byte[] rented = segment.Array; 

        // Debug Log
        if (_audioChunksLogCounter++ % 20 == 0)
        {
             // Calculate SOTA Chunk RMS (Scanning just first 100 samples for speed)
             float sum = 0;
             int count = Math.Min(rented.Length / 2, 100);
             for(int i = 0; i < count; i++)
             {
                 short sample = BitConverter.ToInt16(rented, i * 2);
                 sum += (sample / 32768f) * (sample / 32768f);
             }
             float rms = count > 0 ? (float)Math.Sqrt(sum / count) : 0;
             
             _logger.LogInformation($"[AudioStreamingWorker] Processing SOTA Chunk {segment.Count} bytes. MicLvl: {(int)(_micLevel * 100)}%, SysLvl: {(int)(_sysLevel * 100)}%, MixedRMS: {rms:F3}");
        }

        bool ownershipTransferred = false;

        if (_assemblyAIClient != null && _assemblyAIClient.IsConnected)
        {
             // Update Client to accept Segment (or we copy?)
             // For SOTA, Client matches Segment.
             // We'll update the Client next.
             _assemblyAIClient.SendAudioData(segment);
             ownershipTransferred = true;
        }
        
        if (_backendClient != null || _debugWriter != null)
        {
            // Legacy / Secondary consumers usually need pure array.
            // We copy strict length here.
            byte[] strictCopy = new byte[segment.Count];
            Buffer.BlockCopy(rented, segment.Offset, strictCopy, 0, segment.Count);
            
            _backendClient?.SendAudio(strictCopy);
            _debugWriter?.Write(strictCopy, 0, strictCopy.Length);
             if (_audioChunksLogCounter % 50 == 0) _debugWriter?.Flush();
        }
        
        if (!ownershipTransferred)
        {
             System.Buffers.ArrayPool<byte>.Shared.Return(rented);
        }
    }

    private void OnTranscriptReceived(object? sender, Dictionary<string, object> transcript)
    {
        if (!_isCapturing) return;

        // V3 Fix: "SessionBegins" (or "Begin") might confuse the backend if not fully supported in NativeMessage Union
        // or trigger a race condition type. Safe to ignore for now as Frontend doesn't strictly need it.
        if (transcript.TryGetValue("message_type", out var typeObj) && typeObj?.ToString()?.Equals("SessionBegins", StringComparison.OrdinalIgnoreCase) == true) return;
        if (transcript.TryGetValue("type", out var typeStr) && typeStr?.ToString()?.Equals("Begin", StringComparison.OrdinalIgnoreCase) == true) return;

        if (!string.IsNullOrEmpty(_sessionId)) 
        {
            transcript["session_id"] = _sessionId;
        }
        _backendClient?.SendTranscript(transcript);
    }

    public object GetStatus()
    {
        return new 
        {
            isCapturing = _isCapturing,
            isConnected = (_assemblyAIClient?.IsConnected ?? false) && (_backendClient?.IsConnected ?? false),
            isAssemblyAIConnected = _assemblyAIClient?.IsConnected ?? false,
            isBackendConnected = _backendClient?.IsConnected ?? false,
            sessionId = _sessionId,
            microphone = new 
            { 
                 deviceId = _microphoneDeviceId,
                 deviceName = _micSource?.DeviceName,
                 level = (int)(_micLevel * 100),
                 detectingAudio = _micLevel > 0.01f 
            },
            systemAudio = new 
            {
                 deviceId = _systemDeviceId,
                 deviceName = _systemSource?.DeviceName,
                 level = (int)(_sysLevel * 100),
                 detectingAudio = _sysLevel > 0.01f
            }
        };
    }
    
    // ... (Device Helpers) ...

    // Test Recording Mode
    private string? _testRecordingPath;
    private bool _isTestMode = false;

    public async Task StartTestRecordingAsync(string filePath, string? micId, string? sysId, string? transcriptionService = "assemblyai")
    {
        if (_isCapturing) throw new InvalidOperationException("Already capturing.");
        _logger.LogInformation($"StartTestRecordingAsync called. Service: {transcriptionService}");
        
        _logger.LogInformation($"Starting TEST recording to: {filePath}");
        _microphoneDeviceId = micId;
        _systemDeviceId = sysId;
        _testRecordingPath = filePath;
        _isTestMode = true;

        // 1. Initialize Pipeline
        CleanupAssemblyAI();
        CleanupPipeline();
    try 
    {
        _mixerProvider = new AudioPipeline.AudioMixerProvider();
        _mixerProvider.DigitalGain = _digitalGain;
        _mixerProvider.AudioDataAvailable += (s, data) => OnAudioDataReceived(data);
        _mixerProvider.ErrorOccurred += (s, err) => _logger.LogError($"Mixer Error: {err}");

        _logger.LogInformation("STEP 1: Initializing Sources...");
        _systemSource = new AudioPipeline.WasapiSystemSource(_systemDeviceId);
        _systemSource.Initialize(); 
        
        _micSource = new AudioPipeline.WasapiMicrophoneSource(_microphoneDeviceId);
        _micSource.Initialize(); 
        _logger.LogInformation($"[AudioStreamingWorker] Microphone Initialized: {_micSource.DeviceName} (Format: {_micSource.WaveFormat})");

        // Link events for debugging levels
        _systemSource.AudioDataAvailable += (s, data) => _sysLevel = _systemSource.AudioLevel;
        _micSource.AudioDataAvailable += (s, data) => _micLevel = _micSource.AudioLevel;
        
        _logger.LogInformation("STEP 2: Adding Sources to Mixer...");
        _mixerProvider.AddSource(_systemSource);
        _mixerProvider.AddSource(_micSource);

        bool useAssemblyAI = string.IsNullOrEmpty(transcriptionService) || transcriptionService.ToLower() == "assemblyai";
        
        if (!string.IsNullOrEmpty(_assemblyAIApiKey) && useAssemblyAI)
        {
            _logger.LogInformation("STEP 3: Initializing AssemblyAI for Test...");
            _assemblyAIClient = new AssemblyAIWebSocketClient(_assemblyAIApiKey, _language, _keytermsPrompt);
            _assemblyAIClient.TranscriptReceived += (s, dict) => 
            {
                var json = System.Text.Json.JsonSerializer.Serialize(dict);
                _logger.LogInformation($"[AssemblyAI] Received Transcript: {json}");
                OnTranscriptReceived(s, dict);
            };
            await _assemblyAIClient.ConnectAsync();
        }
    }
    catch (Exception ex)
    {
        _logger.LogError($"Failed to initialize audio pipeline for test recording: {ex.Message}");
        CleanupPipeline(); 
        CleanupAssemblyAI();
        throw;
    }

        // 2. Open File Writer
        try 
        {
            Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
            _debugWriter = new NAudio.Wave.WaveFileWriter(filePath, new NAudio.Wave.WaveFormat(16000, 16, 1));
        }
        catch (Exception ex)
        {
            _logger.LogError($"Failed to create test file: {ex.Message}");
            throw;
        }

        // 3. Start Loop
        _captureTokenSource = new CancellationTokenSource();
        await _mixerProvider.StartAsync();

        // 4. Start Sources
        _systemSource.Start();
        _micSource.Start();

        // NOTIFY BACKEND of Session ID for routing
        var sessionPayload = new { type = "session_update", session_id = "TEST_SESSION" };
        var jsonPayload = System.Text.Json.JsonSerializer.Serialize(sessionPayload);
        
        if (_backendClient != null) 
        {
            _backendClient.CurrentSessionId = "TEST_SESSION";
            _backendClient.SendMessage(jsonPayload);
        }

        _isCapturing = true;
        _logger.LogInformation("Test Recording Started.");
    }

    public void StopTestRecording()
    {
        if (!_isTestMode) return;
        
        _logger.LogInformation("Stopping Test Recording...");
        StopStreaming(); // Reuses stop logic but we need to reset flags
        _isTestMode = false;
        _testRecordingPath = null;
    }

    public async Task UpdateMicrophoneDevice(string deviceId)
    {
        _microphoneDeviceId = deviceId;
        if (_isCapturing)
        {
             await Task.Run(() => {
                 bool wasTest = _isTestMode;
                 string? testPath = _testRecordingPath;
                 
                 StopStreaming();
                 
                 if (wasTest && testPath != null)
                 {
                     StartTestRecordingAsync(testPath, deviceId, _systemDeviceId, "assemblyai").Wait();
                 }
                 else
                 {
                     StartStreamingAsync().Wait();
                 }
             });
        }
    }

    private void CleanupPipeline()
    {
        _mixerProvider?.Dispose();
        _mixerProvider = null;
        
        _systemSource?.Dispose();
        _systemSource = null;
        
        _micSource?.Dispose();
        _micSource = null;
    }

    private void CleanupAssemblyAI()
    {
        if (_assemblyAIClient != null)
        {
            try 
            {
               _assemblyAIClient.Disconnect(); 
               _assemblyAIClient.Dispose();
            } 
            catch {}
            _assemblyAIClient = null;
        }
    }



    public object GetDevices() 
    {
        var enumerator = new MMDeviceEnumerator();
        
        var mics = enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active)
            .Select(d => new { id = d.ID, name = d.FriendlyName })
            .ToList();
            
        var speakers = enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active)
            .Select(d => new { id = d.ID, name = d.FriendlyName })
            .ToList();
            
        return new { microphones = mics, speakers = speakers };
    }

    private void StartDebugRecording()
    {
        // Stub
    }

    private void StopDebugRecording()
    {
        // Stub
    }
}
