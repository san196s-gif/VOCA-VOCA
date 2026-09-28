import os
import shutil
import platform
import subprocess
from typing import Dict, Any
from pathlib import Path

def detect_hardware() -> Dict[str, Any]:
    info: Dict[str, Any] = {
        "os": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "cpu": {
            "cores_logical": os.cpu_count() or 4,
            "architecture": platform.machine()
        },
        "ram": {
            "total_gb": 8.0,
            "available_gb": 4.0
        },
        "gpu": {
            "available": False,
            "cuda_available": False,
            "name": "None",
            "vram_gb": 0.0,
            "device_count": 0
        },
        "storage": {
            "free_gb": 20.0,
            "total_gb": 100.0
        },
        "ffmpeg": {
            "available": False,
            "version": "Not detected"
        },
        "recommended_profile": "cpu_balanced"
    }

    # Detect RAM via psutil if available
    try:
        import psutil
        mem = psutil.virtual_memory()
        info["ram"]["total_gb"] = round(mem.total / (1024**3), 2)
        info["ram"]["available_gb"] = round(mem.available / (1024**3), 2)
    except Exception:
        pass

    # Detect disk space
    try:
        disk_path = Path.cwd()
        total, used, free = shutil.disk_usage(disk_path)
        info["storage"]["free_gb"] = round(free / (1024**3), 2)
        info["storage"]["total_gb"] = round(total / (1024**3), 2)
    except Exception:
        pass

    # Detect CUDA / GPU via PyTorch if available
    try:
        import torch
        if torch.cuda.is_available():
            info["gpu"]["cuda_available"] = True
            info["gpu"]["available"] = True
            info["gpu"]["device_count"] = torch.cuda.device_count()
            info["gpu"]["name"] = torch.cuda.get_device_name(0)
            props = torch.cuda.get_device_properties(0)
            info["gpu"]["vram_gb"] = round(props.total_memory / (1024**3), 2)
    except Exception:
        # Fallback to nvidia-smi check
        try:
            res = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=2
            )
            if res.returncode == 0 and res.stdout.strip():
                parts = res.stdout.strip().split(",")
                info["gpu"]["available"] = True
                info["gpu"]["name"] = parts[0].strip()
                if len(parts) > 1:
                    info["gpu"]["vram_gb"] = round(float(parts[1].strip()) / 1024, 2)
        except Exception:
            pass

    # Detect FFmpeg
    ffmpeg_path = shutil.which("ffmpeg")
    if ffmpeg_path:
        info["ffmpeg"]["available"] = True
        try:
            res = subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=2)
            first_line = res.stdout.split("\n")[0] if res.stdout else "Available"
            info["ffmpeg"]["version"] = first_line
        except Exception:
            info["ffmpeg"]["version"] = "Installed"
    else:
        info["ffmpeg"]["available"] = False

    # Recommend model profile
    vram = info["gpu"]["vram_gb"]
    ram = info["ram"]["total_gb"]
    if info["gpu"]["cuda_available"] and vram >= 8.0:
        info["recommended_profile"] = "gpu_high_precision"
        info["stt_model"] = "large-v3"
        info["compute_type"] = "float16"
    elif info["gpu"]["cuda_available"] and vram >= 4.0:
        info["recommended_profile"] = "gpu_medium"
        info["stt_model"] = "medium"
        info["compute_type"] = "float16"
    elif ram >= 16.0:
        info["recommended_profile"] = "cpu_fast"
        info["stt_model"] = "small"
        info["compute_type"] = "int8"
    else:
        info["recommended_profile"] = "cpu_light"
        info["stt_model"] = "small"
        info["compute_type"] = "int8"

    return info

hardware_profile = detect_hardware()
