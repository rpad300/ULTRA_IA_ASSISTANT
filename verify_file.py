
import os
import glob

file_path = r"C:\Users\rdias\Documents\ULTRA_Assistant_AudioTest.wav"

print(f"Checking: {file_path}")
print(f"Exists: {os.path.exists(file_path)}")

if os.path.exists(file_path):
    print(f"Size: {os.path.getsize(file_path)} bytes")
    try:
        with open(file_path, 'rb') as f:
            print("Successfully opened for reading.")
    except Exception as e:
        print(f"Error opening file: {e}")
else:
    parent = os.path.dirname(file_path)
    print(f"Parent: {parent}")
    if os.path.exists(parent):
        print(f"Parent exists. Listing parent content (first 20):")
        print(os.listdir(parent)[:20])
        # Check for similar files
        print("Looking for similar WAV files:")
        print(glob.glob(os.path.join(parent, "*.wav")))
    else:
        print("Parent does not exist.")
