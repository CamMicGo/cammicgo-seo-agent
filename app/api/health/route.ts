import {NextResponse} from 'next/server';
export const runtime='nodejs';
export function GET(){const configured=Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.SESSION_ENCRYPTION_KEY);return NextResponse.json({service:'CamMicGo SEO MCP',status:'technical-preview',googleOAuth:configured?'configured-for-testing':'configuration-required',mcp:'/api/mcp',privateMcpTools:'not-enabled'},{headers:{'Cache-Control':'no-store'}})}
