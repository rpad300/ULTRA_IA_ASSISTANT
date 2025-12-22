
import os
import sys

# The expected path
target_path = r"C:\Users\rdias\Documents\ULTRA_Assistant_AudioTest.wav"

print(f"Checking path: {target_path}")
print(f"Exists? {os.path.exists(target_path)}")

if not os.path.exists(target_path):
    parent = os.path.dirname(target_path)
    print(f"Parent: {parent}")
    print(f"Parent Exists? {os.path.exists(parent)}")
    if os.path.exists(parent):
        print(f"Parent contents: {os.listdir(parent)[:10]}")
    
