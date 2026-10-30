import type {Metadata} from 'next';
import DownloadView from './download-view';

export const metadata:Metadata={
 title:'Apps (Android, Windows, macOS, Linux) | CamMicGo SEO MCP',
 description:'CamMicGo apps fetch YouTube transcripts from your own phone or computer for the remote MCP server (Claude, ChatGPT).',
};
export default function DownloadPage(){return <DownloadView/>;}
