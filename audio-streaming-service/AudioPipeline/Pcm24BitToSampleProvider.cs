using NAudio.Wave;
using System;

namespace AudioStreamingService.AudioPipeline
{
    /// <summary>
    /// Helper to convert 24-bit PCM to IEEE Float (SampleProvider)
    /// </summary>
    public class Pcm24BitToSampleProvider : ISampleProvider
    {
        private readonly IWaveProvider source;
        public WaveFormat WaveFormat { get; }

        public Pcm24BitToSampleProvider(IWaveProvider source)
        {
            this.source = source;
            this.WaveFormat = WaveFormat.CreateIeeeFloatWaveFormat(source.WaveFormat.SampleRate, source.WaveFormat.Channels);
        }

        public int Read(float[] buffer, int offset, int count)
        {
            // 24-bit = 3 bytes per sample
            int bytesNeeded = count * 3;
            byte[] sourceBuffer = new byte[bytesNeeded];
            int bytesRead = source.Read(sourceBuffer, 0, bytesNeeded);
            int samplesRead = bytesRead / 3;

            for (int n = 0; n < samplesRead; n++)
            {
                // 24-bit LE: [0] = LSB, [1] = Mid, [2] = MSB
                // Bit 23 is the sign bit.
                // Shift LSB to pos 8, Mid to 16, MSB to 24 (total 32 bit space).
                int sample32 = (sourceBuffer[n * 3] << 8) | (sourceBuffer[n * 3 + 1] << 16) | (sourceBuffer[n * 3 + 2] << 24);
                
                // Normalize to -1.0..1.0
                buffer[offset + n] = sample32 / 2147483648f;
            }
            return samplesRead;
        }
    }
}
