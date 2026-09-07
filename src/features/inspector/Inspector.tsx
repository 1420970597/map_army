/**
 * 要素属性面板。
 *
 * 编辑选中要素的名称、SIDC 各字段、文本修饰符、机动方向与样式。
 * 面板直接改写文档 store，所有修改都会进入撤销栈。
 */

import {
  Affiliation,
  Context,
  Echelon,
  HqTfDummy,
  Status,
  formatSidc,
  parseSidc,
  symbolToSvg,
  createSidc,
} from '@/core/symbology';
import { mergeFeatureStyle, mergeFeatureText, useDocumentStore } from '@/stores/useDocumentStore';
import { useViewStore } from '@/stores/useViewStore';

/**
 * 属性面板组件。
 *
 * 未选中要素或面板关闭时返回 null。
 */
export function Inspector() {
  const open = useViewStore((state) => state.inspectorOpen);
  const setOpen = useViewStore((state) => state.setInspectorOpen);

  const selectedIds = useDocumentStore((state) => state.selectedIds);
  const features = useDocumentStore((state) => state.document.features);
  const updateFeature = useDocumentStore((state) => state.updateFeature);
  const removeFeatures = useDocumentStore((state) => state.removeFeatures);

  const feature = features.find((item) => item.id === selectedIds[0]);

  if (!open || !feature) return null;

  let sidc = createSidc();
  try {
    sidc = parseSidc(feature.sidc);
  } catch {
    // SIDC 非法时以默认符号继续编辑，用户可重新选择身份与实体
  }

  const patchSidc = (patch: Partial<typeof sidc>): void => {
    updateFeature(feature.id, { sidc: formatSidc({ ...sidc, ...patch }) });
  };

  return (
    <div className="inspector">
      <div className="panel-header">
        <span>要素属性</span>
        <button type="button" className="icon-button" title="关闭" onClick={() => setOpen(false)}>
          ×
        </button>
      </div>

      <div className="panel-body">
        <div className="panel-section" style={{ textAlign: 'center' }}>
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
              symbolToSvg(sidc, { size: 96, direction: feature.direction }),
            )}`}
            alt="符号预览"
            width={96}
            height={96}
          />
        </div>

        <div className="panel-section">
          <label className="field">
            <span className="field-label">名称</span>
            <input
              className="field-input"
              value={feature.name}
              onChange={(event) => updateFeature(feature.id, { name: event.target.value })}
            />
          </label>
        </div>

        <div className="panel-section">
          <div className="panel-section-title">符号标识（SIDC）</div>

          <label className="field">
            <span className="field-label">身份</span>
            <select
              className="field-select"
              value={sidc.affiliation}
              onChange={(event) =>
                patchSidc({ affiliation: Number(event.target.value) as Affiliation })
              }
            >
              <option value={Affiliation.Friend}>友军</option>
              <option value={Affiliation.Hostile}>敌军</option>
              <option value={Affiliation.Neutral}>中立</option>
              <option value={Affiliation.Unknown}>不明</option>
              <option value={Affiliation.AssumedFriend}>假定友军</option>
              <option value={Affiliation.Suspect}>可疑</option>
              <option value={Affiliation.Pending}>待定</option>
            </select>
          </label>

          <label className="field">
            <span className="field-label">上下文</span>
            <select
              className="field-select"
              value={sidc.context}
              onChange={(event) => patchSidc({ context: Number(event.target.value) as Context })}
            >
              <option value={Context.Reality}>真实</option>
              <option value={Context.Exercise}>演习</option>
              <option value={Context.Simulation}>模拟</option>
            </select>
          </label>

          <label className="field">
            <span className="field-label">状态</span>
            <select
              className="field-select"
              value={sidc.status}
              onChange={(event) => patchSidc({ status: Number(event.target.value) as Status })}
            >
              <option value={Status.Present}>存在</option>
              <option value={Status.Planned}>计划/预期</option>
              <option value={Status.Damaged}>受损</option>
              <option value={Status.Destroyed}>已摧毁</option>
              <option value={Status.FullToCapacity}>满载</option>
            </select>
          </label>

          <label className="field">
            <span className="field-label">司令部 / 特遣队</span>
            <select
              className="field-select"
              value={sidc.hqTfDummy}
              onChange={(event) =>
                patchSidc({ hqTfDummy: Number(event.target.value) as HqTfDummy })
              }
            >
              <option value={HqTfDummy.None}>无</option>
              <option value={HqTfDummy.FeintDummy}>佯动/假目标</option>
              <option value={HqTfDummy.Headquarters}>司令部</option>
              <option value={HqTfDummy.TaskForce}>特遣队</option>
              <option value={HqTfDummy.TaskForceHeadquarters}>特遣队司令部</option>
            </select>
          </label>

          <label className="field">
            <span className="field-label">梯队</span>
            <select
              className="field-select"
              value={sidc.amplifier}
              onChange={(event) => patchSidc({ amplifier: Number(event.target.value) })}
            >
              <option value={0}>无</option>
              <option value={Echelon.Team}>班/组</option>
              <option value={Echelon.Squad}>小队</option>
              <option value={Echelon.Platoon}>排</option>
              <option value={Echelon.Company}>连</option>
              <option value={Echelon.Battalion}>营</option>
              <option value={Echelon.Regiment}>团</option>
              <option value={Echelon.Brigade}>旅</option>
              <option value={Echelon.Division}>师</option>
              <option value={Echelon.Corps}>军</option>
              <option value={Echelon.Army}>集团军</option>
            </select>
          </label>
        </div>

        <div className="panel-section">
          <div className="panel-section-title">文本修饰符</div>

          <label className="field">
            <span className="field-label">唯一标识（右侧）</span>
            <input
              className="field-input"
              value={feature.textFields.uniqueDesignation ?? ''}
              onChange={(event) =>
                mergeFeatureText(feature.id, { uniqueDesignation: event.target.value })
              }
            />
          </label>

          <label className="field">
            <span className="field-label">上级编成（左侧）</span>
            <input
              className="field-input"
              value={feature.textFields.higherFormation ?? ''}
              onChange={(event) =>
                mergeFeatureText(feature.id, { higherFormation: event.target.value })
              }
            />
          </label>

          <label className="field">
            <span className="field-label">附加信息（右下）</span>
            <input
              className="field-input"
              value={feature.textFields.additionalInformation ?? ''}
              onChange={(event) =>
                mergeFeatureText(feature.id, { additionalInformation: event.target.value })
              }
            />
          </label>

          <label className="field">
            <span className="field-label">参谋注记（左下）</span>
            <input
              className="field-input"
              value={feature.textFields.staffComments ?? ''}
              onChange={(event) =>
                mergeFeatureText(feature.id, { staffComments: event.target.value })
              }
            />
          </label>
        </div>

        <div className="panel-section">
          <div className="panel-section-title">样式</div>

          <label className="field">
            <span className="field-label">机动方向（方位角 {feature.direction ?? 0}°）</span>
            <input
              type="range"
              min={0}
              max={359}
              value={feature.direction ?? 0}
              onChange={(event) =>
                updateFeature(feature.id, { direction: Number(event.target.value) })
              }
            />
          </label>

          <label className="field">
            <span className="field-label">颜色</span>
            <input
              type="color"
              className="field-input"
              value={feature.style?.color ?? '#0B82D6'}
              onChange={(event) => mergeFeatureStyle(feature.id, { color: event.target.value })}
            />
          </label>

          <label className="field">
            <span className="field-label">线宽 {feature.style?.weight ?? 3}</span>
            <input
              type="range"
              min={1}
              max={10}
              value={feature.style?.weight ?? 3}
              onChange={(event) =>
                mergeFeatureStyle(feature.id, { weight: Number(event.target.value) })
              }
            />
          </label>
        </div>

        <div className="panel-section">
          <button
            type="button"
            className="tb-button"
            style={{ color: 'var(--c-danger)', border: '1px solid var(--c-border)', width: '100%' }}
            onClick={() => {
              removeFeatures([feature.id]);
              setOpen(false);
            }}
          >
            删除要素
          </button>
        </div>
      </div>
    </div>
  );
}
