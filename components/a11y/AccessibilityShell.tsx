'use client';

import {useEffect,useRef} from 'react';
import AccessibilityCenterV3 from '@/components/a11y/AccessibilityCenterV3';

export default function AccessibilityShell(){
  const rootRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const root=rootRef.current;
    if(!root)return;

    const syncHeight=()=>{
      const children=[...root.children] as HTMLElement[];
      const bar=children.find(el=>el.dataset.a11yReaderBar==='true' && getComputedStyle(el).position==='sticky');
      const height=bar?Math.ceil(bar.getBoundingClientRect().height):0;
      document.documentElement.style.setProperty('--a11y-reader-bar-height',`${height}px`);
      document.documentElement.toggleAttribute('data-a11y-reader-visible',height>0);
    };

    const resize=new ResizeObserver(syncHeight);
    const mutation=new MutationObserver(()=>{
      [...root.children].forEach(el=>resize.observe(el));
      requestAnimationFrame(syncHeight);
    });
    [...root.children].forEach(el=>resize.observe(el));
    mutation.observe(root,{childList:true,subtree:false});
    syncHeight();

    const clickStop=()=>{
      const stopButton=[...root.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent?.trim().startsWith('■')&&!button.disabled);
      if(stopButton){stopButton.click();return true}
      return false;
    };
    const stopWhenHidden=()=>{
      if(document.visibilityState!=='hidden')return;
      if(clickStop())return;
      if('speechSynthesis'in window)window.speechSynthesis.cancel();
    };
    document.addEventListener('visibilitychange',stopWhenHidden);
    window.addEventListener('pagehide',stopWhenHidden);

    return()=>{
      resize.disconnect();
      mutation.disconnect();
      document.removeEventListener('visibilitychange',stopWhenHidden);
      window.removeEventListener('pagehide',stopWhenHidden);
      document.documentElement.style.removeProperty('--a11y-reader-bar-height');
      document.documentElement.removeAttribute('data-a11y-reader-visible');
    };
  },[]);

  return <div ref={rootRef} data-a11y-shell className="sticky top-[var(--sh-h,72px)] z-[180]" onClick={event=>event.stopPropagation()}><AccessibilityCenterV3/></div>;
}
