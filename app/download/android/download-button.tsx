'use client';

import { useState } from 'react';

const fallback = 'https://github.com/CamMicGo/cammicgo-seo-agent/releases/download/android-test-latest/CamMicGo-SEO-MCP-Android-test.apk';
const filename = 'CamMicGo-SEO-MCP-Android-test.apk';

export default function DownloadButton() {
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function download() {
    if (status === 'loading') return;
    setStatus('loading'); setProgress(null); setMessage('Connexion au téléchargement…');
    try {
      const response = await fetch('/download/android/apk', { cache: 'no-store' });
      if (!response.ok) throw new Error('Le serveur de téléchargement est indisponible (HTTP ' + response.status + ').');
      if (!response.body) throw new Error('Le navigateur ne prend pas en charge le téléchargement suivi.');
      const total = Number(response.headers.get('content-length') || 0);
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); received += value.byteLength;
        if (total > 0) setProgress(Math.min(100, Math.round(received / total * 100)));
        setMessage((received / 1048576).toFixed(1) + ' Mo reçus' + (total > 0 ? ' / ' + (total / 1048576).toFixed(1) + ' Mo' : '…'));
      }
      if (!received) throw new Error('Fichier vide.');
      const blob = new Blob(chunks as BlobPart[], { type: 'application/vnd.android.package-archive' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setProgress(100); setStatus('done'); setMessage('Fichier transféré au navigateur. Vérifiez vos téléchargements pour installer l’APK.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Le téléchargement a échoué.');
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: '30px auto', textAlign: 'center' }}>
      <button type="button" onClick={download} disabled={status === 'loading'} className="primary" style={{ border: 0, borderRadius: 14, padding: '18px 28px', fontWeight: 750, fontSize: 16, cursor: status === 'loading' ? 'wait' : 'pointer' }}>
        {status === 'loading' ? 'Téléchargement en cours…' : '⬇ Télécharger l’APK Android'}
      </button>
      {status !== 'idle' && (
        <div role="status" aria-live="polite" style={{ marginTop: 20, textAlign: 'left' }}>
          <div style={{ height: 12, borderRadius: 10, background: '#dce6f6', overflow: 'hidden' }}>
            <div style={{ width: (progress ?? (status === 'loading' ? 8 : 0)) + '%', height: '100%', background: 'linear-gradient(90deg,#00c7dc,#2369ed,#a51ae7)', transition: 'width .2s' }} />
          </div>
          <p style={{ fontSize: 13, color: status === 'error' ? '#b42318' : '#526382' }}>{progress !== null ? progress + '% — ' : ''}{message}</p>
        </div>
      )}
      <p style={{ fontSize: 13, marginTop: 18, color: '#63728d' }}>
        Si le téléchargement ne fonctionne pas, <a href={fallback} style={{ color: '#245fde', textDecoration: 'underline' }}>ouvrir le fichier APK sur GitHub Releases</a>.
      </p>
    </div>
  );
}
