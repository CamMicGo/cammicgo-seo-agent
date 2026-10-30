'use client';

import {useEffect} from 'react';
import {useSiteLanguage} from '@/components/useSiteLanguage';
import type {Lang} from '@/lib/i18n';

const READ_UNITS='h1,h2,h3,h4,h5,h6,p,li,dt,dd,figcaption,blockquote,legend,caption,th,td,label,summary,output,pre,code,a[href],button,[role="note"],[role="status"],[role="alert"],[aria-label]';
const NESTED_READABLE='h1,h2,h3,h4,h5,h6,p,li,dt,dd,figcaption,blockquote,legend,caption,th,td,label,summary,output,pre,code,a[href],button,input,select,textarea,[role],[aria-label],[data-speech-readable]';

type Copy={position:string;of:string;on:string;off:string};
const copy:Record<Lang,Copy>={
 en:{position:'position',of:'of',on:'on',off:'off'},fr:{position:'position',of:'sur',on:'activé',off:'désactivé'},es:{position:'posición',of:'de',on:'activado',off:'desactivado'},de:{position:'Position',of:'von',on:'aktiviert',off:'deaktiviert'},pt:{position:'posição',of:'de',on:'ativado',off:'desativado'},zh:{position:'位置',of:'共',on:'已开启',off:'已关闭'},ja:{position:'位置',of:'中',on:'オン',off:'オフ'},ko:{position:'위치',of:'중',on:'켜짐',off:'꺼짐'},ar:{position:'الموضع',of:'من',on:'مفعّل',off:'غير مفعّل'},ru:{position:'положение',of:'из',on:'включено',off:'выключено'},it:{position:'posizione',of:'di',on:'attivato',off:'disattivato'}
};

function announce(el:HTMLElement){window.setTimeout(()=>{if(document.contains(el))el.dispatchEvent(new FocusEvent('focusin',{bubbles:true,composed:true}))},90)}

export default function AccessibilityInteractionEnhancer(){
 const lang=useSiteLanguage();
 useEffect(()=>{
  const c=copy[lang];
  const ignored=(el:Element)=>Boolean(el.closest('[data-speech-ignore],[aria-hidden="true"],[hidden]'));
  const prepareUnit=(el:Element)=>{if(el instanceof HTMLElement&&!ignored(el)){el.setAttribute('data-speech-readable','true');if(!el.matches('a,button,input,select,textarea,summary,[role="button"],[role="switch"]'))el.setAttribute('data-speech-section','true')}};
  const prepareLeaf=(el:Element)=>{
   if(!(el instanceof HTMLElement)||ignored(el)||el.matches('script,style,noscript,svg,path,main,section,article,nav,aside,header,footer,form,ul,ol,table,tbody,thead,tr'))return;
   const text=el.textContent?.replace(/\s+/g,' ').trim()||'';
   if(!text||text.length>900||el.querySelector(NESTED_READABLE))return;
   prepareUnit(el);
  };
  const prepareRange=(el:HTMLInputElement)=>{if(el.type!=='range')return;const previous=el.dataset.a11yBaseLabel,current=el.getAttribute('aria-label')||el.labels?.[0]?.textContent?.trim()||el.getAttribute('name')||'',base=previous||current.replace(/\.\s*(position|posición|Position|posição|位置|위치|الموضع|положение|posizione).*$/i,'').trim();if(!previous)el.dataset.a11yBaseLabel=base;const min=Number.isFinite(Number(el.min))?Number(el.min):0,max=Number.isFinite(Number(el.max))?Number(el.max):100,value=Number.isFinite(Number(el.value))?Number(el.value):min,state=el.getAttribute('aria-valuetext')||`${c.position} ${value} ${c.of} ${max}`;el.setAttribute('aria-valuemin',String(min));el.setAttribute('aria-valuemax',String(max));el.setAttribute('aria-valuenow',String(value));if(base)el.setAttribute('aria-label',`${base}. ${state}`)};
  const prepareSwitch=(el:HTMLElement)=>{if(el.getAttribute('role')!=='switch')return;const previous=el.dataset.a11ySwitchBaseLabel,current=el.getAttribute('aria-label')||el.textContent?.trim()||'';let base=previous||current;if(!previous){for(const w of Object.values(copy).flatMap(v=>[v.on,v.off]))base=base.replace(new RegExp(`\\.\\s*${w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*$`,'i'),'').trim();el.dataset.a11ySwitchBaseLabel=base}if(base)el.setAttribute('aria-label',`${base}. ${el.getAttribute('aria-checked')==='true'?c.on:c.off}`)};
  const prepareRoot=(root:ParentNode)=>{root.querySelectorAll(READ_UNITS).forEach(prepareUnit);root.querySelectorAll<HTMLElement>('span,div,b,strong,small').forEach(prepareLeaf);root.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(prepareRange);root.querySelectorAll<HTMLElement>('[role="switch"]').forEach(prepareSwitch)};
  prepareRoot(document);
  const mutation=new MutationObserver(records=>{for(const record of records){if(record.type==='childList')record.addedNodes.forEach(node=>{if(!(node instanceof Element))return;if(node.matches(READ_UNITS))prepareUnit(node);prepareLeaf(node);if(node instanceof HTMLInputElement&&node.type==='range')prepareRange(node);if(node instanceof HTMLElement&&node.getAttribute('role')==='switch')prepareSwitch(node);prepareRoot(node)});if(record.type==='attributes'&&record.target instanceof HTMLElement&&record.attributeName==='aria-checked'){prepareSwitch(record.target);if(Date.now()-Number(record.target.dataset.a11yLastAction||0)<1200)announce(record.target)}}});
  mutation.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-checked']});
  const markAction=(target:EventTarget|null)=>{if(target instanceof Element){const control=target.closest<HTMLElement>('[role="switch"],input[type="checkbox"]');if(control)control.dataset.a11yLastAction=String(Date.now())}};
  const onPointerDown=(e:PointerEvent)=>markAction(e.target),onClick=(e:MouseEvent)=>markAction(e.target),onInput=(e:Event)=>{const el=e.target;if(el instanceof HTMLInputElement&&el.type==='range'){prepareRange(el);announce(el)}},onChange=(e:Event)=>{const el=e.target;if(el instanceof HTMLInputElement&&el.type==='range'){prepareRange(el);announce(el)}if(el instanceof HTMLInputElement&&el.type==='checkbox'){el.setAttribute('aria-checked',el.checked?'true':'false');announce(el)}if(el instanceof HTMLElement&&el.getAttribute('role')==='switch'){prepareSwitch(el);announce(el)}};
  document.addEventListener('pointerdown',onPointerDown,true);document.addEventListener('click',onClick,true);document.addEventListener('input',onInput,true);document.addEventListener('change',onChange,true);
  return()=>{mutation.disconnect();document.removeEventListener('pointerdown',onPointerDown,true);document.removeEventListener('click',onClick,true);document.removeEventListener('input',onInput,true);document.removeEventListener('change',onChange,true)};
 },[lang]);
 return null;
}
