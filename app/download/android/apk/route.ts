import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const releaseApi = 'https://api.github.com/repos/CamMicGo/cammicgo-seo-mcp/releases/tags/android-test-latest';
const assetName = 'CamMicGo-SEO-MCP-Android-test.apk';

export async function GET() {
  try {
    const release = await fetch(releaseApi, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'CamMicGo-SEO-MCP' },
      cache: 'no-store',
    });
    if (!release.ok) {
      return NextResponse.json({ error: 'APK not published yet', releaseStatus: release.status }, { status: 503 });
    }
    const data = await release.json();
    const asset = (data.assets as Array<{ name: string; url: string }> | undefined)?.find(a => a.name === assetName);
    if (!asset) return NextResponse.json({ error: 'APK asset not found in release' }, { status: 503 });

    const upstream = await fetch(asset.url, {
      headers: {
        Accept: 'application/octet-stream',
        'User-Agent': 'CamMicGo-SEO-MCP',
      },
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'APK download temporarily unavailable', upstreamStatus: upstream.status }, { status: 502 });
    }
    const headers = new Headers({
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="CamMicGo-SEO-MCP-Android-test.apk"',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    const size = upstream.headers.get('content-length');
    if (size) headers.set('Content-Length', size);
    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: 'APK download temporarily unavailable' }, { status: 502 });
  }
}
