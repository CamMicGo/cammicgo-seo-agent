import type {ReactNode} from 'react';
/** Renders copy where `text` becomes <code>, **text** becomes <strong> and [label](url) becomes a link. */
export default function Rich({text}:{text:string}){
 return <>{text.split('`').map((part,i)=>i%2?<code key={i}>{part}</code>:<Bold key={i} text={part}/>)}</>;
}
function Bold({text}:{text:string}){return <>{text.split('**').map((p,i)=>i%2?<strong key={i}><Links text={p}/></strong>:<Links key={i} text={p}/>)}</>;}
/** [label](url): external links open in a new tab, site links stay in place. */
function Links({text}:{text:string}){
 const out:ReactNode[]=[];const re=/\[([^\]]+)\]\(((?:https:\/\/|\/)[^)\s]+)\)/g;let last=0;let m:RegExpExecArray|null;
 while((m=re.exec(text))){out.push(text.slice(last,m.index));const ext=m[2].startsWith('http');out.push(<a key={m.index} href={m[2]} {...(ext?{target:'_blank',rel:'noreferrer'}:{})}>{m[1]}</a>);last=m.index+m[0].length;}
 out.push(text.slice(last));return <>{out}</>;
}
/** Turns the first occurrence of `phrase` inside `text` into a link. */
export function LinkIn({text,phrase,href}:{text:string;phrase:string;href:string}):ReactNode{
 const i=text.indexOf(phrase);
 if(i<0)return <>{text} <a href={href}>{phrase}</a></>;
 return <>{text.slice(0,i)}<a href={href}>{phrase}</a>{text.slice(i+phrase.length)}</>;
}
