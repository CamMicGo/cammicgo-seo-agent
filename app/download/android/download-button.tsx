'use client';

import { useState } from 'react';
import { useT } from '../../lang-provider';
import type { Dict } from '@/lib/i18n';

const fallback = 'https://github.com/CamMicGo/cammicgo-seo-agent/releases/download/android-test-latest/CamMicGo-SEO-MCP-Android-test.apk';
const filename = 'CamMicGo-SEO-MCP-Android-test.apk';

type C = { small: string; cta: string; meta: string; loading: string; connecting: string; mb: string; unavailable: string; noStream: string; empty: string; done: string; failed: string; fallback1: string; fallback2: string };
const copy: Dict<C> = {
  en: { small: 'Free · Android 8+', cta: 'Download the APK', meta: 'Test version · about 160 KB', loading: 'Downloading…', connecting: 'Connecting…', mb: 'MB', unavailable: 'The download server is unavailable (HTTP {s}).', noStream: 'This browser does not support tracked downloads.', empty: 'Empty file.', done: 'File handed to your browser. Open your downloads to install the APK.', failed: 'The download failed.', fallback1: 'If the download does not work,', fallback2: 'open the APK on GitHub Releases' },
  fr: { small: 'Gratuit · Android 8+', cta: 'Télécharger l’APK', meta: 'Version de test · environ 160 Ko', loading: 'Téléchargement en cours…', connecting: 'Connexion au téléchargement…', mb: 'Mo', unavailable: 'Le serveur de téléchargement est indisponible (HTTP {s}).', noStream: 'Le navigateur ne prend pas en charge le téléchargement suivi.', empty: 'Fichier vide.', done: 'Fichier transféré au navigateur. Ouvrez vos téléchargements pour installer l’APK.', failed: 'Le téléchargement a échoué.', fallback1: 'Si le téléchargement ne fonctionne pas,', fallback2: 'ouvrez l’APK sur GitHub Releases' },
  es: { small: 'Gratis · Android 8+', cta: 'Descargar el APK', meta: 'Versión de prueba · unos 160 KB', loading: 'Descargando…', connecting: 'Conectando…', mb: 'MB', unavailable: 'El servidor de descarga no está disponible (HTTP {s}).', noStream: 'Este navegador no admite descargas con seguimiento.', empty: 'Archivo vacío.', done: 'Archivo entregado al navegador. Abre tus descargas para instalar el APK.', failed: 'La descarga ha fallado.', fallback1: 'Si la descarga no funciona,', fallback2: 'abre el APK en GitHub Releases' },
  de: { small: 'Kostenlos · Android 8+', cta: 'APK herunterladen', meta: 'Testversion · ca. 160 KB', loading: 'Wird heruntergeladen…', connecting: 'Verbindung wird hergestellt…', mb: 'MB', unavailable: 'Der Download-Server ist nicht erreichbar (HTTP {s}).', noStream: 'Dieser Browser unterstützt keine verfolgten Downloads.', empty: 'Leere Datei.', done: 'Datei an den Browser übergeben. Öffnen Sie Ihre Downloads, um die APK zu installieren.', failed: 'Der Download ist fehlgeschlagen.', fallback1: 'Falls der Download nicht funktioniert,', fallback2: 'öffnen Sie die APK auf GitHub Releases' },
  pt: { small: 'Grátis · Android 8+', cta: 'Baixar o APK', meta: 'Versão de teste · cerca de 160 KB', loading: 'Baixando…', connecting: 'Conectando…', mb: 'MB', unavailable: 'O servidor de download está indisponível (HTTP {s}).', noStream: 'Este navegador não suporta downloads acompanhados.', empty: 'Arquivo vazio.', done: 'Arquivo entregue ao navegador. Abra seus downloads para instalar o APK.', failed: 'O download falhou.', fallback1: 'Se o download não funcionar,', fallback2: 'abra o APK no GitHub Releases' },
  it: { small: 'Gratis · Android 8+', cta: 'Scarica l’APK', meta: 'Versione di prova · circa 160 KB', loading: 'Download in corso…', connecting: 'Connessione…', mb: 'MB', unavailable: 'Il server di download non è disponibile (HTTP {s}).', noStream: 'Questo browser non supporta i download monitorati.', empty: 'File vuoto.', done: 'File passato al browser. Apri i download per installare l’APK.', failed: 'Il download non è riuscito.', fallback1: 'Se il download non funziona,', fallback2: 'apri l’APK su GitHub Releases' },
  ru: { small: 'Бесплатно · Android 8+', cta: 'Скачать APK', meta: 'Тестовая версия · около 160 КБ', loading: 'Загрузка…', connecting: 'Подключение…', mb: 'МБ', unavailable: 'Сервер загрузки недоступен (HTTP {s}).', noStream: 'Этот браузер не поддерживает отслеживаемую загрузку.', empty: 'Пустой файл.', done: 'Файл передан браузеру. Откройте загрузки, чтобы установить APK.', failed: 'Загрузка не удалась.', fallback1: 'Если загрузка не работает,', fallback2: 'откройте APK на GitHub Releases' },
  zh: { small: '免费 · Android 8+', cta: '下载 APK', meta: '测试版 · 约 160 KB', loading: '正在下载…', connecting: '正在连接…', mb: 'MB', unavailable: '下载服务器不可用（HTTP {s}）。', noStream: '此浏览器不支持可跟踪的下载。', empty: '文件为空。', done: '文件已交给浏览器。打开“下载”即可安装 APK。', failed: '下载失败。', fallback1: '如果下载无法进行，', fallback2: '请在 GitHub Releases 打开 APK' },
  ja: { small: '無料 · Android 8 以降', cta: 'APK をダウンロード', meta: 'テスト版 · 約 160 KB', loading: 'ダウンロード中…', connecting: '接続中…', mb: 'MB', unavailable: 'ダウンロードサーバーを利用できません（HTTP {s}）。', noStream: 'このブラウザーは進行状況付きのダウンロードに対応していません。', empty: 'ファイルが空です。', done: 'ファイルをブラウザーに渡しました。ダウンロードを開いて APK をインストールしてください。', failed: 'ダウンロードに失敗しました。', fallback1: 'ダウンロードできない場合は、', fallback2: 'GitHub Releases で APK を開いてください' },
  ko: { small: '무료 · Android 8+', cta: 'APK 다운로드', meta: '테스트 버전 · 약 160KB', loading: '다운로드 중…', connecting: '연결 중…', mb: 'MB', unavailable: '다운로드 서버를 사용할 수 없습니다 (HTTP {s}).', noStream: '이 브라우저는 진행률 표시 다운로드를 지원하지 않습니다.', empty: '빈 파일입니다.', done: '파일을 브라우저로 넘겼습니다. 다운로드 폴더를 열어 APK를 설치하세요.', failed: '다운로드에 실패했습니다.', fallback1: '다운로드가 되지 않으면', fallback2: 'GitHub Releases에서 APK를 여세요' },
  ar: { small: 'مجاني · Android 8+', cta: 'تنزيل ملف APK', meta: 'نسخة تجريبية · نحو 160 ك.ب', loading: 'جارٍ التنزيل…', connecting: 'جارٍ الاتصال…', mb: 'م.ب', unavailable: 'خادم التنزيل غير متاح (HTTP {s}).', noStream: 'هذا المتصفح لا يدعم التنزيل مع المتابعة.', empty: 'الملف فارغ.', done: 'تم تسليم الملف إلى المتصفح. افتح التنزيلات لتثبيت ملف APK.', failed: 'فشل التنزيل.', fallback1: 'إذا لم يعمل التنزيل،', fallback2: 'افتح ملف APK على GitHub Releases' },
};

/** Android APK download button with progress, in the site's gradient style and the Android logo. */
export default function DownloadButton() {
  const t = useT(copy);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function download() {
    if (status === 'loading') return;
    setStatus('loading'); setProgress(null); setMessage(t.connecting);
    try {
      const response = await fetch('/download/android/apk', { cache: 'no-store' });
      if (!response.ok) throw new Error(t.unavailable.replace('{s}', String(response.status)));
      if (!response.body) throw new Error(t.noStream);
      const total = Number(response.headers.get('content-length') || 0);
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); received += value.byteLength;
        if (total > 0) setProgress(Math.min(100, Math.round(received / total * 100)));
        setMessage((received / 1048576).toFixed(2) + ' ' + t.mb + (total > 0 ? ' / ' + (total / 1048576).toFixed(2) + ' ' + t.mb : '…'));
      }
      if (!received) throw new Error(t.empty);
      const blob = new Blob(chunks as BlobPart[], { type: 'application/vnd.android.package-archive' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setProgress(100); setStatus('done'); setMessage(t.done);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : t.failed);
    }
  }

  return (
    <div className="apk-dl">
      <button type="button" onClick={download} disabled={status === 'loading'} className="apk-btn" aria-busy={status === 'loading'}>
        <span className="apk-btn-logo"><img src="/os-logos/android.svg" alt="" width="34" height="34" /></span>
        <span className="apk-btn-text"><small>{t.small}</small><strong>{status === 'loading' ? t.loading : t.cta}</strong><em>{t.meta}</em></span>
        <span className="apk-btn-arrow" aria-hidden="true">{status === 'loading' ? '…' : '↓'}</span>
      </button>
      {status !== 'idle' && (
        <div role="status" aria-live="polite" className="apk-progress">
          <div className="apk-bar"><div style={{ width: (progress ?? (status === 'loading' ? 8 : 0)) + '%' }} /></div>
          <p className={status === 'error' ? 'err' : ''}>{progress !== null ? progress + '% — ' : ''}{message}</p>
        </div>
      )}
      <p className="apk-fallback">{t.fallback1} <a href={fallback}>{t.fallback2}</a>.</p>
    </div>
  );
}
