import { Affiliation, SymbolSet, parseSidc } from '../../symbology';

interface PlatformSymbol {
  side: 'blue' | 'red' | 'neutral' | 'unknown';
  domain: 'land' | 'air' | 'surface' | 'subsurface' | 'space';
  icon: string;
}

/** 将点军标映射到 AFSIM 通用静态平台；控制措施与气象符号没有平台语义。 */
export function afsimSymbolForSidc(code: string): PlatformSymbol | null {
  let side: PlatformSymbol['side'] = 'unknown';
  let domain: PlatformSymbol['domain'] = 'land';
  let equipment = false;
  if (/^[SI][A-Z-]{14}$/.test(code)) {
    const identity = code[1];
    side = 'FADM'.includes(identity)
      ? 'blue'
      : 'HSJK'.includes(identity)
        ? 'red'
        : 'NL'.includes(identity)
          ? 'neutral'
          : 'unknown';
    const domains: Record<string, PlatformSymbol['domain']> = {
      A: 'air',
      P: 'space',
      G: 'land',
      S: 'surface',
      U: 'subsurface',
      F: 'land',
      Z: 'land',
    };
    if (!domains[code[2]]) return null;
    domain = domains[code[2]];
    equipment = code[2] === 'G' && code[4] === 'E';
  } else {
    if (!/^\d{20}$/.test(code)) return null;
    try {
      const sidc = parseSidc(code);
      if (
        [
          SymbolSet.ControlMeasure,
          SymbolSet.Activities,
          SymbolSet.Atmospheric,
          SymbolSet.Oceanographic,
          SymbolSet.Cyberspace,
        ].some((set) => set === sidc.symbolSet)
      )
        return null;
      side =
        sidc.affiliation === Affiliation.Friend || sidc.affiliation === Affiliation.AssumedFriend
          ? 'blue'
          : sidc.affiliation === Affiliation.Hostile || sidc.affiliation === Affiliation.Suspect
            ? 'red'
            : sidc.affiliation === Affiliation.Neutral
              ? 'neutral'
              : 'unknown';
      if (sidc.symbolSet === SymbolSet.Air || sidc.symbolSet === SymbolSet.AirMissile)
        domain = 'air';
      if (sidc.symbolSet === SymbolSet.SeaSurface) domain = 'surface';
      if (sidc.symbolSet === SymbolSet.SeaSubsurface || sidc.symbolSet === SymbolSet.MineWarfare)
        domain = 'subsurface';
      if (sidc.symbolSet === SymbolSet.Space || sidc.symbolSet === SymbolSet.SpaceMissile)
        domain = 'space';
      equipment = sidc.symbolSet === SymbolSet.LandEquipment;
    } catch {
      return null;
    }
  }
  // 图标名称来自 AFSIM 2.9 随附 models.txt；仅表示大类，不声称对应真实装备型号。
  const icons = {
    land: equipment ? 'tank' : 'infantry',
    air: 'fighter',
    surface: 'ship',
    subsurface: 'submarine',
    space: 'satellite',
  };
  return { side, domain, icon: icons[domain] };
}
