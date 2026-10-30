'use client';

import Link from 'next/link';
import {Switch} from '@headlessui/react';
import {useEffect,useMemo,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import type {Lang} from '@/lib/i18n';
import {useSiteLanguage} from '@/components/useSiteLanguage';
import {accessibilityCopy,languageLabels,languageOrder,speechLocale,technicalSpeech} from '@/lib/accessibility-i18n';

type ReaderState='idle'|'speaking'|'paused';
type SpeechItem={el?:HTMLElement|null;text:string;pause?:number};
type Extra={reader:string;settings:string;voiceMissing:string;installVoice:string;inactive:string;touchHint:string;okabe:string};

const extra:Record<Lang,Extra>={
 en:{reader:'Voice reader',settings:'Accessibility settings',voiceMissing:'No compatible voice is installed for this language.',installVoice:'Install a compatible voice',inactive:'Reader stopped',touchHint:'Touch text to continue reading from that section. Buttons and links work with one tap; buttons are announced when activated.',okabe:'Use the Okabe–Ito palette for status colours and test feedback.'},
 fr:{reader:'Lecteur vocal',settings:'Réglages d’accessibilité',voiceMissing:'Aucune voix compatible n’est installée pour cette langue.',installVoice:'Installer une voix compatible',inactive:'Lecture arrêtée',touchHint:'Touchez une zone de texte pour reprendre la lecture à cet endroit et poursuivre. Boutons et liens fonctionnent dès le premier appui ; les boutons sont annoncés à l’activation.',okabe:'Utilise la palette Okabe–Ito pour les couleurs d’état et les retours visuels des tests.'},
 es:{reader:'Lector de voz',settings:'Ajustes de accesibilidad',voiceMissing:'No hay una voz compatible instalada para este idioma.',installVoice:'Instalar una voz compatible',inactive:'Lectura detenida',touchHint:'Toca un texto para leer su sección. En botones y enlaces, toca una vez para oírlo y otra vez para activarlo.',okabe:'Usa la paleta Okabe–Ito para los estados y señales visuales de las pruebas.'},
 de:{reader:'Sprachleser',settings:'Barrierefreiheit',voiceMissing:'Für diese Sprache ist keine passende Stimme installiert.',installVoice:'Passende Stimme installieren',inactive:'Lesen gestoppt',touchHint:'Tippe auf einen Textbereich, um ab dort weiterzulesen. Schaltflächen und Links funktionieren mit einer Berührung; Schaltflächen werden bei Aktivierung vorgelesen.',okabe:'Verwendet die Okabe–Ito-Palette für Statusfarben und visuelle Testergebnisse.'},
 pt:{reader:'Leitor de voz',settings:'Definições de acessibilidade',voiceMissing:'Não existe uma voz compatível instalada para este idioma.',installVoice:'Instalar uma voz compatível',inactive:'Leitura parada',touchHint:'Toque num texto para ler imediatamente a secção. Em botões e ligações, toque uma vez para ouvir e outra para ativar.',okabe:'Usa a paleta Okabe–Ito nas cores de estado e nos sinais visuais dos testes.'},
 zh:{reader:'语音朗读',settings:'无障碍设置',voiceMissing:'此语言没有安装兼容的语音。',installVoice:'安装兼容语音',inactive:'朗读已停止',touchHint:'轻触文字即可直接朗读所在部分。按钮或链接第一次轻触朗读说明，第二次轻触才会激活。',okabe:'使用 Okabe–Ito 配色显示状态和测试反馈。'},
 ja:{reader:'音声読み上げ',settings:'アクセシビリティ設定',voiceMissing:'この言語に対応する音声がインストールされていません。',installVoice:'対応する音声をインストール',inactive:'読み上げ停止',touchHint:'文章に触れると、そのセクションをすぐに読み上げます。ボタンやリンクは1回目で説明、2回目で実行します。',okabe:'状態表示とテスト結果に岡部・伊藤（Okabe–Ito）配色を使用します。'},
 ko:{reader:'음성 읽기',settings:'접근성 설정',voiceMissing:'이 언어에 맞는 음성이 설치되어 있지 않습니다.',installVoice:'호환 음성 설치',inactive:'읽기 중지됨',touchHint:'텍스트를 누르면 해당 섹션을 바로 읽습니다. 버튼과 링크는 한 번 눌러 설명을 듣고 같은 항목을 다시 눌러 실행합니다.',okabe:'상태 색상과 테스트 피드백에 Okabe–Ito 팔레트를 사용합니다.'},
 ar:{reader:'القارئ الصوتي',settings:'إعدادات إمكانية الوصول',voiceMissing:'لا يوجد صوت متوافق مثبت لهذه اللغة.',installVoice:'تثبيت صوت متوافق',inactive:'تم إيقاف القراءة',touchHint:'المس النص لقراءة القسم مباشرة. بالنسبة إلى الزر أو الرابط، المسه مرة لسماع وصفه ثم مرة ثانية لتفعيله.',okabe:'يستخدم لوحة Okabe–Ito لألوان الحالة والتنبيهات المرئية في الاختبارات.'},
 ru:{reader:'Голосовое чтение',settings:'Настройки доступности',voiceMissing:'Для этого языка не установлен совместимый голос.',installVoice:'Установить совместимый голос',inactive:'Чтение остановлено',touchHint:'Коснитесь текста, чтобы сразу прочитать его раздел. Кнопку или ссылку коснитесь один раз для озвучивания и второй раз для активации.',okabe:'Использует палитру Okabe–Ito для статусов и визуальных подсказок тестов.'},
 it:{reader:'Lettore vocale',settings:'Impostazioni accessibilità',voiceMissing:'Non è installata una voce compatibile per questa lingua.',installVoice:'Installa una voce compatibile',inactive:'Lettura arrestata',touchHint:'Tocca un testo per leggere subito la sezione. Per pulsanti e link, tocca una volta per ascoltare e una seconda volta per attivare.',okabe:'Usa la palette Okabe–Ito per stati e feedback visivi dei test.'}
};

const INTERACTIVE='a[href],button,input:not([type="hidden"]),select,textarea,summary,[role="button"],[role="switch"]';
const READABLE=`[data-speech-card="true"],h1,h2,h3,h4,h5,h6,p,li,dt,dd,figcaption,blockquote,legend,caption,th,td,img[alt],${INTERACTIVE},[data-speech],[data-speech-readable],[data-capture-card="true"],[role="alert"],[role="status"],[role="note"],[role="tooltip"]`;
const SECTION='[data-speech-card="true"],[data-speech-section],section,article,[role="region"],[data-capture-card="true"],li';
const REVEALABLE='[role="dialog"],[role="menu"],[role="listbox"],[role="navigation"],[role="tooltip"],nav,aside,[aria-modal="true"],[data-speech-region],[data-state="open"]';
const clean=(s:string)=>s.replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const visible=(el:HTMLElement)=>{if(el.closest('[hidden],[aria-hidden="true"],[data-speech-ignore]'))return false;const st=getComputedStyle(el);return st.display!=='none'&&st.visibility!=='hidden'&&el.getClientRects().length>0};
const base=(s:string)=>s.toLowerCase().replace('_','-').split('-')[0];
function chooseVoice(list:SpeechSynthesisVoice[],locale:string){const target=locale.toLowerCase().replace('_','-'),same=list.filter(v=>base(v.lang)===base(target));return same.find(v=>v.lang.toLowerCase().replace('_','-')===target)||same.find(v=>v.localService&&v.default)||same.find(v=>v.localService)||same.find(v=>v.default)||same[0]||null}
function languageName(code:Lang,lang:Lang){try{return new Intl.DisplayNames([speechLocale[lang]],{type:'language'}).of(code)||code}catch{return code}}
function speechText(text:string,lang:Lang){const t=technicalSpeech[lang],okabe=lang==='ja'?'おかべ いとう':'Okabe Ito';return clean(text).replace(/\bGA\s*4\b/gi,lang==='fr'?'Google Analytics':'Google Analytics').replace(/Okabe[\s–—-]*Ito/gi,okabe).replace(/\bREAL\s+FPS\b/gi,t.fps).replace(/\bFPS\b/gi,t.fps).replace(/\bCPU\b/gi,t.cpu).replace(/\bGPU\b/gi,t.gpu)}
function splitText(text:string,lang:Lang,max=420){const n=speechText(text,lang);if(!n)return[];const p=n.match(/[^.!?…;:。！？；：]+[.!?…;:。！？；：]+|[^.!?…;:。！？；：]+$/g)??[n],out:string[]=[];let cur='';for(const part of p){const nx=`${cur} ${part}`.trim();if(nx.length<=max)cur=nx;else{if(cur)out.push(cur);cur=part.trim()}}if(cur)out.push(cur);return out}

function SettingSwitch({checked,onChange,label,state}:{checked:boolean;onChange:(v:boolean)=>void;label:string;state:string}){return <div className="flex shrink-0 flex-col items-end gap-1"><Switch checked={checked} onChange={onChange} aria-label={`${label}: ${state}`} className="group relative inline-flex h-7 w-12 cursor-pointer rounded-full bg-slate-300 p-1 transition data-[checked]:bg-blue-600 dark:bg-slate-700"><span aria-hidden="true" className="pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm transition group-data-[checked]:translate-x-5"/></Switch><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{state}</span></div>}

export default function AccessibilityCenterV3(){
 const siteLang=useSiteLanguage(),pathname=usePathname(),ui=accessibilityCopy[siteLang],x=extra[siteLang];
 const[readerStopped,setReaderStopped]=useState(false),[open,setOpen]=useState(false),[barCollapsed,setBarCollapsed]=useState(false),[okabe,setOkabe]=useState(false),[focusMode,setFocusMode]=useState(true),[enabled,setEnabled]=useState(false),[supported,setSupported]=useState(false),[state,setState]=useState<ReaderState>('idle'),[voiceLang,setVoiceLang]=useState<Lang>(siteLang),[voices,setVoices]=useState<SpeechSynthesisVoice[]>([]),[dark,setDark]=useState(false);
 const stateRef=useRef<ReaderState>('idle'),enabledRef=useRef(false),token=useRef(0),queue=useRef<SpeechItem[]>([]),index=useRef(0),after=useRef<SpeechItem[]>([]),pauseAfter=useRef(false),highlighted=useRef<HTMLElement|null>(null),pendingLanguageResume=useRef<{el:HTMLElement|null;paused:boolean;active:boolean}|null>(null),armed=useRef<{el:HTMLElement|null;at:number}>({el:null,at:0}),allowClick=useRef<HTMLElement|null>(null),blockClick=useRef<{el:HTMLElement|null;until:number}>({el:null,until:0}),lastHover=useRef<HTMLElement|null>(null);
 const voice=useMemo(()=>chooseVoice(voices,speechLocale[voiceLang]),[voices,voiceLang]);
 useEffect(()=>{stateRef.current=state},[state]);useEffect(()=>{enabledRef.current=enabled},[enabled]);
 useEffect(()=>{setSupported('speechSynthesis'in window);setEnabled(localStorage.getItem('cammicgo-read-aloud')==='1');setReaderStopped(localStorage.getItem('cammicgo-reader-stopped')==='1');setOkabe(localStorage.getItem('cammicgo-colorblind')==='1');setFocusMode(localStorage.getItem('cammicgo-focus')!=='0');setDark(document.documentElement.classList.contains('dark'));const load=()=>setVoices(speechSynthesis.getVoices());load();speechSynthesis.addEventListener?.('voiceschanged',load);const mo=new MutationObserver(()=>setDark(document.documentElement.classList.contains('dark')));mo.observe(document.documentElement,{attributes:true,attributeFilter:['class']});return()=>{speechSynthesis.removeEventListener?.('voiceschanged',load);mo.disconnect()}},[]);
 useEffect(()=>{const fn=()=>setOpen(true);window.addEventListener('cammicgo-open-accessibility',fn);return()=>window.removeEventListener('cammicgo-open-accessibility',fn)},[]);
 useEffect(()=>{window.dispatchEvent(new CustomEvent<boolean>('cammicgo-accessibility-state',{detail:open}))},[open]);
 useEffect(()=>{const current=queue.current[index.current]?.el||highlighted.current;const active=stateRef.current!=='idle';pendingLanguageResume.current={el:current||null,paused:stateRef.current==='paused',active};try{speechSynthesis.cancel()}catch{};token.current++;queue.current=[];after.current=[];index.current=0;pauseAfter.current=false;clearHighlight();setState('idle');setVoiceLang(siteLang);localStorage.setItem('cammicgo-voice-lang',siteLang)},[siteLang]);
 useEffect(()=>{document.documentElement.toggleAttribute('data-colorblind',okabe);localStorage.setItem('cammicgo-colorblind',okabe?'1':'0')},[okabe]);
 useEffect(()=>{document.documentElement.dataset.enhancedFocus=focusMode?'true':'false';localStorage.setItem('cammicgo-focus',focusMode?'1':'0')},[focusMode]);
 useEffect(()=>{localStorage.setItem('cammicgo-read-aloud',enabled?'1':'0')},[enabled]);

 const clearHighlight=()=>{highlighted.current?.removeAttribute('data-a11y-reading');highlighted.current=null};
 const stopSpeech=()=>{token.current++;try{speechSynthesis.cancel()}catch{}queue.current=[];after.current=[];index.current=0;pauseAfter.current=false;clearHighlight();setState('idle')};
 useEffect(()=>{stopSpeech()},[pathname]);
 const highlight=(el?:HTMLElement|null,scroll=true)=>{clearHighlight();if(!el||!visible(el))return;el.setAttribute('data-a11y-reading','true');highlighted.current=el;if(scroll){const r=el.getBoundingClientRect();if(r.top<120||r.bottom>innerHeight-70)el.scrollIntoView({behavior:'smooth',block:'center'})}};
 const labelledBy=(el:HTMLElement)=>(el.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').filter(Boolean).join(' ');
 const describedBy=(el:HTMLElement)=>(el.getAttribute('aria-describedby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').filter(Boolean).join(' ');
 const label=(el:HTMLElement)=>clean(el.dataset.speech||el.getAttribute('aria-label')||labelledBy(el)||(el instanceof HTMLInputElement||el instanceof HTMLSelectElement||el instanceof HTMLTextAreaElement?el.labels?.[0]?.textContent||'':'')||(el instanceof HTMLImageElement?el.alt:'')||el.getAttribute('title')||el.innerText||el.textContent||'');
 const describe=(el:HTMLElement)=>{const l=label(el);if(!l)return'';const ex=el.getAttribute('aria-expanded'),statePart=ex==='true'?`, ${ui.open}`:ex==='false'?`, ${ui.closed}`:'',desc=clean(describedBy(el));if(el instanceof HTMLSelectElement){const v=el.value as Lang,sel=languageOrder.includes(v)?languageName(v,voiceLang):clean(el.selectedOptions[0]?.textContent||'');return`${ui.select}: ${l}, ${ui.selected}: ${sel}`};if(el instanceof HTMLAnchorElement)return`${ui.link}: ${l}${statePart}${desc?`. ${desc}`:''}`;if(el instanceof HTMLButtonElement||el.getAttribute('role')==='button'||el.tagName==='SUMMARY')return`${ui.button}: ${l}${statePart}${desc?`. ${desc}`:''}`;if(el.getAttribute('role')==='switch')return`${ui.switch}: ${l}, ${el.getAttribute('aria-checked')==='true'?ui.on:ui.off}`;if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)return`${ui.field}: ${l}`;return l};
 const readable=(el:HTMLElement)=>el.matches(INTERACTIVE)?describe(el):el instanceof HTMLImageElement?`${ui.image}: ${el.alt}`:clean(el.dataset.speech||el.innerText||el.textContent||'');
 const item=(el:HTMLElement,pause=800):SpeechItem=>({el,text:readable(el),pause});
 const itemsIn=(root:HTMLElement)=>{
  const out:SpeechItem[]=[];const seen=new Set<HTMLElement>();
  const add=(el:HTMLElement,pause:number)=>{if(seen.has(el)||!visible(el))return;const t=readable(el);if(t){seen.add(el);out.push({el,text:t,pause})}};
  const nodes=[root,...root.querySelectorAll<HTMLElement>(READABLE)];
  for(const el of nodes){
   if(!el.matches(READABLE)||!visible(el)||el.closest('[data-speech-ignore]'))continue;
   const card=el.closest<HTMLElement>('[data-speech-card="true"]');
   if(card&&card!==el)continue;
   if(el.hasAttribute('data-speech-card')){add(el,1100);continue}
   if(el.querySelector('[data-speech-card="true"]')&&!el.hasAttribute('data-speech'))continue;
   if(!el.hasAttribute('data-speech')&&el.querySelector('[data-speech]'))continue;
   const speechParent=el.parentElement?.closest<HTMLElement>('[data-speech]');if(speechParent&&root.contains(speechParent))continue;
   const parent=el.parentElement?.closest<HTMLElement>(INTERACTIVE);if(parent&&root.contains(parent)&&!el.matches(INTERACTIVE))continue;
   add(el,el.matches('h1,h2,h3')?750:el.matches('h4,h5,h6')?550:460)
  }
  return out
 };
 const pageItems=()=>{const body=document.body;if(!body)return[];return itemsIn(body)};
 const makeUtterance=(text:string)=>{if(!voice)return null;const u=new SpeechSynthesisUtterance(text);u.lang=speechLocale[voiceLang];u.voice=voice;u.rate=['zh','ja','ko','ar'].includes(voiceLang)?.72:.78;return u};
 const speakNext=(id:number)=>{if(!enabledRef.current||id!==token.current)return;const cur=queue.current[index.current];if(!cur){clearHighlight();if(after.current.length&&!pauseAfter.current){queue.current=after.current.splice(0);index.current=0;speakNext(id);return}after.current=[];if(pauseAfter.current){pauseAfter.current=false;setState('paused')}else setState('idle');return}const parts=splitText(cur.text,voiceLang);if(!parts.length){index.current++;speakNext(id);return}let ci=0;const next=()=>{if(!enabledRef.current||id!==token.current)return;const part=parts[ci++];if(!part){index.current++;window.setTimeout(()=>speakNext(id),cur.pause??450);return}const u=makeUtterance(part);if(!u){setState('idle');return}u.onstart=()=>{if(enabledRef.current&&id===token.current){setState('speaking');highlight(cur.el)}};u.onend=()=>{if(enabledRef.current&&id===token.current)window.setTimeout(next,ci<parts.length?240:(cur.pause??450))};u.onerror=()=>{if(enabledRef.current&&id===token.current){index.current++;speakNext(id)}};speechSynthesis.speak(u)};next()};
 const play=(items:SpeechItem[],rest:SpeechItem[]=[],returnToPause=false)=>{if(!enabledRef.current||!voice||!items.length)return;token.current++;try{speechSynthesis.cancel()}catch{}clearHighlight();queue.current=items;after.current=rest;index.current=0;pauseAfter.current=returnToPause;const id=++token.current;setState('speaking');speakNext(id)};
 useEffect(()=>{
  const pending=pendingLanguageResume.current;
  if(!pending||!voice||!enabledRef.current)return;
  pendingLanguageResume.current=null;
  if(!pending.active)return;
  const timer=window.setTimeout(()=>{
   const all=pageItems();
   if(!all.length)return;
   const anchor=pending.el;
   let at=anchor?all.findIndex(it=>it.el===anchor||Boolean(it.el&&anchor.contains(it.el))):0;
   if(at<0)at=0;
   const remaining=all.slice(at);
   if(remaining.length)play(remaining,[],pending.paused);
  },140);
  return()=>window.clearTimeout(timer);
 },[siteLang,voiceLang,voice]);

 const enableReader=()=>{setReaderStopped(false);localStorage.setItem('cammicgo-reader-stopped','0');if(!enabledRef.current){enabledRef.current=true;setEnabled(true);localStorage.setItem('cammicgo-read-aloud','1')}};
 const start=()=>{if(!voice)return;enableReader();play(pageItems())};
 useEffect(()=>{let saved:SpeechItem[]|null=null;const onLocalStart=()=>{if(stateRef.current==='speaking'||stateRef.current==='paused'){saved=[...queue.current.slice(index.current),...after.current];stopSpeech()}};const onLocalEnd=()=>{const resume=saved;saved=null;if(enabledRef.current&&resume?.length)play(resume)};window.addEventListener('cammicgo-mail-audio-start',onLocalStart);window.addEventListener('cammicgo-mail-audio-end',onLocalEnd);return()=>{window.removeEventListener('cammicgo-mail-audio-start',onLocalStart);window.removeEventListener('cammicgo-mail-audio-end',onLocalEnd)}},[voice]);
 // Never resume speech when a tab or browser window regains focus.
 useEffect(()=>{const suspend=()=>{token.current++;try{speechSynthesis.cancel()}catch{}queue.current=[];after.current=[];index.current=0;pauseAfter.current=false;pendingLanguageResume.current=null;lastHover.current=null;clearHighlight();stateRef.current='idle';setState('idle')};const onVisibility=()=>{if(document.hidden)suspend()};document.addEventListener('visibilitychange',onVisibility);window.addEventListener('blur',suspend);window.addEventListener('pagehide',suspend);return()=>{document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('blur',suspend);window.removeEventListener('pagehide',suspend)}},[]);
 const stopReader=()=>{setReaderStopped(true);localStorage.setItem('cammicgo-reader-stopped','1');enabledRef.current=false;setEnabled(false);localStorage.setItem('cammicgo-read-aloud','0');pendingLanguageResume.current=null;lastHover.current=null;stateRef.current='idle';stopSpeech();};
 const togglePause=()=>{if(!enabledRef.current){start();return}if(stateRef.current==='speaking'){try{speechSynthesis.pause()}catch{}setState('paused')}else if(stateRef.current==='paused'){try{speechSynthesis.resume()}catch{}setState('speaking')}else start()};
 const sectionFor=(el:HTMLElement)=>{const atomic=el.closest<HTMLElement>('[data-speech-card="true"]');if(atomic&&visible(atomic))return atomic;const s=el.closest<HTMLElement>(SECTION);return s&&visible(s)?s:el};
 const continuationAfter=(section:HTMLElement)=>{const all=pageItems();let last=-1;all.forEach((it,i)=>{if(it.el&&(it.el===section||section.contains(it.el)))last=i});return last>=0?all.slice(last+1):[]};
 const continuationAfterElement=(el:HTMLElement)=>{const all=pageItems();let at=all.findIndex(it=>it.el===el);if(at<0)at=all.findIndex(it=>Boolean(it.el&&(el.contains(it.el)||it.el.contains(el))));return at>=0?all.slice(at+1):[]};
 const readSection=(section:HTMLElement)=>{if(!enabledRef.current)return;const atomic=section.matches('[data-speech-card="true"]');const its=atomic?[item(section)]:itemsIn(section);const remaining=continuationAfter(section);play(its.length?its:[item(section)],remaining,false)};
 const visibleRegions=()=>new Set([...document.querySelectorAll<HTMLElement>(REVEALABLE)].filter(visible));
 const openedRegion=(trigger:HTMLElement,before:Set<HTMLElement>)=>{for(const id of (trigger.getAttribute('aria-controls')||'').split(/\s+/).filter(Boolean)){const el=document.getElementById(id);if(el instanceof HTMLElement&&visible(el)&&(!before.has(el)||trigger.getAttribute('aria-expanded')==='true'))return el}return [...document.querySelectorAll<HTMLElement>(REVEALABLE)].find(el=>visible(el)&&!before.has(el)&&!el.contains(trigger))||null};
 const announceControl=(el:HTMLElement,before?:Set<HTMLElement>)=>{if(!enabledRef.current)return;window.setTimeout(()=>{if(!enabledRef.current)return;const region=el.isConnected&&before?openedRegion(el,before):null,follow=continuationAfterElement(el);if(region){play([item(el),...itemsIn(region)],follow,false);return}play([item(el)],follow,false)},70)};
 const inReaderBar=(el:HTMLElement)=>Boolean(el.closest('[data-a11y-reader-bar="true"]'));
 const announceReaderBarItem=(el:HTMLElement)=>{if(!enabledRef.current)return;play([item(el)],continuationAfterElement(el),false)};

 useEffect(()=>{
  if(!open||!enabledRef.current||!voice)return;
  const timer=window.setTimeout(()=>{
   const dialog=document.getElementById('a11y-dialog');
   if(!(dialog instanceof HTMLElement)||!visible(dialog))return;
   const wasPaused=stateRef.current==='paused';
   const wasActive=stateRef.current==='speaking'||wasPaused;
   const remaining=wasActive?[...queue.current.slice(index.current),...after.current]:[];
   const dialogItems=itemsIn(dialog);
   if(dialogItems.length)play(dialogItems,remaining,wasPaused);
  },120);
  return()=>window.clearTimeout(timer);
 },[open]);

 useEffect(()=>{if(!supported)return;
  const target=(v:EventTarget|null)=>{
    if(!(v instanceof Element))return null;
    // Interactive descendants must take priority over speech cards.
    return v.closest<HTMLElement>(INTERACTIVE)||v.closest<HTMLElement>('[data-speech-card="true"]')||v.closest<HTMLElement>(READABLE);
  };
  const ignored=(el:HTMLElement)=>Boolean(el.closest('[data-speech-ignore]'));
  const announce=(el:HTMLElement)=>{
    if(!visible(el)||ignored(el)||inReaderBar(el))return;
    if(el.matches(INTERACTIVE))play([item(el)],[],false);
    else readSection(sectionFor(el));
  };
  // Mouse hover remains independent of touch handling.
  const hover=(e:PointerEvent)=>{
    if(!enabledRef.current||e.pointerType!=='mouse'||document.hidden||!document.hasFocus())return;
    const el=target(e.target);
    if(!el||!visible(el)||ignored(el)||inReaderBar(el))return;
    const area=el.matches(INTERACTIVE)?el:sectionFor(el);
    if(lastHover.current===area)return;
    lastHover.current=area;announce(el);
  };
  const out=(e:PointerEvent)=>{if(e.pointerType!=='mouse')return;const el=target(e.target);if(!el)return;const related=e.relatedTarget instanceof Node?e.relatedTarget:null;if(!related||!el.contains(related))lastHover.current=null};

  // Read while exploring with a finger. Use Touch Events because a browser
  // may cancel Pointer Events as soon as native scrolling starts.
  let origin:{x:number;y:number;exploring:boolean;last:HTMLElement|null}|null=null;
  let suppressUntil=0;
  const touchStart=(e:TouchEvent)=>{
    if(!enabledRef.current||document.hidden||e.touches.length!==1){origin=null;return}
    const t=e.touches[0];origin={x:t.clientX,y:t.clientY,exploring:false,last:null};
  };
  const touchMove=(e:TouchEvent)=>{
    if(!enabledRef.current||!origin||e.touches.length!==1)return;
    const t=e.touches[0];
    if(Math.hypot(t.clientX-origin.x,t.clientY-origin.y)<10&&!origin.exploring)return;
    origin.exploring=true;
    const el=target(document.elementFromPoint(t.clientX,t.clientY));
    if(!el||!visible(el)||ignored(el)||inReaderBar(el))return;
    const area=el.matches(INTERACTIVE)?el:sectionFor(el);
    if(origin.last===area)return;
    origin.last=area;announce(el);
  };
  const touchEnd=(e:TouchEvent)=>{
    if(origin?.exploring){
      // Suppress only a synthetic click generated after an exploration gesture.
      suppressUntil=Date.now()+450;
    }else if(enabledRef.current&&origin&&!document.hidden){
      const t=e.changedTouches[0];const el=t?target(document.elementFromPoint(t.clientX,t.clientY)):null;
      if(el&&!el.matches(INTERACTIVE)&&!el.closest(INTERACTIVE)&&!ignored(el)&&!inReaderBar(el))readSection(sectionFor(el));
    }
    origin=null;
  };
  const touchCancel=()=>{if(origin?.exploring)suppressUntil=Date.now()+450;origin=null};
  const captureClick=(e:MouseEvent)=>{
    if(!enabledRef.current||Date.now()>suppressUntil||e.detail===0)return;
    suppressUntil=0;e.preventDefault();e.stopImmediatePropagation();
  };
  const click=(e:MouseEvent)=>{
    if(!enabledRef.current||document.hidden)return;
    const el=target(e.target);
    if(!el||!visible(el)||ignored(el)||inReaderBar(el)||!el.matches(INTERACTIVE))return;
    if(el instanceof HTMLAnchorElement)return;
    announceControl(el,visibleRegions());
  };
  document.addEventListener('pointerover',hover,true);
  document.addEventListener('pointerout',out,true);
  document.addEventListener('touchstart',touchStart,{passive:true,capture:true});
  document.addEventListener('touchmove',touchMove,{passive:true,capture:true});
  document.addEventListener('touchend',touchEnd,{passive:true,capture:true});
  document.addEventListener('touchcancel',touchCancel,{passive:true,capture:true});
  document.addEventListener('click',captureClick,true);
  document.addEventListener('click',click,false);
  return()=>{
    document.removeEventListener('pointerover',hover,true);
    document.removeEventListener('pointerout',out,true);
    document.removeEventListener('touchstart',touchStart,true);
    document.removeEventListener('touchmove',touchMove,true);
    document.removeEventListener('touchend',touchEnd,true);
    document.removeEventListener('touchcancel',touchCancel,true);
    document.removeEventListener('click',captureClick,true);
    document.removeEventListener('click',click,false);
  };
 },[supported,voice,voiceLang,siteLang]);

 const changeVoice=(l:Lang)=>{const anchor=queue.current[index.current]?.el||highlighted.current;const active=stateRef.current!=='idle';pendingLanguageResume.current={el:anchor||null,paused:stateRef.current==='paused',active};stopSpeech();setVoiceLang(l);localStorage.setItem('cammicgo-voice-lang',l)};
 const voiceHelpHref=`https://cammicgo.com/voice-packs?lang=${voiceLang}`;
 const status=state==='speaking'?ui.read:state==='paused'?ui.pause:x.inactive;
 return <>
  {supported&&<div data-a11y-reader-bar="true" className="sticky top-[var(--sh-h,72px)] z-[180] w-full border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95"><div className="mx-auto flex max-w-[820px] items-center gap-2 px-3 py-2"><span className={`h-2.5 w-2.5 rounded-full ${state==='speaking'?'bg-emerald-500':state==='paused'?'bg-amber-500':'bg-slate-400'}`}/><div className="min-w-0 flex-1" data-speech-section="true"><div data-speech-readable="true" tabIndex={0} aria-label={`${x.reader} · ${languageLabels[voiceLang]}`} className="truncate rounded text-xs font-black">{x.reader} · {languageLabels[voiceLang]}</div>{!barCollapsed&&<div data-speech-readable="true" tabIndex={0} aria-label={`${voice?.name||x.voiceMissing} · ${status}`} className="truncate rounded text-[10px] text-slate-400">{voice?.name||x.voiceMissing} · {status}</div>}</div>{!barCollapsed&&<><button type="button" onClick={togglePause} disabled={!voice} className="grid h-10 min-w-10 place-items-center rounded-lg bg-blue-600 text-white disabled:opacity-40" aria-label={state==='paused'?ui.resume:state==='speaking'?ui.pause:ui.listen}>{state==='speaking'?<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></svg>:<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M7 4.5a1 1 0 0 1 1.52-.85l12 7.5a1 1 0 0 1 0 1.7l-12 7.5A1 1 0 0 1 7 19.5z"/></svg>}</button><button type="button" onClick={stopReader} aria-pressed={readerStopped} className={`grid h-10 min-w-10 place-items-center rounded-lg border ${readerStopped?'border-blue-600 bg-blue-600 text-white':'border-slate-200 dark:border-white/10'}`} aria-label={ui.stop}><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="1"/></svg></button><button type="button" onClick={()=>setOpen(true)} className="grid h-10 min-w-10 place-items-center rounded-lg border border-slate-200 dark:border-white/10" aria-label={x.settings} aria-haspopup="dialog" aria-controls="a11y-dialog" aria-expanded={open}>⚙</button></>}<button type="button" onClick={()=>setBarCollapsed(v=>!v)} className="grid h-9 min-w-9 place-items-center rounded-lg border border-slate-200 dark:border-white/10" aria-label={barCollapsed?ui.expand:ui.collapse} aria-expanded={!barCollapsed}>{barCollapsed?'⌄':'⌃'}</button></div></div>}
  {open&&<div id="a11y-dialog" role="dialog" aria-modal="true" aria-labelledby="a11y-title" className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-5" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}><div className="max-h-[92svh] w-full overflow-y-auto rounded-t-[2rem] border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:max-w-xl sm:rounded-[2rem] sm:p-7"><div className="flex items-start justify-between gap-4"><div><img src={dark?'/brand/cammicgo-logo-dark.svg':'/brand/cammicgo-logo.svg'} alt="CamMicGo" className="h-9 w-auto"/><h2 id="a11y-title" className="mt-4 text-2xl font-black">{ui.title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{ui.subtitle}</p></div><button type="button" onClick={()=>setOpen(false)} aria-label={ui.close} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-xl dark:border-white/10">×</button></div><p className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">{x.touchHint}</p><div className="mt-5 space-y-3"><div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"><div className="flex gap-4"><div className="flex-1"><h3 className="font-black">Okabe–Ito</h3><p className="mt-1 text-sm text-slate-500">{x.okabe}</p></div><SettingSwitch checked={okabe} onChange={setOkabe} label="Okabe–Ito" state={okabe?ui.on:ui.off}/></div></div><div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"><div className="flex gap-4"><div className="flex-1"><h3 className="font-black">{ui.focus}</h3><p className="mt-1 text-sm text-slate-500">{ui.focusHelp}</p></div><SettingSwitch checked={focusMode} onChange={setFocusMode} label={ui.focus} state={focusMode?ui.on:ui.off}/></div></div><div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"><div className="flex gap-4"><div className="flex-1"><h3 className="font-black">{ui.read}</h3><p className="mt-1 text-sm text-slate-500">{ui.readHelp}</p></div><SettingSwitch checked={enabled} onChange={v=>{if(!v){stopReader()}else{enableReader()}}} label={ui.read} state={enabled?ui.on:ui.off}/></div><label className="mt-4 block"><span className="mb-1 block text-xs font-bold text-slate-500">{ui.voiceLanguage}</span><select aria-label={ui.voiceLanguage} value={voiceLang} onChange={e=>changeVoice(e.target.value as Lang)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-semibold dark:border-white/10 dark:bg-slate-950">{languageOrder.map(code=><option key={code} value={code}>{languageLabels[code]}</option>)}</select></label>{!voice&&<div className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">{x.voiceMissing} <Link href={voiceHelpHref} onClick={()=>setOpen(false)} className="font-black underline">{x.installVoice}</Link></div>}<div className="mt-4 flex gap-2"><button type="button" onClick={togglePause} disabled={!voice} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">{state==='paused'?ui.resume:state==='speaking'?ui.pause:ui.listen}</button><button type="button" onClick={stopReader} aria-pressed={readerStopped} className={`rounded-xl border px-4 py-3 text-sm font-black ${readerStopped?'border-blue-600 bg-blue-600 text-white':'border-slate-200 dark:border-white/10'}`}>{ui.stop}</button></div></div></div></div></div>}
 </>;
}
