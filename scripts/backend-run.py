#!/usr/bin/env python3
"""开发命令优先使用项目虚拟环境，保持 API 与测试解释器一致。"""
import os
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
python = str(root / '.venv/bin/python') if (root / '.venv/bin/python').exists() else sys.executable
mode = sys.argv[1] if len(sys.argv) > 1 else 'api'
commands = {
    'api': [['uvicorn', 'backend.app.main:app', '--host', '127.0.0.1', '--port', '30881']],
    'worker': [['backend.app.worker']],
    'check': [['ruff', 'check', 'backend'], ['ruff', 'format', '--check', 'backend'], ['pytest', 'backend/tests', '-q']],
}
os.chdir(root)
for args in commands[mode]:
    result = subprocess.run([python, '-m', *args])
    if result.returncode:
        sys.exit(result.returncode)
