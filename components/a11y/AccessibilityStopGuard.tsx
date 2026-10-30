'use client';

import {useEffect,useRef} from 'react';

const TARGET='a[href],button,input:not([type="hidden"]),select,textarea,summary,[role="button"],[role="switch"],h1,h2,h3,h4,h5,h6,p,li,dt,dd,figcaption,blockquote,legend,caption,th,td,img[alt],[data-speech],[data-speech-readable],[data-capture-card="true"],[role="alert"],[role="status"],[role="note"]';

export default function AccessibilityStopGuard(){
  const stoppedRef=useRef(true);

  useEffect(()=>{
    const html=document.documentElement;

    const sync=()=>{
      const shell=document.querySelector<HTMLElement>('[data-a11y-shell]');
      const bar=shell?.querySelector<HTMLElement>('[data-a11y-reader-bar="true"]');
      const dot=bar?.querySelector<HTMLElement>('span');
      const stopped=Boolean(dot?.classList.contains('bg-slate-400'));
      stoppedRef.current=stopped;
      html.dataset.a11yReaderMode=stopped?'stopped':'active';

      shell?.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{
        if(button.textContent?.trim()==='■')button.dataset.a11yStopControl='true';
      });
    };

    const silenceForThisEvent=(event:Event)=>{
      if(!stoppedRef.current||!(event.target instanceof Element))return;
      if(event.target.closest('[data-a11y-shell]'))return;
      const target=event.target.closest<HTMLElement>(TARGET);
      if(!target)return;
      const already=target.hasAttribute('data-speech-ignore');
      if(!already)target.setAttribute('data-speech-ignore','reader-stopped');
      window.setTimeout(()=>{
        if(!already&&target.getAttribute('data-speech-ignore')==='reader-stopped')target.removeAttribute('data-speech-ignore');
      },0);
    };

    const observer=new MutationObserver(()=>sync());
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    window.addEventListener('pointerdown',silenceForThisEvent,true);
    window.addEventListener('click',silenceForThisEvent,true);
    window.addEventListener('pointerover',silenceForThisEvent,true);
    window.addEventListener('focusin',silenceForThisEvent,true);
    sync();

    return()=>{
      observer.disconnect();
      window.removeEventListener('pointerdown',silenceForThisEvent,true);
      window.removeEventListener('click',silenceForThisEvent,true);
      window.removeEventListener('pointerover',silenceForThisEvent,true);
      window.removeEventListener('focusin',silenceForThisEvent,true);
      delete html.dataset.a11yReaderMode;
    };
  },[]);

  return <style>{`html[data-a11y-reader-mode="stopped"] [data-a11y-stop-control="true"]{background-color:rgb(37 99 235)!important;color:white!important;border-color:rgb(37 99 235)!important}`}</style>;
}
