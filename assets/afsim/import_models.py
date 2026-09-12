#!/usr/bin/env python3
"""从本机 AFSIM 模型索引生成可审计的模型目录，不复制受限原始资产。"""
from __future__ import annotations
import json, re
from pathlib import Path

AFSIM = Path('/root/afsim/afsim2.9-data/resources/models')
OUT = Path(__file__).resolve().parents[2] / 'public/models/afsim/manifest.json'
TS_OUT = Path(__file__).resolve().parents[2] / 'src/core/model/afsimCatalog.ts'
RESTRICTED = {
    'f16','f15c','f15e','kc46','kc46ext','b52','b2','f22','agm109','mig29','mk82','mk82_hd','mk82_hd_ballute',
    'aim9m','aim9x','aim120b','aim120c','zuni','e3_awacs','c130','b767','b777','f35','typhoon','globalhawk','lcaat',
    'ucav','reaper','j10','su27','j11','tu95','tu16','h6','luyang','ea18','chaff','flare','zell-booster','tnk-f16-370g',
    'tnk-f15c-600g','tnk-f15e-600g','iridium','gps','wgs-sat',
}
ALLOWED = {
    'rosetta_satellite': ('rosettasat.osgb', 'BrianJ & Chris Lauel, Celestia Motherlode: http://www.celestiamotherlode.net/catalog/spacecraft.php'),
    'cubesat': ('cubesat.osgb', 'Chris Meany, NASA: https://nasa3d.arc.nasa.gov/detail/cubesat-1RU'),
    'cubesat2': ('cubesat2.osgb', 'Chris Meany, NASA: https://nasa3d.arc.nasa.gov/detail/cubesat-2RU'),
    'stereo_satellite': ('stereosat.osgb', 'Chris Meany, NASA: https://nasa3d.arc.nasa.gov/detail/stereo'),
    'rocket': ('rocket.osgb', 'Michael Carbajal, NASA Headquarters: https://nasa3d.arc.nasa.gov/detail/ares1-c2'),
    'space_shuttle_atlantis': ('spaceshuttleatlantis.osgb', 'Anonymous, NASA Johnson Space Center: https://nasa3d.arc.nasa.gov/detail/shuttle-hi-res'),
}

def scalar(line: str):
    parts = line.split()
    return parts[1] if len(parts) > 1 else None

def number(value: str):
    try: return float(value)
    except ValueError: return value

def parse(path: Path):
    rows = []
    current = None
    transform = []
    engines = []
    active_engine = None
    for raw in path.read_text(errors='replace').splitlines():
        line = raw.strip()
        if not line or line.startswith('#'): continue
        if line.startswith('model '):
            if current: rows.append(current)
            current = {'name': line.split(None, 1)[1], 'category': 'Unknown', 'sourcePath': None, 'transform': [], 'wingTip': None, 'engines': []}
            continue
        if current is None: continue
        if line == 'end_model':
            rows.append(current); current = None; continue
        if line.startswith('category '): current['category'] = scalar(line); continue
        if line.startswith('filename '): current['sourcePath'] = scalar(line); continue
        if line.startswith('set '): current['variant'] = scalar(line); continue
        if line == 'default_set': current['defaultSet'] = True; continue
        if line.startswith('wing_tip '): current['wingTip'] = [number(x) for x in line.split()[1:4]]; continue
        if line.startswith('pre_xform'): transform = []; continue
        if line == 'end_pre_xform': current['transform'] = transform; continue
        if line.startswith('scale '): transform.append({'kind':'scale','value':number(line.split()[1])}); continue
        if line.startswith('translate '): transform.append({'kind':'translate','value':[number(x) for x in line.split()[1:4]]}); continue
        if line.startswith('rotate '): transform.append({'kind':'rotate','axis':line.split()[1],'degrees':number(line.split()[2])}); continue
        if line == 'engine': active_engine = {}; continue
        if line == 'end_engine':
            if active_engine: current['engines'].append(active_engine)
            active_engine = None; continue
        if active_engine is not None and line.startswith('position '): active_engine['position'] = [number(x) for x in line.split()[1:4]]; continue
        if active_engine is not None and line.startswith('diameter '): active_engine['diameter'] = number(line.split()[1]); continue
    if current: rows.append(current)
    return rows

def stem(name: str):
    name = name.lower().replace('_', '-')
    for suffix in ('-high','-low','-hi','-lo','-icon','-tan','-dk','-wht','-zh','-jm','-aj','-ww','-nb','-iriaf','-rus','-stowed','-ret','-ext','-hd','-ballute'):
        name = name.removesuffix(suffix)
    return name

def equipment_type(category: str, name: str) -> str:
    """把 AFSIM 类别归一化为页面可筛选的装备类型。"""
    value = f'{category} {name}'.lower()
    if category.lower() == 'space' or 'satellite' in value:
        return 'space'
    if category.lower() == 'weapon' or 'missile' in value or 'bomb' in value:
        return 'weapon'
    if 'aircraft' in value or 'bomber' in value or 'fighter' in value:
        return 'aircraft'
    if 'helicopter' in value:
        return 'helicopter'
    if 'drone' in value or 'ucav' in value:
        return 'drone'
    if 'rocket' in value:
        return 'space'
    if 'launcher' in value or 'radar' in value:
        return 'launcher'
    if 'ship' in value or 'submarine' in value:
        return 'naval'
    if 'ground' in value or 'vehicle' in value:
        return 'ground'
    return 'unknown'

rows = parse(AFSIM / 'models.txt')
seen = {}
for row in rows:
    name = row['name']
    source = row['sourcePath'] or ''
    path_match = AFSIM / source if source else None
    filename = Path(source).name.lower() if source else ''
    base = stem(Path(filename).stem)
    restricted = base in RESTRICTED or stem(name) in RESTRICTED
    allowed = name in ALLOWED
    exists = bool(path_match and path_match.exists())
    if not exists and path_match:
        matches = list(path_match.parent.glob(path_match.name.lower()))
        exists = bool(matches)
    variant = row.get('variant') or ('default' if row.get('defaultSet') else 'base')
    if allowed and exists:
        status, attribution = 'embedded', ALLOWED[name][1]
        web_path = f"/models/afsim/{name}.glb"
    elif restricted:
        status, attribution, web_path = 'restricted', None, None
    elif not exists:
        status, attribution, web_path = 'missing', None, None
    else:
        status, attribution, web_path = 'source-only', None, None
    key = f"{name}@{variant}:{source}"
    seen[key] = {
        'id': f"afsim-{re.sub(r'[^a-z0-9]+','-', name.lower()).strip('-')}-{variant}",
        'name': name,
        'displayName': name.replace('_', ' ').replace('-', ' ').title(),
        'category': row.get('category') or 'Unknown',
        'type': equipment_type(row.get('category') or 'Unknown', name),
        'sourcePath': source,
        'variant': variant,
        'status': status,
        'url': web_path,
        'attribution': attribution,
        'transform': row.get('transform', []),
        'wingTip': row.get('wingTip'),
        'engines': row.get('engines', []),
        'sockets': [],
        'attachments': [],
    }
items = sorted(seen.values(), key=lambda x: (x['category'], x['name'], x['variant'], x['sourcePath']))
catalog = {'source':'AFSIM models.txt','generatedFrom':'/root/afsim/afsim2.9-data/resources/models/models.txt','count':len(items),'items':items}
OUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
TS_OUT.write_text(
    '/** 由 assets/afsim/import_models.py 生成；不要手工编辑。 */\n'
    'export interface AfsimCatalogEntry {\n'
    '  id: string; name: string; displayName: string; category: string; type: string; sourcePath: string | null; variant: string;\n'
    "  status: 'embedded' | 'restricted' | 'source-only' | 'missing'; url: string | null;\n"
    '  attribution: string | null; transform: readonly Record<string, unknown>[]; wingTip: readonly number[] | null;\n'
    '  engines: readonly Record<string, unknown>[]; sockets: readonly never[]; attachments: readonly never[];\n'
    '}\n\n'
    f'export const AFSIM_MODEL_CATALOG: readonly AfsimCatalogEntry[] = {json.dumps(items, ensure_ascii=False, indent=2)};\n'
)
print(f'generated {len(items)} model entries -> {OUT}')
from collections import Counter
print(Counter(x['status'] for x in items))
