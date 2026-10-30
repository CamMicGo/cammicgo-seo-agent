'use client';
import {createContext,useCallback,useContext,useEffect,useState,type ReactNode} from 'react';
import {isLang,LANG_COOKIE,type Dict,type Lang} from '@/lib/i18n';

type Ctx={lang:Lang;setLang:(l:Lang)=>void};
const LangContext=createContext<Ctx>({lang:'en',setLang:()=>{}});

function persist(l:Lang){
 try{localStorage.setItem('lang',l)}catch{}
 // Shared with cammicgo.com when served from a *.cammicgo.com host.
 const domain=location.hostname.endsWith('cammicgo.com')?'; Domain=.cammicgo.com':'';
 document.cookie=`${LANG_COOKIE}=${l}; Path=/; Max-Age=31536000; SameSite=Lax${domain}`;
 document.documentElement.lang=l;
 document.documentElement.dir=l==='ar'?'rtl':'ltr';
}

export function LangProvider({initial,children}:{initial:Lang;children:ReactNode}){
 const [lang,setState]=useState<Lang>(initial);
 useEffect(()=>{
  let saved:string|null=null;try{saved=localStorage.getItem('lang')}catch{}
  if(isLang(saved)&&saved!==initial){setState(saved);persist(saved)}else persist(initial);
  const onLang=(e:Event)=>{const next=(e as CustomEvent).detail;if(isLang(next)){setState(next);persist(next)}};
  window.addEventListener('cammicgo-language',onLang);
  return()=>window.removeEventListener('cammicgo-language',onLang);
 },[initial]);
 const setLang=useCallback((l:Lang)=>{setState(l);persist(l);window.dispatchEvent(new CustomEvent('cammicgo-language',{detail:l}))},[]);
 return <LangContext.Provider value={{lang,setLang}}>{children}</LangContext.Provider>;
}
export const useLang=()=>useContext(LangContext);
/** Returns the copy for the current language. */
export function useT<T>(dict:Dict<T>):T{const {lang}=useLang();return dict[lang]??dict.en;}
