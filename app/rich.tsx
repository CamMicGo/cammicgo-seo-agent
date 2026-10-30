/** Renders copy where `text in backticks` becomes <code>. */
export default function Rich({text}:{text:string}){
 return <>{text.split('`').map((part,i)=>i%2?<code key={i}>{part}</code>:part)}</>;
}
