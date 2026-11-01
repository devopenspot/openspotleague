import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextConfig from 'eslint-config-next';

const REACT_RULES_TO_SKIP = new Set([
  'react/display-name',
  'react/jsx-no-comment-textnodes',
  'react/jsx-no-duplicate-props',
  'react/jsx-no-target-blank',
  'react/jsx-no-undef',
  'react/jsx-uses-react',
  'react/jsx-uses-vars',
  'react/no-children-prop',
  'react/no-danger-with-children',
  'react/no-deprecated',
  'react/no-direct-mutation-state',
  'react/no-find-dom-node',
  'react/no-is-mounted',
  'react/no-render-return-value',
  'react/no-string-refs',
  'react/no-unescaped-entities',
  'react/no-unknown-property',
  'react/no-unsafe',
  'react/prop-types',
  'react/react-in-jsx-scope',
  'react/require-render-return',
]);

function sanitizeNextConfig(configs) {
  return configs.map((entry) => {
    if (!entry?.rules) return entry;
    const next = { ...entry.rules };
    for (const key of Object.keys(next)) {
      if (REACT_RULES_TO_SKIP.has(key)) delete next[key];
    }
    return { ...entry, rules: next };
  });
}

export default [
  {
    ignores: ['.next/**', 'dist/**', 'node_modules/**', 'coverage/**', 'supabase/migrations/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...sanitizeNextConfig(nextConfig),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
    },
  },
];
