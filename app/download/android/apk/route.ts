import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const releaseApi = 'https://api.github.com/repos/CamMicGo/cammicgo-seo-agent/releases/tags/android-test-latest';
const assetName = 'CamMicGo-SEO-MCP-Android-test.apk';

/** Redirect to the published release asset: avoid streaming APK binaries through Vercel. */
export async function GET() {
  try {
    const release = await fetch(releaseApi, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'CamMicGo-SEO-MCP' },
      cache: 'no-store',
    });
    if (!release.ok) return NextResponse.json({error:'APK not published yet',releaseStatus:release.status},{status:503});
    const data = await release.json();
    const asset = (data.assets as Array<{name:string;browser_download_url:string}>|undefined)
      ?.find(a=>a.name===assetName);
    if (!asset?.browser_download_url || !asset.browser_download_url.startsWith('https://github.com/CamMicGo/cammicgo-seo-agent/releases/download/'))
      return NextResponse.json({error:'APK asset not found in release'},{status:503});
    const response = NextResponse.redirect(asset.browser_download_url, 307);
    response.headers.set('Cache-Control','no-store');
    return response;
  } catch {
    return NextResponse.json({error:'APK download temporarily unavailable'},{status:502});
  }
}
