'use client';
import {useT} from '../lang-provider';
import {privacyCopy} from '@/lib/copy/setup';
import {legalLinksCopy} from '@/lib/copy/terms';
export default function PrivacyView(){
 const t=useT(privacyCopy);
 const l=useT(legalLinksCopy);
 return <main className="legal-page"><h1>{t.title}</h1>{t.p.map((p,i)=><p key={i}>{p}</p>)}<p className="legal-links"><a href="/account">{t.connect}</a> · <a href="/terms">{l.terms}</a></p></main>;
}
