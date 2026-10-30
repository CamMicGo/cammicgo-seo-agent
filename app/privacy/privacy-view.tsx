'use client';
import {useT} from '../lang-provider';
import {privacyCopy} from '@/lib/copy/setup';
export default function PrivacyView(){
 const t=useT(privacyCopy);
 return <main className="legal-page"><h1>{t.title}</h1>{t.p.map((p,i)=><p key={i}>{p}</p>)}<a href="/account">{t.connect}</a></main>;
}
