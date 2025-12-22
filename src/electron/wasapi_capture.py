#!/usr/bin/env python3
"""
WASAPI Loopback Capture using sounddevice
Captures system audio (loopback) without needing native compilation
"""

import sys
import argparse
import sounddevice as sd
import numpy as np

def capture_loopback(sample_rate=16000, channels=1):
    """Capture audio from default output device (loopback)"""
    
    try:
        # List all devices to find loopback
        devices = sd.query_devices()
        default_output = sd.default.device[1]
        
        if default_output is None:
            print("Error: No default output device found", file=sys.stderr)
            sys.exit(1)
        
        device_info = devices[default_output]
        print(f"Default output device: {default_output} - {device_info['name']}", file=sys.stderr)
        print(f"Device info: {device_info}", file=sys.stderr)
        
        # For loopback, we need to use the device as input
        # But first, check what channels it supports
        # Most output devices are stereo (2 channels)
        device_channels = device_info.get('max_input_channels', 0)
        
        # If device doesn't support input (output only), we can't capture from it directly
        # We need to use a different approach - use the device's default format
        if device_channels == 0:
            # Try to use the device anyway - sounddevice might handle it
            # Use stereo (2 channels) as that's what most output devices are
            input_channels = 2
            print(f"Device is output-only, using {input_channels} channels (will convert to mono)", file=sys.stderr)
        else:
            # Use the device's supported input channels, but limit to 2 (stereo)
            input_channels = min(device_channels, 2)
            print(f"Device supports {device_channels} input channels, using {input_channels}", file=sys.stderr)
        
        # Get device's default sample rate
        device_samplerate = device_info.get('default_samplerate', sample_rate)
        if device_samplerate != sample_rate:
            print(f"Device sample rate: {device_samplerate}, requested: {sample_rate}", file=sys.stderr)
            print(f"Using device sample rate: {device_samplerate}", file=sys.stderr)
            actual_samplerate = int(device_samplerate)
        else:
            actual_samplerate = sample_rate
        
        print(f"Final config: {actual_samplerate} Hz, {input_channels} channels (will convert to {channels})", file=sys.stderr)
        
        # Create callback function
        def audio_callback(indata, frames, time, status):
            if status:
                print(f"Warning: {status}", file=sys.stderr)
                return
            
            # Convert to int16 PCM
            # indata is float32 in range [-1.0, 1.0]
            audio_data = (indata * 32767).astype(np.int16)
            
            # Convert to mono if needed
            if channels == 1 and audio_data.shape[1] > 1:
                # Average channels to mono
                audio_data = audio_data.mean(axis=1, dtype=np.int16)
            elif channels == 1 and audio_data.shape[1] == 1:
                # Already mono, just flatten
                audio_data = audio_data.flatten()
            
            # Resample if needed (simple linear interpolation for now)
            if actual_samplerate != sample_rate:
                # Simple downsampling: take every Nth sample
                ratio = actual_samplerate / sample_rate
                if ratio > 1:
                    indices = np.arange(0, len(audio_data), ratio, dtype=np.int32)
                    audio_data = audio_data[indices]
            
            # Write to stdout as binary
            sys.stdout.buffer.write(audio_data.tobytes())
            sys.stdout.buffer.flush()
        
        # Try to open stream
        # Use the device as input (for loopback, we capture what's being played)
        try:
            with sd.InputStream(
                device=default_output,
                channels=input_channels,  # Use device's native channel count
                samplerate=actual_samplerate,  # Use device's native sample rate
                dtype='float32',
                callback=audio_callback,
                blocksize=int(actual_samplerate * 0.1),  # 100ms blocks
            ):
                print("WASAPI capture started. Press Ctrl+C to stop.", file=sys.stderr)
                sd.sleep(1000000)  # Run for a long time
        except sd.PortAudioError as e:
            # If direct capture fails, try using a virtual device or different approach
            print(f"Error opening stream: {e}", file=sys.stderr)
            print("Note: Direct loopback capture may not be supported by this device.", file=sys.stderr)
            print("Consider using Stereo Mix or VB-Audio Cable for system audio capture.", file=sys.stderr)
            sys.exit(1)
        except KeyboardInterrupt:
            print("\nStopping capture...", file=sys.stderr)
        except Exception as e:
            print(f"Error during capture: {e}", file=sys.stderr)
            sys.exit(1)
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='WASAPI Loopback Capture')
    parser.add_argument('--sample-rate', type=int, default=16000, help='Sample rate (Hz)')
    parser.add_argument('--channels', type=int, default=1, help='Number of channels')
    
    args = parser.parse_args()
    
    capture_loopback(args.sample_rate, args.channels)

