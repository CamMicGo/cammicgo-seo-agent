import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const releaseApi = 'https://api.github.com/repos/CamMicGo/cammicgo-seo-agent/releases/tags/android-test-latest';
const assetName = 'CamMicGo-SEO-MCP-Android-test.apk';

/** Stream the APK directly from our own domain: Android browsers never have to follow GitHub redirects. */
export async function GET() {
  try {
    const release = await fetch(releaseApi, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'CamMicGo-SEO-MCP' },
      cache: 'no-store',
    });
    if (!release.ok) return NextResponse.json({ error: 'APK release unavailable', status: release.status }, { status: 503 });
    const data = await release.json();
    const asset = (data.assets as Array<{ name: string; browser_download_url: string; size: number }> | undefined)
      ?.find(a => a.name === assetName);
    if (!asset || !asset.browser_download_url.startsWith('https://github.com/CamMicGo/cammicgo-seo-agent/releases/download/'))
      return NextResponse.json({ error: 'APK asset not found' }, { status: 503 });
    const upstream = await fetch(asset.browser_download_url, {
      headers: { 'User-Agent': 'CamMicGo-SEO-MCP', Accept: 'application/octet-stream' },
      redirect: 'follow',
      cache: 'no-store',
    });
    if (!upstream.ok || !upstream.body)
      return NextResponse.json({ error: 'APK upstream download failed', status: upstream.status }, { status: 502 });
    const headers = new Headers({
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="CamMicGo-SEO-MCP-Android-test.apk"',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    });
    if (upstream.headers.get('content-length')) headers.set('Content-Length', upstream.headers.get('content-length')!);
    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: 'APK download temporarily unavailable' }, { status: 502 });
  }
}
