import type { Metadata } from 'next';
import DownloadButton from './download-button';

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
          <span>CamMicGo <b>SEO Agent</b></span>
        </a>
        <a href="/" style={{ color: '#285bd9', fontWeight: 700 }}>← Accueil</a>
      </header>
      <section className="hero" style={{ paddingTop: 60, paddingBottom: 55 }}>
        <span className="eyebrow">🤖 ANDROID · APK EXPÉRIMENTALE</span>
        <div className="hero-logo">
          <img src="/branding/cammicgo-seo-mcp-apk-icon.png" alt="Icône de l’application CamMicGo SEO MCP" width="112" height="112" style={{ borderRadius: 24 }} />
        </div>
        <h1>CamMicGo sur <span>Android</span></h1>
        <p className="lead">Application Android de test pour extraire les transcriptions YouTube à partir de l’URL d’une vidéo. Partagez une vidéo depuis l’app YouTube ou collez son lien : la transcription horodatée est récupérée depuis votre téléphone, puis vous pouvez la copier, l’exporter en JSON ou la partager.</p>
        <DownloadButton />
        <p className="notice">Le téléchargement commence uniquement après avoir appuyé sur le bouton. Il peut être nécessaire d’autoriser l’installation d’applications depuis votre navigateur Android.</p>
      </section>
      <section className="bottom">
        <div>
          <span className="kicker">À SAVOIR AVANT LE TEST</span>
          <h2>Test local aujourd’hui, synchronisation MCP ensuite</h2>
          <p>Phase actuelle : saisir une URL YouTube dans l’application pour vérifier que l’extraction fonctionne sur Android. Phase suivante (non disponible actuellement) : appairer l’application au serveur MCP distant, qui pourra lui transmettre automatiquement une URL demandée par Claude ou ChatGPT et récupérer la transcription en retour, sans copier-coller. Certaines vidéos YouTube peuvent bloquer les sous-titres.</p>
          <p>Installez uniquement un APK provenant d’une source en laquelle vous avez confiance.</p>
        </div>
      </section>
    </main>
  );
}
