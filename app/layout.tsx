import type {ReactNode} from 'react';
import {cookies,headers} from 'next/headers';
import './globals.css';
import {LangProvider} from './lang-provider';
import {LANG_COOKIE,resolveLang} from '@/lib/i18n';
export const metadata={title:'CamMicGo SEO Agent — Free Open Source MCP',description:'Free and open-source SEO insights for AI assistants. Built by CamMicGo.',icons:{icon:'https://avatars.githubusercontent.com/u/322584442?v=4',apple:'https://avatars.githubusercontent.com/u/322584442?v=4'}};
export default async function RootLayout({children}:{children:ReactNode}){
 const lang=resolveLang((await cookies()).get(LANG_COOKIE)?.value,(await headers()).get('accept-language'));
 return <html lang={lang} dir={lang==='ar'?'rtl':'ltr'}><body><LangProvider initial={lang}>{children}</LangProvider></body></html>;
}
