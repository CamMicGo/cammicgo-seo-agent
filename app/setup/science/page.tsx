import type {Metadata} from 'next';
import ScienceGuide from './science-view';
export const metadata:Metadata={title:'Scientific sources setup | CamMicGo SEO MCP',description:'Search OpenAlex, Semantic Scholar, arXiv, PubMed and HAL from your AI assistant, and add free personal API keys.'};
export default function SetupScience(){return <ScienceGuide/>;}
