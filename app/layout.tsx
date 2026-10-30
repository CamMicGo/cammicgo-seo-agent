import type {ReactNode} from 'react';
import {cookies,headers} from 'next/headers';
import './a11y.css';
import './globals.css';
import {LangProvider} from './lang-provider';
import SiteHeader from './site-header';
import AccessibilityShell from '@/components/a11y/AccessibilityShell';
import AccessibilityInteractionEnhancer from '@/components/a11y/AccessibilityInteractionEnhancer';
import AccessibilityStopGuard from '@/components/a11y/AccessibilityStopGuard';
import SpeechPronunciationGuard from '@/components/a11y/SpeechPronunciationGuard';
import {LANG_COOKIE,resolveLang} from '@/lib/i18n';
export const metadata={title:'CamMicGo SEO MCP — Free open-source MCP server',description:'Free and open-source SEO insights for AI assistants. Built by CamMicGo.',icons:{icon:'https://avatars.githubusercontent.com/u/322584442?v=4',apple:'https://avatars.githubusercontent.com/u/322584442?v=4'}};
export default async function RootLayout({children}:{children:ReactNode}){
 const lang=resolveLang((await cookies()).get(LANG_COOKIE)?.value,(await headers()).get('accept-language'));
 return <html lang={lang} dir={lang==='ar'?'rtl':'ltr'} suppressHydrationWarning><body><LangProvider initial={lang}>
  <SpeechPronunciationGuard/><SiteHeader/><AccessibilityStopGuard/><AccessibilityShell/><AccessibilityInteractionEnhancer/>
  {children}
 </LangProvider></body></html>;
}
