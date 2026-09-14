#!/usr/bin/env python3
"""从真实 HTTP 入口验证持久化与独立转换任务，访问凭证只写入私有临时文件。"""
import argparse
import json
import os
import time
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('phase', choices=['create', 'verify'])
parser.add_argument('--url', default='http://127.0.0.1:8080')
parser.add_argument('--state', type=Path, required=True)
args = parser.parse_args()
token = ''


def request(path, data=None, method=None, content_type='application/json'):
    payload = json.dumps(data).encode() if data is not None and content_type == 'application/json' else data
    req = urllib.request.Request(args.url + path, data=payload, method=method, headers={'Content-Type': content_type, 'X-Workspace-Token': token})
    with urllib.request.urlopen(req, timeout=60) as response:
        body = response.read()
        return json.loads(body) if 'json' in response.headers.get('Content-Type', '') else body


assert request('/api/health')['database'] == 'mysql'
assert b'<html' in request('/')
if args.phase == 'create':
    owner = request('/api/workspaces', {'name': '部署持久化验收'})
    token = owner['token']
    doc = {'schemaVersion': 1, 'name': '重启验收', 'createdAt': 1, 'updatedAt': 1, 'layers': [], 'features': []}
    project = request('/api/projects', {'document': doc})
    geometry = b'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'
    boundary = 'maparmy-smoke-boundary'
    multipart = (f'--{boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\nmodel-source\r\n--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="triangle.obj"\r\nContent-Type: text/plain\r\n\r\n'.encode() + geometry + f'\r\n--{boundary}--\r\n'.encode())
    source = request('/api/assets', multipart, 'POST', f'multipart/form-data; boundary={boundary}')
    job = request('/api/model-imports', {'assetId': source['id'], 'name': '部署转换验收'})
    for _ in range(60):
        found = next(item for item in request('/api/model-imports') if item['id'] == job['id'])
        if found['status'] in ('complete', 'failed'):
            break
        time.sleep(1)
    assert found['status'] == 'complete', found.get('error', '转换未完成')
    model = found['result']
    with os.fdopen(os.open(args.state, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as output:
        json.dump({'token': token, 'project': project['id'], 'asset': model['url'], 'source': source['url']}, output)
    print('HTTP 创建项目、S3 上传、独立 Blender worker 转换均通过。')
else:
    state = json.loads(args.state.read_text())
    token = state['token']
    assert request('/api/projects/' + state['project'])['document']['name'] == '重启验收'
    assert request(state['asset'])[:4] == b'glTF'
    assert b'f 1 2 3' in request(state['source'])
    args.state.unlink()
    print('重启后项目、原始文件、转换模型仍可读取；临时访问凭证已清理。')
