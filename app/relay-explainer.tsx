/** Shared visuals explaining how YouTube transcripts reach the remote MCP through the paired Android app. */
type Lang = 'fr' | 'en';

const flow = {
  fr: [
    { icon: '💬', title: 'Votre assistant IA', text: 'Claude, ChatGPT… demande la transcription d’une vidéo.' },
    { icon: '☁️', title: 'Serveur MCP CamMicGo', text: 'Met la demande en file d’attente. YouTube bloque les serveurs cloud.' },
    { icon: '📱', title: 'Votre téléphone', text: 'L’app en mode connecté récupère les sous-titres avec votre connexion.' },
    { icon: '✅', title: 'Réponse', text: 'La transcription horodatée revient à l’assistant en quelques secondes.' },
  ],
  en: [
    { icon: '💬', title: 'Your AI assistant', text: 'Claude, ChatGPT… asks for a video transcript.' },
    { icon: '☁️', title: 'CamMicGo MCP server', text: 'Queues the request. YouTube blocks cloud servers.' },
    { icon: '📱', title: 'Your phone', text: 'The app, in connected mode, fetches captions over your own connection.' },
    { icon: '✅', title: 'Answer', text: 'The timestamped transcript returns to the assistant within seconds.' },
  ],
};

export function RelayFlow({ lang = 'fr' }: { lang?: Lang }) {
  const steps = flow[lang];
  return (
    <ol className="relay-flow" aria-label={lang === 'fr' ? 'Parcours d’une demande de transcription' : 'How a transcript request travels'}>
      {steps.map((s, i) => (
        <li className="relay-node" key={s.title}>
          <span className="relay-node-icon" aria-hidden="true">{s.icon}</span>
          <strong>{s.title}</strong>
          <span>{s.text}</span>
          {i < steps.length - 1 && <span className="relay-arrow" aria-hidden="true">→</span>}
        </li>
      ))}
    </ol>
  );
}

const limits = {
  fr: {
    kicker: 'À SAVOIR',
    title: 'Deux limites imposées par Android',
    cards: [
      {
        icon: '🌙',
        title: 'La veille profonde peut couper le réseau',
        text: 'Quand le téléphone reste longtemps écran éteint et immobile, Android peut suspendre l’accès réseau des applications pour économiser la batterie (mode « Doze »). Les demandes attendent alors sans réponse.',
        tips: [
          'Pendant vos demandes, gardez le téléphone actif ou en charge.',
          'Dans Paramètres › Applications › CamMicGo SEO MCP › Batterie, choisissez « Non restreinte ».',
          'Si l’assistant répond « en attente », rallumez l’écran : la demande est traitée dès le retour du réseau (elle reste valable 10 minutes).',
        ],
      },
      {
        icon: '⏱️',
        title: 'Environ 6 heures par jour sur Android 15',
        text: 'Android 15 limite les services de synchronisation en arrière-plan à environ 6 heures par période de 24 heures. Au-delà, le système arrête le mode connecté et l’application l’indique.',
        tips: [
          'Activez le mode connecté seulement quand vous en avez besoin, puis arrêtez-le.',
          'S’il a été arrêté, ouvrez l’application et touchez « Activer le mode connecté ».',
          'Android 14 et versions antérieures ne sont pas concernés par cette limite.',
        ],
      },
    ],
    note: 'Les transcriptions déjà récupérées sont gardées en cache 30 jours : la même vidéo ne sollicite plus le téléphone.',
  },
  en: {
    kicker: 'GOOD TO KNOW',
    title: 'Two limits set by Android',
    cards: [
      {
        icon: '🌙',
        title: 'Deep sleep can cut network access',
        text: 'When the phone stays idle with its screen off, Android may suspend apps’ network access to save battery (“Doze” mode). Requests then wait unanswered.',
        tips: [
          'While you request transcripts, keep the phone awake or charging.',
          'In Settings › Apps › CamMicGo SEO MCP › Battery, choose “Unrestricted”.',
          'If the assistant says “pending”, wake the screen: the request is handled as soon as the network is back (it stays valid for 10 minutes).',
        ],
      },
      {
        icon: '⏱️',
        title: 'About 6 hours a day on Android 15',
        text: 'Android 15 limits background sync services to about 6 hours per 24 hours. Past that, the system stops connected mode and the app says so.',
        tips: [
          'Turn on connected mode only when you need it, then turn it off.',
          'If it was stopped, open the app and tap “Activer le mode connecté”.',
          'Android 14 and earlier are not affected by this limit.',
        ],
      },
    ],
    note: 'Fetched transcripts are cached for 30 days, so the same video never needs the phone again.',
  },
};

export function RelayLimits({ lang = 'fr' }: { lang?: Lang }) {
  const l = limits[lang];
  return (
    <div className="relay-limits">
      <span className="kicker">{l.kicker}</span>
      <h2>{l.title}</h2>
      <div className="relay-limit-grid">
        {l.cards.map(c => (
          <article className="relay-limit-card" key={c.title}>
            <div className="relay-limit-head">
              <span className="relay-limit-icon" aria-hidden="true">{c.icon}</span>
              <h3>{c.title}</h3>
            </div>
            <p>{c.text}</p>
            <div className="relay-limit-tips">
              <strong>{lang === 'fr' ? 'Que faire' : 'What to do'}</strong>
              <ul>{c.tips.map(t => <li key={t}>{t}</li>)}</ul>
            </div>
          </article>
        ))}
      </div>
      <p className="relay-limit-note">{l.note}</p>
    </div>
  );
}

const pairing = {
  fr: [
    { title: 'Installez l’application', text: 'Téléchargez l’APK depuis cette page et ouvrez-la sur votre téléphone Android (8 ou plus récent).' },
    { title: 'Demandez un code à votre assistant', text: 'Dans Claude ou ChatGPT connecté au serveur CamMicGo, écrivez « donne-moi un code d’appairage CamMicGo ». Il affiche un code comme ABCD-2345, valable 10 minutes.' },
    { title: 'Appairez', text: 'Dans l’app, bloc « Connexion au serveur MCP » : saisissez le code et touchez « Appairer ». Autorisez les notifications : le mode connecté démarre.' },
    { title: 'Demandez vos transcriptions', text: 'Par exemple « récupère la transcription de cette vidéo YouTube ». Le téléphone la traite et l’assistant reçoit le texte horodaté.' },
  ],
  en: [
    { title: 'Install the app', text: 'Download the APK from seo.cammicgo.com/download and open it on your Android phone (8 or newer).' },
    { title: 'Ask your assistant for a code', text: 'In Claude or ChatGPT connected to the CamMicGo server, ask “give me a CamMicGo pairing code”. It shows a code like ABCD-2345, valid for 10 minutes.' },
    { title: 'Pair', text: 'In the app, under “Connexion au serveur MCP”, type the code and tap “Appairer”. Allow notifications: connected mode starts.' },
    { title: 'Request transcripts', text: 'For example “get the transcript of this YouTube video”. The phone handles it and the assistant receives the timestamped text.' },
  ],
};

export function RelaySteps({ lang = 'fr' }: { lang?: Lang }) {
  return (
    <ol className="relay-steps">
      {pairing[lang].map((s, i) => (
        <li key={s.title}>
          <span className="relay-step-num" aria-hidden="true">{i + 1}</span>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
        </li>
      ))}
    </ol>
  );
}
