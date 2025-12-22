using NAudio.Wave;
using System;

namespace AudioStreamingService.AudioPipeline
{
    public interface IAudioSource : IDisposable
    {
        event EventHandler<ArraySegment<byte>>? AudioDataAvailable;
        event EventHandler<string>? ErrorOccurred;

        void Start();
        void Stop();

        float AudioLevel { get; }
        WaveFormat WaveFormat { get; }
        string DeviceName { get; }
    }
}
