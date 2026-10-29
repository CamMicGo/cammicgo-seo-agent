const platforms=[
 {name:'Windows',icon:'⊞',format:'.exe / .msi',desc:'Windows 10 / 11'},
 {name:'macOS',icon:'⌘',format:'.dmg',desc:'Intel & Apple Silicon'},
 {name:'Linux',icon:'🐧',format:'.deb / .rpm / AppImage',desc:'Linux desktop'},
 {name:'Android',icon:'🤖',format:'.apk',desc:'Android phones & tablets'},
 {name:'iOS / iPadOS',icon:'●',format:'App Store / TestFlight',desc:'iPhone & iPad'}
];
export default function AgentDownloads(){return <section id="agent-downloads" className="feature-section" aria-labelledby="agent-download-title"><span className="kicker">CAMMICGO LOCAL AGENT</span><h2 id="agent-download-title">Download for your device</h2><p className="lead">Run YouTube caption extraction on your own device. No paid residential proxy required. Installers are in development and are not available yet.</p><div className="agent-platforms">{platforms.map(p=><article className="agent-platform" key={p.name}><span className="agent-platform-icon" aria-hidden="true">{p.icon}</span><h3>{p.name}</h3><p>{p.desc}</p><small>{p.format}</small><span className="agent-unavailable" aria-label={p.name+' coming soon'}>Coming soon</span></article>)}</div><p className="notice">Local extraction depends on video availability and YouTube restrictions. No installer is published or verified yet. Source and prototype: <a href="https://github.com/CamMicGo/cammicgo-seo-agent" target="_blank" rel="noreferrer">GitHub</a>.</p></section>}
