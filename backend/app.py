import os
import uvicorn

# ZeroGPU requires @spaces.GPU to be defined in app.py
try:
    import spaces
    @spaces.GPU
    def _gpu_worker():
        pass
except Exception:
    pass

# Prevent torchaudio C++ extension load failure on cloud platforms (Render, Hugging Face Spaces)
import sys
import types
if "torchaudio._extension" not in sys.modules:
    _ext_mod = types.ModuleType("torchaudio._extension")
    _ext_mod._IS_TORCHAUDIO_EXT_AVAILABLE = False
    _ext_mod._check_cuda_version = lambda: None
    _ext_mod.fail_if_no_align = lambda x: x
    sys.modules["torchaudio._extension"] = _ext_mod

from main import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
