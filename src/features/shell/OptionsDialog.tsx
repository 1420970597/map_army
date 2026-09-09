/** 全局设置：显示偏好与符号默认格式均独立持久化。 */
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { useSymbolStore } from '@/stores/useSymbolStore';
import { useEditStore } from '@/stores/useEditStore';
import { useViewStore } from '@/stores/useViewStore';

export function OptionsDialog({ onClose }: { onClose: () => void }) {
  const prefs = usePreferencesStore();
  const defaults = useSymbolStore((s) => s.symbolDefaults);
  const setDefaults = useSymbolStore((s) => s.setDefaults);
  const mode = useSymbolStore((s) => s.symbolMode);
  const setMode = useSymbolStore((s) => s.setMode);
  const snap = useEditStore((s) => s.snapEnabled);
  const threshold = useEditStore((s) => s.snapThresholdPx);
  return (
    <div className="modal-backdrop">
      <section className="app-dialog" role="dialog" aria-modal="true" aria-label="选项">
        <div className="panel-header">
          选项<button onClick={onClose}>×</button>
        </div>
        <div className="panel-body">
          <div className="settings-grid">
            <label className="field">
              语言
              <select
                value={prefs.language}
                onChange={(e) =>
                  prefs.update({ language: e.target.value as typeof prefs.language })
                }
              >
                <option value="zh">简体中文</option>
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
                <option value="it">Italiano</option>
              </select>
            </label>
            <label className="field">
              单位
              <select
                value={prefs.units}
                onChange={(e) => prefs.update({ units: e.target.value as typeof prefs.units })}
              >
                <option value="metric">公制（米 / 千米）</option>
                <option value="imperial">英制（码 / 英里）</option>
                <option value="nautical">航海（海里）</option>
              </select>
            </label>
            <label className="field">
              角度单位
              <select
                value={prefs.angularUnit}
                onChange={(e) =>
                  prefs.update({ angularUnit: e.target.value as typeof prefs.angularUnit })
                }
              >
                <option value="degree">度</option>
                <option value="milliradian">北约密位</option>
              </select>
            </label>
            <label className="field">
              经纬度格式
              <select
                value={prefs.geoDegreeFormat}
                onChange={(e) =>
                  prefs.update({ geoDegreeFormat: e.target.value as typeof prefs.geoDegreeFormat })
                }
              >
                <option value="decimal">十进制度</option>
                <option value="dms">度分秒</option>
              </select>
            </label>
            <label className="field">
              工作模式
              <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
                <option value="standard">International</option>
                <option value="extended">Extended</option>
              </select>
            </label>
            <label className="field">
              底图标注
              <select
                value={prefs.mapLanguage}
                onChange={(e) =>
                  prefs.update({ mapLanguage: e.target.value as typeof prefs.mapLanguage })
                }
              >
                <option value="local">当地语言</option>
                <option value="en">英文（支持的底图）</option>
              </select>
            </label>
          </div>
          {(
            [
              ['coordinateSearch', '坐标搜索'],
              ['northArrow', '指北针'],
              ['measurement', '量测工具'],
              ['hillshade', '地形晕渲'],
              ['magneticNorth', '使用磁北'],
              ['magnifier', '按住 D 放大镜'],
            ] as const
          ).map(([key, label]) => (
            <label className="field-row" key={key}>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) => prefs.update({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          <label className="field-row">
            <input
              type="checkbox"
              checked={prefs.pacific}
              onChange={(e) => {
                prefs.update({ pacific: e.target.checked });
                useViewStore.getState().setView({ lon: e.target.checked ? 180 : 0, lat: 20 }, 3);
              }}
            />
            太平洋视图
          </label>
          <label className="field-row">
            <input
              type="checkbox"
              checked={snap}
              onChange={() => useEditStore.getState().toggleSnap()}
            />
            顶点吸附（S）
          </label>
          <label className="field">
            吸附距离 {threshold} px
            <input
              type="range"
              min={0}
              max={30}
              value={threshold}
              onChange={(e) => useEditStore.getState().setSnapThresholdPx(Number(e.target.value))}
            />
          </label>
          <hr />
          <h3>底图显示</h3>
          <label className="field">
            亮度 {prefs.brightness}%
            <input
              type="range"
              min={40}
              max={180}
              value={prefs.brightness}
              onChange={(e) => prefs.update({ brightness: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            Hue {prefs.hue}°
            <input
              type="range"
              min={-180}
              max={180}
              value={prefs.hue}
              onChange={(e) => prefs.update({ hue: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            Chroma {prefs.chroma}%
            <input
              type="range"
              min={0}
              max={200}
              value={prefs.chroma}
              onChange={(e) => prefs.update({ chroma: Number(e.target.value) })}
            />
          </label>
          <hr />
          <h3>六边形网格</h3>
          <label className="field">
            边长 {prefs.hexEdgeMeters.toLocaleString()} m
            <input
              type="range"
              min={1000}
              max={50000}
              step={1000}
              value={prefs.hexEdgeMeters}
              onChange={(e) => prefs.update({ hexEdgeMeters: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            颜色
            <input
              type="color"
              value={prefs.hexColor}
              onChange={(e) => prefs.update({ hexColor: e.target.value })}
            />
          </label>
          <label className="field">
            线宽 {prefs.hexLineWidth}px
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={prefs.hexLineWidth}
              onChange={(e) => prefs.update({ hexLineWidth: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            不透明度 {Math.round(prefs.hexOpacity * 100)}%
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={prefs.hexOpacity}
              onChange={(e) => prefs.update({ hexOpacity: Number(e.target.value) })}
            />
          </label>
          <label className="field-row">
            <input
              type="checkbox"
              checked={prefs.hexLabels}
              onChange={(e) => prefs.update({ hexLabels: e.target.checked })}
            />
            显示六边形标签
          </label>
          <hr />
          <h3>新建符号默认格式</h3>
          <div className="settings-grid">
            <label className="field">
              线宽
              <input
                type="number"
                min={1}
                max={8}
                value={defaults.lineWeight}
                onChange={(e) => setDefaults({ lineWeight: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              填充颜色
              <input
                type="color"
                value={defaults.fillColor}
                onChange={(e) => setDefaults({ fillColor: e.target.value })}
              />
            </label>
            <label className="field">
              字号
              <input
                type="number"
                min={10}
                max={72}
                value={defaults.fontSize}
                onChange={(e) => setDefaults({ fontSize: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              字体
              <select
                value={defaults.fontFamily}
                onChange={(e) => setDefaults({ fontFamily: e.target.value })}
              >
                <option value={'system-ui, "Segoe UI", sans-serif'}>系统字体</option>
                <option value="Arial">Arial</option>
                <option value="sans-serif">无衬线</option>
                <option value="serif">衬线</option>
                <option value="monospace">等宽</option>
              </select>
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}
