import type {Metadata} from 'next';
import DesktopView from './desktop-view';

export const metadata:Metadata={
 title:'Computer app (Windows, macOS, Linux) | CamMicGo SEO MCP',
 description:'The CamMicGo computer relay fetches YouTube transcripts over your own connection for the remote MCP server (Claude, ChatGPT).',
};
export default function DesktopDownloadPage(){return <DesktopView/>;}
