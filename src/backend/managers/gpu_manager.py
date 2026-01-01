
import torch
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class GPUManager:
    _instance = None

    def __init__(self):
        if hasattr(self, "initialized"):
            return
        self.initialized = True
        self.priority_index = 1  # Default preference for RTX 3090 (often at index 1 in dual setups)
        
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = GPUManager()
        return cls._instance

    def get_best_device(self, priority_index: int = 1) -> torch.device:
        """
        Determines the best available device (CUDA vs CPU).
        Ranked by:
        1. Availability of Priority Index (if healthy and has memory)
        2. Max Free Memory
        """
        if not torch.cuda.is_available():
            logger.warning("GPUManager: No CUDA devices found. Using CPU.")
            return torch.device("cpu")

        try:
            device_count = torch.cuda.device_count()
            candidates = []

            for i in range(device_count):
                try:
                    # mem_get_info returns (free, total) in bytes
                    free_mem, total_mem = torch.cuda.mem_get_info(i)
                    free_gb = free_mem / (1024**3)
                    total_gb = total_mem / (1024**3)
                    name = torch.cuda.get_device_name(i)
                    
                    candidates.append({
                        "index": i,
                        "name": name,
                        "free_gb": free_gb,
                        "total_gb": total_gb
                    })
                    
                    # Log telemetry
                    logger.info(f"GPUManager: Device {i} ({name}) - Free: {free_gb:.2f}GB / {total_gb:.2f}GB")
                    
                except Exception as e:
                    logger.error(f"GPUManager: Failed to query device {i}: {e}")

            if not candidates:
                return torch.device("cpu")

            # Sort by Free Memory (descending)
            candidates.sort(key=lambda x: x["free_gb"], reverse=True)

            best_gpu = candidates[0]

            # Logic: If priority index exists and has "enough" memory (e.g. > 4GB), prefer it.
            # Otherwise, stick to the one with most free memory.
            priority_candidate = next((c for c in candidates if c["index"] == priority_index), None)
            
            if priority_candidate:
                # If priority has at least 8GB free (arbitrary SOTA threshold for safety), take it.
                # Or if it's the winner anyway.
                if priority_candidate["free_gb"] > 8.0:
                    best_gpu = priority_candidate
                    logger.info(f"GPUManager: Priority Device {priority_index} selected (Healthy: {priority_candidate['free_gb']:.2f}GB free).")
                else:
                    logger.warning(f"GPUManager: Priority Device {priority_index} low on memory ({priority_candidate['free_gb']:.2f}GB). Switching to {best_gpu['index']} ({best_gpu['name']}).")
            
            selected_device = torch.device(f"cuda:{best_gpu['index']}")
            logger.info(f"GPUManager: Final Selection -> {selected_device} ({best_gpu['name']})")
            return selected_device

        except Exception as e:
            logger.error(f"GPUManager: Error during selection: {e}", exc_info=True)
            return torch.device("cpu")

    def get_best_device_index(self) -> int:
        dev = self.get_best_device()
        if dev.type == "cpu":
            return -1
        return dev.index if dev.index is not None else 0

def get_gpu_manager():
    return GPUManager.get_instance()
