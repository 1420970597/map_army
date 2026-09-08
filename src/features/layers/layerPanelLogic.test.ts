import { describe, expect, it } from 'vitest';

import { LayerStatus } from '@/core/model';

import {
  FEATURE_IDS_DRAG_MIME,
  LAYER_ID_DRAG_MIME,
  dropPayloadKind,
  layerStatusDisplay,
  opacityTransactionAction,
  parseFeatureDragIds,
  serializeFeatureDragIds,
} from './layerPanelLogic';

describe('layerStatusDisplay', () => {
  it('将缺失状态显示为草稿并切换到已核定', () => {
    expect(layerStatusDisplay(undefined)).toEqual({
      label: '草稿',
      nextStatus: LayerStatus.Approved,
    });
  });

  it('将草稿状态切换为已核定', () => {
    expect(layerStatusDisplay(LayerStatus.Working)).toEqual({
      label: '草稿',
      nextStatus: LayerStatus.Approved,
    });
  });

  it('将已核定状态切换回草稿', () => {
    expect(layerStatusDisplay(LayerStatus.Approved)).toEqual({
      label: '已核定',
      nextStatus: LayerStatus.Working,
    });
  });
});

describe('要素拖放载荷', () => {
  it('序列化时过滤空值并去重', () => {
    expect(serializeFeatureDragIds(['a', '', 'a', 'b'])).toBe('["a","b"]');
  });

  it('解析合法的要素标识数组', () => {
    expect(parseFeatureDragIds('["a","a","b"]')).toEqual(['a', 'b']);
  });

  it.each(['', 'null', '{}', '[]', '["a", 2]', '[""]'])('拒绝非法载荷 %s', (payload) => {
    expect(parseFeatureDragIds(payload)).toBeNull();
  });

  it('优先区分要素放置', () => {
    expect(dropPayloadKind([LAYER_ID_DRAG_MIME, FEATURE_IDS_DRAG_MIME])).toBe('feature');
  });

  it('识别图层排序放置和未知放置', () => {
    expect(dropPayloadKind([LAYER_ID_DRAG_MIME])).toBe('layer');
    expect(dropPayloadKind(['text/plain'])).toBeNull();
  });
});

describe('opacityTransactionAction', () => {
  it('指针操作形成事务边界', () => {
    expect(opacityTransactionAction('pointerdown')).toBe('begin');
    expect(opacityTransactionAction('pointerup')).toBe('end');
    expect(opacityTransactionAction('pointercancel')).toBe('end');
    expect(opacityTransactionAction('blur')).toBe('end');
  });

  it('键盘范围调整形成事务边界', () => {
    expect(opacityTransactionAction('keydown', 'ArrowRight')).toBe('begin');
    expect(opacityTransactionAction('keyup', 'ArrowRight')).toBe('end');
  });

  it('无关键不影响事务', () => {
    expect(opacityTransactionAction('keydown', 'Tab')).toBe('none');
    expect(opacityTransactionAction('keyup', 'a')).toBe('none');
  });
});
