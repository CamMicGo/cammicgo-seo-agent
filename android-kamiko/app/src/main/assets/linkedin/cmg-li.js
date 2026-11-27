/*
 * CamMicGo LinkedIn reader (read-only), injected into the signed-in LinkedIn WebView of the Android app.
 * The same file is loaded by the Node fixture tests (tests/linkedin-reader.test.ts), so what is tested is
 * exactly what ships in the APK.
 *
 * Rules:
 *  - Detection relies on accessible names, roles, links and LinkedIn URNs first, CSS classes last
 *    (LinkedIn renames classes often and serves different layouts on mobile and desktop).
 *  - Every click goes through safeClick(), which refuses overflow ("three dots") menus, reaction toggles,
 *    sharing, editing, deleting and reporting controls. Nothing here posts, reacts or changes anything.
 *  - Results say what was really read: "complete" is only true when counts match LinkedIn's counters.
 */
(function () {
  'use strict';
  var VERSION = '2026.11.24-3';
  if (window.__cmgLi && window.__cmgLi.version === VERSION) return;

  var env = { noLayout: !!window.__cmgLiNoLayout, delayScale: window.__cmgLiDelayScale == null ? 1 : window.__cmgLiDelayScale };
  // Per-pass caches: the DOM only changes across awaits and clicks, which clear them.
  var memo = new Map(), kindCache = new WeakMap();
  function invalidate() { memo = new Map(); kindCache = new WeakMap(); }
  function cached(key, root, fn) { var m = memo.get(root); if (!m) { m = {}; memo.set(root, m); } if (!(key in m)) m[key] = fn(); return m[key]; }
  // Android throttles or freezes a page's timers when it thinks the page is in the background (down to one
  // wake-up a minute, or none). Every pause is therefore also ended by the app's own check of the page,
  // which runs every 600 ms whatever the page's state (tick, called by runPoll).
  var sleeping = [];
  function wake(t) { if (t.done) return; t.done = true; var i = sleeping.indexOf(t); if (i >= 0) sleeping.splice(i, 1); invalidate(); t.r(); }
  function tick() { var now = Date.now(); sleeping.slice().forEach(function (t) { if (t.due <= now) wake(t); }); }
  var sleep = function (ms) { invalidate(); var d = Math.max(0, ms * env.delayScale); return new Promise(function (r) { var t = { due: Date.now() + d, r: r, done: false }; sleeping.push(t); setTimeout(function () { wake(t); }, d); }); };
  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`]/g, "'").toLowerCase().replace(/\s+/g, ' ').trim(); };
  var attr = function (e, n) { return e && e.getAttribute ? e.getAttribute(n) || '' : ''; };
  var txt = function (e) { if (!e) return ''; var t = e.innerText != null ? e.innerText : e.textContent; return String(t || '').replace(/ /g, ' ').trim(); };
  var lines = function (s) { return String(s || '').split('\n').map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean); };
  var cls = function (e) { var c = e && e.className; return String(c && c.baseVal != null ? c.baseVal : c || ''); };
  var uniq = function (a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); };
  var arr = function (x) { return Array.prototype.slice.call(x || []); };
  var qsa = function (root, sel) { try { return arr((root || document).querySelectorAll(sel)); } catch (e) { return []; } };
  var before = function (a, b) { return !!(a.compareDocumentPosition(b) & 4); }; // a precedes b

  function vis(e) {
    if (!e || !e.isConnected) return false;
    if (env.noLayout) {
      for (var p = e; p && p.nodeType === 1; p = p.parentElement) {
        if (p.hidden || /display:\s*none|visibility:\s*hidden/i.test(attr(p, 'style'))) return false;
      }
      return true;
    }
    var r = e.getClientRects();
    if (!r.length) return false;
    var b = e.getBoundingClientRect();
    if (b.width <= 0 || b.height <= 0) return false;
    var s = window.getComputedStyle(e);
    return s.visibility !== 'hidden' && s.display !== 'none';
  }

  /** Accessible name: aria-label, aria-labelledby, title, alt. */
  function label(e) {
    if (!e || !e.getAttribute) return '';
    var out = [attr(e, 'aria-label'), attr(e, 'title'), attr(e, 'alt')];
    var by = attr(e, 'aria-labelledby');
    if (by) by.split(/\s+/).forEach(function (id) { var n = document.getElementById(id); if (n) out.push(txt(n)); });
    return out.filter(Boolean).join(' ').trim();
  }
  /** Icon traits (SVG ids, data-test-icon, li-icon type, image alt/src) of an element and its descendants. */
  function iconMeta(e) {
    if (!e || !e.querySelectorAll) return '';
    var nodes = [e].concat(qsa(e, 'svg,use,img,li-icon,[data-test-icon],[data-icon],[type]').slice(0, 14));
    return nodes.map(function (x) {
      return [attr(x, 'data-test-icon'), attr(x, 'data-icon'), x.tagName === 'LI-ICON' ? attr(x, 'type') : '', attr(x, 'href'), attr(x, 'xlink:href'), x.tagName === 'svg' || x.tagName === 'SVG' ? attr(x, 'id') : '', x.tagName === 'IMG' ? attr(x, 'alt') + ' ' + attr(x, 'src').slice(0, 200) : '', x.tagName === 'svg' || x.tagName === 'SVG' || x.tagName === 'use' ? cls(x) : ''].join(' ');
    }).join(' ').replace(/\s+/g, ' ').trim();
  }
  function ownText(e) { var t = txt(e); return t.length > 120 ? t.slice(0, 120) : t; }

  // ---------------------------------------------------------------- click safety
  var OVERFLOW_RX = /(more|other)\s+(options|actions)|plus\s+d.?options|autres\s+actions|options\s+(for|de|du|des|pour|sur)|\boptions\b|\bmenu\b|overflow|ellipsis|three.?dots|trois.?points|control.?menu|options.?trigger|m[aá]s opciones|weitere optionen|^\s*(\.\.\.|…|⋯|⋮)\s*$/i;
  var DANGER_RX = /\b(modifier|supprimer|signaler|report|delete|edit|copy link|copier le lien|embed|int[eé]grer|unfollow|ne plus suivre|hide|masquer|save|enregistrer|not interested|pas int[eé]ress[eé]|block|bloquer|mute|send|envoyer|repost|republier|share|partager|post comment|publier|follow|suivre|connect|se connecter|message)\b/i;
  var TOGGLE_RX = /^(like|j.aime|react|r[eé]agir|me gusta|gef[aä]llt mir|unlike|je n.aime plus|celebrate|bravo|support|soutien|love|j.adore|insightful|instructif|funny|dr[oô]le|recommander)\b/i;

  function isOverflow(e) {
    if (!e) return true;
    var pop = attr(e, 'aria-haspopup');
    if (pop && pop !== 'false') return true;
    if (attr(e, 'aria-expanded') && /menu/i.test(attr(e, 'aria-controls'))) return true;
    var m = [label(e), ownText(e), attr(e, 'data-view-name'), attr(e, 'data-testid'), attr(e, 'data-control-name'), cls(e)].join(' ');
    if (OVERFLOW_RX.test(m)) return true;
    if (/overflow|ellipsis|three-dots|more-horizontal/i.test(iconMeta(e))) return true;
    return false;
  }
  function refusal(e, purpose) {
    if (!e) return 'missing';
    if (isOverflow(e)) return 'overflow_menu';
    var name = (label(e) || ownText(e)).trim();
    if (purpose !== 'close' && purpose !== 'tab' && DANGER_RX.test(name) && !/\d/.test(name)) return 'unsafe_action';
    if (attr(e, 'aria-pressed') && purpose !== 'tab') return 'reaction_toggle';
    if (TOGGLE_RX.test(name) && !/\d/.test(name) && purpose !== 'tab') return 'reaction_toggle';
    return '';
  }
  var clickLog = [];
  function safeClick(e, purpose) {
    var why = refusal(e, purpose);
    clickLog.push({ purpose: purpose, label: (label(e) || ownText(e)).slice(0, 80), refused: why || undefined });
    if (clickLog.length > 80) clickLog.shift();
    if (why) return false;
    try { if (e.scrollIntoView) e.scrollIntoView({ block: 'center' }); } catch (x) { /* detached */ }
    e.click();
    invalidate();
    return true;
  }
  function clickable(e) { return e && e.closest ? e.closest('button,a,[role=button],[role=tab],[tabindex]') || e : e; }

  // ---------------------------------------------------------------- classification of controls
  var NUM = '(\\d[\\d\\s., ]*\\s*[kK]?)';
  var RX = {
    commentCount: new RegExp('^' + NUM + '\\s*(comments?|commentaires?|comentarios?|kommentare?|commenti)\\b', 'i'),
    repostCount: new RegExp('^' + NUM + '\\s*(reposts?|republications?|partages?|shares?)\\b', 'i'),
    reactionCount: new RegExp('^' + NUM + '\\s*(reactions?|r[eé]actions?|reacciones|reaktionen|reazioni)\\b|\\b(and|et|y|und|e)\\s+' + NUM + '\\s+(others?|autres?( personnes)?|m[aá]s|weitere)\\b', 'i'),
    comment: /^(comment|commenter|commentaire|comentar|kommentieren|commenta)(\b|$)/i,
    reply: /^(reply|r[eé]pondre|responder|antworten|rispondi)(\b|$)/i,
    repost: /^(repost|republier|reposter|compartir|teilen)(\b|$)/i,
    send: /^(send|envoyer|enviar|senden|invia)(\b|$)/i,
  };
  function parseCount(s) {
    var m = String(s || '').replace(/ | /g, ' ').match(/(\d[\d\s.,]*)\s*([kK])?/);
    if (!m) return null;
    var raw = m[1].trim();
    if (m[2]) return Math.round(parseFloat(raw.replace(/\s/g, '').replace(',', '.')) * 1000);
    var n = parseInt(raw.replace(/[\s.,]/g, ''), 10);
    return isNaN(n) ? null : n;
  }
  function actionKind(e) {
    if (!e) return 'overflow';
    if (kindCache.has(e)) return kindCache.get(e);
    var k = actionKind0(e);
    kindCache.set(e, k);
    return k;
  }
  function actionKind0(e) {
    if (isOverflow(e)) return 'overflow';
    var l = label(e).trim(), t = ownText(e).trim();
    var cands = [l, t].filter(Boolean);
    for (var i = 0; i < cands.length; i++) {
      var s = cands[i];
      if (RX.commentCount.test(s)) return 'commentCount';
      if (RX.repostCount.test(s)) return 'repostCount';
      if (RX.reactionCount.test(s)) return 'reactionCount';
    }
    for (var j = 0; j < cands.length; j++) {
      var u = cands[j];
      if (RX.reply.test(u)) return 'reply';
      if (RX.comment.test(u)) return 'comment';
      if (RX.repost.test(u)) return 'repost';
      if (RX.send.test(u)) return 'send';
      if (TOGGLE_RX.test(u) || attr(e, 'aria-pressed')) return 'like';
    }
    var meta = norm([attr(e, 'data-view-name'), attr(e, 'data-testid'), cls(e)].join(' '));
    if (/reaction.?count|social.?counts?__reactions|reactions-count|likes-count/.test(meta) && /\d/.test(l + t)) return 'reactionCount';
    if (/comments?.?count|social.?counts?__comments/.test(meta) && /\d/.test(l + t)) return 'commentCount';
    var icon = norm(iconMeta(e));
    if (!t.replace(/\d/g, '').trim() || t.length < 3) {
      if (/comment|speech|chat-bubble/.test(icon)) return /^\d/.test(t) ? 'commentCount' : 'comment';
      if (/repost|reshare/.test(icon)) return 'repost';
    }
    return '';
  }
  function controls(root) { root = root || document; return cached('controls', root, function () { return qsa(root, 'button,a,[role=button],[role=link],[tabindex="0"]').filter(vis); }); }

  // ---------------------------------------------------------------- reactions vocabulary
  var REACTION_TYPES = [
    ['celebrate', /celebrat|bravo|praise|applau|felicit/],
    ['support', /\bsupport|soutien|apoyo|appreciation|unterst/],
    ['love', /\blove\b|j.adore|adore|empathy|encanta|heart/],
    ['insightful', /insightful|instructif|interest|interessant|interesante|lightbulb|idea/],
    ['funny', /funny|drole|entertainment|amusing|lustig|divertid|laugh|rire/],
    ['like', /\blike\b|j.aime|thumbs|recommend|me gusta|gefallt|consumption-like|reactions-like/],
  ];
  function classifyReaction(s) {
    s = norm(s);
    if (!s) return null;
    for (var i = 0; i < REACTION_TYPES.length; i++) if (REACTION_TYPES[i][1].test(s)) return REACTION_TYPES[i][0];
    return null;
  }
  function isReactionIcon(img) {
    var m = norm([attr(img, 'alt'), attr(img, 'src'), attr(img, 'data-test-icon'), attr(img, 'aria-label'), attr(img, 'id'), attr(img, 'type'), cls(img)].join(' '));
    if (/reaction|consumption|emoji|static\.licdn\.com\/aero|\/sc\/h\//.test(m)) return true;
    var w = parseInt(attr(img, 'width'), 10) || (img.getBoundingClientRect && !env.noLayout ? img.getBoundingClientRect().width : 0);
    return w > 0 && w <= 24 && !!classifyReaction(m);
  }

  // ---------------------------------------------------------------- links, people
  var PROFILE_LINK = 'a[href*="/in/"],a[href*="/company/"],a[href*="/school/"],a[href*="/showcase/"]';
  function profileUrl(href) {
    var m = String(href || '').match(/^(?:https?:\/\/(?:[a-z]{2,3}\.|www\.)?linkedin\.com)?\/(in|company|school|showcase)\/([^/?#]+)/i);
    return m ? 'https://www.linkedin.com/' + m[1].toLowerCase() + '/' + m[2] + '/' : '';
  }
  var BADGE_RX = /^(auteur|author|autor|autore|verfasser|•|·|\W?\s*(1er|2e|3e|1st|2nd|3rd|3e\+|3rd\+|\d(er|e|nd|rd|th)\+?)|premium|verified|v[eé]rifi[eé]e?|follow(ing)?|suivi|abonn[eé]e?|relation de (1er|2e|3e) niveau|(1st|2nd|3rd)[- ]degree connection|(1er|2e|3e) et \+|3rd\+|out of network|hors r[eé]seau|she\/her|he\/him|elle|il|they\/them|creator|cr[eé]ateur|top voice|statut vérifié|has a verified status|a un statut v[eé]rifi[eé]|view my (newsletter|services)|open to work|vous|you|t[uú])$/i;
  var TIME_RX = /^(\d+\s*(s|sec|secs|min|mins|mn|h|hr|hrs|hour|hours|heure|heures|j|d|day|days|jour|jours|sem|w|wk|wks|week|weeks|semaine|semaines|mo|mos|month|months|mois|an|ans|y|yr|yrs|year|years|année|années))(\s*[•·].*)?$|^(now|maintenant|à l.instant|just now)$/i;
  var ACTION_LINE_RX = /^(like|j.aime|reply|r[eé]pondre|comment|commenter|repost|republier|send|envoyer|share|partager|see more|voir plus|…\s*(plus|more)|load more.*|afficher.*|voir.*|show.*|view.*|translate.*|traduire.*|voir la traduction|see translation|\d+\s*(reactions?|r[eé]actions?|replies|r[eé]ponses?|comments?|commentaires?)|\|)$/i;
  function cleanName(s) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    var m = s.match(/^(?:view|voir|visit|photo de profil de|profile picture of|profil de)\s+(?:le profil de\s+|the profile of\s+)?(.+?)(?:['’]s profile|['’]s profile picture|\s*,.*)?$/i);
    if (m && m[1]) s = m[1];
    s = s.replace(/['’]s (profile|photo).*$/i, '').replace(/\s*[•·].*$/, '').replace(/\s+(?:\(?(?:1er|2e|3e|1st|2nd|3rd)\+?\)?)$/i, '').trim();
    return s.slice(0, 150);
  }
  function nameLines(e) {
    return lines(txt(e)).map(function (x) { return x.replace(/^[•·]\s*/, ''); }).filter(function (x) { return x && !BADGE_RX.test(x) && !TIME_RX.test(x) && !/^(view|voir)\s/i.test(x) && !/^(\+\s*)?(follow|suivre|connect|se connecter|message|envoyer un message|pending|en attente|s.abonner)$/i.test(x) && x.length < 150; });
  }
  function bestImg(scope, href) {
    var imgs = qsa(scope, 'img').filter(function (i) { return !isReactionIcon(i); });
    var linked = imgs.filter(function (i) { var a = i.closest('a'); return a && profileUrl(a.href || attr(a, 'href')) === href; });
    var pick = linked[0] || imgs.find(function (i) { return /profile|ghost|dms\/image|media\.licdn/.test(attr(i, 'src')); }) || null;
    if (!pick) return '';
    var src = pick.currentSrc || attr(pick, 'src') || '';
    return /^data:/.test(src) || /ghost-person|ghost_person/.test(src) ? '' : src;
  }
  /** Name, profile link and photo for an actor link, never a badge ("Auteur") or a mention. */
  function actorInfo(link, scope) {
    var href = profileUrl(link.href || attr(link, 'href'));
    var same = qsa(scope, PROFILE_LINK).filter(function (a) { return profileUrl(a.href || attr(a, 'href')) === href; });
    var name = '';
    for (var i = 0; i < same.length && !name; i++) name = nameLines(same[i])[0] || '';
    if (!name) for (var j = 0; j < same.length && !name; j++) name = cleanName(label(same[j]) || attr(same[j].querySelector('img'), 'alt'));
    if (!name) { var img = qsa(scope, 'img').find(function (x) { return !isReactionIcon(x) && /\S/.test(attr(x, 'alt')); }); if (img) name = cleanName(attr(img, 'alt')); }
    var badge = /\s*[•·]?\s*(auteur|author|autor|autore|verfasser)$/i;
    var isAuthorBadge = badge.test(name);
    return { name: cleanName(name.replace(badge, '')), profileUrl: href, photoUrl: bestImg(scope, href), authorBadge: isAuthorBadge };
  }

  // ---------------------------------------------------------------- URNs and post URLs
  var URN_RX = /urn(?::|%3A)li(?::|%3A)(activity|ugcPost|share)(?::|%3A)(\d{8,22})/i;
  var ACTIVITY_SLUG_RX = /linkedin\.com\/posts\/[^?#\s"']*?-(activity|ugcpost|share)-(\d{8,22})/i;
  function urnFromString(s) {
    var m = String(s || '').match(URN_RX);
    if (m) return 'urn:li:' + (m[1].toLowerCase() === 'ugcpost' ? 'ugcPost' : m[1].toLowerCase()) + ':' + m[2];
    var p = String(s || '').match(ACTIVITY_SLUG_RX);
    if (p) return 'urn:li:' + (p[1].toLowerCase() === 'ugcpost' ? 'ugcPost' : p[1].toLowerCase()) + ':' + p[2];
    return '';
  }
  function ownUrn(e) {
    if (!e || !e.attributes) return '';
    for (var i = 0; i < e.attributes.length; i++) { var u = urnFromString(e.attributes[i].value); if (u && !/urn(?::|%3A)li(?::|%3A)comment/i.test(e.attributes[i].value)) return u; }
    return '';
  }
  /** The post's own URN: on the container, then permalink links, then the first URN inside (not a comment). */
  function urnOf(c) {
    var u = ownUrn(c);
    if (u) return u;
    var links = qsa(c, 'a[href*="/feed/update/"],a[href*="/posts/"]');
    for (var i = 0; i < links.length; i++) { u = urnFromString(links[i].href || attr(links[i], 'href')); if (u) return u; }
    var all = qsa(c, '*').slice(0, 2500);
    for (var j = 0; j < all.length; j++) { u = ownUrn(all[j]); if (u) return u; }
    return '';
  }
  function postUrlOf(urn) { return urn ? 'https://www.linkedin.com/feed/update/' + urn + '/' : ''; }
  function sameTarget(urnA, urnB) { return !!urnA && !!urnB && urnA.split(':').pop() === urnB.split(':').pop(); }

  // ---------------------------------------------------------------- page state
  function pageState() {
    var body = document.body;
    var t = txt(body);
    return {
      url: location.href.split('#')[0].slice(0, 300),
      path: location.pathname,
      ready: document.readyState,
      bodyLength: t.length,
      signedOut: !!document.querySelector('input[name=session_key],form[action*="login"]') || /\/(login|authwall|checkpoint|uas)\b/.test(location.pathname),
      noResults: noResults(),
    };
  }
  function noResults() {
    if (document.querySelector('[class*="no-results"],[data-view-name*="no-results"],[data-test-id*="no-results"]')) return true;
    var heads = qsa(document, 'h1,h2,h3,[role=heading],p').filter(vis).slice(0, 200);
    return heads.some(function (h) { return /^(no results found|aucun r[eé]sultat|ning[uú]n resultado|keine ergebnisse|nessun risultato|no matching results)/i.test(txt(h)); });
  }
  /** A summary of the page structure (no personal data) so a layout change can be fixed from one report. */
  function domShape(extra) {
    var vn = {};
    qsa(document, '[data-view-name]').forEach(function (e) { var v = attr(e, 'data-view-name'); vn[v] = (vn[v] || 0) + 1; });
    var kinds = {};
    controls(document).forEach(function (e) { var k = actionKind(e) || 'other'; kinds[k] = (kinds[k] || 0) + 1; });
    var urnEls = 0, urnAttrs = {};
    qsa(document, '*').slice(0, 6000).forEach(function (e) {
      for (var i = 0; i < e.attributes.length; i++) if (/urn(?::|%3A)li(?::|%3A)(activity|ugcPost|share)/i.test(e.attributes[i].value)) { urnEls++; urnAttrs[e.attributes[i].name] = (urnAttrs[e.attributes[i].name] || 0) + 1; break; }
    });
    var shape = {
      viewNames: Object.keys(vn).sort(function (a, b) { return vn[b] - vn[a]; }).slice(0, 30).map(function (k) { return k + ':' + vn[k]; }),
      controlKinds: kinds,
      urnElements: urnEls,
      urnAttributes: urnAttrs,
      roles: ['article', 'listitem', 'list', 'dialog', 'tab', 'feed'].reduce(function (o, r) { o[r] = qsa(document, '[role=' + r + ']').length; return o; }, {}),
      articles: qsa(document, 'article').length,
      profileLinks: qsa(document, PROFILE_LINK).length,
      permalinkLinks: qsa(document, 'a[href*="/feed/update/"],a[href*="/posts/"]').length,
      dialogsOpen: qsa(document, '[role=dialog],[aria-modal=true]').filter(vis).length,
      clicks: clickLog.slice(-20),
    };
    if (extra) for (var k in extra) shape[k] = extra[k];
    return shape;
  }

  // ---------------------------------------------------------------- posts
  var LEGACY_POST = '[data-urn*="urn:li:activity"],[data-urn*="urn:li:ugcPost"],[data-urn*="urn:li:share"],[data-id*="urn:li:activity"],[data-view-name*="feed-full-update"],[data-view-name*="feed-update"],[class*="feed-shared-update-v2"],[class*="occludable-update"]';
  function isChrome(e) { return !!e.closest('header,nav,aside,footer,[class*="global-nav"],[role=banner],[role=navigation],[role=complementary]'); }
  function replyButtons(root) { root = root || document; return cached('replies', root, function () { return controls(root).filter(function (e) { return actionKind(e) === 'reply'; }); }); }
  function repliesIn(p, scope) { return replyButtons(scope || document).filter(function (r) { return p.contains(r); }).length; }
  /** Inside a comment (or reply) of the scope, as opposed to the post itself. */
  function inCommentBlock(e, scope) {
    scope = scope || document;
    return commentBlocks(scope).some(function (b) { return b.block !== scope && b.block !== e && b.block.contains(e) && !e.contains(b.reply); });
  }
  function lca(a, b) { for (var p = a; p; p = p.parentElement) if (p.contains(b)) return p; return null; }

  /** Post containers by three independent strategies: action bars, URNs, legacy selectors. */
  function findPosts(root) {
    root = root || document;
    var all = controls(root).filter(function (e) { return !isChrome(e); }).map(function (e) { return { e: e, k: actionKind(e) }; }).filter(function (x) { return x.k === 'comment' || x.k === 'repost' || x.k === 'commentCount'; }).filter(function (x) { return !inCommentBlock(x.e, root); });
    var primaries = all.map(function (x) { return x.e; });
    var count = function (p, kinds) { return all.filter(function (x) { return kinds.indexOf(x.k) >= 0 && p.contains(x.e); }).length; };
    var found = [], strategies = { actionBar: 0, urn: 0, legacy: 0 };
    primaries.forEach(function (a) {
      // Highest ancestor that still holds one action bar (at most one "comment" and one "repost").
      var max = a;
      for (var p = a.parentElement; p && p !== document.body && p !== root.parentElement; p = p.parentElement) {
        if (count(p, ['comment']) > 1 || count(p, ['repost']) > 1 || count(p, ['commentCount']) > 1) break;
        max = p;
      }
      var actor = qsa(max, PROFILE_LINK).filter(function (l) { return vis(l) && !isChrome(l) && before(l, a) && !inCommentBlock(l, max); })[0];
      if (!actor) return;
      var c = lca(actor, a);
      if (c && txt(c).length >= 40) { found.push({ el: c, actor: actor, via: 'actionBar' }); strategies.actionBar++; }
    });
    qsa(root, '*').slice(0, 8000).forEach(function (e) {
      if (!ownUrn(e) || isChrome(e)) return;
      if (/^(A|BUTTON|IMG|SPAN|svg|SVG|USE|TIME)$/.test(e.tagName)) return;
      if (txt(e).length < 40) return;
      found.push({ el: e, via: 'urn' }); strategies.urn++;
    });
    qsa(root, LEGACY_POST).filter(vis).forEach(function (e) { if (txt(e).length >= 40) { found.push({ el: e, via: 'legacy' }); strategies.legacy++; } });

    // Action-bar posts first (they hold the author and the actions); URN/legacy elements only add their
    // URN to the post they belong to, and stand alone only when no action-bar post overlaps them.
    found.forEach(function (f) { f.len = txt(f.el).length; });
    found.sort(function (x, y) { return (x.via === 'actionBar' ? 0 : 1) - (y.via === 'actionBar' ? 0 : 1) || x.len - y.len; });
    var posts = [];
    found.forEach(function (f) {
      if (isChrome(f.el)) return;
      var outer = posts.filter(function (p) { return p.el.contains(f.el); });
      var inner = posts.filter(function (p) { return f.el.contains(p.el) && p.el !== f.el; });
      if (outer.length) { var o = outer[outer.length - 1]; o.vias[f.via] = 1; if (!o.urn) o.urn = ownUrn(f.el); return; }
      if (inner.length === 1) { inner[0].vias[f.via] = 1; if (!inner[0].urn) inner[0].urn = ownUrn(f.el); return; }
      if (inner.length > 1) return;
      var v = {}; v[f.via] = 1;
      posts.push({ el: f.el, actor: f.actor || null, urn: ownUrn(f.el), vias: v });
    });
    posts.sort(function (x, y) { return before(x.el, y.el) ? -1 : 1; });
    return { posts: posts, strategies: strategies, primaries: primaries.length };
  }

  var BODY_SEL = '[class*="commentary"],[class*="update-components-text"],[class*="feed-shared-text"],[class*="feed-shared-inline-show-more-text"],[data-view-name*="commentary"],[data-testid*="commentary"],[data-test-id*="commentary"],[dir="ltr"],[dir="auto"]';
  function extractPost(p) {
    var c = p.el;
    var actor = p.actor || qsa(c, PROFILE_LINK).filter(function (l) { return !isChrome(l); })[0] || null;
    var info = actor ? actorInfo(actor, c) : { name: '', profileUrl: '', photoUrl: '' };
    var actorBox = actor ? qsa(c, PROFILE_LINK).filter(function (a) { return profileUrl(a.href || attr(a, 'href')) === info.profileUrl; }).reduce(function (acc, a) { return acc ? lca(acc, a) : a; }, null) : null;
    if (actorBox === c) actorBox = actor;
    var nameLink = actor ? qsa(c, PROFILE_LINK).filter(function (a) { return profileUrl(a.href || attr(a, 'href')) === info.profileUrl && nameLines(a).length; })[0] || actor : null;
    var headRoot = nameLink;
    for (var hp = nameLink && nameLink.parentElement; hp && hp !== c; hp = hp.parentElement) {
      if (txt(hp).length > 400 || controls(hp).some(function (e) { var k = actionKind(e); return k && k !== 'overflow' && k !== ''; }) || qsa(hp, BODY_SEL).some(function (b) { return txt(b).length > 200; })) break;
      headRoot = hp;
    }
    var headLines = headRoot ? lines(txt(headRoot)) : [];
    var headline = headLines.filter(function (x) { return x !== info.name && !BADGE_RX.test(x) && !TIME_RX.test(x.replace(/^[•·]\s*/, '')) && !/^(follow|suivre|\+ follow|\+ suivre)$/i.test(x); })[0] || '';
    var timeEl = c.querySelector('time');
    var time = timeEl ? (attr(timeEl, 'datetime') || txt(timeEl)) : (headLines.map(function (x) { return x.replace(/^[•·]\s*/, ''); }).find(function (x) { return TIME_RX.test(x); }) || '');
    var bodies = qsa(c, BODY_SEL).filter(function (b) { return !(actorBox && actorBox.contains(b)) && !(actor && b.contains(actor)) && !inCommentBlock(b, c) && repliesIn(b, c) === 0 && txt(b).length > 0; });
    bodies.sort(function (x, y) { return txt(y).length - txt(x).length; });
    var text = bodies.length ? txt(bodies[0]) : '';
    if (!text) {
      // What is left once the header, action bars, counters and comments are set aside.
      var avoid = (headRoot ? [headRoot] : []).concat(qsa(c, PROFILE_LINK).filter(function (a) { return profileUrl(a.href || attr(a, 'href')) === info.profileUrl; }))
        .concat(commentBlocks(c).map(function (x) { return x.block; }))
        .concat(controls(c).filter(function (e) { var k = actionKind(e); return k && k !== 'overflow'; }).map(function (e) { return e.parentElement && e.parentElement !== c ? e.parentElement : e; }));
      var parts = [];
      var walk = function (n) { arr(n.children).forEach(function (ch) { if (avoid.some(function (x) { return x === ch || x.contains(ch); })) return; if (avoid.some(function (x) { return ch.contains(x); })) { walk(ch); return; } if (vis(ch)) parts.push(txt(ch)); }); };
      walk(c);
      var skip = {};
      headLines.forEach(function (x) { skip[x] = 1; });
      text = lines(parts.join('\n')).filter(function (x) { return !skip[x] && !ACTION_LINE_RX.test(x) && !RX.reactionCount.test(x) && !RX.commentCount.test(x) && !TIME_RX.test(x); }).join('\n');
    }
    var imgs = qsa(c, 'img').filter(function (i) {
      if (isReactionIcon(i) || (actorBox && actorBox.contains(i)) || inCommentBlock(i, c)) return false;
      var w = parseInt(attr(i, 'width'), 10) || i.naturalWidth || (!env.noLayout ? i.getBoundingClientRect().width : 0);
      return /feedshare|image-shrink|articleshare|videocover|dms\/image\/[^"]*(feedshare|image)/i.test(attr(i, 'src')) || w >= 150;
    });
    var counts = { reactions: null, comments: null, reposts: null };
    controls(c).concat(qsa(c, 'span,div,li').filter(function (e) { return !e.children.length; })).forEach(function (e) {
      if (inCommentBlock(e, c)) return;
      var k = actionKind(e), s = label(e) + ' ' + ownText(e);
      if (k === 'reactionCount' && counts.reactions == null) counts.reactions = reactionTotal(e);
      if (k === 'commentCount' && counts.comments == null) counts.comments = parseCount((s.match(/(\d[\d\s.,]*\s*[kK]?)\s*(?:comments?|commentaires?|comentarios?|kommentare?)/i) || [])[1] || s);
      if (k === 'repostCount' && counts.reposts == null) counts.reposts = parseCount(s);
    });
    if (counts.reactions == null) {
      // Mobile: reaction icons followed by a bare number.
      var bare = qsa(c, 'span,div,button,a').find(function (e) { return !e.children.length && /^\d[\d\s.,]*$/.test(txt(e)) && !inCommentBlock(e, c) && e.previousElementSibling && qsa(e.previousElementSibling, 'img,svg').concat([e.previousElementSibling]).some(function (i) { return isReactionIcon(i); }); });
      if (bare) counts.reactions = parseCount(txt(bare));
    }
    var urn = p.urn || urnOf(c);
    return {
      postUrl: postUrlOf(urn),
      urn: urn || null,
      author: info.name || null,
      authorProfileUrl: info.profileUrl || null,
      authorPhotoUrl: info.photoUrl || null,
      authorHeadline: headline.slice(0, 220) || null,
      time: String(time || '').replace(/\s*[•·].*$/, '').trim().slice(0, 80) || null,
      text: text.slice(0, 5000),
      images: imgs.slice(0, 8).map(function (i) { return i.currentSrc || attr(i, 'src'); }).filter(Boolean),
      imageCount: imgs.length,
      reactionCount: counts.reactions,
      commentCount: counts.comments,
      repostCount: counts.reposts,
      detectedBy: Object.keys(p.vias || {}),
    };
  }
  /** "Marie Curie and 13 others" → 14; "14 reactions" → 14; a bare "14" next to reaction icons → 14. */
  function reactionTotal(e) {
    var s = (label(e) + ' ' + ownText(e)).replace(/ | /g, ' ');
    var others = s.match(/\b(?:and|et|y|und|e)\s+(\d[\d\s.,]*)\s+(?:others?|autres?|m[aá]s|weitere)/i);
    if (others) return parseCount(others[1]) + 1;
    var n = s.match(/(\d[\d\s.,]*\s*[kK]?)\s*(?:reactions?|r[eé]actions?|reacciones|reaktionen|reazioni)/i);
    if (n) return parseCount(n[1]);
    return parseCount(s);
  }

  // ---------------------------------------------------------------- matching a target post
  var STOP = { le: 1, la: 1, les: 1, de: 1, des: 1, du: 1, un: 1, une: 1, et: 1, en: 1, the: 1, and: 1, of: 1, to: 1, a: 1, on: 1, sur: 1, pour: 1, par: 1, avec: 1, est: 1, ces: 1, ce: 1, qui: 1, que: 1, peut: 1, parler: 0 };
  function tokens(s) { return uniq(norm(s).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(' ').filter(function (w) { return w.length >= 2 && !STOP[w]; })); }
  function matchScore(post, want) {
    var hay = norm([post.text, post.author, post.authorHeadline].join(' ')).replace(/[^\p{L}\p{N}\s]/gu, ' ');
    var kw = tokens(want.keywords || ''), hits = kw.filter(function (w) { return hay.indexOf(w) >= 0; });
    var authorOk = null;
    if (want.author) { var at = tokens(want.author), an = norm(post.author || '').replace(/[^\p{L}\p{N}\s]/gu, ' '); authorOk = at.length > 0 && at.every(function (w) { return an.indexOf(w) >= 0; }); }
    if (want.authorProfileUrl && post.authorProfileUrl) authorOk = profileUrl(want.authorProfileUrl) === post.authorProfileUrl || authorOk;
    var urnOk = want.urn ? sameTarget(want.urn, post.urn) : null;
    var score = (kw.length ? hits.length / kw.length : 0) * 10 + (authorOk ? 6 : 0) + (urnOk ? 100 : 0);
    return { score: Math.round(score * 10) / 10, keywordHits: hits.length, keywordTotal: kw.length, authorMatch: authorOk, urnMatch: urnOk };
  }

  async function waitFor(fn, timeout, step) {
    var end = Date.now() + timeout * env.delayScale, v;
    for (;;) {
      try { v = fn(); } catch (e) { v = null; }
      if (v) return v;
      if (Date.now() >= end) return null;
      await sleep(step || 300);
    }
  }
  function scrollers(root) {
    return (root && root.nodeType === 1 ? [root].concat(qsa(root, '*')) : qsa(root || document, '*')).filter(function (e) {
      if (env.noLayout) return false;
      if (e.scrollHeight <= e.clientHeight + 30) return false;
      var o = window.getComputedStyle(e).overflowY;
      return o === 'auto' || o === 'scroll';
    }).slice(0, 4);
  }
  function scrollMore(root) {
    window.scrollBy(0, Math.round((window.innerHeight || 800) * 1.2));
    scrollers(root).forEach(function (s) { s.scrollTop = s.scrollTop + Math.round(s.clientHeight * 0.9); });
  }

  /** Reads posts on a list page (search results, feed, profile activity), scrolling for more. */
  async function collectPosts(o, progress) {
    o = o || {};
    var limit = Math.max(1, Math.min(60, o.limit || 20)), rounds = o.scrolls == null ? 6 : o.scrolls;
    var st = pageState();
    if (st.signedOut) return { status: 'signed_out', posts: [], diagnostics: { page: st } };
    await waitFor(function () { return findPosts().posts.length || noResults(); }, o.firstWait || 12000, 400);
    var byKey = {}, order = [];
    for (var i = 0; i <= rounds; i++) {
      var f = findPosts();
      f.posts.forEach(function (p) {
        var x = extractPost(p);
        var key = x.urn || norm(x.author + '|' + x.text.slice(0, 160));
        if (!byKey[key]) { order.push(key); byKey[key] = x; } else if (x.text.length > byKey[key].text.length) byKey[key] = x;
        if (o.mark && !p.el.hasAttribute('data-cmg-post')) p.el.setAttribute('data-cmg-post', key.slice(0, 60));
      });
      if (progress) progress({ posts: order.length });
      if (order.length >= (o.enough || limit) || noResults()) break;
      if (o.stopWhen && order.some(function (k) { return o.stopWhen(byKey[k]); })) break;
      if (i < rounds) { scrollMore(); invalidate(); await waitFor(function () { return countNew(byKey) > 0; }, 1800, 500); }
    }
    var posts = order.map(function (k) { return byKey[k]; });
    var page = pageState(), status;
    if (posts.length) status = 'ok';
    else if (page.noResults) status = 'no_results';
    else if (page.bodyLength < 400) status = 'not_loaded';
    else status = 'extraction_failed';
    var out = { status: status, posts: posts, retrieved: posts.length, diagnostics: { page: page } };
    if (status !== 'ok' || o.diagnose) out.diagnostics.dom = domShape({ strategies: findPosts().strategies });
    return out;
  }
  function countNew(byKey) {
    return findPosts().posts.filter(function (p) { var x = extractPost(p); return !byKey[x.urn || norm(x.author + '|' + x.text.slice(0, 160))]; }).length;
  }

  async function searchPosts(o, progress) {
    o = o || {};
    if (/\/search\/results\//.test(location.pathname) && !/\/content\//.test(location.pathname)) ensurePostsFilter();
    var want = { keywords: o.keywords, author: o.author, authorProfileUrl: o.authorProfileUrl, urn: urnFromString(o.postUrl || '') };
    // Stop scrolling as soon as a post matches the author and every keyword: the usual "find this post" case.
    var strong = function (p) { var m = matchScore(p, want); return (want.author || want.authorProfileUrl ? m.authorMatch : true) && (m.keywordTotal ? m.keywordHits === m.keywordTotal : !!(want.author || want.authorProfileUrl)) && !!(want.keywords || want.author || want.authorProfileUrl); };
    var r = await collectPosts({ limit: Math.max(o.limit || 20, 10), scrolls: o.scrolls == null ? 5 : o.scrolls, enough: o.limit || 20, mark: true, stopWhen: o.exhaustive ? null : strong }, progress);
    r.posts.forEach(function (p) { p.match = matchScore(p, want); });
    var kept = r.posts.filter(function (p) { return want.author || want.authorProfileUrl ? p.match.authorMatch : true; });
    kept.sort(function (a, b) { return b.match.score - a.match.score; });
    r.unfiltered = r.posts.length;
    r.posts = kept.slice(0, o.limit || 20);
    r.retrieved = r.posts.length;
    if (r.status === 'ok' && !r.posts.length) { r.status = 'no_matching_post'; r.authorsOnPage = collectAuthors(); }
    r.searchUrl = location.href.slice(0, 300);
    return r;
  }
  function collectAuthors() { return findPosts().posts.map(function (p) { var x = extractPost(p); return x.author ? x.author + (x.authorProfileUrl ? ' <' + x.authorProfileUrl + '>' : '') : ''; }).filter(Boolean).slice(0, 25); }

  /** Selects the "Posts" / "Publications" filter of a search page (a filter pill, never a menu). */
  function ensurePostsFilter() {
    var pill = controls(document).find(function (e) { return /^(posts|publications|beitr[aä]ge|publicaciones|post)$/i.test((ownText(e) || label(e)).trim()) && !isOverflow(e); });
    if (!pill) return 'missing';
    if (attr(pill, 'aria-pressed') === 'true' || attr(pill, 'aria-current') || attr(pill, 'aria-selected') === 'true') return 'already';
    pill.click();
    return 'clicked';
  }
  /** Types a query in LinkedIn's own search bar and submits it (used when the results URL gives nothing). */
  function typeSearch(q) {
    var input = qsa(document, 'input[role=combobox],input[type=search],input[placeholder*="Search" i],input[placeholder*="Recherch" i],input[aria-label*="Search" i],input[aria-label*="Recherch" i]').filter(vis)[0];
    if (!input) return 'missing';
    input.focus();
    var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, q);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    ['keydown', 'keypress', 'keyup'].forEach(function (t) { input.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })); });
    var form = input.closest('form');
    if (form && form.requestSubmit) try { form.requestSubmit(); } catch (e) { /* LinkedIn handles Enter itself */ }
    return 'submitted';
  }

  // ---------------------------------------------------------------- target post scope
  function openDialogs() { return qsa(document, '[role=dialog],[aria-modal=true]').filter(vis); }
  function isReactionsDialog(d) {
    var h = d.querySelector('h1,h2,h3,[role=heading]');
    return /r[eé]actions?|reacciones|reaktionen|reazioni/i.test(txt(h) + ' ' + label(d)) || qsa(d, '[role=tab]').some(function (t) { return /\d/.test(txt(t) + label(t)) && !!classifyReaction(txt(t) + ' ' + label(t) + ' ' + iconMeta(t)); });
  }
  function commentEditor(root) { return qsa(root, '[contenteditable=true],textarea').filter(vis).find(function (e) { return /comment|r[eé]pon|reply|ajouter/i.test(label(e) + ' ' + attr(e, 'placeholder') + ' ' + attr(e, 'data-placeholder')); }) || null; }
  /**
   * Where the target post lives: a marked post, an open comment panel/sheet (e.g. over search results),
   * the post matching the given URL/keywords/author, or the only post on the page.
   */
  function resolveScope(o) {
    o = o || {};
    var want = { keywords: o.keywords, author: o.author, authorProfileUrl: o.authorProfileUrl, urn: urnFromString(o.postUrl || '') };
    var marked = document.querySelector('[data-cmg-target]');
    if (marked && marked.isConnected && vis(marked)) return { scope: marked, how: 'marked' };
    var panels = openDialogs().filter(function (d) { return !isReactionsDialog(d) && (replyButtons(d).length || commentEditor(d) || controls(d).some(function (e) { return actionKind(e) === 'commentCount'; })); });
    if (panels.length) {
      var dp = panels[panels.length - 1];
      var inner = findPosts(dp).posts;
      if (!want.urn || !inner.length || inner.some(function (p) { return sameTarget(urnOf(p.el), want.urn); }) || !urnOf(dp)) return { scope: dp, how: 'open_panel' };
    }
    var posts = findPosts().posts;
    if (!posts.length) return { scope: null, how: 'no_post', candidates: 0 };
    if (want.urn) { var byUrn = posts.filter(function (p) { return sameTarget(p.urn || urnOf(p.el), want.urn); }); if (byUrn.length) return { scope: byUrn[0].el, how: 'urn' }; }
    var onPostPage = /\/(feed\/update|posts)\//.test(location.pathname);
    if (posts.length === 1) return { scope: posts[0].el, how: 'single_post' };
    if (want.keywords || want.author || want.authorProfileUrl) {
      var ranked = posts.map(function (p) { return { p: p, m: matchScore(extractPost(p), want) }; }).filter(function (x) { return (want.author || want.authorProfileUrl) ? x.m.authorMatch : x.m.keywordHits > 0; }).sort(function (a, b) { return b.m.score - a.m.score; });
      if (ranked.length === 1 || (ranked.length > 1 && ranked[0].m.score > ranked[1].m.score)) return { scope: ranked[0].p.el, how: 'match' };
      if (ranked.length > 1) return { scope: null, how: 'ambiguous', candidates: ranked.slice(0, 5).map(function (x) { var e = extractPost(x.p); return { author: e.author, text: e.text.slice(0, 140), postUrl: e.postUrl, score: x.m.score }; }) };
    }
    if (onPostPage) return { scope: posts[0].el, how: 'post_page_main' };
    return { scope: null, how: 'ambiguous', candidates: posts.slice(0, 5).map(function (p) { var e = extractPost(p); return { author: e.author, text: e.text.slice(0, 140), postUrl: e.postUrl }; }) };
  }
  function markTarget(o) {
    var s = resolveScope(o);
    qsa(document, '[data-cmg-target]').forEach(function (e) { if (e !== s.scope) e.removeAttribute('data-cmg-target'); });
    if (s.scope) s.scope.setAttribute('data-cmg-target', '1');
    return { marked: !!s.scope, how: s.how, candidates: s.candidates || null, post: s.scope ? extractPost({ el: s.scope, vias: {} }) : null };
  }

  // ---------------------------------------------------------------- comments
  var LOAD_MORE_RX = /^(load|show|view|see|voir|afficher|charger|mostrar|ver|cargar|weitere|mehr|alle)\b.{0,40}\b(comments?|commentaires?|replies|reply|r[eé]ponses?|previous|pr[eé]c[eé]dent(e)?s?|more|plus|comentarios|respuestas|kommentare|antworten)\b|^\d+\s+(replies|reply|r[eé]ponses?|respuestas?|antworten)\b|^(voir|afficher|view|show|see)\s+(les\s+)?\d+\s+(r[eé]ponses?|replies|autres?|more|commentaires?)/i;
  var SEE_MORE_RX = /^(…\s*)?(see more|voir plus|plus|more|mehr anzeigen|ver m[aá]s|…more|…plus)$/i;
  function commentAnchors(scope) { return replyButtons(scope).filter(function (r) { return !isChrome(r); }); }
  /** One block per "Reply" control: lowest ancestor holding that control and the author's link above it. */
  function commentBlocks(scope) { scope = scope || document; return cached('blocks', scope, function () { return commentBlocks0(scope); }); }
  function commentBlocks0(scope) {
    var out = [];
    commentAnchors(scope).forEach(function (r) {
      var block = null, actor = null;
      // Replies to this comment come after its own Reply control; an earlier one belongs to another comment.
      var rs = replyButtons(scope);
      for (var p = r.parentElement; p && p !== (scope.parentElement || null); p = p.parentElement) {
        if (rs.some(function (x) { return x !== r && p.contains(x) && before(x, r); })) break;
        var links = qsa(p, PROFILE_LINK).filter(function (l) { return before(l, r); });
        if (links.length) { block = p; actor = links[0]; break; }
      }
      if (!block) { block = r.parentElement; for (var q = block, lv = 0; q && q.parentElement && q.parentElement !== scope && repliesIn(q.parentElement, scope) === 1 && lv < 3; q = q.parentElement, lv++) block = q.parentElement; }
      var outer = block;
      for (var u = block.parentElement, d = 0; u && u !== scope && d < 4 && repliesIn(u, scope) === 1; u = u.parentElement, d++) outer = u;
      out.push({ reply: r, block: block, outer: outer, actor: actor });
    });
    // Legacy layouts without a visible Reply control (read-only threads).
    if (!out.length) qsa(scope, '[class*="comments-comment-item"],[class*="comments-comment-entity"],[data-id*="urn:li:comment"]').forEach(function (b) {
      if (out.some(function (x) { return x.block.contains(b) || b.contains(x.block); })) return;
      out.push({ reply: null, block: b, outer: b, actor: qsa(b, PROFILE_LINK)[0] || null });
    });
    return out;
  }
  function commentIdOf(b) {
    for (var p = b.block, d = 0; p && d < 6; p = p.parentElement, d++) {
      // The attribute value itself is returned when it is the id, so linkedin_reply_comment finds the same element.
      for (var i = 0; i < (p.attributes || []).length; i++) { var at = p.attributes[i], m = at.value.match(/urn(?::|%3A)li(?::|%3A)comment(?::|%3A)\([^)]*\)|urn:li:comment:[\w:(),-]+/i); if (m) return /^(data-id|data-urn|id)$/.test(at.name) ? at.value : m[0]; }
      if (p === b.outer) break;
    }
    return null;
  }
  var COMMENT_TEXT_SEL = '[class*="main-content"],[class*="comment-text"],[class*="comment__text"],[data-testid*="comment-text"],[data-test-id*="comment-text"],[class*="comments-comment-item__main-content"],[dir="ltr"],[dir="auto"]';
  function extractComment(b, scope) {
    // Only what precedes this comment's own action bar belongs to it (nested replies come after).
    var own = function (e) { return !b.reply || before(e, b.reply) || (b.reply.parentElement && b.reply.parentElement.contains(e)); };
    var info = b.actor ? actorInfo(b.actor, b.outer) : { name: '', profileUrl: '', photoUrl: '' };
    var sameLinks = b.actor ? qsa(b.block, PROFILE_LINK).filter(function (a) { return profileUrl(a.href || attr(a, 'href')) === info.profileUrl && own(a); }) : [];
    var nameLink = sameLinks.find(function (a) { return nameLines(a).length; }) || b.actor;
    var headerRoot = nameLink && nameLink.parentElement && nameLink.parentElement !== b.block && !(b.reply && nameLink.parentElement.contains(b.reply)) ? nameLink.parentElement : nameLink;
    var head = headerRoot ? lines(txt(headerRoot)) : [];
    var badgeEls = qsa(b.block, 'span,div,p,li-icon,[aria-label]').filter(function (e) { return (!e.children.length || e.tagName === 'LI-ICON') && own(e); });
    var isPostAuthor = !!info.authorBadge || badgeEls.some(function (e) { return /^(auteur|author|autor|autore|verfasser)$/i.test(txt(e) || label(e)); }) || head.some(function (x) { return /^[•·]?\s*(auteur|author|autor)$/i.test(x); });
    var candidates = qsa(b.block, COMMENT_TEXT_SEL).filter(function (e) { return !(headerRoot && (headerRoot.contains(e) || e.contains(headerRoot))) && !sameLinks.some(function (a) { return a.contains(e) || e.contains(a); }) && !(b.reply && e.contains(b.reply)) && own(e) && txt(e).length > 0; });
    candidates.sort(function (x, y) { return txt(y).length - txt(x).length; });
    var text = candidates.length ? txt(candidates[0]) : '';
    if (!text) {
      // Text = what is left of the block once the header, the action bar and nested replies are set aside.
      var avoid = sameLinks.concat(headerRoot ? [headerRoot] : []).concat(b.reply ? [b.reply.parentElement] : []).concat(commentBlocks(scope).filter(function (x) { return x !== b && b.block.contains(x.block); }).map(function (x) { return x.block; }));
      var parts = [];
      var walk = function (n) { arr(n.children).forEach(function (ch) { if (avoid.some(function (a) { return a === ch || a.contains(ch); })) return; if (avoid.some(function (a) { return ch.contains(a); })) { walk(ch); return; } if (vis(ch)) parts.push(txt(ch)); }); };
      walk(b.block);
      var skip = {}; head.forEach(function (x) { skip[x] = 1; });
      text = lines(parts.join('\n')).filter(function (x) { return !skip[x] && !ACTION_LINE_RX.test(x) && !TIME_RX.test(x) && !BADGE_RX.test(x) && x !== info.name; }).join('\n');
    }
    text = text.replace(/\n?(…\s*)?(see more|voir plus)$/i, '').trim();
    var headline = head.filter(function (x) { var y = x.replace(/^[•·]\s*/, ''); return y !== info.name && !BADGE_RX.test(y) && !TIME_RX.test(y) && y.indexOf(info.name) !== 0; })[0] || '';
    var timeEl = qsa(b.block, 'time').filter(own)[0];
    var time = timeEl ? (attr(timeEl, 'datetime') || txt(timeEl)) : (lines(txt(headerRoot || b.block)).map(function (x) { return x.replace(/^[•·]\s*/, ''); }).find(function (x) { return TIME_RX.test(x); }) || '');
    var reactions = null;
    controls(b.block).concat(qsa(b.block, 'span').filter(function (e) { return !e.children.length; })).forEach(function (e) {
      if (reactions != null || !own(e)) return;
      var k = actionKind(e);
      if (k === 'reactionCount') reactions = reactionTotal(e);
    });
    if (reactions == null && b.reply) {
      // Mobile: a bare number right after the Like control.
      var likeBtn = controls(b.block).find(function (e) { return actionKind(e) === 'like' && own(e); });
      var sib = likeBtn && likeBtn.nextElementSibling;
      if (sib && /^\d+$/.test(txt(sib))) reactions = parseInt(txt(sib), 10);
    }
    return {
      commentId: commentIdOf(b),
      author: info.name || null,
      authorResolved: !!info.name,
      authorProfileUrl: info.profileUrl || null,
      authorPhotoUrl: info.photoUrl || null,
      authorHeadline: headline.slice(0, 220) || null,
      isPostAuthor: isPostAuthor,
      text: text.slice(0, 4000),
      time: String(time || '').replace(/\s*[•·].*$/, '').trim().slice(0, 80) || null,
      reactionCount: reactions,
    };
  }
  /** Reply depth from nested lists, then indentation; parent = previous comment one level up. */
  function threadComments(blocks, scope) {
    var listDepth = blocks.map(function (b) { var d = 0; for (var p = b.block; p && p !== scope; p = p.parentElement) if (/^(UL|OL)$/.test(p.tagName) || attr(p, 'role') === 'list' || /replies|reply-list|comments-replies/i.test(cls(p))) d++; return d; });
    var depth = listDepth;
    var distinct = uniq(listDepth);
    if (distinct.length < 2 && !env.noLayout) {
      var lefts = blocks.map(function (b) { var img = b.actor && (b.actor.querySelector('img') || b.actor); return Math.round((img || b.block).getBoundingClientRect().left); });
      var base = Math.min.apply(null, lefts.length ? lefts : [0]);
      depth = lefts.map(function (l) { return l - base > 12 ? 1 : 0; });
    }
    var min = Math.min.apply(null, depth.length ? depth : [0]);
    return depth.map(function (d) { return d - min > 0 ? 1 : 0; });
  }
  function readCommentsNow(scope) {
    var blocks = commentBlocks(scope);
    var depth = threadComments(blocks, scope);
    var out = [], lastTop = null, seen = {};
    blocks.forEach(function (b, i) {
      var c = extractComment(b, scope);
      c.depth = depth[i];
      var key = c.commentId || norm((c.authorProfileUrl || c.author) + '|' + c.text.slice(0, 200));
      if (seen[key]) return;
      seen[key] = 1;
      c.key = key;
      if (depth[i] === 0) { lastTop = c; c.parentKey = null; c.parentId = null; c.parentAuthor = null; }
      else { c.parentKey = lastTop ? lastTop.key : null; c.parentId = lastTop ? lastTop.commentId : null; c.parentAuthor = lastTop ? lastTop.author : null; }
      c.isReply = depth[i] > 0;
      out.push(c);
    });
    return out;
  }
  function findCommentOpener(scope) {
    var cs = controls(scope).filter(function (e) { return !inCommentBlock(e, scope); });
    var ranked = cs.map(function (e) {
      var k = actionKind(e), s = 0;
      if (k === 'commentCount') s = 10; else if (k === 'comment') s = 6;
      return { e: e, s: s, k: k };
    }).filter(function (x) { return x.s > 0 && !refusal(x.e, 'open_comments'); }).sort(function (a, b) { return b.s - a.s; });
    return ranked[0] || null;
  }
  /**
   * LinkedIn's default comment order ("Most relevant") hides some comments on big posts ("select Most recent
   * to see them"). The sort dropdown (never a three-dots menu) is switched to "Most recent" first.
   */
  var RELEVANT_RX = /^(les plus pertinents|most relevant|m[aá]s relevantes|relevanteste|mais relevantes|pi[uù] rilevanti|самые релевантные|最相关|関連度の高い順|관련성 높은 순|الأكثر صلة)/i;
  var RECENT_RX = /^(les plus r[ée]cents|most recent|m[aá]s recientes|neueste|mais recentes|pi[uù] recenti|самые новые|最新|新しい順|최신순|الأحدث)/i;
  // The sort dropdown opens a popup like a menu does, but it is named by its visible order ("Most relevant"),
  // never by dots or an overflow icon: only such a control may be opened, nothing else with a popup.
  function isSortControl(e) {
    var name = (ownText(e) || label(e) || '').trim();
    return (RELEVANT_RX.test(name) || RECENT_RX.test(name)) && name.length < 60 && !OVERFLOW_RX.test([label(e), attr(e, 'data-testid'), attr(e, 'data-control-name'), cls(e)].join(' ')) && !/overflow|ellipsis|three-dots|more-horizontal/i.test(iconMeta(e));
  }
  async function sortCommentsByRecent(scope) {
    var near = function () { return controls(scope.closest('[role=dialog]') || document.body).filter(function (e) { return vis(e) && (isSortControl(e) || !isOverflow(e)); }); };
    var cur = near().find(function (e) { return isSortControl(e) && RELEVANT_RX.test((ownText(e) || label(e)).trim()); });
    if (!cur) return near().some(function (e) { return isSortControl(e) && RECENT_RX.test((ownText(e) || label(e)).trim()); }) ? 'already_recent' : 'no_sort_control';
    clickLog.push({ purpose: 'sort_comments', label: (ownText(cur) || label(cur)).slice(0, 80) });
    try { cur.click(); invalidate(); } catch (x) { return 'refused'; }
    var opt = null;
    await waitFor(function () { opt = qsa(document, '[role=option],[role=menuitem],[role=menuitemradio],li,button,a,div[tabindex]').find(function (e) { return vis(e) && e !== cur && !isOverflow(e) && RECENT_RX.test((ownText(e) || txt(e)).trim()); }); return !!opt; }, 3000, 200);
    if (!opt) return 'option_missing';
    var before = commentBlocks(scope).length;
    safeClick(clickable(opt), 'sort_comments');
    await waitFor(function () { return commentBlocks(scope).length !== before; }, 4000, 300);
    await sleep(500);
    return 'recent';
  }
  /** Set by the app (window.__cmgLiStop) when the user or the assistant asks to stop and keep what was read. */
  function stopRequested() { return !!window.__cmgLiStop; }
  async function expandComments(scope, maxRounds, progress, expected) {
    var done = typeof WeakSet !== 'undefined' ? new WeakSet() : { has: function () { return false; }, add: function () {} };
    var clicks = 0, stable = 0, last = -1, collected = {}, retries = new WeakMap();
    function capture() { invalidate(); readCommentsNow(scope).forEach(function(c){ collected[c.key] = c; }); return Object.keys(collected).length; }
    for (var round = 0; round < maxRounds; round++) {
      if (stopRequested()) break;  // "Stop and build the report" on the phone or linkedin_job_stop
      var targets = controls(scope).filter(function (e) {
        if (isOverflow(e)) return false;
        if (done.has(e) && (!LOAD_MORE_RX.test((ownText(e) || label(e)).trim()) || (SEE_MORE_RX.test((ownText(e) || label(e)).trim()) && inCommentBlock(e, scope)) || (retries.get(e) || 0) >= 4)) return false;
        var s = (ownText(e) || label(e)).trim();
        return LOAD_MORE_RX.test(s) || (SEE_MORE_RX.test(s) && inCommentBlock(e, scope));
      });
      var nBefore = capture();
      // "See more" only unfolds a text: all of them at once. A "load more / replies" control loads from
      // LinkedIn: one per round, then wait for it (several at once get lost on big posts).
      var loaders = targets.filter(function (e) { var t = (ownText(e) || label(e)).trim(); return LOAD_MORE_RX.test(t) && !(SEE_MORE_RX.test(t) && inCommentBlock(e, scope)); });
      targets.filter(function (e) { return loaders.indexOf(e) < 0; }).forEach(function (e) { done.add(e); safeClick(clickable(e), 'expand_comments'); });
      var clicked = null;
      if (loaders.length) { var e = loaders[0]; clicked = e; done.add(e); retries.set(e,(retries.get(e)||0)+1); if (safeClick(clickable(e), 'expand_comments')) clicks++; }
      targets = loaders;
      if (!targets.length && expected != null && nBefore >= expected) break;
      if (!targets.length) {
        scrollers(scope).forEach(function (s) { s.scrollTop = s.scrollHeight; });
        if (scope === document.body || !scope.closest('[role=dialog]')) window.scrollBy(0, Math.round((window.innerHeight || 800) * 0.8));
      }
      await waitFor(function () { invalidate(); return readCommentsNow(scope).some(function(c){return !collected[c.key];}); }, targets.length ? 5000 : 3000, 500);
      var n = capture();
      // LinkedIn keeps the same "load more" button for every page: only clicks that bring nothing count
      // towards giving up on it.
      if (clicked && n > nBefore) retries.set(clicked, 0);
      if (progress) progress({ stage: 'comments', commentsVisible: n, commentsExpected: expected == null ? null : expected, expandClicks: clicks, beat:round });
      if (n === last && !targets.length) { if (++stable >= (expected != null && n < expected ? 6 : 2)) break; } else stable = 0;
      last = n;
    }
    capture();
    return { clicks: clicks, comments: Object.keys(collected).map(function(k){return collected[k];}) };
  }

  /** Comments rendered next to the post card instead of inside it: widen while no other post is included. */
  function widenForComments(scope) {
    if (commentBlocks(scope).length) return scope;
    // Posts found inside comments (a comment's own controls) are not other posts.
    var docBlocks = commentBlocks(document);
    var all = findPosts().posts.filter(function (x) { return !docBlocks.some(function (b) { return b.block.contains(x.el); }); });
    // Climb as high as needed (LinkedIn nests the comment list far from the post card), never over a second post.
    for (var p = scope.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      if (all.filter(function (x) { return p.contains(x.el); }).length > 1) break;
      if (commentBlocks(p).length) return p;
    }
    // On a single post's page every comment belongs to that post.
    if (/\/(feed\/update|posts)\//.test(location.pathname) && docBlocks.length) {
      var top = scope;
      docBlocks.forEach(function (b) { top = lca(top, b.block) || top; });
      return top;
    }
    return scope;
  }
  /** Opens the target post's comments (never a menu), expands threads and reads every rendered comment. */
  async function readComments(o, progress) {
    o = o || {};
    var st = pageState();
    if (st.signedOut) return { status: 'signed_out', comments: [], diagnostics: { page: st } };
    await waitFor(function () { return findPosts().posts.length || openDialogs().length; }, o.firstWait || 10000, 400);
    var s = resolveScope(o);
    if (!s.scope) return { status: s.how === 'ambiguous' ? 'ambiguous_post' : 'post_not_found', comments: [], candidates: s.candidates || null, diagnostics: { page: pageState(), dom: domShape() } };
    var scope = s.scope;
    var isDialog = scope.matches('[role=dialog],[aria-modal=true]');
    var post = extractPost({ el: isDialog ? (findPosts(scope).posts[0] || { el: scope }).el : scope, vias: {} });
    var opened = 'already_open';
    scope = widenForComments(scope);
    if (!commentBlocks(scope).length) {
      var op = findCommentOpener(scope);
      if (op && op.e.tagName === 'A' && op.e.href && op.e.href.split('#')[0] !== location.href.split('#')[0] && !/^javascript:/i.test(op.e.href) && /linkedin\.com/.test(op.e.href)) {
        return { status: 'navigate', url: op.e.href, reason: 'comment_control_is_a_link', post: post };
      }
      if (op && (post.commentCount == null || post.commentCount > 0)) { opened = safeClick(op.e, 'open_comments') ? 'clicked_' + op.k : 'refused'; }
      else opened = op ? 'no_comments_counter_zero' : 'no_comment_control';
      await waitFor(function () {
        var panel = openDialogs().filter(function (d) { return !isReactionsDialog(d) && replyButtons(d).length; }).pop();
        if (panel && !scope.contains(panel)) scope = panel;
        scope = widenForComments(scope);
        return commentBlocks(scope).length || (post.commentCount === 0);
      }, 9000, 350);
    }
    var limit = Math.max(1, Math.min(2000, o.limit || 100));
    var sorted = await sortCommentsByRecent(scope);
    var rounds = o.maxRounds || Math.min(600, Math.max(40, Math.ceil((post.commentCount || 0) / 2) + 20));
    var exp = await expandComments(scope, rounds, progress, post.commentCount);
    var comments = exp.comments.slice(0, limit);
    var expected = post.commentCount;
    if (o.diagnose || sorted !== 'recent') post.commentSort = sorted;
    var complete = expected != null ? comments.length >= expected : null;
    var res = {
      status: comments.length ? 'ok' : (expected === 0 ? 'no_comments' : (opened === 'no_comment_control' ? 'comment_control_missing' : 'extraction_failed')),
      post: post,
      postUrl: post.postUrl || (/\/(feed\/update|posts)\//.test(location.pathname) ? location.href.split('?')[0] : null),
      scope: s.how,
      opened: opened,
      comments: comments,
      retrieved: comments.length,
      topLevel: comments.filter(function (c) { return !c.isReply; }).length,
      replies: comments.filter(function (c) { return c.isReply; }).length,
      displayedCount: expected,
      complete: complete,
      partial: complete !== true,
      expandClicks: exp.clicks,
      note: expected != null && comments.length < expected ? 'LinkedIn shows ' + expected + ' comments but only ' + comments.length + ' could be loaded (hidden, deleted or still collapsed).' : (expected == null ? 'LinkedIn shows no comment counter here: completeness cannot be checked.' : 'All comments shown by LinkedIn were read.'),
    };
    // Comments still missing: list the reply / load-more controls left on the page (labels only) so the next
    // fix targets what LinkedIn really shows.
    if (expected != null && comments.length < expected) res.unclickedControls = controls(scope.closest('[role=dialog]') || document.body).filter(function (e) { var t = (ownText(e) || label(e) || '').trim(); return t.length < 60 && /r[eé]ponse|repl|respuesta|antwort|commentaire|comment|more|plus|previous|pr[eé]c[eé]dent/i.test(t) && !/^(r[eé]pondre|reply|responder|antworten|commenter|comment)$/i.test(t) && !isOverflow(e); }).slice(0, 12).map(function (e) { return (ownText(e) || label(e)).trim().slice(0, 60); });
    if (res.status !== 'ok' || o.diagnose) res.diagnostics = { page: pageState(), dom: domShape({ commentBlocks: commentBlocks(scope).length, replyControls: replyButtons(scope).length, documentCommentBlocks: commentBlocks(document).length, postsOnPage: findPosts().posts.length, replySamples: replyButtons(document).slice(0, 3).map(function (r) { var path = []; for (var q = r; q && q !== document.body && path.length < 14; q = q.parentElement) path.push(q.tagName.toLowerCase() + (attr(q, 'role') ? '[' + attr(q, 'role') + ']' : '') + (q === scope ? '*' : '')); return { label: (label(r) || ownText(r)).slice(0, 40), inScope: scope.contains(r), path: path.join('<') }; }) }) };
    else res.diagnostics = { clicks: clickLog.slice(-20) };
    return res;
  }

  // ---------------------------------------------------------------- reactions
  function reactionsRoot(scopeDialog) {
    var ds = openDialogs().filter(function (d) { return d !== scopeDialog && isReactionsDialog(d); });
    if (ds.length) return ds[ds.length - 1];
    if (/\/(reactions|likes)\b|reactors/.test(location.pathname)) return document.querySelector('main') || document.body;
    var loose = openDialogs().filter(function (d) { return d !== scopeDialog && !replyButtons(d).length && qsa(d, 'a[href*="/in/"]').length; });
    return loose.length ? loose[loose.length - 1] : null;
  }
  function findReactionCounter(scope) {
    var cs = controls(scope).filter(function (e) { return !inCommentBlock(e, scope); });
    var ranked = cs.map(function (e) {
      var meta = norm([attr(e, 'data-view-name'), attr(e, 'data-testid'), cls(e)].join(' '));
      var s = 0, k = actionKind(e), l = label(e) + ' ' + ownText(e);
      if (k === 'reactionCount') s += 6;
      if (/reaction.?count|social.?counts?__reactions|reactions-count|social-details-social-counts/.test(meta)) s += 10;
      if (qsa(e, 'img,svg,li-icon').some(function (i) { return isReactionIcon(i) || !!classifyReaction(iconMeta(i)); }) && /\d/.test(l)) s += 4;
      if (/\b(and|et|y|und)\s+\d/i.test(l)) s += 2;
      if (k === 'like' || k === 'comment' || k === 'commentCount' || k === 'repostCount' || k === 'reply') s = 0;
      return { e: e, s: s, total: reactionTotal(e), l: l.trim().slice(0, 90) };
    }).filter(function (x) { return x.s >= 4 && !refusal(x.e, 'open_reactions'); }).sort(function (a, b) { return b.s - a.s; });
    if (!ranked.length) return { error: 'missing', candidates: [] };
    var top = ranked.filter(function (x) { return x.s === ranked[0].s; });
    var totals = uniq(top.map(function (x) { return x.total; }));
    if (top.length > 1 && totals.length > 1) return { error: 'ambiguous', candidates: top.slice(0, 6).map(function (x) { return { label: x.l, score: x.s }; }) };
    return { el: top[0].e, total: top[0].total, label: top[0].l };
  }
  function parseTab(t) {
    var s = (ownText(t) + ' ' + label(t)).trim();
    var count = parseCount(s);
    var isAll = /^(all|tous|toutes|todos|alle|tutti)\b/i.test(ownText(t).trim() || label(t).trim());
    var type = isAll ? null : classifyReaction(label(t) + ' ' + iconMeta(t) + ' ' + ownText(t));
    return { el: t, label: s.slice(0, 60), count: count, type: type, all: isAll };
  }
  function reactionTabs(root) {
    var tabs = qsa(root, '[role=tab]').filter(vis);
    if (!tabs.length) {
      var list = root.querySelector('[role=tablist]');
      tabs = list ? controls(list) : controls(root).filter(function (b) { var s = ownText(b) + ' ' + label(b); return /\d/.test(s) && (/^(all|tous|todos|alle)\b/i.test(ownText(b)) || !!classifyReaction(label(b) + ' ' + iconMeta(b))) && !qsa(b, 'a[href*="/in/"]').length; });
    }
    return tabs.map(parseTab).filter(function (t) { return t.all || t.type || t.count != null; });
  }
  function personRows(root) {
    var links = qsa(root, PROFILE_LINK).filter(function (a) { return vis(a) && !a.closest('[role=tablist],[role=tab]'); });
    var rows = [], seen = {};
    links.forEach(function (a) {
      var href = profileUrl(a.href || attr(a, 'href'));
      if (!href || seen[href]) return;
      var row = a;
      for (var p = a.parentElement; p && p !== root; p = p.parentElement) {
        var hs = uniq(qsa(p, PROFILE_LINK).map(function (x) { return profileUrl(x.href || attr(x, 'href')); }));
        if (hs.length > 1) break;
        row = p;
      }
      seen[href] = 1;
      rows.push({ row: row, link: a, href: href });
    });
    return rows;
  }
  function readPerson(r, typeHint) {
    var info = actorInfo(r.link, r.row);
    var ls = nameLines(r.row).filter(function (x) { return x !== info.name; });
    var icon = qsa(r.row, 'img,svg,li-icon,[data-test-icon]').filter(function (i) { return isReactionIcon(i) || (!!classifyReaction(iconMeta(i)) && !/dms\/image|profile-displayphoto/.test(attr(i, 'src'))); });
    var fromIcon = icon.map(function (i) { return classifyReaction(iconMeta(i) + ' ' + label(i)); }).filter(Boolean)[0] || null;
    // One reaction picture per type is enough (the server shows its own): a picture per person made the
    // list megabytes long on big posts and choked the transfer to the app.
    var ICONS = window.__cmgLiIcons = window.__cmgLiIcons || {};
    var iu = null;
    if (fromIcon && !ICONS[fromIcon]) ICONS[fromIcon] = iconUrl(icon[0]);
    if (icon[0]) { var im = icon[0].tagName === 'IMG' ? icon[0] : icon[0].querySelector && icon[0].querySelector('img'); var src = im ? (im.currentSrc || attr(im, 'src')) : ''; if (/^https:\/\/[a-z0-9.-]*licdn\.com\//i.test(src)) iu = src.slice(0, 400); }
    return { name: info.name || null, profileUrl: r.href, photoUrl: info.photoUrl || null, headline: (ls[0] || '').slice(0, 200) || null, reaction: typeHint || fromIcon, reactionFromIcon: fromIcon, reactionIconUrl: iu };
  }
  /** LinkedIn's own reaction picture: an <img> URL, or the SVG itself as a data URL (no external fetch). */
  function iconUrl(i) {
    if (!i) return null;
    var img = i.tagName === 'IMG' ? i : i.querySelector && i.querySelector('img');
    var src = img ? (img.currentSrc || attr(img, 'src')) : '';
    if (/^https:\/\/[a-z0-9.-]*licdn\.com\//i.test(src)) return src.slice(0, 400);
    var svg = i.tagName && i.tagName.toLowerCase() === 'svg' ? i : i.querySelector && i.querySelector('svg');
    if (svg && svg.outerHTML && svg.outerHTML.length < 6000 && svg.querySelector('path,circle,g')) {
      var x = svg.cloneNode(true);
      if (!x.getAttribute('xmlns')) x.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(x.outerHTML)));
    }
    return null;
  }
  async function collectPeople(root, typeHint, expected, into, progress, diag) {
    var stable = 0, rounds = 0, last = -1, seenHere = {}, t0 = Date.now(), stalls = 0, end = 'rounds', more = null;
    for (; rounds < 3000; rounds++) {
      if (stopRequested()) { end = 'stopped'; break; }
      invalidate();
      personRows(root).forEach(function (r) {
        if (seenHere[r.href] && into[r.href]) return;
        var p = readPerson(r, typeHint);
        seenHere[p.profileUrl] = 1;
        var old = into[p.profileUrl];
        if (!old) into[p.profileUrl] = p;
        else { if (typeHint) old.reaction = typeHint; if (!old.reactionIconUrl && p.reactionIconUrl) old.reactionIconUrl = p.reactionIconUrl; if (!old.photoUrl && p.photoUrl) old.photoUrl = p.photoUrl; if (!old.headline && p.headline) old.headline = p.headline; if (!old.reaction && p.reaction) old.reaction = p.reaction; }
      });
      var n = Object.keys(seenHere).length;
      // "beat" changes every round, so the app sees the reader is alive even while it re-reads people it
      // already knows (a new pass) or waits for LinkedIn, and does not give up on it.
      if (progress) progress({ reactionsRead: Object.keys(into).length, expectedTotal: window.__cmgLiExpected == null ? null : window.__cmgLiExpected, tab: typeHint || 'all', inList: n, beat: rounds }, Object.keys(into).map(function (k) { return into[k]; }));
      if (expected != null && n >= expected) { end = 'reached'; break; }
      more = controls(root).find(function (b) { return /^(show more|load more|afficher plus|voir plus|charger plus|mostrar m[aá]s|mehr anzeigen)/i.test((ownText(b) || label(b)).trim()) && !isOverflow(b); });
      if (more) safeClick(more, 'more_reactions');
      var sc = scrollers(root);
      if (sc.length) sc.forEach(function (s) { s.scrollTop += Math.max(100, Math.floor(s.clientHeight * 0.8)); }); else root.scrollTop += Math.max(100, Math.floor(root.clientHeight * 0.8));
      if (root === document.body || root.tagName === 'MAIN') window.scrollBy(0, Math.round((window.innerHeight || 800)));
      await waitFor(function () { invalidate(); return personRows(root).some(function (r) { return !seenHere[r.href]; }); }, 2200, 300);
      if (n === last) {
        // Big lists load slowly: while far from LinkedIn's count, keep trying longer and nudge the list
        // (small scroll up then down) so the next page is requested again.
        // LinkedIn answers more slowly as the list grows: wait longer after each empty round (up to 9 s).
        var far = expected != null && n < expected * 0.97;
        stalls++;
        if (++stable >= (far ? 8 : 3)) { end = 'stalled'; break; }
        if (far) {
          await sleep(Math.min(700 * stable, 6500));
          (sc.length ? sc : [root]).forEach(function (s) { s.scrollTop = Math.max(0, s.scrollTop - 600); });
          await sleep(500);
          (sc.length ? sc : [root]).forEach(function (s) { s.scrollTop += Math.max(100, Math.floor(s.clientHeight * 0.8)); });
          if (root === document.body || root.tagName === 'MAIN') { window.scrollBy(0, -600); await sleep(300); window.scrollBy(0, 1600); }
          await sleep(1200);
        }
      } else stable = 0;
      last = n;
    }
    if (diag) { diag.end = end; diag.rounds = rounds; diag.stalls = stalls; diag.seconds = Math.round((Date.now() - t0) / 1000); diag.moreButtonLeft = !!(more && vis(more)); }
    return Object.keys(seenHere).length;
  }

  /** Opens the reaction COUNT of the target post (never the Like button) and reads every category. */
  /**
   * Reaction list memory in the LinkedIn page's own storage (this phone only, 6 hours): everyone read is kept
   * as the list is scrolled, across passes and across a new run on the same post, then sent in one result.
   */
  // ---------------------------------------------------------------- fast read (opt-in, off by default)
  /**
   * The LinkedIn page asks its own service for each new piece of the reaction list. When the user turned
   * "fast read" on in the app, the reader notes that request (address and headers, as the page sent it)
   * and asks for the next pieces the same way, with the same piece size, a 2-4 s pause between pieces,
   * a daily cap, and a stop at the first error or check. Nothing is hard-coded: if LinkedIn changes, the
   * reader falls back to reading the page.
   */
  var REACTION_REQ = /voyager\/api\/.*reaction|reactions?.*(start|count)[=:]/i;
  function installTap() {
    var T = window.__cmgLiTap;
    if (T) return T;
    T = window.__cmgLiTap = { reactions: null, fetch: window.fetch && window.fetch.bind(window) };
    var keep = function (url, method, headers, body) {
      if (!url || !REACTION_REQ.test(url) || !/[?&(,]start[=:]\d+/.test(url) || !/[?&(,]count[=:]\d+/.test(url)) return;
      if (String(method || 'GET').toUpperCase() !== 'GET') return;
      var abs = url; try { abs = new URL(url, location.href).href; } catch (e) { /* keep */ }
      if (!/^https:\/\/([a-z0-9-]+\.)?linkedin\.com\//i.test(abs)) return;
      T.reactions = { url: abs, headers: headers || {}, body: body || null, at: Date.now() };
    };
    if (T.fetch) {
      window.fetch = function (input, init) {
        try {
          var url = typeof input === 'string' ? input : (input && input.url) || '';
          var h = {}, src = (init && init.headers) || (input && input.headers);
          if (src && typeof src.forEach === 'function') src.forEach(function (v, k) { h[k] = v; }); else if (src) Object.keys(src).forEach(function (k) { h[k] = src[k]; });
          keep(url, (init && init.method) || (input && input.method), h);
        } catch (e) { /* never break the page */ }
        return T.fetch.apply(window, arguments);
      };
    }
    var X = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
    if (X && !X.__cmgTap) {
      var open = X.open, setH = X.setRequestHeader, send = X.send;
      X.open = function (m, u) { this.__cmg = { m: m, u: u, h: {} }; return open.apply(this, arguments); };
      X.setRequestHeader = function (k, v) { if (this.__cmg) this.__cmg.h[k] = v; return setH.apply(this, arguments); };
      X.send = function () { try { if (this.__cmg) keep(this.__cmg.u, this.__cmg.m, this.__cmg.h); } catch (e) { /* page first */ } return send.apply(this, arguments); };
      X.__cmgTap = true;
    }
    return T;
  }
  function apiText(x) { return typeof x === 'string' ? x : (x && typeof x.text === 'string' ? x.text : null); }
  function apiPhoto(o) {
    var best = null;
    (function walk(n, d) {
      if (!n || typeof n !== 'object' || d > 8 || best) return;
      if (typeof n.rootUrl === 'string' && Array.isArray(n.artifacts) && n.artifacts.length) {
        var a = n.artifacts.slice().sort(function (x, y) { return Math.abs((x.width || 0) - 200) - Math.abs((y.width || 0) - 200); })[0];
        if (a && a.fileIdentifyingUrlPathSegment) best = n.rootUrl + a.fileIdentifyingUrlPathSegment;
        return;
      }
      Object.keys(n).forEach(function (k) { walk(n[k], d + 1); });
    })(o, 0);
    return best && /^https:\/\/media\.licdn\.com\//.test(best) ? best : null;
  }
  /** People of one answer of LinkedIn's reaction service (both its older and newer shapes). */
  function apiPeople(json) {
    var all = [], byUrn = {};
    (function walk(n, d) {
      if (!n || typeof n !== 'object' || d > 12) return;
      if (Array.isArray(n)) { n.forEach(function (x) { walk(x, d + 1); }); return; }
      all.push(n);
      if (typeof n.entityUrn === 'string') byUrn[n.entityUrn] = n;
      Object.keys(n).forEach(function (k) { if (n[k] && typeof n[k] === 'object') walk(n[k], d + 1); });
    })(json, 0);
    var out = [];
    all.forEach(function (o) {
      if (typeof o.reactionType !== 'string') return;
      var type = classifyReaction(o.reactionType.toLowerCase()) || null;
      var lk = o.reactorLockup, p = null;
      if (lk && typeof lk === 'object') {
        p = { name: apiText(lk.title), headline: apiText(lk.subtitle), profileUrl: lk.navigationUrl || null, photoUrl: apiPhoto(lk.image) };
      } else {
        var a = o.actor || o['*actor'] || o.actorUrn || o.reactor || o['*reactor'];
        if (typeof a === 'string') a = byUrn[a];
        if (a && typeof a === 'object') {
          var mini = a.miniProfile || a['*miniProfile'] && byUrn[a['*miniProfile']] || a;
          var nm = [mini.firstName, mini.lastName].filter(Boolean).join(' ') || apiText(mini.name) || null;
          var pid = mini.publicIdentifier;
          p = { name: nm, headline: mini.occupation || apiText(mini.headline) || null, profileUrl: pid ? 'https://www.linkedin.com/in/' + pid + '/' : (mini.url || null), photoUrl: apiPhoto(mini.picture || mini.profilePicture || mini.logo) };
        }
      }
      if (!p || !p.profileUrl || !p.name) return;
      var u = profileUrl(p.profileUrl) || p.profileUrl;
      out.push({ name: p.name.slice(0, 120), profileUrl: u, photoUrl: p.photoUrl, headline: p.headline ? String(p.headline).slice(0, 200) : null, reaction: type, reactionFromIcon: type, reactionIconUrl: null, fromApi: true });
    });
    return out;
  }
  function apiDay() {
    var d = new Date().toISOString().slice(0, 10), v = null;
    try { v = JSON.parse(localStorage.getItem('cmgLiApiDay') || 'null'); } catch (e) { /* off */ }
    return v && v.d === d ? v : { d: d, posts: 0, people: 0 };
  }
  function apiDaySave(v) { try { localStorage.setItem('cmgLiApiDay', JSON.stringify(v)); } catch (e) { /* off */ } }
  var API_LIMITS = { postsPerDay: 6, peoplePerDay: 8000 };
  /** Asks for the next pieces of the reaction list the way the page did. Returns what happened. */
  async function apiReadReactions(people, expected, progress) {
    var T = window.__cmgLiTap, req = T && T.reactions;
    if (!req) return { used: false, reason: 'no_request_seen' };
    var c = req.url.match(/[?&(,]count[=:](\d+)/), st = req.url.match(/[?&(,]start[=:](\d+)/);
    var count = c ? parseInt(c[1], 10) : 0;
    if (!count || !st || count > 100) return { used: false, reason: 'no_paging' };
    var day = apiDay();
    if (day.posts >= API_LIMITS.postsPerDay || day.people >= API_LIMITS.peoplePerDay) return { used: false, reason: 'daily_cap', day: day };
    day.posts++; apiDaySave(day);
    var headers = {}; Object.keys(req.headers || {}).forEach(function (k) { headers[k] = req.headers[k]; });
    if (!Object.keys(headers).some(function (k) { return /^csrf-token$/i.test(k); })) { var js = (document.cookie.match(/JSESSIONID="?([^";]+)/) || [])[1]; if (js) headers['csrf-token'] = js; }
    var start = 0, pages = 0, empty = 0, added = 0, reason = 'end', t0 = Date.now();
    while (pages < 300) {
      if (stopRequested()) { reason = 'stopped'; break; }
      if (expected != null && start >= expected + count) break;
      var url = req.url.replace(/([?&(,]start[=:])\d+/, '$1' + start);
      var json = null, fail = null;
      // A request that never answers must not hold the reader: 20 s at most, one more try, then page reading.
      for (var attempt = 0; attempt < 2 && json == null; attempt++) {
        fail = null;
        try {
          var ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
          var timer = setTimeout(function () { if (ac) ac.abort(); }, 20000);
          var res = await Promise.race([
            T.fetch(url, { method: 'GET', headers: headers, credentials: 'include', signal: ac ? ac.signal : undefined }),
            sleep(21000).then(function () { throw new Error('timeout'); }),
          ]);
          clearTimeout(timer);
          if (!res.ok) { fail = 'http_' + res.status; break; }
          var ct = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
          if (ct && !/json/i.test(ct)) { fail = 'not_json'; break; }
          json = await Promise.race([res.json(), sleep(15000).then(function () { throw new Error('timeout'); })]);
        } catch (e) { fail = /timeout|abort/i.test(String(e && (e.name + e.message))) ? 'timeout' : 'network'; if (attempt === 0) await sleep(3000); }
      }
      if (json == null) { reason = fail || 'network'; break; }
      var got = apiPeople(json), fresh = 0;
      got.forEach(function (p) { var k = p.profileUrl; if (!people[k]) { people[k] = p; fresh++; } else { var old = people[k]; ['photoUrl', 'headline', 'reaction', 'name'].forEach(function (f) { if (!old[f] && p[f]) old[f] = p[f]; }); } });
      added += fresh; pages++;
      day.people += fresh; apiDaySave(day);
      if (progress) progress({ stage: 'reaction_fast', reactionsRead: Object.keys(people).length, expectedTotal: expected, page: pages, beat: pages }, Object.keys(people).map(function (k) { return people[k]; }));
      if (!got.length) { if (++empty >= 2) { reason = 'no_more'; break; } } else empty = 0;
      if (day.people >= API_LIMITS.peoplePerDay) { reason = 'daily_cap'; break; }
      start += count;
      await sleep(2000 + Math.floor(Math.random() * 2000));
    }
    return { used: true, reason: reason, pages: pages, added: added, pieceSize: count, seconds: Math.round((Date.now() - t0) / 1000) };
  }
  function memKey(o) { var m = String((o && o.postUrl) || location.href).match(/(activity|ugcPost|share)[:-](\d{8,22})/i); return m ? 'cmgLiPeople:' + m[2] : null; }
  function memLoad(k) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && Date.now() - v.t < 6 * 3600e3 && v.p) return v.p; } catch (e) { /* storage off */ } return {}; }
  function memSave(k, people) {
    var slim = {};
    Object.keys(people).forEach(function (u) { slim[u] = slimPerson(people[u]); });
    try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), p: slim })); } catch (e) { /* full or off */ }
  }
  function slimPerson(x) { var o = {}; ['name', 'profileUrl', 'headline', 'reaction', 'photoUrl'].forEach(function (f) { if (x && x[f] != null) o[f] = x[f]; }); return o; }
  function personKey(x) { var u = String((x && x.profileUrl) || '').split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase(); return u || ('name:' + String((x && x.name) || '').trim().toLowerCase()); }
  /**
   * Progress of a run, kept small: people go into a queue that the app drains a few hundred at a time
   * (each one once, again only when a field was learned later), never the whole list at every check.
   */
  function runProgress(v, p, snap) {
    if (!v || v.done) return;
    v.partial = p;
    if (!snap) return;
    var rx = snap.reactions;
    if (rx && Array.isArray(rx.people)) {
      v.seen = v.seen || {}; v.q = v.q || []; v.count = v.count || 0;
      rx.people.forEach(function (x) {
        var k = personKey(x);
        if (k === 'name:') return;
        var sl = slimPerson(x), sig = [sl.reaction || '', sl.headline ? 1 : 0, sl.photoUrl ? 1 : 0].join('|');
        if (v.seen[k] === sig) return;
        if (v.seen[k] == null) v.count++;
        v.seen[k] = sig; v.q.push(sl);
      });
      var r2 = {}; Object.keys(rx).forEach(function (f) { if (f !== 'people') r2[f] = rx[f]; });
      r2.people = []; r2.retrieved = v.count; r2.savedInBatches = v.count;
      var s2 = {}; Object.keys(snap).forEach(function (f) { s2[f] = snap[f]; });
      s2.reactions = r2; snap = s2;
    }
    v.snapshot = snap;
  }
  function runPoll(R, k, max) {
    tick();
    var v = R && R[k];
    if (!v) return JSON.stringify({ lost: true });
    var fresh = v.q ? v.q.splice(0, max || 300) : [];
    var left = v.q ? v.q.length : 0;
    // The final answer is handed over only once every queued person has been taken.
    if (v.done && !left) { delete R[k]; return JSON.stringify({ done: true, result: v.result, error: v.error, fresh: fresh }); }
    return JSON.stringify({ done: false, partial: v.partial || null, snapshot: v.snapshot || null, fresh: fresh, queued: left });
  }
  function memClear(k) { try { localStorage.removeItem(k); } catch (e) { /* off */ } }
  async function readReactions(o, progress) {
    o = o || {};
    var st = pageState();
    if (st.signedOut) return { status: 'signed_out', people: [], diagnostics: { page: st } };
    if (o.fastRead === true) installTap();
    invalidate();
    if (progress) progress({stage:'reaction_detect_dialog'}, []);
    var root = reactionsRoot(null);
    var counter = null, s = null;
    if (!root) {
      await waitFor(function () { return findPosts().posts.length || openDialogs().length; }, o.firstWait || 10000, 400);
      invalidate();
      if (progress) progress({stage:'reaction_resolve_post'}, []);
      s = resolveScope(o);
      if (!s.scope) return { status: s.how === 'ambiguous' ? 'ambiguous_post' : 'post_not_found', people: [], candidates: s.candidates || null, diagnostics: { page: pageState(), dom: domShape() } };
      if (progress) progress({stage:'reaction_find_counter'}, []);
      counter = findReactionCounter(s.scope);
      if (counter.error) return { status: counter.error === 'missing' ? 'reaction_counter_missing' : 'reaction_counter_ambiguous', people: [], candidates: counter.candidates, error: 'Reaction count control ' + counter.error, diagnostics: { page: pageState(), dom: domShape({ scope: s.how }) } };
      var link = counter.el.closest('a[href]');
      if (link && /linkedin\.com/.test(link.href) && link.href.split('#')[0] !== location.href.split('#')[0]) return { status: 'navigate', url: link.href, expectedTotal: counter.total };
      if (progress) progress({stage:'reaction_open_dialog', expectedTotal:counter.total}, []);
      if (!safeClick(counter.el, 'open_reactions')) return { status: 'reaction_counter_refused', people: [], diagnostics: { dom: domShape() } };
      var scopeDialog = s.scope.closest('[role=dialog],[aria-modal=true]');
      root = await waitFor(function () { invalidate(); return reactionsRoot(scopeDialog); }, 15000, 300);
      if (!root) return { status: 'reaction_dialog_not_found', people: [], expectedTotal: counter.total, diagnostics: { page: pageState(), dom: domShape() } };
    }
    if (progress) progress({stage:'reaction_wait_rows'}, []);
    await waitFor(function () { invalidate(); return personRows(root).length; }, 12000, 300);
    invalidate();
    var tabs = reactionTabs(root);
    var allTab = tabs.find(function (t) { return t.all; });
    var expectedTotal = allTab && allTab.count != null ? allTab.count : (counter ? counter.total : (o.expectedTotal || null));
    var people = {}, perTab = [];
    var mk = memKey(o), lastSave = 0, restored = 0;
    if (mk && o.freshExtraction === true) memClear(mk);
    if (mk) { var old = memLoad(mk); Object.keys(old).forEach(function (k) { people[k] = old[k]; }); restored = Object.keys(old).length; }
    var progress2 = function (p, list) { if (mk && Date.now() - lastSave > 5000) { memSave(mk, people); lastSave = Date.now(); } if (progress) progress(p, list); };
    window.__cmgLiExpected = expectedTotal;
    if (allTab) { safeClick(allTab.el, 'tab'); await sleep(600); }
    if (progress) progress({stage:'reaction_collect', expectedTotal:expectedTotal, reactionsRead:Object.keys(people).length}, Object.keys(people).map(function(k){return people[k];}));
    var fast = null;
    if (o.fastRead === true) {
      // The first piece is asked for by the page when the list opens: give it a moment, scroll once if needed.
      await waitFor(function () { return window.__cmgLiTap && window.__cmgLiTap.reactions; }, 4000, 300);
      if (!(window.__cmgLiTap && window.__cmgLiTap.reactions)) { (scrollers(root)[0] || root).scrollTop += 2000; await waitFor(function () { return window.__cmgLiTap && window.__cmgLiTap.reactions; }, 5000, 300); }
      fast = await apiReadReactions(people, expectedTotal, progress2);
      perTab.push(Object.assign({ tab: 'fast' }, fast, { total: Object.keys(people).length }));
    }
    var d1 = {};
    if (fast && fast.used && expectedTotal != null && Object.keys(people).length >= expectedTotal * 0.97) {
      // Fast read got (nearly) everything: the page list is not scrolled again.
      perTab.push({ tab: 'all', expected: expectedTotal, read: 0, skipped: 'fast_read', total: Object.keys(people).length });
    } else {
    var readAll = await collectPeople(root, null, expectedTotal, people, progress2, d1);
    perTab.push(Object.assign({ tab: 'all', expected: expectedTotal, read: readAll, total: Object.keys(people).length }, d1));
    }
    if (readAll == null) readAll = Object.keys(people).length;
    var cats = tabs.filter(function (t) { return !t.all && t.type; });
    var fromIcons = function (type) { return Object.keys(people).filter(function (k) { return people[k].reaction === type; }).length; };
    for (var i = 0; i < cats.length; i++) {
      if (stopRequested()) break;
      // The "All" list already shows each person's reaction picture: a category whose count is reached from
      // those pictures is not read again (halves the time on big posts).
      if (cats[i].count != null && readAll >= (expectedTotal || 0) && fromIcons(cats[i].type) >= cats[i].count) { perTab.push({ tab: cats[i].type, expected: cats[i].count, read: fromIcons(cats[i].type), fromIcons: true }); continue; }
      var t = reactionTabs(root).find(function (x) { return x.type === cats[i].type && !x.all; }) || cats[i];
      var firstBefore = personRows(root)[0];
      if (!safeClick(t.el, 'tab')) { perTab.push({ tab: t.type, expected: t.count, read: 0, error: 'tab_refused' }); continue; }
      await waitFor(function () { var f = personRows(root)[0]; return attr(t.el, 'aria-selected') === 'true' || (f && f !== firstBefore); }, 4000, 250);
      await sleep(400);
      var dt = {};
      var read = await collectPeople(root, t.type, t.count, people, progress2, dt);
      perTab.push(Object.assign({ tab: t.type, expected: t.count, read: read }, dt));
    }
    // Still far from LinkedIn's count: close and reopen the list (LinkedIn starts loading again) and keep
    // adding to what is already known, up to two more passes.
    for (var pass = 2; pass <= 3 && counter && s && expectedTotal != null && !stopRequested() && Object.keys(people).length < expectedTotal * 0.97; pass++) {
      var cb = controls(root.closest('[role=dialog]') || root).find(function (b) { return /^(dismiss|close|fermer|ignorer|cerrar|schlie[ßs]en)\b/i.test(label(b) || ownText(b)); });
      if (cb) safeClick(cb, 'close');
      await sleep(1500);
      var c2 = findReactionCounter(s.scope);
      if (c2.error || !safeClick(c2.el, 'open_reactions')) break;
      var root2 = await waitFor(function () { return reactionsRoot(s.scope.closest('[role=dialog],[aria-modal=true]')); }, 9000, 300);
      if (!root2) break;
      root = root2;
      await waitFor(function () { return personRows(root).length; }, 6000, 300);
      await sleep(800);
      var d2 = {};
      var again = await collectPeople(root, null, expectedTotal, people, progress2, d2);
      perTab.push(Object.assign({ tab: 'all', pass: pass, expected: expectedTotal, read: again, total: Object.keys(people).length }, d2));
    }
    if (mk) memSave(mk, people);
    var list = Object.keys(people).map(function (k) { return people[k]; });
    var byType = {}, icons = {};
    list.forEach(function (p) { var k = p.reaction || 'unknown'; byType[k] = (byType[k] || 0) + 1; if (p.reaction && p.reactionIconUrl && !icons[p.reaction] && p.reactionFromIcon === p.reaction) icons[p.reaction] = p.reactionIconUrl; });
    var gi = window.__cmgLiIcons || {}; Object.keys(gi).forEach(function (k) { if (gi[k] && !icons[k]) icons[k] = gi[k]; });
    tabs.forEach(function (t) { if (t.type && !icons[t.type]) { var u = iconUrl(qsa(t.el, 'img,svg')[0]); if (u) icons[t.type] = u; } });
    var best = {}; perTab.forEach(function (x) { if (!best[x.tab] || x.read > best[x.tab].read) best[x.tab] = x; });
    var missing = Object.keys(best).map(function (k) { return best[k]; }).filter(function (x) { return x.expected != null && x.read < x.expected; }).map(function (x) { return { tab: x.tab, expected: x.expected, read: x.read, missing: x.expected - x.read }; });
    var anonymous = qsa(root, 'li,[role=listitem]').filter(function (li) { return vis(li) && !qsa(li, PROFILE_LINK).length && /linkedin member|membre de linkedin|miembro de linkedin/i.test(txt(li)); }).length;
    var complete = expectedTotal != null && list.length + anonymous >= expectedTotal;
    if (complete) { missing = []; if (mk) memClear(mk); }
    if (o.close !== false) {
      var closeBtn = controls(root.closest('[role=dialog]') || root).find(function (b) { return /^(dismiss|close|fermer|ignorer|cerrar|schlie[ßs]en)\b/i.test(label(b) || ownText(b)); });
      if (closeBtn) safeClick(closeBtn, 'close');
    }
    var res = {
      status: list.length ? 'ok' : 'no_people_read',
      people: list,
      retrieved: list.length,
      anonymousRows: anonymous,
      expectedTotal: expectedTotal,
      byType: byType,
      reactionIcons: icons,
      categories: tabs.map(function (t) { return { label: t.label, type: t.all ? 'all' : t.type, count: t.count }; }),
      perCategory: perTab,
      missing: missing,
      restoredFromMemory: restored || undefined,
      fastRead: fast || undefined,
      passes: perTab.filter(function (x) { return x.tab === 'all'; }).length,
      complete: complete && !stopRequested(),
      partial: !complete || stopRequested(),
      stopped: stopRequested(),
      untyped: list.filter(function (p) { return !p.reaction; }).length,
      note: complete ? 'Every reaction counted by LinkedIn was read.' : (expectedTotal == null ? 'LinkedIn shows no total here: completeness cannot be checked.' : 'Read ' + list.length + (anonymous ? ' (+' + anonymous + ' private members)' : '') + ' of ' + expectedTotal + ' reactions; the rest was not loaded by LinkedIn.'),
    };
    if (res.status !== 'ok' || o.diagnose) res.diagnostics = { page: pageState(), dom: domShape({ tabs: tabs.length }) };
    else res.diagnostics = { clicks: clickLog.slice(-25) };
    return res;
  }

  /** Is the target post's comment panel already open here? (then the caller must not navigate away) */
  function targetOpen(o) {
    o = o || {};
    var want = urnFromString(o.postUrl || '');
    var id = want ? want.split(':').pop() : '';
    var present = !want || location.href.indexOf(id) >= 0 || findPosts().posts.some(function (p) { return sameTarget(p.urn || urnOf(p.el), want); });
    var s = resolveScope(o);
    var open = present && !!s.scope && (s.how === 'open_panel' || s.how === 'marked' || s.how === 'urn' || s.how === 'single_post' || s.how === 'post_page_main') && commentBlocks(widenForComments(s.scope)).length > 0;
    return { open: open, present: present, how: s.how };
  }
  /** On a people search page: the profile whose name contains every word of the given name. */
  function findProfile(o) {
    var want = tokens((o && o.name) || '');
    var seen = {};
    var hits = qsa(document, 'a[href*="/in/"]').filter(function (a) { return vis(a) && !isChrome(a); }).map(function (a) {
      var href = profileUrl(a.href || attr(a, 'href'));
      if (!href || seen[href]) return null;
      var name = nameLines(a)[0] || cleanName(label(a));
      if (!name) return null;
      seen[href] = 1;
      var n = norm(name);
      return want.length && want.every(function (w) { return n.indexOf(w) >= 0; }) ? { name: name, profileUrl: href } : null;
    }).filter(Boolean);
    return { profiles: hits.slice(0, 5), unique: hits.length === 1 };
  }
  /** Keeps a result under the relay's size limit: photos and long texts are cut first, never silently. */
  function fit(res, max) {
    max = max || 230000;
    function size() { return JSON.stringify(res).length; }
    if (size() <= max) return res;
    res.truncated = true;
    var lists = [];
    function add(owner, key, name) {
      if (owner && Array.isArray(owner[key])) lists.push({ owner: owner, rows: owner[key], key: key, name: name });
    }
    add(res, 'people', 'people');
    add(res, 'comments', 'comments');
    add(res, 'posts', 'posts');
    add(res.comments, 'comments', 'comments.comments');
    add(res.reactions, 'people', 'reactions.people');
    function each(fn) { lists.forEach(function (l) { l.rows.forEach(function (p) { if (p && typeof p === 'object') fn(p); }); }); }
    [res, res.comments, res.reactions].forEach(function (o) { if (o && o.diagnostics) delete o.diagnostics.dom; });
    each(function (p) { if (typeof p.reactionIconUrl === 'string' && /^data:/.test(p.reactionIconUrl)) delete p.reactionIconUrl; });
    if (size() <= max) return res;
    // Full extraction: the reacting people already went to the server in batches of 50 while reading, so
    // they are shortened first; comments keep their texts and their authors' photos.
    if (res.reactions && Array.isArray(res.reactions.people) && res.comments && typeof res.comments === 'object') {
      var rp = res.reactions.people;
      while (size() > max && rp.length) rp.length = Math.max(0, Math.floor(rp.length * 0.8) - 1);
      res.reactions.peopleInBatches = true;
      if (size() <= max) return res;
    }
    each(function (p) { if (typeof p.text === 'string' && p.text.length > 1200) { p.text = p.text.slice(0, 1200) + '…'; res.textsShortened = true; } });
    if (size() <= max) return res;
    each(function (p) {
      ['imageDataUrl', 'photoUrl', 'authorPhotoUrl', 'imageUrl', 'images'].forEach(function (k) {
        if (p[k] != null) { delete p[k]; res.photosDropped = true; }
      });
    });
    while (size() > max) {
      var l = lists.filter(function (x) { return x.rows.length > 0; }).sort(function (a, b) { return JSON.stringify(b.rows).length - JSON.stringify(a.rows).length; })[0];
      if (!l) break;
      l.rows.length = Math.floor(l.rows.length * 0.85);
      res.cutTo = res.cutTo || {}; res.cutTo[l.name] = l.rows.length;
      l.owner.complete = false; l.owner.partial = true; l.owner.retrieved = l.rows.length;
      l.owner.note = 'Result shortened to fit the relay size limit; displayed counts are unchanged.';
      if (l.key === 'comments') {
        l.owner.topLevel = l.rows.filter(function (p) { return p && !p.isReply; }).length;
        l.owner.replies = l.rows.filter(function (p) { return p && p.isReply; }).length;
        if (res.consistency) { res.consistency.commentsRead = l.rows.length; res.consistency.commentsComplete = false; }
      }
      if (l.key === 'people') {
        if (res.consistency) { res.consistency.reactionsRead = l.rows.length; res.consistency.reactionsComplete = false; }
      }
      if (res.status === 'ok') res.status = 'partial';
    }
    if (size() > max) res.sizeLimitExceeded = true;
    return res;
  }

  /**
   * Comments, then reactions, on the target post. Each step is independent: a reaction failure keeps the
   * comments already read, and the result says which step failed and why.
   */
  async function readPostFull(o, progress) {
    o = o || {};
    var c, r;
    try { c = await readComments(o, progress); } catch (e) { c = { status: 'error', error: String(e && e.message || e), comments: [] }; }
    if (c.status === 'navigate') return { status: 'navigate', stage: 'comments', url: c.url };
    if (progress) progress({ stage: 'reactions', commentsRead: (c.comments || []).length, commentsExpected: c.displayedCount == null ? null : c.displayedCount }, { status: 'partial', post: c.post || null, postUrl: c.postUrl || null, comments: c, reactions: { people: [], complete: false, partial: true } });
    if (stopRequested()) r = { status: 'stopped', stopped: true, people: [], retrieved: 0, complete: false, partial: true, missing: [], note: 'Stopped on request before the reactions were read.' };
    else try { r = await readReactions(Object.assign({}, o, { postUrl: o.postUrl || c.postUrl || '', freshExtraction: o.freshExtraction === true }), function (p, people) { if (progress) progress(p, { status: 'partial', post: c.post || null, postUrl: c.postUrl || null, comments: c, reactions: { people: people || [], retrieved: (people || []).length, complete: false, partial: true } }); }); } catch (e2) { r = { status: 'error', error: String(e2 && e2.message || e2), people: [] }; }
    var post = c.post || null;
    // The reaction list's own total is LinkedIn's real count; the number read on the post can be a
    // comment's counter once the comments are expanded.
    if (post && r.expectedTotal != null && post.reactionCount !== r.expectedTotal) { post.reactionCountOnPost = post.reactionCount; post.reactionCount = r.expectedTotal; }
    var out = {
      // ok = complete; partial = something read but not everything (or stopped on request); failed = nothing.
      status: c.status !== 'ok' && r.status !== 'ok' && !(r.people || []).length ? 'failed' : (c.status === 'ok' && r.status === 'ok' && c.complete !== false && r.complete === true && !stopRequested() ? 'ok' : 'partial'),
      stoppedByUser: stopRequested(),
      post: post,
      postUrl: c.postUrl || (post && post.postUrl) || null,
      comments: c,
      reactions: r,
      consistency: {
        commentsDisplayed: c.displayedCount == null ? null : c.displayedCount,
        commentsRead: (c.comments || []).length,
        commentsComplete: c.complete == null ? null : c.complete,
        reactionsDisplayed: r.expectedTotal == null ? (post ? post.reactionCount : null) : r.expectedTotal,
        reactionsRead: (r.people || []).length,
        reactionsComplete: r.complete == null ? null : r.complete,
      },
    };
    if (r.status === 'navigate') out.reactionsNavigate = r.url;
    return fit(out);
  }

  var pub = function (f) { return function () { invalidate(); return f.apply(null, arguments); }; };
  window.__cmgLi = {
    version: VERSION,
    pageState: pub(pageState),
    domShape: pub(domShape),
    findPosts: function (root) { invalidate(); return findPosts(root).posts.map(extractPost); },
    collectPosts: pub(collectPosts),
    searchPosts: pub(searchPosts),
    ensurePostsFilter: pub(ensurePostsFilter),
    typeSearch: pub(typeSearch),
    resolveScope: function (o) { invalidate(); var s = resolveScope(o); return { found: !!s.scope, how: s.how, candidates: s.candidates || null }; },
    markTarget: pub(markTarget),
    targetOpen: pub(targetOpen),
    readComments: pub(readComments),
    readReactions: pub(readReactions),
    runProgress: runProgress,
    runPoll: runPoll,
    tick: tick,
    readPostFull: pub(readPostFull),
    findProfile: pub(findProfile),
    fit: fit,
    _test: { apiPeople: apiPeople, apiReadReactions: apiReadReactions, installTap: installTap, actionKind: actionKind, isOverflow: isOverflow, refusal: refusal, safeClick: safeClick, classifyReaction: classifyReaction, parseCount: parseCount, reactionTotal: reactionTotal, cleanName: cleanName, urnFromString: urnFromString, clickLog: clickLog, matchScore: matchScore },
  };
})();
