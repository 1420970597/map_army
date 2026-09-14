"""FastAPI 应用入口；路由共享错误契约与依赖健康检查。"""

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from . import assets, exchange, model_assets, projects, shares, workspaces
from .config import settings
from .db import engine
from .storage import s3

app = FastAPI(title="map.army API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
for router in (
    workspaces.router,
    projects.router,
    shares.router,
    assets.router,
    exchange.router,
    model_assets.router,
):
    app.include_router(router)


@app.middleware("http")
async def limits(request: Request, call_next):
    length = request.headers.get("content-length", "0")
    if not length.isdigit() or int(length) > settings().max_file_bytes + 1024 * 1024:
        return JSONResponse({"error": "请求超过大小限制"}, status_code=413)
    maximum = (
        settings().max_document_bytes
        if request.headers.get("content-type", "").startswith("application/json")
        else settings().max_file_bytes + 1024 * 1024
    )
    # 在 multipart 解析和临时文件落盘前也限制无 Content-Length 的分块请求。
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > maximum:
            return JSONResponse({"error": "请求超过大小限制"}, status_code=413)
    request._body = bytes(body)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    if "Cache-Control" not in response.headers:
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return JSONResponse(
        {"error": "请求参数无效", "fields": [{"path": e["loc"], "message": e["msg"]} for e in exc.errors()]},
        status_code=422,
    )


async def dependency_error(request, exc):
    return JSONResponse({"error": "数据服务暂时不可用，请保留当前修改并重试"}, status_code=503)


for error_type in (SQLAlchemyError, BotoCoreError, ClientError):
    app.add_exception_handler(error_type, dependency_error)


@app.get("/api/health")
def health():
    with engine().connect() as conn:
        conn.execute(text("SELECT 1"))
        version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    s3().head_bucket(Bucket=settings().s3_bucket)
    return {"status": "ok", "database": "mysql", "storage": "s3", "schema": version}
