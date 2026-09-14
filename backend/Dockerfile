# 保留经过现有格式回归验证的无状态 Node 工具，持久化服务仅由 Python 提供。
FROM node:22-bookworm-slim AS tools
WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY scripts/build-backend-tool.mjs scripts/
COPY backend/compat backend/compat
COPY src src
RUN node scripts/build-backend-tool.mjs

FROM python:3.13-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt && useradd --create-home --uid 10001 app
COPY --from=tools /usr/local/bin/node /usr/local/bin/node
COPY --from=tools /build/backend/tool backend/tool
COPY backend backend
COPY public/models public/models
USER app
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=8s --start-period=15s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=5)"
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]

FROM runtime AS worker
USER root
RUN apt-get update && apt-get install -y --no-install-recommends blender python3-numpy && rm -rf /var/lib/apt/lists/*
USER app
HEALTHCHECK NONE
CMD ["python", "-m", "backend.app.worker"]
