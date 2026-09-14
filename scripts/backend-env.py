#!/usr/bin/env python3
"""生成本机配置；不覆盖现有文件，不在终端显示密码。"""
from pathlib import Path
import secrets

root = Path(__file__).resolve().parents[1]
path = root / '.env'
if path.exists():
    print('.env 已存在，保留现有配置。')
else:
    sql, admin, s3secret = [secrets.token_hex(24) for _ in range(3)]
    path.write_text(f'MYSQL_PASSWORD={sql}\nMYSQL_ROOT_PASSWORD={admin}\nS3_ACCESS_KEY=maparmy-local\nS3_SECRET_KEY={s3secret}\n'
                    f'DATABASE_URL=mysql+pymysql://map_army:{sql}@127.0.0.1:33080/map_army\n'
                    'S3_ENDPOINT=http://127.0.0.1:39000\nS3_BUCKET=map-army\nCOOKIE_SECURE=false\n')
    path.chmod(0o600)
    print('已生成仅当前用户可读的 .env。')
