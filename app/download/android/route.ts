import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.redirect(
    'https://github.com/CamMicGo/cammicgo-seo-agent/releases/download/android-test-latest/CamMicGo-SEO-MCP-Android-test.apk',
    { status: 307 },
  );
}
