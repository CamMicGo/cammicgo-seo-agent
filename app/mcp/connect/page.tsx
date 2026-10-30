import type {Metadata} from 'next';
import ConnectView from './connect-view';

export const metadata:Metadata={
 title:'Connect AI agents | CamMicGo SEO MCP',
 description:'Connect Claude, ChatGPT or Gemini CLI to the CamMicGo remote MCP server, authorize Google with the shared project or your own Google Cloud quota, and get YouTube transcripts through your own devices.',
};
export default function McpConnect(){return <ConnectView/>;}
