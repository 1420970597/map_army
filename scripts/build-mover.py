"""为本机与 CI 编译独立几何内核。"""

import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1] / "backend/mover"
sources = [root / "native" / file for file in ("main.cpp", "GeometryObjFile.cpp", "ObjPointCollection.cpp")]
subprocess.run(["g++", "-std=c++17", "-O2", *map(str,sources), "-o", str(root / "mover-kernel")],check=True)
