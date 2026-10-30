import type { Metadata } from 'next';
import DownloadButton from './android/download-button';
import { RelayFlow, RelayLimits, RelaySteps } from '../relay-explainer';

export const metadata: Metadata = {
  title: 'Télécharger | CamMicGo SEO MCP',
  description: "Téléchargez l'application Android CamMicGo SEO MCP pour récupérer les transcriptions YouTube depuis votre propre appareil.",
};

const LOGO = 'https://avatars.githubusercontent.com/u/322584442?v=4';

const platforms = [
  { name: 'Android', icon:'/os-logos/android.svg', desc: 'Téléphones et tablettes · Android 8+', state: 'Disponible (test)', href: '/download/android', available: true },
  { name: 'Windows', icon:'/os-logos/windows.svg', desc: 'Application ordinateur pour le MCP distant · Windows 10 / 11', state: 'Télécharger', href: '/download/desktop#windows', available: true, local: '/setup/local/windows' },
  { name: 'macOS', icon:'/os-logos/macos.svg', desc: 'Application ordinateur pour le MCP distant · Apple Silicon et Intel', state: 'Télécharger', href: '/download/desktop#macos', available: true, local: '/setup/local/macos' },
  { name: 'Linux', icon:'/os-logos/linux.svg', desc: 'Application ordinateur pour le MCP distant · x64 et ARM64', state: 'Télécharger', href: '/download/desktop#linux', available: true, local: '/setup/local/linux' },
  { name: 'iOS / iPadOS', icon:'/os-logos/ios.svg', desc: 'iPhone et iPad', state: 'Non disponible', href: '', available: false },
];

export default function DownloadPage() {
  return (
    <div className="site">

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
          Version de test 0.3.0 · fichier APK signé en mode debug. Android peut vous demander d’autoriser l’installation depuis votre navigateur.{' '}
          <a href="/download/android">Détails et installation ↗</a>
        </p>
      </section>

      <section className="feature-section" aria-labelledby="sync-title">
        <span className="kicker">SYNCHRONISATION AVEC VOTRE ASSISTANT IA</span>
        <h2 id="sync-title">Comment la transcription arrive jusqu’à votre assistant</h2>
        <p className="lead">Le serveur MCP distant ne peut pas joindre YouTube lui-même. Il confie la demande à votre téléphone appairé, qui la traite avec votre connexion et renvoie le résultat.</p>
        <RelayFlow />
        <h2 style={{ marginTop: 56 }}>Mise en route en 4 étapes</h2>
        <RelaySteps />
        <RelayLimits />
        <p className="notice">Vous pouvez dissocier le téléphone à tout moment dans l’application (« Dissocier ») ou demander à votre assistant de le révoquer (outil <code>device_revoke</code>). L’application ne reçoit que des identifiants de vidéos YouTube, jamais de commandes.</p>
      </section>

      <section className="feature-section" aria-labelledby="manual-title">
        <span className="kicker">SANS ASSISTANT IA</span>
        <h2 id="manual-title">Utilisation directe dans l’application</h2>
        <p className="lead">Partagez une vidéo depuis l’app YouTube vers « CamMicGo SEO MCP », ou collez son lien. La transcription s’affiche avec des horodatages <code>[mm:ss]</code> : copiez-la, exportez-la en JSON ou partagez-la. La langue originale est choisie par défaut, et la liste des autres langues disponibles pour la vidéo vous permet d’en choisir une autre.</p>
      </section>

      <section className="feature-section" aria-labelledby="platforms-title">
        <span className="kicker">AUTRES APPAREILS</span>
        <h2 id="platforms-title">Choisissez votre appareil</h2>
        <div className="agent-platforms">
          {platforms.map(p => (
            <article className="agent-platform" key={p.name}>
              <span className="agent-platform-icon" aria-hidden="true"><img src={p.icon} alt="" width="44" height="44" className="os-logo"/></span>
              <h3>{p.name}</h3>
              <p>{p.desc}</p>
              {p.available
                ? <a className="agent-unavailable" style={{ background: '#245edc', color: '#fff', borderColor: '#245edc', textDecoration: 'none' }} href={p.href}>{p.state}</a>
                : <span className="agent-unavailable">{p.state}</span>}
              {'local' in p && p.local ? <a className="agent-local-link" href={p.local}>ou serveur MCP local ↗</a> : null}
            </article>
          ))}
        </div>
        <p className="notice">Sur ordinateur, deux options : l’application ordinateur sert de relais au serveur MCP distant (Claude, ChatGPT), comme le téléphone ; le serveur MCP local récupère lui-même les transcriptions pour Claude Desktop, Cursor ou Gemini CLI, sans relais.</p>
      </section>
    </div>
  );
}
