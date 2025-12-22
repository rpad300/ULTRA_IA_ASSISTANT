import site
import os
import sys

print("Python Executable:", sys.executable)
print("Site Packages:")
try:
    paths = site.getsitepackages()
    for p in paths:
        print(f" - {p}")
        nvidia_path = os.path.join(p, "nvidia")
        if os.path.exists(nvidia_path):
            print(f"   Found nvidia folder at: {nvidia_path}")
            for d in os.listdir(nvidia_path):
                print(f"     - {d}")
                bin_path = os.path.join(nvidia_path, d, "bin")
                if os.path.exists(bin_path):
                    print(f"       Bin path: {bin_path}")
                    # Check for DLLs
                    dlls = [f for f in os.listdir(bin_path) if f.endswith('.dll')]
                    print(f"       DLLs found: {len(dlls)} files")
                    if 'cudnn_ops64_9.dll' in dlls:
                         print("       !!! FOUND cudnn_ops64_9.dll !!!")
                    else:
                         print("       cudnn_ops64_9.dll NOT FOUND in this bin folder")
except Exception as e:
    print(f"Error checking site packages: {e}")

print("\nCurrent PATH:")
print(os.environ["PATH"])
