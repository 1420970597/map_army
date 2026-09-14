"""共享连接池；一次请求的写入在同一事务中提交。"""

from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from .config import settings


@lru_cache
def engine():
    return create_engine(settings().database_url, pool_pre_ping=True, pool_recycle=1800)


def session():
    with Session(engine(), expire_on_commit=False) as db:
        with db.begin():
            yield db
