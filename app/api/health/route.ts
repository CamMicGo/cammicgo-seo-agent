import {NextResponse} from 'next/server';
export const runtime='nodejs';
export function GET(){return NextResponse.json({service:'CamMicGo SEO Agent',status:'preview',googleOAuth:'not_configured',mcp:'/api/mcp'},{headers:{'Cache-Control':'no-store'}})}
