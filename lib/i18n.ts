/** Same languages, storage key (localStorage "lang"), cookie ("cammicgo-lang") and change event as cammicgo.com. */
export type Lang='en'|'fr'|'es'|'de'|'pt'|'zh'|'ja'|'ko'|'ar'|'ru'|'it';
export const languages:{code:Lang;label:string;flag:string}[]=[
 {code:'en',label:'English',flag:'🇺🇸'},{code:'fr',label:'Français',flag:'🇫🇷'},{code:'es',label:'Español',flag:'🇪🇸'},
 {code:'de',label:'Deutsch',flag:'🇩🇪'},{code:'pt',label:'Português',flag:'🇵🇹'},{code:'it',label:'Italiano',flag:'🇮🇹'},
 {code:'ru',label:'Русский',flag:'🇷🇺'},{code:'zh',label:'中文',flag:'🇨🇳'},{code:'ja',label:'日本語',flag:'🇯🇵'},
 {code:'ko',label:'한국어',flag:'🇰🇷'},{code:'ar',label:'العربية',flag:'🇸🇦'},
];
export const isLang=(v:unknown):v is Lang=>typeof v==='string'&&languages.some(l=>l.code===v);
export const LANG_COOKIE='cammicgo-lang';
/** Picks the saved cookie, otherwise the best Accept-Language match, otherwise English. */
export function resolveLang(cookie:string|undefined,acceptLanguage:string|null):Lang{
 if(isLang(cookie))return cookie;
 for(const part of (acceptLanguage||'').split(',')){const code=part.trim().slice(0,2).toLowerCase();if(isLang(code))return code;}
 return 'en';
}
export type Dict<T>=Record<Lang,T>;
