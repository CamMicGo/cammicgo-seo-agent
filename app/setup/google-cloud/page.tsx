import type {Metadata} from 'next';
import GcpView from './gcp-view';
export const metadata:Metadata={title:'Google Cloud setup | CamMicGo SEO MCP',description:'Use your own Google OAuth client and API quota with CamMicGo SEO MCP.'};
export default function SetupGoogle(){return <GcpView/>;}
