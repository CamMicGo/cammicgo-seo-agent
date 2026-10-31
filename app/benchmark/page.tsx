import type {Metadata} from 'next';
import BenchmarkView from './benchmark-view';
export const metadata:Metadata={title:'Benchmark: web search vs CamMicGo | CamMicGo SEO MCP',description:'Time the same research task with your AI assistant\'s usual web search and with CamMicGo; every reference is checked automatically.'};
export default function Benchmark(){return <BenchmarkView/>;}
