import os
import site
import time

print("Debugging NVIDIA DLL Path Search...")

if os.name == 'nt':
    try:
        start_time = time.time()
        print("Getting site packages...")
        packages = site.getsitepackages()
        print(f"Found packages: {packages}")
        
        found_nvidia = False
        for site_pkg in packages:
            nvidia_path = os.path.join(site_pkg, "nvidia")
            print(f"Checking {nvidia_path}...")
            if os.path.exists(nvidia_path):
                print(f"Found NVIDIA path: {nvidia_path}")
                found_nvidia = True
                # Add all subdirectories with a 'bin' folder (cudnn, cublas, etc.)
                for directory in os.listdir(nvidia_path):
                    print(f"  Scanning subdir: {directory}")
                    bin_path = os.path.join(nvidia_path, directory, "bin")
                    if os.path.exists(bin_path):
                        print(f"    Adding to PATH: {bin_path}")
                        os.environ["PATH"] = bin_path + os.pathsep + os.environ["PATH"]
                        if hasattr(os, 'add_dll_directory'):
                            try:
                                os.add_dll_directory(bin_path)
                            except Exception as e:
                                print(f"    Failed to add dll directory: {e}")
        
        if not found_nvidia:
            print("WARNING: 'nvidia' package not found in site-packages.")
            
        print(f"Done in {time.time() - start_time:.2f}s")
            
    except Exception as e:
        print(f"Failed to add NVIDIA DLL paths: {e}")
else:
    print("Not Windows, skipping.")
