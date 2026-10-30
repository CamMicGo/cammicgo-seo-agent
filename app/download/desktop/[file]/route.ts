import { NextResponse } from 'next/server';

/** Stable download links for the desktop relay binaries, published by .github/workflows/desktop-relay.yml. */
const BASE = 'https://github.com/CamMicGo/cammicgo-seo-agent/releases/download/desktop-relay-latest/';
const FILES: Record<string, string> = {
  windows: 'CamMicGo-Relay-Windows.exe',
  'macos-arm64': 'CamMicGo-Relay-macOS-arm64.zip',
  'macos-x64': 'CamMicGo-Relay-macOS-x64.zip',
  'linux-x64': 'CamMicGo-Relay-Linux-x64.tar.gz',
  'linux-arm64': 'CamMicGo-Relay-Linux-arm64.tar.gz',
};

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const name = FILES[(await params).file];
  if (!name) return NextResponse.json({ error: 'Unknown platform', platforms: Object.keys(FILES) }, { status: 404 });
  return NextResponse.redirect(BASE + name, { status: 302, headers: { 'Cache-Control': 'no-store' } });
}
