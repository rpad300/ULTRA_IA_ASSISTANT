import torch
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

def get_best_gpu_indices() -> List[int]:
    """
    Analyses available GPUs and ranks them by performance (VRAM + Compute Capability).
    Returns a list of indices sorted from most powerful to least powerful.
    
    This implements "Hardware Awareness" to automatically select the best device (e.g., RTX 3090)
    for heavy inference tasks like Whisper or LLMs.
    """
    if not torch.cuda.is_available():
        logger.warning("No CUDA GPUs detected. Falling back to CPU strategies.")
        return []

    gpu_list: List[Dict[str, Any]] = []
    device_count = torch.cuda.device_count()

    for i in range(device_count):
        try:
            props = torch.cuda.get_device_properties(i)
            # SOTA Metric: VRAM is the most critical factor for loading large models (Large-v3, LLMs)
            # We also consider Compute Capability (Architecture generation)
            # props.total_memory is in bytes
            vram_mb = props.total_memory / (1024**2)
            
            score = {
                "index": i,
                "name": props.name,
                "total_memory_mb": vram_mb, 
                "compute_capability": f"{props.major}.{props.minor}",
                "multi_processor_count": props.multi_processor_count
            }
            gpu_list.append(score)
            logger.debug(f"GPU Candidate [{i}]: {props.name} | {vram_mb:.0f}MB | SMs: {props.multi_processor_count}")
        except Exception as e:
            logger.warning(f"Failed to get properties for GPU {i}: {e}")

    # Sorting Logic (SOTA):
    # 1. Total Memory (Descending) - More VRAM = Larger Models / Batches
    # 2. Multi Processor Count (Descending) - More Cores = Faster Inference
    gpu_list.sort(key=lambda x: (x["total_memory_mb"], x["multi_processor_count"]), reverse=True)

    if not gpu_list:
        return []

    best_gpu = gpu_list[0]
    logger.info(f"🏆 SOTA Auto-Selected Best GPU: [{best_gpu['index']}] {best_gpu['name']} ({best_gpu['total_memory_mb']:.0f}MB VRAM)")

    return [gpu["index"] for gpu in gpu_list]
