import torch
import time

print(f"PyTorch Version: {torch.__version__}")
print(f"CUDA Available: {torch.cuda.is_available()}")

if torch.cuda.is_available():
    print(f"Device: {torch.cuda.get_device_name(0)}")
    
    print("Allocating tensor on GPU...")
    x = torch.rand(10000, 10000).cuda()
    y = torch.rand(10000, 10000).cuda()
    
    print("Performing Matrix Multiplication on GPU...")
    start = time.time()
    z = torch.matmul(x, y)
    end = time.time()
    
    print(f"Computation Done in {end - start:.4f} seconds.")
    print("GPU is definitely working!")
else:
    print("FATAL: GPU NOT DETECTED.")
