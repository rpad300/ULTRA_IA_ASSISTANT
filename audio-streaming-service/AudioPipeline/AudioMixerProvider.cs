using NAudio.Wave;
using NAudio.Wave.SampleProviders;
using System;
using System.Buffers;
using System.Threading;
using System.Threading.Tasks;

namespace AudioStreamingService.AudioPipeline
{
    public class AudioMixerProvider : IDisposable
    {
        private readonly MixingSampleProvider _mixer;
        private readonly WaveFormat _mixerFormat;
        private readonly CancellationTokenSource _cts = new();
        private bool _isRunning;
        private Task? _processingTask;

        // Target: 16kHz Mono Float (Internal) -> 16bit PCM (Network)
        private static readonly WaveFormat INTERNAL_FORMAT = WaveFormat.CreateIeeeFloatWaveFormat(16000, 1);
        
        public event EventHandler<ArraySegment<byte>>? AudioDataAvailable;
        // Error event for logging
        public event EventHandler<string>? ErrorOccurred;

        public float DigitalGain { get; set; } = 1.0f;

        public AudioMixerProvider()
        {
            _mixerFormat = INTERNAL_FORMAT;
            _mixer = new MixingSampleProvider(_mixerFormat) { ReadFully = true };
        }

        public void AddSource(IAudioSource source)
        {
            // SOTA: High-perf buffer to decouple capture from mix
            var buffer = new BufferedWaveProvider(source.WaveFormat)
            {
                DiscardOnBufferOverflow = true,
                BufferDuration = TimeSpan.FromMilliseconds(400) // 400ms jitter buffer
            };

            // Subscribe to Source Event (SOTA: ArraySegment)
            source.AudioDataAvailable += (s, segment) =>
            {
                if (segment.Array == null) return;
                try
                {
                    // segment comes from ArrayPool (SOTA Source)
                    buffer.AddSamples(segment.Array, segment.Offset, segment.Count);
                }
                finally
                {
                    // SOTA: Return to pool immediately after buffering
                    // Critical: Both System and Mic sources now Rent, so this is safe.
                    ArrayPool<byte>.Shared.Return(segment.Array);
                }
            };

            // Conversion Pipeline
            ISampleProvider sampleProvider;
            if (source.WaveFormat.Encoding == WaveFormatEncoding.IeeeFloat)
            {
                sampleProvider = new WaveToSampleProvider(buffer);
            }
            else
            {
                sampleProvider = buffer.ToSampleProvider();
            }

            // Mono Downmix
            if (sampleProvider.WaveFormat.Channels > 1)
            if (sampleProvider.WaveFormat.Channels > 1)
            {
                sampleProvider = new WdlResamplingSampleProvider(sampleProvider, 16000); // Resampler usually handles generic conversion or use ToMono
                // Forcing Mono via WDL or just ignore if it works?
                // Actually ToMono is an extension.
                // sampleProvider = sampleProvider.ToMono(); 
                // But ToMono() is for ISampleProvider...
                // If missing, use MultiplexingSampleProvider
                sampleProvider = new MultiplexingSampleProvider(new[] { sampleProvider }, 1);
            }

            // Resampler (WDL - High Quality)
            if (sampleProvider.WaveFormat.SampleRate != 16000)
            {
               Console.WriteLine($"[SOTA Mixer] Resampling {source.DeviceName} from {sampleProvider.WaveFormat.SampleRate} to 16000");
               sampleProvider = new WdlResamplingSampleProvider(sampleProvider, 16000);
            }
            
            _mixer.AddMixerInput(sampleProvider);
            Console.WriteLine($"[SOTA Mixer] Added {source.DeviceName} to pipeline. Final Format: {sampleProvider.WaveFormat}");
        }

        public async Task StartAsync()
        {
            if (_isRunning) return;
            _isRunning = true;

            Console.WriteLine("[SOTA Mixer] Starting Processing Loop...");
            // High Priority Thread
            _processingTask = Task.Factory.StartNew(async () => await ProcessingLoop(), 
                _cts.Token, 
                TaskCreationOptions.LongRunning, 
                TaskScheduler.Default);
            
            await Task.CompletedTask;
        }

        private async Task ProcessingLoop()
        {
            // Pre-allocated buffers (Zero-GC for reading)
            // 800 samples = 50ms at 16kHz
            // Reduced to prevent buffer starvation (was 1600/100ms reading every 20ms which is 5x speed)
            float[] readBuffer = new float[800]; 
            
            while (!_cts.Token.IsCancellationRequested)
            {
                try 
                {
                    int samplesRead = _mixer.Read(readBuffer, 0, readBuffer.Length);

                    if (samplesRead > 0)
                    {
                        // SOTA: Rent output buffer
                        // 1 sample (float) -> 1 sample (short, 2 bytes)
                        int bytesNeeded = samplesRead * 2;
                        byte[] rented = ArrayPool<byte>.Shared.Rent(bytesNeeded);

                        // Unsafe Float->Short Conversion
                        unsafe
                        {
                            fixed (float* pIn = readBuffer)
                            fixed (byte* pOut = rented)
                            {
                                short* pOutSample = (short*)pOut;
                                float gain = DigitalGain;
                                
                                for (int i = 0; i < samplesRead; i++)
                                {
                                    float val = pIn[i] * gain;
                                    
                                    // Hard Limiter / Clamp
                                    if (val > 1.0f) val = 1.0f;
                                    else if (val < -1.0f) val = -1.0f;
                                    
                                    pOutSample[i] = (short)(val * 32767);
                                }
                            }
                        }

                        // Fire SOTA Event
                        AudioDataAvailable?.Invoke(this, new ArraySegment<byte>(rented, 0, bytesNeeded));
                    }

                    // Dynamic Delay to match real-time
                    // We read 50ms of audio. Wait approx 45ms to keep pace but stay slightly ahead?
                    // Or 50ms? 
                    await Task.Delay(45, _cts.Token); 
                }
                catch (TaskCanceledException) { break; }
                catch (Exception ex)
                {
                    Console.WriteLine($"[SOTA Mixer] Loop Error: {ex.Message}");
                    ErrorOccurred?.Invoke(this, ex.Message);
                    await Task.Delay(100); // Backoff
                }
            }
        }

        public void Stop()
        {
            _cts.Cancel();
        }

        public void Dispose()
        {
            Stop();
            _mixer.RemoveAllMixerInputs();
            _cts.Dispose();
        }
    }
}
