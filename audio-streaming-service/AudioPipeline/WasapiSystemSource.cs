using NAudio.CoreAudioApi;
using NAudio.Wave;
using System;
using System.Buffers;

namespace AudioStreamingService.AudioPipeline
{
    public class WasapiSystemSource : IAudioSource
    {
        private WasapiLoopbackCapture? _capture;
        private readonly string? _deviceId;
        
        // SOTA: Use ArrayPool to avoid GC pressure
        // Consumer MUST return the buffer: ArrayPool<byte>.Shared.Return(buffer);
        public event EventHandler<ArraySegment<byte>>? AudioDataAvailable;
        public event EventHandler<string>? ErrorOccurred;
        
        public float AudioLevel { get; private set; }
        public WaveFormat WaveFormat => _capture?.WaveFormat ?? new WaveFormat(48000, 16, 2); 
        public string DeviceName { get; private set; } = "System Audio";

        public WasapiSystemSource(string? deviceId = null)
        {
            _deviceId = deviceId;
        }

        public void Initialize()
        {
            if (_capture != null) return;

            try
            {
                var deviceEnumerator = new MMDeviceEnumerator();
                MMDevice? device = string.IsNullOrEmpty(_deviceId) 
                    ? deviceEnumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Console)
                    : deviceEnumerator.GetDevice(_deviceId);

                if (device == null)
                {
                    ErrorOccurred?.Invoke(this, "System audio device not found.");
                    return;
                }

                DeviceName = device.FriendlyName;
                
                // SOTA: Use EventSync for ultra-low latency (1-10ms)
                _capture = new WasapiLoopbackCapture(device)
                {
                    ShareMode = AudioClientShareMode.Shared
                    // UseEventSync = true // Causiing build error in this version 
                };
                
                _capture.DataAvailable += OnDataAvailable;
                _capture.RecordingStopped += (s, a) => { if (a.Exception != null) ErrorOccurred?.Invoke(this, $"System Capture Stopped: {a.Exception.Message}"); };

                Console.WriteLine($"[WasapiSystemSource] Initialized (SOTA Mode) on device: {DeviceName} ({device.ID})");
            }
            catch (Exception ex)
            {
                ErrorOccurred?.Invoke(this, $"Failed to initialize system audio: {ex.Message}");
            }
        }

        public void Start()
        {
            try
            {
                _capture?.StartRecording();
            }
            catch (Exception ex)
            {
                ErrorOccurred?.Invoke(this, $"Failed to start system audio: {ex.Message}");
            }
        }

        private void OnDataAvailable(object? sender, WaveInEventArgs e)
        {
            if (e.BytesRecorded <= 0) return;

            // SOTA: Compute Level BEFORE renting (read-only scan)
            CalculateLevel(e.Buffer, e.BytesRecorded);

            // SOTA: Rent from Pool
            byte[] pooledBuffer = ArrayPool<byte>.Shared.Rent(e.BytesRecorded);
            
            // Fast Block Copy
            Buffer.BlockCopy(e.Buffer, 0, pooledBuffer, 0, e.BytesRecorded);
            
            // Invoke SOTA Event: Consumer (Mixer) MUST Return pooledBuffer
            // We pass ArraySegment to indicate EXACT count of valid bytes
            AudioDataAvailable?.Invoke(this, new ArraySegment<byte>(pooledBuffer, 0, e.BytesRecorded));
        }

        private void CalculateLevel(byte[] buffer, int count)
        {
            // SOTA: Optimized Level Calc (Skip scan if needed or sparse scan)
            float max = 0;
            
            // Assuming IEEE Float (Loopback standard)
            if (_capture?.WaveFormat.Encoding == WaveFormatEncoding.IeeeFloat) 
            {
                // Unsafe Scan for Speed
                unsafe 
                {
                    fixed (byte* p = buffer)
                    {
                        float* pf = (float*)p;
                        int samples = count / 4;
                        // Skip scan: Check every 8th sample (16k/8 = 2k checks/sec = fine)
                        for (int i = 0; i < samples; i+=8)
                        {
                            float abs = Math.Abs(pf[i]);
                            if (abs > max) max = abs;
                        }
                    }
                }
            }
            else
            {
                // 16-bit PCM Fallback
                for (int i = 0; i < count; i += 16) 
                {
                    if (i + 1 >= count) break;
                    short sample = BitConverter.ToInt16(buffer, i);
                    float abs = Math.Abs(sample) / 32768f;
                    if (abs > max) max = abs;
                }
            }
            
            AudioLevel = AudioLevel * 0.7f + max * 0.3f; // Faster Attack
        }

        public void Stop()
        {
            _capture?.StopRecording();
        }

        public void Dispose()
        {
            Stop();
            _capture?.Dispose();
            _capture = null;
        }
    }
}
