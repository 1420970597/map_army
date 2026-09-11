import { createDocument, createFeature, createLayer, type MapDocument } from '../model';
import { Affiliation, Context, SymbolSet, createSidc } from '../symbology';
import { type LonLat, mgrsStringToLonLat } from '../geo';
import { blockEnd, isScript, isScriptBlock, location, type Token } from './afsim/lexer';
import { AFSIM_LIMITS, loadAfsimSources, type AfsimSourceFile } from './afsim/source';

export { afsimEntryPaths, AFSIM_LIMITS } from './afsim/source';
export type { AfsimSourceFile } from './afsim/source';

/** 静态部署导入结果；不能执行或解析的语义保留在诊断中。 */
export interface AfsimImportResult {
  document: MapDocument;
  skipped: number;
  warnings: string[];
  sources: string[];
}

interface Route {
  points: { position: LonLat | null; label?: string; relative?: boolean; altitude?: string }[];
  unsupported?: boolean;
}

interface State {
  side?: string;
  domain?: string;
  icon?: string;
  categories?: string[];
  mover?: string;
  position?: LonLat | null;
  heading?: number;
  altitude?: string;
  route?: Route | string;
  startAt?: string;
  deferred?: boolean;
}

interface Definition {
  type: string;
  body: Token[];
  token: Token;
}

/** AFSIM 坐标固定按纬度、经度读取；裸有符号十进制度是兼容扩展。 */
export function parseAfsimCoordinate(token: string, axis?: 'lat' | 'lon'): number | null {
  const match =
    /^([nsew])?([+-]?\d+(?:\.\d+)?)(?::(\d+(?:\.\d+)?))?(?::(\d+(?:\.\d+)?))?([nsew])?$/i.exec(
      token,
    );
  if (!match) return null;
  const [, prefix, degrees, minutes, seconds, suffix] = match;
  if (prefix && suffix) return null;
  const hemisphere = (prefix ?? suffix)?.toLowerCase();
  if (axis === 'lat' && hemisphere && !'ns'.includes(hemisphere)) return null;
  if (axis === 'lon' && hemisphere && !'ew'.includes(hemisphere)) return null;
  if (Number(minutes ?? 0) >= 60 || Number(seconds ?? 0) >= 60) return null;
  if (hemisphere && degrees.startsWith('-')) return null;
  const sign = hemisphere === 's' || hemisphere === 'w' || degrees.startsWith('-') ? -1 : 1;
  const value =
    sign * (Math.abs(Number(degrees)) + Number(minutes ?? 0) / 60 + Number(seconds ?? 0) / 3600);
  return Math.abs(value) <= (axis === 'lat' ? 90 : 180) ? value : null;
}

function positionAt(tokens: readonly Token[], index: number): LonLat | null {
  const lat = parseAfsimCoordinate(tokens[index]?.value ?? '', 'lat');
  const lon = parseAfsimCoordinate(tokens[index + 1]?.value ?? '', 'lon');
  return lat === null || lon === null ? null : { lat, lon };
}

function readRoute(tokens: Token[]): Route {
  const route: Route = { points: [] };
  let label: string | undefined;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.quoted || token.argument) continue;
    if (token.value === 'label') label = tokens[++i]?.value;
    else if (token.value === 'position') {
      route.points.push({ position: positionAt(tokens, i + 1), label });
      label = undefined;
      i += 2;
    } else if (token.value === 'mgrs_coordinate') {
      let position: LonLat | null = null;
      try {
        position = mgrsStringToLonLat(tokens[++i]?.value ?? '');
      } catch {
        /* 无效航点交给平台诊断。 */
      }
      route.points.push({ position, label });
      label = undefined;
    } else if (token.value === 'altitude') {
      let altitude = `${tokens[++i]?.value ?? ''} ${tokens[++i]?.value ?? ''}`;
      if (['agl', 'msl'].includes(tokens[i + 1]?.value)) altitude += ` ${tokens[++i].value}`;
      const point = route.points.at(-1);
      if (point) point.altitude = altitude;
    } else if (/^(?:insert_|transform_|offset|position_offset)/.test(token.value))
      route.unsupported = true;
    else if (
      [
        'time',
        'distance',
        'turn',
        'heading',
        'turn_right',
        'turn_left',
        'turn_to_heading',
      ].includes(token.value) &&
      !route.points.length
    ) {
      route.points.push({ position: null, label, relative: true });
    } else if (isScriptBlock(tokens, i)) i = blockEnd(tokens, i);
    else if (token.value === 'execute') i++;
  }
  return route;
}

function sidcForState(state: State) {
  const side = state.side?.toLowerCase();
  const affiliation =
    side === 'blue' || side === 'friendly'
      ? Affiliation.Friend
      : side === 'red' || side === 'hostile'
        ? Affiliation.Hostile
        : side === 'neutral'
          ? Affiliation.Neutral
          : Affiliation.Unknown;
  const mover = state.mover ?? '';
  const domain =
    state.domain ??
    (/AIR|ROTORCRAFT|KINEMATIC|P6DOF|SIX_DOF|GUIDED|BALLISTIC/.test(mover)
      ? 'air'
      : /SUBSURFACE|SUBMARINE/.test(mover)
        ? 'subsurface'
        : /SURFACE/.test(mover)
          ? 'surface'
          : /SPACE|ORBIT/.test(mover)
            ? 'space'
            : 'land');
  const symbolSet =
    domain === 'air'
      ? SymbolSet.Air
      : domain === 'surface'
        ? SymbolSet.SeaSurface
        : domain === 'subsurface'
          ? SymbolSet.SeaSubsurface
          : domain === 'space'
            ? SymbolSet.Space
            : domain === 'land'
              ? SymbolSet.LandUnit
              : SymbolSet.Unknown;
  const description = `${state.icon ?? ''} ${(state.categories ?? []).join(' ')}`.toLowerCase();
  let entity = '000000';
  if (symbolSet === SymbolSet.Air) {
    entity = /fighter|f-?\d/.test(description)
      ? '110104'
      : /bomber/.test(description)
        ? '110103'
        : /helicopter|rotary/.test(description)
          ? '110200'
          : /uav|ucav|drone/.test(description)
            ? '110300'
            : '000000';
  } else if (symbolSet === SymbolSet.SeaSurface) {
    entity = /carrier/.test(description)
      ? '120100'
      : /destroyer/.test(description)
        ? '120203'
        : /frigate/.test(description)
          ? '120204'
          : '000000';
  }
  return createSidc({
    context: Context.Simulation,
    affiliation,
    symbolSet,
    entity: entity.slice(0, 2),
    entityType: entity.slice(2, 4),
    entitySubtype: entity.slice(4),
  });
}

/** 从指定入口解析静态平台，类型、航路和 mover 只在依赖闭包中查找。 */
export async function afsimFilesToDocument(
  files: readonly AfsimSourceFile[],
  entry: string,
): Promise<AfsimImportResult> {
  const loaded = await loadAfsimSources(files, entry);
  const warnings = new Set(loaded.warnings);
  const tokens = loaded.tokens;
  const blockNames = new Set(
    tokens
      .filter(
        (token) =>
          !token.quoted &&
          !token.argument &&
          token.value.startsWith('end_') &&
          !['end_time', 'end_of_path'].includes(token.value),
      )
      .map((token) => token.value.slice(4)),
  );
  // 已知组件即使缺少闭合词也必须按块解析，防止内部位置泄漏为平台位置。
  for (const name of [
    'sensor',
    'processor',
    'comm',
    'weapon',
    'fuel',
    'aux_data',
    'track',
    'zone',
    'antenna_pattern',
    'radar_signature',
    'optical_signature',
    'infrared_signature',
    'terrain',
    'event_output',
    'event_pipe',
  ])
    blockNames.add(name);
  const types = new Map<string, Definition>();
  const movers = new Map<string, Definition>();
  const routes = new Map<string, Route>();
  const platforms = new Map<string, Definition>();
  const edits: { name: string; body: Token[]; token: Token }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.quoted || token.argument) continue;
    const kind = token.value;
    if (['platform', 'platform_type', 'mover', 'route'].includes(kind)) {
      const end = blockEnd(tokens, i);
      let name = tokens[i + 1]?.value;
      const type = kind === 'route' ? '' : tokens[i + 2]?.value;
      if (!name || type === undefined) throw new Error(`${location(token)}：${kind} 定义不完整`);
      if (kind === 'platform' && name === '<default>') {
        name = `${type}-import-${platforms.size + 1}`;
        warnings.add(`${location(token)}：自动命名平台使用导入名称 ${name}`);
      }
      const body = tokens.slice(i + (kind === 'route' ? 2 : 3), end);
      if (kind === 'route') {
        if (routes.has(name)) throw new Error(`${location(token)}：重复 route ${name}`);
        routes.set(name, readRoute(body));
      } else {
        const definitions =
          kind === 'platform_type' ? types : kind === 'mover' ? movers : platforms;
        if (definitions.has(name)) throw new Error(`${location(token)}：重复 ${kind} ${name}`);
        definitions.set(name, { type, body, token });
        if (platforms.size > AFSIM_LIMITS.platforms) throw new Error('AFSIM 平台超过 10000 个');
      }
      i = end;
    } else if ((kind === 'edit' || kind === 'delete') && tokens[i + 1]?.value === 'platform') {
      const name = tokens[i + 2]?.value;
      if (kind === 'delete') {
        throw new Error(`${location(token)}：不支持顶层 delete platform`);
      } else {
        const end = blockEnd(tokens, i + 1);
        edits.push({ name, body: tokens.slice(i + 3, end), token });
        i = end;
      }
    } else if (isScript(kind) || blockNames.has(kind)) i = blockEnd(tokens, i);
  }

  for (const edit of edits) {
    const previous = platforms.get(edit.name);
    if (!previous) throw new Error(`${location(edit.token)}：未定义的平台 ${edit.name}`);
    previous.body = previous.body.concat(edit.body);
  }

  const readState = (
    body: Token[],
    initial: State,
    moverChain: string[] = [],
    loadingType = true,
  ): State => {
    const state = { ...initial, categories: [...(initial.categories ?? [])] };
    for (let i = 0; i < body.length; i++) {
      const token = body[i];
      if (token.quoted || token.argument) continue;
      const value = token.value;
      if (
        [
          'radar_signature',
          'optical_signature',
          'infrared_signature',
          'acoustic_signature',
          'inherent_contrast',
          'p6dof_object_type',
          'marking',
          'on_broken',
        ].includes(value)
      ) {
        i++;
      } else if (value === 'delete') {
        const component = body[++i]?.value;
        if (component === 'mover') {
          delete state.mover;
          delete state.route;
          delete state.startAt;
        } else if (component !== 'fuel') i++;
      } else if (['side', 'icon', 'category', 'spatial_domain', 'start_at'].includes(value)) {
        const arg = body[++i];
        if (!arg) throw new Error(`${location(token)}：${value} 缺少值`);
        if (value === 'side') state.side = arg.value;
        if (value === 'icon') state.icon = arg.value;
        if (value === 'category') state.categories.push(arg.value);
        if (value === 'spatial_domain') state.domain = arg.value;
        if (value === 'start_at') state.startAt = arg.value;
      } else if (value === 'clear_categories') {
        state.categories = [];
      } else if (value === 'position') {
        state.position = positionAt(body, i + 1);
        i += 2;
      } else if (value === 'mgrs_coordinate') {
        try {
          state.position = mgrsStringToLonLat(body[++i]?.value ?? '');
        } catch {
          state.position = null;
        }
      } else if (value === 'heading') {
        const angle = Number(body[++i]?.value);
        const unit = body[++i]?.value;
        const degrees =
          unit === 'rad' || unit === 'radians'
            ? (angle * 180) / Math.PI
            : /^(deg|degree|degrees)$/.test(unit ?? '')
              ? angle
              : NaN;
        state.heading = Number.isFinite(degrees) ? ((degrees % 360) + 360) % 360 : undefined;
        if (state.heading === undefined)
          warnings.add(`${location(token)}：heading 无效，未导入航向`);
      } else if (value === 'altitude') {
        state.altitude = `${body[++i]?.value ?? ''} ${body[++i]?.value ?? ''}`;
        if (['agl', 'msl'].includes(body[i + 1]?.value)) state.altitude += ` ${body[++i].value}`;
      } else if (value === 'creation_time') {
        state.deferred = Number(body[++i]?.value) !== 0;
        i++;
      } else if (value === 'route') {
        const end = blockEnd(body, i);
        state.route = readRoute(body.slice(i + 1, end));
        i = end;
      } else if (value === 'use_route') state.route = body[++i]?.value;
      else if (value === 'mover') {
        const end = blockEnd(body, i);
        const type = body[i + 1]?.value;
        let moverState: State = {};
        const adding =
          body[i - 1]?.value === 'add' || (loadingType && body[i - 1]?.value !== 'edit');
        if (adding) {
          const resolveMover = (name: string, chain: string[]): State => {
            if (chain.includes(name) || chain.length >= 64)
              throw new Error(`AFSIM mover 继承循环：${name}`);
            const definition = movers.get(name);
            return definition
              ? readState(definition.body, resolveMover(definition.type, [...chain, name]), [
                  ...chain,
                  name,
                ])
              : name.startsWith('WSF_')
                ? { mover: name }
                : (() => {
                    throw new Error(`缺少 mover ${name}`);
                  })();
          };
          moverState = resolveMover(type, moverChain);
        }
        Object.assign(
          state,
          readState(body.slice(i + (adding ? 2 : 1), end), { ...state, ...moverState }, moverChain),
        );
        i = end;
      } else if (isScriptBlock(body, i) || blockNames.has(value)) i = blockEnd(body, i);
      else if (value === 'execute') i++;
    }
    return state;
  };
  const resolvedTypes = new Map<string, State>();
  const resolveType = (name: string, chain: string[] = []): State => {
    if (name === 'WSF_PLATFORM') return {};
    if (chain.includes(name) || chain.length >= 64)
      throw new Error(`AFSIM platform_type 继承循环：${[...chain, name].join(' -> ')}`);
    const cached = resolvedTypes.get(name);
    if (cached) return cached;
    const definition = types.get(name);
    if (!definition) throw new Error(`缺少 platform_type ${name}`);
    const state = readState(definition.body, resolveType(definition.type, [...chain, name]));
    resolvedTypes.set(name, state);
    return state;
  };

  const document = createDocument(entry.split('/').pop());
  document.layers = [];
  let skipped = 0;
  for (const [name, definition] of platforms) {
    try {
      const state = readState(definition.body, resolveType(definition.type), [], false);
      let position = state.position;
      if (state.route) {
        if (!state.mover) throw new Error('route 没有对应的 mover');
        const route = typeof state.route === 'string' ? routes.get(state.route) : state.route;
        if (!route || route.unsupported)
          throw new Error(
            `缺少或不支持的 route ${typeof state.route === 'string' ? state.route : ''}`,
          );
        const start = state.startAt
          ? route.points.find((point) => point.label === state.startAt)
          : route.points[0];
        if (state.startAt && !start) throw new Error(`route 中不存在 start_at ${state.startAt}`);
        if (start?.position) {
          position = start.position;
          state.altitude = start.altitude ?? state.altitude;
        } else if (route.points.length && (!start?.relative || !position || state.startAt))
          throw new Error('route 起点没有可静态解析的位置');
      }
      if (!position) throw new Error('没有有效 position');
      const side = state.side ?? 'unknown';
      let layer = document.layers.find((item) => item.group === side);
      if (!layer) {
        layer = createLayer({ name: `AFSIM ${side}`, group: side, order: document.layers.length });
        document.layers.push(layer);
      }
      if (state.deferred)
        warnings.add(`${location(definition.token)}：${name} 为延迟创建平台，绘制声明的部署位置`);
      document.features.push(
        createFeature({
          layerId: layer.id,
          name,
          sidc: sidcForState(state),
          geometry: { kind: 'point', position },
          direction: state.heading,
          textFields: {
            uniqueDesignation: name,
            type: definition.type,
            altitudeDepth: state.altitude,
            staffComments: `${location(definition.token)}; side=${side}${state.deferred ? '; deferred' : ''}`,
          },
        }),
      );
    } catch (error) {
      skipped++;
      warnings.add(
        `${location(definition.token)}：平台 ${name} 已跳过：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (!platforms.size) warnings.add('入口及其依赖没有静态 platform 实例');
  warnings.add('静态部署导入；军标按 side 和运动域映射，AFSIM icon 不等同于标准 SIDC');
  return { document, skipped, warnings: [...warnings], sources: loaded.sources };
}
