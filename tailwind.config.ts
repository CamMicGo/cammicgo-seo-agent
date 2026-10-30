import type {Config} from 'tailwindcss';

/** Tailwind is only used by the accessibility reader shared with cammicgo.com (components/a11y). */
const config:Config={
 darkMode:'class',
 content:['./components/a11y/**/*.{ts,tsx}'],
 corePlugins:{preflight:false},
 theme:{extend:{}},
 plugins:[],
};
export default config;
