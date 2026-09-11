import { describe, expect, it, vi } from 'vitest';
import {
  afsimFilesToDocument,
  parseAfsimCoordinate,
  afsimEntryPaths,
  AFSIM_LIMITS,
  type AfsimSourceFile,
} from './afsim';
import { serializeMilxly, deserializeMilxly } from './milxly';
import { parseSidc } from '../symbology';

function files(inputs: Record<string, string>): AfsimSourceFile[] {
  return Object.entries(inputs).map(([path, text]) => ({
    path,
    size: new TextEncoder().encode(text).length,
    readText: async () => text,
  }));
}

const unit = 'platform unit WSF_PLATFORM position 12N 34E end_platform';

describe('AFSIM 想定导入', () => {
  it('解析半球前缀、后缀、度分秒及有符号十进制度扩展，拒绝越界', () => {
    expect(parseAfsimCoordinate('26:12:35.457n', 'lat')).toBeCloseTo(26.2098492, 6);
    expect(parseAfsimCoordinate('E133:26:35.270', 'lon')).toBeCloseTo(133.4431306, 6);
    expect(parseAfsimCoordinate('91.5w', 'lon')).toBe(-91.5);
    expect(parseAfsimCoordinate('-12.5', 'lat')).toBe(-12.5);
    for (const bad of ['91n', '20e', '12:60n', '12:20:60n', '-12s', '12:2:3:4n', 'N12S', 'NaN', ''])
      expect(parseAfsimCoordinate(bad, 'lat')).toBeNull();
  });

  it('只加载入口依赖，保留相对路径并继承类型字段，路线起点覆盖平台位置', async () => {
    const unread = vi.fn(async () => {
      throw new Error('不应读取未引用文件');
    });
    const result = await afsimFilesToDocument(
      [
        ...files({
          'main.txt':
            'include_once types/air.txt include_once types/air.txt include deployment.txt',
          'types/air.txt':
            'platform_type AIR BASE icon F35 end_platform_type platform_type BASE WSF_PLATFORM side blue mover WSF_AIR_MOVER end_mover end_platform_type',
          'deployment.txt':
            'platform jet AIR position 20N 30E route position 25N 135E position 26N 136E end_route heading 90 deg end_platform',
        }),
        { path: 'unrelated.txt', size: 200_000_000, readText: unread },
      ],
      'main.txt',
    );
    expect(unread).not.toHaveBeenCalled();
    expect(result.sources).toEqual(['main.txt', 'types/air.txt', 'deployment.txt']);
    expect(result.document.features).toHaveLength(1);
    const feature = result.document.features[0];
    expect(feature.geometry).toEqual({ kind: 'point', position: { lat: 25, lon: 135 } });
    expect(parseSidc(feature.sidc)).toMatchObject({ affiliation: 3, symbolSet: 1 });
    expect(feature.textFields.type).toBe('AIR');
    const roundTrip = deserializeMilxly(serializeMilxly(result.document));
    expect(roundTrip.document.features[0]).toEqual(feature);
  });

  it('忽略注释、脚本字符串和传感器内部位置，只保留有效平台', async () => {
    const result = await afsimFilesToDocument(
      files({
        'main.txt': `
      # ${unit}
      /* ${unit} */
      script void mock() string a = "${unit}"; end_script
      platform_type A WSF_PLATFORM
        side red sensor s TEST position 40N 50E on_success TRACK end_sensor
        on_initialize string value = "position 0N 0E"; end_on_initialize
      end_platform_type
      platform missing A end_platform
      platform actual A position 12S 34W end_platform
    `,
      }),
      'main.txt',
    );
    expect(result.document.features).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.warnings.join('\n')).toContain('没有有效 position');
    expect(result.document.features[0].geometry).toEqual({
      kind: 'point',
      position: { lat: -12, lon: -34 },
    });
  });

  it('按文件目录、file_path、工作目录的顺序解析 include，支持路径变量', async () => {
    const result = await afsimFilesToDocument(
      files({
        'scenario/main.txt':
          'file_path ../shared define_path_variable LIB ../shared include sub/load.txt',
        'scenario/sub/load.txt': 'include "local.txt" include $(LIB)/other.txt',
        'scenario/sub/local.txt': unit,
        'shared/local.txt': unit.replace('unit', 'wrong'),
        'shared/other.txt': unit.replace('unit', 'second'),
      }),
      'scenario/main.txt',
    );
    expect(result.document.features.map((feature) => feature.name)).toEqual(['unit', 'second']);
  });

  it('普通 include 重复定义报错，include_once 和普通循环被区别处理', async () => {
    await expect(
      afsimFilesToDocument(
        files({ 'main.txt': 'include u.txt include u.txt', 'u.txt': unit }),
        'main.txt',
      ),
    ).rejects.toThrow('重复 platform');
    await expect(
      afsimFilesToDocument(
        files({ 'main.txt': 'include a.txt', 'a.txt': 'include main.txt' }),
        'main.txt',
      ),
    ).rejects.toThrow('include 循环');
    const result = await afsimFilesToDocument(
      files({ 'main.txt': `include_once main.txt ${unit}` }),
      'main.txt',
    );
    expect(result.document.features).toHaveLength(1);
  });

  it('缺少依赖和类型会报告，不会按文件名猜测或绘制到原点', async () => {
    const result = await afsimFilesToDocument(
      files({
        'main.txt': 'include missing.txt platform bad MISSING position 12N 34E end_platform',
        'unrelated/missing.txt': 'platform_type MISSING WSF_PLATFORM end_platform_type',
      }),
      'main.txt',
    );
    expect(result.document.features).toHaveLength(0);
    expect(result.skipped).toBe(1);
    expect(result.warnings.join('\n')).toMatch(/缺少依赖.*missing.txt/);
    expect(result.warnings.join('\n')).toContain('缺少 platform_type');
  });

  it('循环继承、无效坐标和不支持的起点分别诊断', async () => {
    const result = await afsimFilesToDocument(
      files({
        'main.txt': `
      platform_type A B end_platform_type platform_type B A end_platform_type
      platform cyclic A position 12N 34E end_platform
      platform invalid WSF_PLATFORM position 100N 34E end_platform
      platform route WSF_PLATFORM use_route MISSING end_platform
    `,
      }),
      'main.txt',
    );
    expect(result.skipped).toBe(3);
    expect(result.warnings.join('\n')).toContain('继承循环');
  });

  it('命名路线与 start_at、空路线和相对首航点保留正确起点', async () => {
    const result = await afsimFilesToDocument(
      files({
        'main.txt': `
      route PATH position 10N 20E label second position 30N 40E end_route
      platform_type A WSF_PLATFORM mover WSF_AIR_MOVER end_mover end_platform_type
      platform labelled A use_route PATH start_at second end_platform
      platform relative A position 5N 6E route heading 90 deg time 10 sec position 30N 40E end_route end_platform
      platform empty A position 7N 8E route end_route end_platform
    `,
      }),
      'main.txt',
    );
    expect(result.document.features.map((feature) => feature.geometry)).toEqual([
      { kind: 'point', position: { lat: 30, lon: 40 } },
      { kind: 'point', position: { lat: 5, lon: 6 } },
      { kind: 'point', position: { lat: 7, lon: 8 } },
    ]);
  });

  it('显式运动域优先于 mover，未知阵营保留名称并映射为未知', async () => {
    const result = await afsimFilesToDocument(
      files({
        'main.txt': `
      platform_type SHIP WSF_PLATFORM icon F35 side alpha mover WSF_SURFACE_MOVER end_mover end_platform_type
      platform sea SHIP position 12N 34E end_platform
      platform air SHIP spatial_domain air position 13N 35E end_platform
    `,
      }),
      'main.txt',
    );
    expect(result.document.features.map((feature) => parseSidc(feature.sidc).symbolSet)).toEqual([
      30, 1,
    ]);
    expect(parseSidc(result.document.features[0].sidc).affiliation).toBe(1);
    expect(result.document.layers[0].name).toBe('AFSIM alpha');
  });

  it('项目 XML 使用 project-directory 和多个入口，拒绝目录外路径', async () => {
    const inputs = files({
      'test.afproj':
        '<wsf-ide-project-file><wsf-ide-project project-directory="scenario"><wsf-ide-scenario working-directory="."><file-item file-type="file-main-source" file-path="main.txt"/><file-item file-type="file-main-source" file-path="second.txt"/></wsf-ide-scenario></wsf-ide-project></wsf-ide-project-file>',
      'scenario/main.txt': unit,
      'scenario/second.txt': unit.replace('unit', 'second'),
    });
    expect(afsimEntryPaths(inputs)[0]).toBe('test.afproj');
    const result = await afsimFilesToDocument(inputs, 'test.afproj');
    expect(result.document.features).toHaveLength(2);
    await expect(
      afsimFilesToDocument(files({ '../outside.txt': unit }), '../outside.txt'),
    ).rejects.toThrow('路径无效');
  });

  it('损坏块、二进制和过大依赖中止解析', async () => {
    for (const text of ['platform unit WSF_PLATFORM', '\0binary']) {
      await expect(afsimFilesToDocument(files({ 'main.txt': text }), 'main.txt')).rejects.toThrow();
    }
    const readText = vi.fn(async () => unit);
    await expect(
      afsimFilesToDocument(
        [{ path: 'main.txt', size: AFSIM_LIMITS.bytes + 1, readText }],
        'main.txt',
      ),
    ).rejects.toThrow('32 MB');
    expect(readText).not.toHaveBeenCalled();
  });

  it('前向 edit platform 与无类型的 mover 编辑生效，删除 mover 后恢复平台位置', async () => {
    const result = await afsimFilesToDocument(
      files({
        'main.txt': `
      edit platform edited side neutral mover route position 14N 15E end_route end_mover end_platform
      platform_type A WSF_PLATFORM mover WSF_AIR_MOVER route position 1N 2E end_route end_mover end_platform_type
      platform edited A position 3N 4E end_platform
      platform deleted A position 5N 6E delete mover end_platform
    `,
      }),
      'main.txt',
    );
    expect(result.document.features.map((feature) => feature.geometry)).toEqual([
      { kind: 'point', position: { lat: 14, lon: 15 } },
      { kind: 'point', position: { lat: 5, lon: 6 } },
    ]);
    expect(parseSidc(result.document.features[0].sidc).affiliation).toBe(4);
    expect(parseSidc(result.document.features[1].sidc).symbolSet).toBe(10);
  });

  it('脚本函数调用中的引号和 on_broken/on_success 标量不会破坏块结构', async () => {
    const result = await afsimFilesToDocument(
      files({
        'main.txt': `
      script void message() writeln("unit",PLATFORM.Name()," position "); end_script
      platform_type A WSF_PLATFORM on_broken remove sensor s X on_success TRACK end_sensor end_platform_type
      platform actual A position 12N 34E end_platform
    `,
      }),
      'main.txt',
    );
    expect(result.document.features).toHaveLength(1);
  });

  it('无效 route 坐标不能回退平台位置；路线 MGRS 可以转换', async () => {
    const result = await afsimFilesToDocument(
      files({
        'main.txt': `
      platform_type A WSF_PLATFORM mover WSF_AIR_MOVER end_mover end_platform_type
      platform invalid A position 12N 34E route position 100N 34E end_route end_platform
      platform mgrs A route mgrs_coordinate 33UXP0500449998 end_route end_platform
    `,
      }),
      'main.txt',
    );
    expect(result.skipped).toBe(1);
    expect(result.document.features.map((feature) => feature.name)).toEqual(['mgrs']);
  });

  it('未闭合组件不能泄漏坐标；与关键字同名的名称和值正常解析', async () => {
    const damaged = await afsimFilesToDocument(
      files({
        'main.txt':
          'platform_type A WSF_PLATFORM sensor x TEST position 40N 50E end_platform_type platform a A end_platform',
      }),
      'main.txt',
    );
    expect(damaged.document.features).toHaveLength(0);
    expect(damaged.warnings.join('\n')).toContain('缺少 end_sensor');
    const named = await afsimFilesToDocument(
      files({
        'main.txt': 'platform platform WSF_PLATFORM icon platform position 12N 34E end_platform',
      }),
      'main.txt',
    );
    expect(named.document.features[0].name).toBe('platform');
  });

  it('自由字符串与 script 同名、清空分类和转向首航点保持格式语义', async () => {
    const result = await afsimFilesToDocument(
      files({
        'main.txt': `
      platform_type A WSF_PLATFORM side script category fighter mover WSF_AIR_MOVER end_mover end_platform_type
      platform script A clear_categories icon script position 5N 6E route turn_right 90 deg position 30N 40E end_route end_platform
    `,
      }),
      'main.txt',
    );
    expect(result.document.features[0].name).toBe('script');
    expect(result.document.features[0].geometry).toEqual({
      kind: 'point',
      position: { lat: 5, lon: 6 },
    });
    expect(parseSidc(result.document.features[0].sidc)).toMatchObject({
      entity: '00',
      entityType: '00',
      entitySubtype: '00',
    });
  });

  it('组件缺省类型时不会吞掉 end_sensor，预处理宏可展开平台类型', async () => {
    const result = await afsimFilesToDocument(
      files({
        'main.txt': `
          $define PLATFORM_TYPE WSF_PLATFORM
          platform_type A $<PLATFORM_TYPE:WSF_PLATFORM>$
            side blue
            sensor radar WSF_RADAR_SENSOR
              processor track-proc
            end_sensor
            position 12N 34E
          end_platform_type
          platform unit A end_platform
        `,
      }),
      'main.txt',
    );
    expect(result.document.features).toHaveLength(1);
    expect(result.skipped).toBe(0);
  });

  it('execute 运行块及版本标记不会阻断静态平台导入', async () => {
    const result = await afsimFilesToDocument(
      files({
        'main.txt': `
          log version $Id: main.txt,v 1.1 2020/01/01 $
          execute at_time 1 sec relative
            writeln("动态逻辑")
          end_execute
          platform unit WSF_PLATFORM position 12N 34E end_platform
        `,
      }),
      'main.txt',
    );
    expect(result.document.features).toHaveLength(1);
    expect(result.skipped).toBe(0);
  });

  it('支持省略组件类型、嵌套多分辨率组件和 mover 类型参数', async () => {
    const result = await afsimFilesToDocument(
      files({
        'main.txt': `
          multiresolution_processor MR WSF_MULTIRESOLUTION_PROCESSOR
            model low
              processor WSF_SCRIPT_PROCESSOR
              end_processor
            end_model
          end_multiresolution_processor
          multiresolution_mover MM WSF_MULTIRESOLUTION_MOVER
            model low
              mover WSF_SPACE_MOVER
              end_mover
            end_model
          end_multiresolution_mover
          platform_type A WSF_PLATFORM
            mover WSF_SPACE_MOVER
              update_interval 5 sec
            end_mover
            sensor radar WSF_RADAR_SENSOR
              processor track-proc
            end_sensor
          end_platform_type
          platform unit A position 12N 34E end_platform
        `,
      }),
      'main.txt',
    );
    expect(result.document.features).toHaveLength(1);
    expect(result.skipped).toBe(0);
  });

  it('ignore_block 参数和 track/target 内嵌 platform 不会改变块边界', async () => {
    const result = await afsimFilesToDocument(
      files({
        'main.txt': `
          ignore_block route
          platform_type A WSF_PLATFORM mover WSF_AIR_MOVER end_mover end_platform_type
          platform target A position 12N 34E end_platform
          platform fighter A position 20N 30E
            track
              target
                offset ntw -50 0 30 m
                platform target
              end_target
            end_track
          end_platform
        `,
      }),
      'main.txt',
    );
    expect(result.document.features.map((feature) => feature.name)).toEqual(['target', 'fighter']);
    expect(result.skipped).toBe(0);
  });

  it('平台引用型 inherent_contrast 与 p6dof_object_type 不会被当作嵌套块', async () => {
    const result = await afsimFilesToDocument(
      files({
        'main.txt': `
          inherent_contrast CONTRAST
            constant 1.0
          end_inherent_contrast
          platform_type A WSF_PLATFORM
            inherent_contrast CONTRAST
            mover WSF_AIR_MOVER
              p6dof_object_type AIRCRAFT
            end_mover
          end_platform_type
          platform unit A position 12N 34E end_platform
        `,
      }),
      'main.txt',
    );
    expect(result.document.features).toHaveLength(1);
    expect(result.skipped).toBe(0);
  });

  it('入口候选排除文档、原始数据和日志文件', () => {
    const paths = afsimEntryPaths(
      files({
        'demo.afproj': '<project/>',
        'main.txt': unit,
        'doc/README.txt': unit,
        'doc/changelog/update.txt': unit,
        'satcat_raw_data.txt': unit,
        'mission.log': unit,
        'scenarios/strike.txt': unit,
      }),
    );
    expect(paths).toEqual(['demo.afproj', 'main.txt', 'scenarios/strike.txt']);
  });
});
