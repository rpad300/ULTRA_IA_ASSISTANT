import sys
import time
import urllib.request
import urllib.error
import argparse

def wait_for_service(url, timeout=60, name="Service"):
    """
    Polls a service URL until it returns a 200 OK status or timeout is reached.
    """
    start_time = time.time()
    print(f"[ULTRA OS] Waiting for {name} at {url} (Timeout: {timeout}s)...")
    
    while True:
        try:
            with urllib.request.urlopen(url) as response:
                if response.getcode() == 200:
                    print(f"[ULTRA OS] SUCCESS: {name} is up and running!")
                    return True
        except urllib.error.URLError:
            pass
        except Exception as e:
            print(f"[ULTRA OS] Warning: Error checking {name}: {e}")

        if time.time() - start_time > timeout:
            print(f"[ULTRA OS] ERROR: Timeout waiting for {name}!")
            return False
            
        time.sleep(1)
        print(".", end="", flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Wait for a service to become available.")
    parser.add_argument("url", help="Service URL to poll")
    parser.add_argument("--timeout", type=int, default=60, help="Timeout in seconds")
    parser.add_argument("--name", default="Service", help="Display name of the service")
    
    args = parser.parse_args()
    
    success = wait_for_service(args.url, args.timeout, args.name)
    sys.exit(0 if success else 1)
