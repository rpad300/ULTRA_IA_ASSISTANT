
import os

log_file = r"src\backend\backend_auth.log"
output_file = "debug_log_extract.txt"

if os.path.exists(log_file):
    with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
        # Seek to end minus 10KB
        f.seek(0, 2)
        size = f.tell()
        f.seek(max(0, size - 10000))
        lines = f.readlines()
        
    with open(output_file, "w", encoding="utf-8") as out:
        for line in lines:
            out.write(line)
            
    print(f"Wrote {len(lines)} lines to {output_file}")
else:
    print("Log file not found")
