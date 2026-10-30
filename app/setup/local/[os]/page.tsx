import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {LocalGuide,type Os} from '../local-guide';
const names:Record<Os,string>={windows:'Windows',macos:'macOS',linux:'Linux'};
export function generateStaticParams(){return (Object.keys(names) as Os[]).map(os=>({os}));}
export async function generateMetadata({params}:{params:Promise<{os:string}>}):Promise<Metadata>{const {os}=await params;const n=names[os as Os]??'';return {title:'Install the local MCP on '+n+' | CamMicGo SEO Agent',description:'Step-by-step installation of the CamMicGo local MCP server on '+n+'.'};}
export default async function Page({params}:{params:Promise<{os:string}>}){const {os}=await params;if(!(os in names))notFound();return <LocalGuide os={os as Os}/>;}
