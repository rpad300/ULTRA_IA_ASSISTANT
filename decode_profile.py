
import numpy as np

# The raw string from inspect_profile.py (first chunk)
raw_hex = "3835353330356331373934633632633062663138386663316235626162316330356663343630343134343639666334303061346438616331316562313932626635623436263383430393061343661343238623235656663316535316464616330363964653135343161343931643334313636346361396266353661333064633238636137633063303530646"

def try_decode(s):
    print(f"Input length: {len(s)}")
    
    # Step 1: Decode the outer hex (Postgres bytea -> Bytes)
    try:
        level1_bytes = bytes.fromhex(s)
        print(f"Level 1 decode success. Type: {type(level1_bytes)}, Len: {len(level1_bytes)}")
        print(f"Level 1 Preview: {level1_bytes[:50]}")
    except Exception as e:
        print(f"Level 1 failed: {e}")
        return

    # Check if level1_bytes looks like an ASCII string of hex digits
    try:
        level1_str = level1_bytes.decode('utf-8')
        print(f"Level 1 as string: {level1_str[:50]}...")
        
        # Step 2: Decode the inner hex (Hex String -> Embedding Bytes)
        level2_bytes = bytes.fromhex(level1_str)
        print(f"Level 2 decode success. Len: {len(level2_bytes)}")
        
        # Try converting to numpy
        arr = np.frombuffer(level2_bytes, dtype=np.float32)
        print(f"Numpy Array Shape: {arr.shape}")
        print(f"Numpy Array Preview: {arr[:5]}")
        
    except Exception as e:
        print(f"Level 2 failed: {e}")

try_decode(raw_hex)
