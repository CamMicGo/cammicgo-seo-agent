import type { Metadata } from 'next';
import SiteHeader from '../../site-header';

export const metadata: Metadata = {
  title: 'Application ordinateur (Windows, macOS, Linux) | CamMicGo SEO MCP',
  description: 'Le relais CamMicGo pour ordinateur récupère les transcriptions YouTube depuis votre connexion pour le serveur MCP distant (Claude, ChatGPT).',
};

const OS = [
  {
    id: 'windows', name: 'Windows', sub: 'Windows 10 / 11 · 64 bits',
    links: [{ href: '/download/desktop/windows', label: 'Télécharger pour Windows', meta: '.exe · 64 bits' }],
    first: ['Double-cliquez sur CamMicGo-Relay-Windows.exe.', 'Si Windows affiche « Windows a protégé votre ordinateur », cliquez sur « Informations complémentaires » puis « Exécuter quand même » (application pas encore signée).', 'Une fenêtre noire s’ouvre et votre navigateur affiche la page de contrôle.'],
  },
  {
    id: 'macos', name: 'macOS', sub: 'macOS 11 et plus',
    links: [
      { href: '/download/desktop/macos-arm64', label: 'Apple Silicon (M1 à M4)', meta: '.zip' },
      { href: '/download/desktop/macos-x64', label: 'Mac Intel', meta: '.zip' },
    ],
    first: ['Ouvrez le .zip puis double-cliquez sur CamMicGo-Relay.', 'Si macOS le bloque : Réglages Système › Confidentialité et sécurité › « Ouvrir quand même », puis relancez.', 'Le Terminal s’ouvre et votre navigateur affiche la page de contrôle.'],
  },
  {
    id: 'linux', name: 'Linux', sub: 'x64 ou ARM64',
    links: [
      { href: '/download/desktop/linux-x64', label: 'Linux x64', meta: '.tar.gz' },
      { href: '/download/desktop/linux-arm64', label: 'Linux ARM64', meta: '.tar.gz' },
    ],
    first: ['tar -xzf CamMicGo-Relay-Linux-x64.tar.gz', './cammicgo-relay', 'La page de contrôle s’ouvre dans votre navigateur (sinon : http://127.0.0.1:47821).'],
  },
];

export default function DesktopDownloadPage() {
  return (
    <main className="site" style={{ minHeight: '100vh' }}>
      <SiteHeader active="android" />
      <section className="hero" style={{ paddingTop: 54, paddingBottom: 30 }}>
        <span className="eyebrow">ORDINATEUR · RELAIS POUR LE MCP DISTANT</span>
        <div className="dk-logos" aria-hidden="true">
          {OS.map(o => <img key={o.id} src={`/os-logos/${o.id}.svg`} alt="" width="46" height="46" />)}
        </div>
        <h1>Votre ordinateur <span>récupère les transcriptions</span></h1>
        <p className="lead">
          YouTube bloque les serveurs cloud. Quand vous utilisez le serveur MCP <b>distant</b> (Claude, ChatGPT…), cette petite application
          télécharge les sous-titres depuis votre connexion et les renvoie à votre assistant : exactement comme l’application Android, mais sur votre PC ou votre Mac.
        </p>
        <p className="dk-note">Vous utilisez le <a href="/setup/local">serveur MCP local</a> ? Inutile : il récupère déjà les transcriptions lui-même.</p>
      </section>

      <section className="feature-section" style={{ paddingTop: 10 }} aria-labelledby="dk-dl">
        <span className="kicker">1 · TÉLÉCHARGER</span>
        <h2 id="dk-dl">Choisissez votre système</h2>
        <div className="dk-grid">
          {OS.map(o => (
            <article className="dk-card" key={o.id} id={o.id}>
              <div className="dk-head"><img src={`/os-logos/${o.id}.svg`} alt="" width="40" height="40" /><div><h3>{o.name}</h3><small>{o.sub}</small></div></div>
              <div className="dk-links">
                {o.links.map(l => <a key={l.href} className="dk-btn" href={l.href}><span>{l.label}</span><em>{l.meta}</em></a>)}
              </div>
              <ol className="dk-first">
                {o.first.map((s, i) => <li key={i}>{o.id === 'linux' && i < 2 ? <code>{s}</code> : s}</li>)}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <section className="feature-section" style={{ paddingTop: 0 }} aria-labelledby="dk-pair">
        <span className="kicker">2 · ASSOCIER</span>
        <h2 id="dk-pair">Trois étapes, une seule fois</h2>
        <div className="dk-steps">
          <div className="dk-step"><b>1</b><div><strong>Demandez un code à votre assistant</strong><p>Dans Claude ou ChatGPT connecté à CamMicGo SEO MCP : « Génère un code d’appairage CamMicGo pour mon ordinateur. »</p></div></div>
          <div className="dk-step"><b>2</b><div><strong>Saisissez-le dans la page de contrôle</strong><p>Code de 8 caractères (ex. ABCD-2345), valable 10 minutes et utilisable une seule fois.</p></div></div>
          <div className="dk-step"><b>3</b><div><strong>Laissez l’application ouverte</strong><p>Le mode connecté démarre seul. Demandez une transcription ou une chaîne entière : votre ordinateur s’en charge.</p></div></div>
        </div>
      </section>

      <section className="feature-section" style={{ paddingTop: 0 }} aria-labelledby="dk-know">
        <span className="kicker">BON À SAVOIR</span>
        <h2 id="dk-know">Questions fréquentes</h2>
        <div className="dk-faq">
          <details open><summary>Faut-il garder l’ordinateur allumé ?</summary><p>Oui : le relais fonctionne tant que la fenêtre est ouverte et l’ordinateur éveillé. En veille, les demandes attendent jusqu’à 10 minutes (plusieurs heures pour un lot de chaîne), puis reprennent dès le réveil.</p></details>
          <details><summary>Téléphone et ordinateur ensemble ?</summary><p>Oui. Associez les deux : le premier appareil disponible prend chaque demande. Pour un lot de 50 vidéos, l’ordinateur est plus rapide et n’est pas limité par la batterie.</p></details>
          <details><summary>Que se passe-t-il si YouTube limite ma connexion ?</summary><p>La vidéo est remise dans la file et le relais fait une pause de 5 à 30 minutes, puis reprend automatiquement.</p></details>
          <details><summary>Mes données ?</summary><p>Le jeton de l’appareil est enregistré dans <code>~/.cammicgo-seo-mcp/relay.json</code>, lisible par vous seul. La page de contrôle n’est accessible que depuis cet ordinateur (127.0.0.1). Dissocier l’appareil révoque le jeton.</p></details>
          <details><summary>Vous avez déjà Node.js et le code source ?</summary><p><code>git clone https://github.com/CamMicGo/cammicgo-seo-mcp.git</code> puis <code>cd cammicgo-seo-mcp</code> et <code>npm run relay</code>.</p></details>
        </div>
      </section>
    </main>
  );
}
