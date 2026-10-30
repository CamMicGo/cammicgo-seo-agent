import type { Metadata } from 'next';
import DownloadButton from './download-button';
import { RelayLimits } from '../../relay-explainer';

export const metadata: Metadata = {
  title: 'Télécharger CamMicGo SEO MCP pour Android',
  description: 'Téléchargez la version expérimentale de CamMicGo SEO MCP pour Android depuis le site officiel CamMicGo.',
};

export default function AndroidDownloadPage() {
  return (
    <main className="site" style={{ minHeight: '100vh' }}>
      <header className="header">
        <a className="brand" href="/">
          <img src="https://avatars.githubusercontent.com/u/322584442?v=4" alt="Logo CamMicGo" width="46" height="46" />
          <span>CamMicGo <b>SEO MCP</b></span>
        </a>
        <a href="/" style={{ color: '#285bd9', fontWeight: 700 }}>← Accueil</a>
      </header>
      <section className="hero" style={{ paddingTop: 60, paddingBottom: 55 }}>
        <span className="eyebrow">🤖 ANDROID · APK EXPÉRIMENTALE</span>
        <div className="hero-logo">
          <img src="/branding/cammicgo-seo-mcp-apk-icon.png" alt="Icône de l’application CamMicGo SEO MCP" width="112" height="112" style={{ borderRadius: 24 }} />
        </div>
        <h1>CamMicGo sur <span>Android</span></h1>
        <p className="lead">Application Android pour récupérer les transcriptions YouTube depuis votre téléphone, seule ou pour votre assistant IA. Partagez une vidéo depuis l’app YouTube ou collez son lien : la transcription horodatée est récupérée depuis votre téléphone, puis vous pouvez la copier, l’exporter en JSON ou la partager.</p>
        <DownloadButton />
        <p className="notice">Le téléchargement commence uniquement après avoir appuyé sur le bouton. Il peut être nécessaire d’autoriser l’installation d’applications depuis votre navigateur Android.</p>
      </section>
      <section className="bottom">
        <div>
          <span className="kicker">À SAVOIR AVANT L’INSTALLATION</span>
          <h2>Utilisable seule ou synchronisée avec votre assistant IA</h2>
          <p>Seule, l’application extrait la transcription d’une vidéo que vous partagez ou collez. Appairée au serveur MCP distant (code donné par votre assistant), elle récupère automatiquement les transcriptions demandées par Claude ou ChatGPT. Certaines vidéos n’ont pas de sous-titres. <a href="/download">Guide complet de synchronisation ↗</a></p>
          <p>Version de test signée en mode debug : installez uniquement un APK provenant d’une source en laquelle vous avez confiance.</p>
        </div>
      </section>
      <section className="feature-section" style={{ paddingTop: 0 }}>
        <RelayLimits />
      </section>
    </main>
  );
}
