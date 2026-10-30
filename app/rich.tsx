import type {ReactNode} from 'react';
/** Renders copy where `text` becomes <code> and **text** becomes <strong>. */
export default function Rich({text}:{text:string}){
 return <>{text.split('`').map((part,i)=>i%2?<code key={i}>{part}</code>:<Bold key={i} text={part}/>)}</>;
}
function Bold({text}:{text:string}){return <>{text.split('**').map((p,i)=>i%2?<strong key={i}>{p}</strong>:p)}</>;}
/** Turns the first occurrence of `phrase` inside `text` into a link. */
export function LinkIn({text,phrase,href}:{text:string;phrase:string;href:string}):ReactNode{
 const i=text.indexOf(phrase);
 if(i<0)return <>{text} <a href={href}>{phrase}</a></>;
 return <>{text.slice(0,i)}<a href={href}>{phrase}</a>{text.slice(i+phrase.length)}</>;
}
