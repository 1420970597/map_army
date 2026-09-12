/** AFSIM 导出文案覆盖项目五种界面语言。占位符由调用方提供纯文本。 */
const messages = {
  export: [
    '导出 AFSIM 想定 ZIP',
    'Export AFSIM scenario ZIP',
    'AFSIM-Szenario als ZIP exportieren',
    'Exporter le scénario AFSIM ZIP',
    'Esporta scenario AFSIM ZIP',
  ],
  format: [
    'AFSIM 想定 ZIP（标准目录）',
    'AFSIM scenario ZIP (folders)',
    'AFSIM-Szenario ZIP (Ordner)',
    'Scénario AFSIM ZIP (dossiers)',
    'Scenario AFSIM ZIP (cartelle)',
  ],
  scope: [
    '导出范围',
    'Export scope',
    'Exportumfang',
    'Portée de l’export',
    'Ambito di esportazione',
  ],
  all: [
    '全部图层（包含隐藏和锁定图层）',
    'All layers (including hidden and locked)',
    'Alle Ebenen (auch ausgeblendete und gesperrte)',
    'Tous les calques (masqués et verrouillés inclus)',
    'Tutti i livelli (inclusi nascosti e bloccati)',
  ],
  active: ['活动图层', 'Active layer', 'Aktive Ebene', 'Calque actif', 'Livello attivo'],
  done: [
    'AFSIM 已导出：{count} 个单位，跳过 {skipped} 个',
    'AFSIM exported: {count} units, {skipped} skipped',
    'AFSIM exportiert: {count} Einheiten, {skipped} übersprungen',
    'AFSIM exporté : {count} unités, {skipped} ignorées',
    'AFSIM esportato: {count} unità, {skipped} saltate',
  ],
  empty: [
    '没有可导出的点单位，请先在地图放置军标或调整导出范围。',
    'No point units to export. Place symbols or change the export scope.',
    'Keine Punkte zum Exportieren. Symbole platzieren oder Umfang ändern.',
    'Aucune unité ponctuelle à exporter. Placez des symboles ou modifiez la portée.',
    'Nessuna unità puntuale. Inserisci simboli o cambia l’ambito.',
  ],
  failed: [
    'AFSIM 导出失败',
    'AFSIM export failed',
    'AFSIM-Export fehlgeschlagen',
    'Échec de l’export AFSIM',
    'Esportazione AFSIM non riuscita',
  ],
  report: [
    'AFSIM 导出诊断（{count} 项）',
    'AFSIM export report ({count})',
    'AFSIM-Exportbericht ({count})',
    'Rapport d’export AFSIM ({count})',
    'Rapporto esportazione AFSIM ({count})',
  ],
  entry: [
    '入口：{entry}；压缩包包含 {count} 个文件。',
    'Entry: {entry}; archive contains {count} files.',
    'Einstieg: {entry}; Archiv enthält {count} Dateien.',
    'Entrée : {entry} ; archive de {count} fichiers.',
    'Ingresso: {entry}; archivio di {count} file.',
  ],
  more: [
    '完整诊断请下载报告。',
    'Download the report for all diagnostics.',
    'Vollständigen Bericht herunterladen.',
    'Téléchargez le rapport complet.',
    'Scarica il rapporto completo.',
  ],
  downloadReport: [
    '下载诊断报告',
    'Download report',
    'Bericht herunterladen',
    'Télécharger le rapport',
    'Scarica rapporto',
  ],
  snapshot: [
    '导出当前部署位置、阵营、作战域和航向。未填写高度时使用 0 m MSL；平台静止，仿真时长 1 秒，不含运动、武器、传感器或三维装配。',
    'Exports current positions, sides, domains and headings. Missing altitude defaults to 0 m MSL. Platforms remain static for 1 second; no motion, weapons, sensors or 3D assemblies.',
    'Exportiert Positionen, Seiten, Domänen und Kurse. Ohne Höhe gilt 0 m MSL. Statische Plattformen für 1 Sekunde, ohne Bewegung, Waffen, Sensoren oder 3D-Montage.',
    'Exporte positions, camps, domaines et caps. Altitude absente : 0 m MSL. Plateformes statiques pendant 1 seconde, sans mouvement, armes, capteurs ni assemblages 3D.',
    'Esporta posizioni, schieramenti, domini e direzioni. Altitudine assente: 0 m MSL. Piattaforme statiche per 1 secondo, senza movimento, armi, sensori o assemblaggi 3D.',
  ],
  invalidLayer: [
    '导出图层已不存在，请重新选择。',
    'Export layer no longer exists. Select it again.',
    'Exportebene existiert nicht mehr. Neu auswählen.',
    'Le calque à exporter n’existe plus. Sélectionnez-le à nouveau.',
    'Il livello non esiste più. Selezionalo nuovamente.',
  ],
  skipped: [
    '{name}：不是可导出的点单位或 WGS84 坐标无效，已跳过。',
    '{name}: skipped; not a point unit or invalid WGS84 coordinates.',
    '{name}: übersprungen; keine Punkteinheit oder ungültige WGS84-Koordinaten.',
    '{name} : ignoré ; unité non ponctuelle ou coordonnées WGS84 invalides.',
    '{name}: saltato; unità non puntuale o coordinate WGS84 non valide.',
  ],
  external: [
    '{name}：图像和在线资源未嵌入，仅导出已有点单位。',
    '{name}: images and online resources are not embedded; existing point units only.',
    '{name}: Bilder und Online-Ressourcen nicht eingebettet; nur vorhandene Punkteinheiten.',
    '{name} : images et ressources en ligne non intégrées ; unités ponctuelles existantes uniquement.',
    '{name}: immagini e risorse online non incluse; solo unità puntuali esistenti.',
  ],
  altitude: [
    '{name}：高度格式无效，使用 0 m MSL。请填写数值和 m/km/ft 等长度单位。',
    '{name}: invalid altitude; using 0 m MSL. Enter a number with m/km/ft or another length unit.',
    '{name}: ungültige Höhe; 0 m MSL verwendet. Zahl mit m/km/ft oder anderer Längeneinheit eingeben.',
    '{name} : altitude invalide ; 0 m MSL utilisé. Entrez une valeur et une unité m/km/ft.',
    '{name}: altitudine non valida; usato 0 m MSL. Inserisci numero e unità m/km/ft.',
  ],
  heading: [
    '{name}：航向无效，使用 0 deg。',
    '{name}: invalid heading; using 0 deg.',
    '{name}: ungültiger Kurs; 0 deg verwendet.',
    '{name} : cap invalide ; 0 deg utilisé.',
    '{name}: direzione non valida; usato 0 deg.',
  ],
  nameChanged: [
    '{name}：名称中的引号、控制字符或宏标记已转换为普通显示文本。',
    '{name}: quotes, control characters or macro markers in the name were converted to display text.',
    '{name}: Anführungszeichen, Steuerzeichen oder Makros im Namen in Anzeigetext umgewandelt.',
    '{name} : guillemets, caractères de contrôle ou macros du nom convertis en texte d’affichage.',
    '{name}: virgolette, controlli o macro del nome convertiti in testo visualizzato.',
  ],
  custom: [
    '{name}：自定义 SVG 使用通用平台图标；请另存项目 JSON 保留外观。',
    '{name}: custom SVG uses a generic platform icon; save project JSON to retain appearance.',
    '{name}: eigenes SVG nutzt allgemeines Plattform-Symbol; Projekt-JSON erhält das Aussehen.',
    '{name} : SVG personnalisé remplacé par une icône générique ; conservez le JSON du projet.',
    '{name}: SVG personalizzato usa un’icona generica; salva JSON per conservarne l’aspetto.',
  ],
  limit: [
    'AFSIM 导出超过限制（10000 单位、10000 文件或 32 MB），请缩小范围。',
    'AFSIM export exceeds limits (10000 units, 10000 files or 32 MB). Reduce the scope.',
    'AFSIM-Export zu groß (10000 Einheiten, 10000 Dateien oder 32 MB). Umfang reduzieren.',
    'Limites AFSIM dépassées (10000 unités, 10000 fichiers ou 32 Mo). Réduisez la portée.',
    'Limiti AFSIM superati (10000 unità, 10000 file o 32 MB). Riduci l’ambito.',
  ],
} as const;

/** 按语言和命名占位符生成导出文案；未支持的语言回退为中文。 */
export function afsimExportText(
  language: string,
  key: keyof typeof messages,
  values: Record<string, string | number> = {},
): string {
  const index = Math.max(0, ['zh', 'en', 'de', 'fr', 'it'].indexOf(language));
  return messages[key][index].replace(/\{(\w+)\}/g, (token, name: string) =>
    String(values[name] ?? token),
  );
}
