using NAudio.CoreAudioApi;
using NAudio.Wave;
using System;
using System.Buffers;

namespace AudioStreamingService.AudioPipeline
{
    public class WasapiMicrophoneSource : IAudioSource
    {
        private WasapiCapture? _capture;
        private readonly string? _deviceId;
        
        public event EventHandler<ArraySegment<byte>>? AudioDataAvailable;
        public event EventHandler<string>? ErrorOccurred;

        public float AudioLevel { get; private set; }
        public WaveFormat WaveFormat => _capture?.WaveFormat ?? new WaveFormat(16000, 16, 1);
        public string DeviceName { get; private set; } = "Microphone";

        public WasapiMicrophoneSource(string? deviceId = null)
        {
            _deviceId = deviceId;
        }

        public void Initialize()
        {
            if (_capture != null) return;
            try
            {
                 var deviceEnumerator = new MMDeviceEnumerator();
                 var device = string.IsNullOrEmpty(_deviceId) 
                     ? GetSmartDefaultDevice(deviceEnumerator)
                     : deviceEnumerator.GetDevice(_deviceId);
                 
                 if (device == null) throw new Exception("Microphone not found");
                 
                 DeviceName = device.FriendlyName;
                 _capture = new WasapiCapture(device) { ShareMode = AudioClientShareMode.Shared }; 
                 _capture.DataAvailable += OnDataAvailable;
                 _capture.RecordingStopped += (s, a) => {
                     if (a.Exception != null) ErrorOccurred?.Invoke(this, $"Mic Capture Stopped: {a.Exception.Message}");
                 };
            }
            catch(Exception ex)
            {
                ErrorOccurred?.Invoke(this, $"Failed to init mic: {ex.Message}");
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
                ErrorOccurred?.Invoke(this, $"Failed to start microphone: {ex.Message}");
                // Immediate retry if start fails
                 Task.Run(async () => await AttemptReconnect());
            }
        }

        private void OnDataAvailable(object? sender, WaveInEventArgs e)
        {
            if (e.BytesRecorded > 0)
            {
                CalculateLevel(e.Buffer, e.BytesRecorded);

                // SOTA: Use ArrayPool instead of alloc
                byte[] pooledBuffer = System.Buffers.ArrayPool<byte>.Shared.Rent(e.BytesRecorded);
                Buffer.BlockCopy(e.Buffer, 0, pooledBuffer, 0, e.BytesRecorded);

                AudioDataAvailable?.Invoke(this, new ArraySegment<byte>(pooledBuffer, 0, e.BytesRecorded));
            }
        }

        private void CalculateLevel(byte[] buffer, int count)
        {
            float max = 0;
            
            if (_capture?.WaveFormat.Encoding == WaveFormatEncoding.IeeeFloat)
            {
                for (int i = 0; i < count; i += 4)
                {
                   if (i + 3 >= count) break;
                   float sample = BitConverter.ToSingle(buffer, i);
                   float abs = Math.Abs(sample);
                   if (abs > max) max = abs;
                }
            }
            else if (_capture?.WaveFormat.BitsPerSample == 24)
            {
                 for (int i = 0; i < count; i += 3)
                {
                   if (i + 2 >= count) break;
                   int sample = (buffer[i] << 8) | (buffer[i + 1] << 16) | (buffer[i + 2] << 24);
                   float abs = Math.Abs(sample / 2147483648f);
                   if (abs > max) max = abs;
                }
            }
            else 
            {
                 for (int i = 0; i < count; i += 2)
                {
                    if (i + 1 >= count) break;
                    short sample = BitConverter.ToInt16(buffer, i);
                    float abs = Math.Abs(sample) / 32768f;
                    if (abs > max) max = abs;
                }
            }

            AudioLevel = AudioLevel * 0.5f + max * 0.5f;
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
        private MMDevice GetSmartDefaultDevice(MMDeviceEnumerator enumerator)
        {
            try 
            {
                // 1. Try Windows Default (Console)
                var defaultDevice = enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Console);
                if (!IsStereoMix(defaultDevice)) return defaultDevice;

                Console.WriteLine($"[SmartDefault] Default 'Console' was {defaultDevice.FriendlyName} (Stereo Mix). Trying explicit fallback...");

                // 2. Try Communications Default
                try {
                    var commDevice = enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Communications);
                    if (!IsStereoMix(commDevice)) return commDevice;
                } catch {}

                // 3. Fallback: Find first ACTIVE device that is NOT Stereo Mix and has "Microphone" or typical name
                var allDevices = enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active);
                foreach(var device in allDevices)
                {
                     if (!IsStereoMix(device) && (device.FriendlyName.Contains("Microphone", StringComparison.OrdinalIgnoreCase) || device.FriendlyName.Contains("HyperX", StringComparison.OrdinalIgnoreCase) || device.FriendlyName.Contains("USB", StringComparison.OrdinalIgnoreCase)))
                     {
                         Console.WriteLine($"[SmartDefault] Selected Fallback: {device.FriendlyName}");
                         return device;
                     }
                }
                
                // 4. Last resort: just return original default if nothing else found
                return defaultDevice;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SmartDefault] Error selecting default: {ex.Message}");
                // Fallback to simpler logic
                return enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Console);
            }
        }

        private bool IsStereoMix(MMDevice? device)
        {
            if (device == null) return true; 
            var name = device.FriendlyName.ToLower();
            return name.Contains("mix") || name.Contains("loopback") || name.Contains("mistura"); // "Mistura" is Portuguese for Mix
        }
    private async Task AttemptReconnect()
        {
             Console.WriteLine($"[Mic] Attempting Reconnect for {_deviceId}...");
             await Task.Delay(2000); // Wait 2s
             try
             {
                 Stop();
                 _capture = null;
                 // Re-init handled by caller or we need self-init?
                 // Simple retry:
                 Initialize();
                 Start();
                 Console.WriteLine("[Mic] Reconnect Successful.");
             }
             catch (Exception ex)
             {
                 Console.WriteLine($"[Mic] Reconnect Failed: {ex.Message}");
                 // Recursive Retry with Backoff? For now just log.
             }
        }
    }
}
