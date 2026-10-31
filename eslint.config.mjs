import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FlatCompat} from '@eslint/eslintrc';

const compat = new FlatCompat({baseDirectory: dirname(fileURLToPath(import.meta.url))});

export default [
  {ignores: ['.next/**', 'node_modules/**', 'android-kamiko/**', 'desktop/**', 'scripts/**', 'public/**', 'lib/gum-operation-catalog.ts', 'lib/science.mjs', 'next-env.d.ts']},
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];
