import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

/**
 * ESLint 9 扁平配置（Flat Config）。
 *
 * 规则分层：
 *   1. 通用 JS / TS 规则
 *   2. TypeScript 类型感知规则（仅对 src 生效，避免拖慢构建脚本检查）
 *   3. React Hooks / React Refresh 规则
 *   4. Prettier 关闭所有风格类冲突规则（风格统一交给 Prettier）
 */
export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', '.reference', 'public', '.npm-cache'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // 允许使用 any 之外的显式未知类型，但禁止隐式 any
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // 军事符号编号（SIDC）等常量需要保留下划线命名风格
      camelcase: 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
    },
  },
  {
    // 构建脚本允许使用 Node 全局对象
    files: ['vite.config.ts', 'vitest.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // 必须放在最后：关闭与 Prettier 冲突的规则
  prettierConfig,
);
