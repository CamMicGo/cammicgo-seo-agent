import type { Metadata } from 'next';
import DownloadButton from './android/download-button';

export const metadata: Metadata = {
  title: 'Télécharger | CamMicGo SEO Agent',
  description: "Téléchargez l'application Android CamMicGo SEO MCP pour récupérer les transcriptions YouTube depuis votre propre appareil.",
};

const LOGO = 'https://avatars.githubusercontent.com/u/322584442?v=4';

const platforms = [
  { name: 'Android', icon: '🤖', desc: 'Téléphones et tablettes · Android 8+', state: 'Disponible (test)', href: '/download/android', available: true },
  { name: 'Windows', icon: '⊞', desc: 'Serveur MCP local (Node.js)', state: "Guide d'installation", href: '/setup/local', available: true },
  { name: 'macOS', icon: '⌘', desc: 'Serveur MCP local (Node.js)', state: "Guide d'installation", href: '/setup/local', available: true },
  { name: 'Linux', icon: '🐧', desc: 'Serveur MCP local (Node.js)', state: "Guide d'installation", href: '/setup/local', available: true },
  { name: 'iOS / iPadOS', icon: '●', desc: 'iPhone et iPad', state: 'Non disponible', href: '', available: false },
];

export default function DownloadPage() {
  return (
    <div className="site">
      <header className="header">
        <a className="brand" href="/">
          <img src={LOGO} alt="CamMicGo logo" width="46" height="46" />
          <span>CamMicGo <b>SEO Agent</b></span>
        </a>
        <a href="/" style={{ color: '#285bd9', fontWeight: 700 }}>← Accueil</a>
      </header>

      <section className="hero" style={{ paddingTop: 60, paddingBottom: 50 }}>
        <span className="eyebrow">TÉLÉCHARGEMENT · APPLICATION ANDROID</span>
        <div className="hero-logo">
          <img src="/branding/cammicgo-seo-mcp-apk-icon.png" alt="Icône de l’application CamMicGo SEO MCP" width="112" height="112" style={{ borderRadius: 24 }} />
        </div>
        <h1>Vos transcriptions YouTube, <span>depuis votre appareil</span></h1>
        <p className="lead">
          YouTube bloque les serveurs cloud avec sa vérification anti-robot : c’est pour cela que le serveur MCP distant ne peut pas récupérer les transcriptions.
          L’application CamMicGo fait la requête depuis votre téléphone, avec votre propre connexion, et obtient la transcription horodatée.
        </p>
        <DownloadButton />
        <p className="notice">
          Version de test 0.2.0 · fichier APK signé en mode debug. Android peut vous demander d’autoriser l’installation depuis votre navigateur.{' '}
          <a href="/download/android">Détails et installation ↗</a>
        </p>
      </section>

      <section className="feature-section" aria-labelledby="how-title">
        <span className="kicker">COMMENT ÇA MARCHE</span>
        <h2 id="how-title">Trois étapes</h2>
        <ol className="local-steps">
          <li><h3>Partagez une vidéo</h3><p>Depuis l’app YouTube, appuyez sur Partager puis choisissez « CamMicGo SEO MCP », ou collez simplement le lien de la vidéo dans l’application.</p></li>
          <li><h3>L’application récupère les sous-titres</h3><p>La requête part de votre téléphone, pas d’un serveur cloud. La langue par défaut est l’anglais ; vous pouvez en choisir une autre.</p></li>
          <li><h3>Copiez, exportez ou partagez</h3><p>Le résultat s’affiche avec les horodatages <code>[mm:ss]</code>. Le bouton JSON produit le même format que l’outil MCP <code>youtube_get_transcript</code>.</p></li>
        </ol>
        <p className="notice">
          <strong>Synchronisation avec le serveur MCP distant : en développement.</strong> Pour l’instant, l’application fonctionne seule.
          À terme, votre assistant IA pourra demander une transcription au serveur MCP, qui la fera récupérer par votre application appairée.
        </p>
      </section>

      <section className="feature-section" aria-labelledby="platforms-title">
        <span className="kicker">AUTRES APPAREILS</span>
        <h2 id="platforms-title">Choisissez votre appareil</h2>
        <div className="agent-platforms">
          {platforms.map(p => (
            <article className="agent-platform" key={p.name}>
              <span className="agent-platform-icon" aria-hidden="true">{p.icon}</span>
              <h3>{p.name}</h3>
              <p>{p.desc}</p>
              {p.available
                ? <a className="agent-unavailable" style={{ background: '#245edc', color: '#fff', borderColor: '#245edc', textDecoration: 'none' }} href={p.href}>{p.state}</a>
                : <span className="agent-unavailable">{p.state}</span>}
            </article>
          ))}
        </div>
        <p className="notice">Sur ordinateur, le serveur MCP local récupère les transcriptions depuis votre propre connexion et les fournit directement à Claude Desktop, Cursor ou Gemini CLI.</p>
      </section>
    </div>
  );
}
