import type {Metadata} from 'next';
import {LocalChooser} from './local-guide';
export const metadata:Metadata={title:'Install the local MCP | CamMicGo SEO MCP',description:'Install the CamMicGo MCP server on Windows, macOS or Linux, step by step: Git, Node.js, Google Desktop OAuth client, guided installer, Claude Desktop, Cursor or Gemini CLI, built-in YouTube transcripts.'};
export default function LocalSetup(){return <LocalChooser/>;}
