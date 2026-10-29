import type { Metadata } from 'next';

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
        <span className="eyebrow">ANDROID · VERSION DE TEST</span>
        <div className="hero-logo">
          <img src="https://avatars.githubusercontent.com/u/322584442?v=4" alt="CamMicGo" width="112" height="112" />
        </div>
        <h1>CamMicGo sur <span>Android</span></h1>
        <p className="lead">Testez la récupération de sous-titres YouTube depuis votre smartphone. Collez ou partagez un lien vidéo, consultez la transcription disponible et copiez-la.</p>
        <div className="actions" style={{ marginTop: 34 }}>
          <a className="primary" href="/download/android/apk" download="CamMicGo-SEO-MCP-Android-test.apk" style={{ display: 'inline-block', padding: '18px 30px' }}>↓ Télécharger l’APK Android</a>
        </div>
        <p className="notice">Le téléchargement commence uniquement après avoir appuyé sur le bouton. Il peut être nécessaire d’autoriser l’installation d’applications depuis votre navigateur Android.</p>
      </section>
      <section className="bottom">
        <div>
          <span className="kicker">À SAVOIR AVANT LE TEST</span>
          <h2>Une version expérimentale</h2>
          <p>Cette version permet de tester les sous-titres accessibles localement sur Android. Elle ne peut pas encore recevoir automatiquement des demandes de Claude ou de ChatGPT via le MCP distant. Certaines vidéos YouTube peuvent ne pas fournir de transcription exploitable.</p>
          <p>Installez uniquement un APK provenant d’une source en laquelle vous avez confiance.</p>
        </div>
      </section>
    </main>
  );
}
