/**
 * Turns NotebookLM Studio payloads (quiz, flashcards, reports, data tables, mind maps) into content an
 * assistant can show directly in the chat. The device returns NotebookLM's native arrays; their layout
 * is undocumented, so every reader searches the payload instead of relying on fixed indexes, and says
 * plainly when it found nothing usable.
 */

type Json = unknown;

export type QuizQuestion = {number:number;question:string;choices:Array<{letter:string;text:string}>;answer:string|null;explanation:string|null;hint:string|null};
export type Flashcard = {number:number;front:string;back:string};
export type Readable =
 | {kind:'quiz';count:number;questions:QuizQuestion[];markdown:string}
 | {kind:'flashcards';count:number;cards:Flashcard[];markdown:string}
 | {kind:'report';markdown:string}
 | {kind:'data_table';rows:string[][];markdown:string}
 | {kind:'mindmap';outline:string;mermaid:string;nodes:number}
 | {kind:'unknown';reason:string};

const LETTERS = 'ABCDEFGHIJ';

/** Every string inside a nested NotebookLM payload (depth-first), including JSON encoded inside strings. */
export function collectStrings(value:Json, out:string[] = [], depth = 0):string[] {
 if (depth > 40) return out;
 if (typeof value === 'string') out.push(value);
 else if (Array.isArray(value)) for (const v of value) collectStrings(v, out, depth + 1);
 else if (value && typeof value === 'object') for (const v of Object.values(value as Record<string, Json>)) collectStrings(v, out, depth + 1);
 return out;
}

export function decodeHtmlEntities(s:string){
 return s.replace(/&(#x[0-9a-f]+|#\d+|quot|amp|lt|gt|apos|#39|nbsp);/gi, (m, e:string) => {
  const k = e.toLowerCase();
  if (k === 'quot') return '"'; if (k === 'amp') return '&'; if (k === 'lt') return '<'; if (k === 'gt') return '>';
  if (k === 'apos' || k === '#39') return "'"; if (k === 'nbsp') return ' ';
  if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16));
  if (k.startsWith('#')) return String.fromCodePoint(parseInt(k.slice(1), 10));
  return m;
 });
}

const stripHtml = (s:string) => decodeHtmlEntities(s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+\n/g, '\n').trim();
const tryJson = (s:string):Json => { try { return JSON.parse(s); } catch { return undefined; } };

/** Interactive Studio items (quiz, flashcards) carry their content as JSON in a data-app-data attribute, or as plain JSON. */
export function findAppData(payload:Json):Record<string, Json>|null {
 for (const s of collectStrings(payload)) {
  const attr = s.match(/data-app-data\s*=\s*"([^"]+)"/);
  const candidate = attr ? tryJson(decodeHtmlEntities(attr[1])) : (/^\s*\{/.test(s) && /"(quiz|flashcards|cards)"/.test(s) ? tryJson(s) : undefined);
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
   const o = candidate as Record<string, Json>;
   if (Array.isArray(o.quiz) || Array.isArray(o.flashcards) || Array.isArray(o.cards)) return o;
  }
 }
 return null;
}

const str = (v:Json) => typeof v === 'string' ? stripHtml(v) : typeof v === 'number' ? String(v) : '';

export function parseQuiz(items:Json[], max = 100):QuizQuestion[] {
 const out:QuizQuestion[] = [];
 for (const raw of items) {
  if (!raw || typeof raw !== 'object') continue;
  const q = raw as Record<string, Json>;
  const question = str(q.question ?? q.q ?? q.text ?? q.prompt);
  if (!question) continue;
  const options = (Array.isArray(q.answerOptions) ? q.answerOptions : Array.isArray(q.options) ? q.options : Array.isArray(q.choices) ? q.choices : []) as Json[];
  const choices:Array<{letter:string;text:string}> = [];
  let answer:string|null = null; const why:string[] = [];
  options.slice(0, LETTERS.length).forEach((o, i) => {
   const letter = LETTERS[i];
   if (typeof o === 'string') { choices.push({letter, text:stripHtml(o)}); return; }
   if (!o || typeof o !== 'object') return;
   const opt = o as Record<string, Json>;
   choices.push({letter, text:str(opt.text ?? opt.answer ?? opt.option ?? opt.label)});
   const correct = opt.isCorrect === true || opt.correct === true || opt.is_correct === true;
   if (correct) { answer = letter; if (str(opt.rationale ?? opt.explanation)) why.unshift(str(opt.rationale ?? opt.explanation)); }
  });
  if (!answer && (typeof q.correctAnswer === 'string' || typeof q.answer === 'string')) {
   const given = str(q.correctAnswer ?? q.answer);
   const hit = choices.find(c => c.text === given || c.letter === given.toUpperCase());
   answer = hit ? hit.letter : null;
  }
  out.push({number:out.length + 1, question, choices, answer, explanation:why[0] || str(q.explanation ?? q.rationale) || null, hint:str(q.hint) || null});
  if (out.length >= max) break;
 }
 return out;
}

export function quizMarkdown(qs:QuizQuestion[], withAnswers = true){
 const body = qs.map(q => {
  const lines = ['**' + q.number + '. ' + q.question + '**', ...q.choices.map(c => '- ' + c.letter + ') ' + c.text)];
  if (q.hint) lines.push('  _Indice : ' + q.hint + '_');
  return lines.join('\n');
 }).join('\n\n');
 if (!withAnswers) return body;
 const answers = qs.map(q => q.number + '. ' + (q.answer ?? '?') + (q.explanation ? ' — ' + q.explanation : '')).join('\n');
 return body + '\n\n---\n**Réponses**\n' + answers;
}

export function parseFlashcards(items:Json[], max = 200):Flashcard[] {
 const out:Flashcard[] = [];
 for (const raw of items) {
  if (!raw || typeof raw !== 'object') continue;
  const c = raw as Record<string, Json>;
  const front = str(c.f ?? c.front ?? c.question ?? c.term), back = str(c.b ?? c.back ?? c.answer ?? c.definition);
  if (front || back) out.push({number:out.length + 1, front, back});
  if (out.length >= max) break;
 }
 return out;
}

const flashcardsMarkdown = (cards:Flashcard[]) => cards.map(c => '**' + c.number + '. ' + c.front + '**\n' + c.back).join('\n\n');

/** Mind map JSON: {name, children:[…]} (also title/text and nodes/subtopics). */
export function mindMapToOutline(root:Json):{outline:string;mermaid:string;nodes:number}|null {
 if (!root || typeof root !== 'object' || Array.isArray(root)) return null;
 const label = (n:Record<string, Json>) => str(n.name ?? n.title ?? n.text ?? n.label);
 const kids = (n:Record<string, Json>) => (Array.isArray(n.children) ? n.children : Array.isArray(n.nodes) ? n.nodes : Array.isArray(n.subtopics) ? n.subtopics : []) as Json[];
 if (!label(root as Record<string, Json>)) return null;
 const outline:string[] = []; const mermaid:string[] = ['mindmap']; let nodes = 0;
 const walk = (n:Json, depth:number) => {
  if (!n || typeof n !== 'object' || nodes >= 2000) return;
  const o = n as Record<string, Json>; const l = label(o); if (!l) return;
  nodes++;
  outline.push('  '.repeat(depth) + '- ' + l);
  const safe = l.replace(/[()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
  mermaid.push('  '.repeat(depth + 1) + (depth === 0 ? 'root((' + safe + '))' : safe));
  for (const k of kids(o)) walk(k, depth + 1);
 };
 walk(root, 0);
 return {outline:outline.join('\n'), mermaid:mermaid.join('\n'), nodes};
}

/** The longest Markdown-looking text: reports (study guide, briefing doc, blog post) arrive this way. */
export function findReportMarkdown(payload:Json):string|null {
 let best = '';
 for (const s of collectStrings(payload)) {
  if (s.length < 200 || s.length <= best.length) continue;
  if (/^\s*[[{]/.test(s) || /^https?:\/\//.test(s)) continue;
  if (/(^|\n)#{1,4} |\n- |\n\* |\*\*/.test(s) || s.split(/\s+/).length > 80) best = s;
 }
 return best ? best.trim() : null;
}

/** A data table: an array of rows, each an array of at least two strings or numbers. */
export function findTable(payload:Json):string[][]|null {
 let best:string[][]|null = null;
 const visit = (v:Json, depth:number) => {
  if (!Array.isArray(v) || depth > 30) return;
  const rows = v.filter(r => Array.isArray(r) && r.length >= 2 && r.every(c => typeof c === 'string' || typeof c === 'number')) as Array<Array<string|number>>;
  if (rows.length >= 2 && rows.length === v.length && (!best || rows.length * rows[0].length > best.length * best[0].length)) best = rows.map(r => r.map(c => String(c)));
  for (const x of v) visit(x, depth + 1);
 };
 visit(payload, 0);
 return best;
}

const tableMarkdown = (rows:string[][]) => {
 const width = Math.max(...rows.map(r => r.length));
 const cell = (s:string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
 const line = (r:string[]) => '| ' + Array.from({length:width}, (_, i) => cell(r[i] ?? '')).join(' | ') + ' |';
 return [line(rows[0]), '|' + ' --- |'.repeat(width), ...rows.slice(1).map(line)].join('\n');
};

/** NotebookLM Studio type codes seen in studio_status: 1 audio, 2 report, 3 video, 4 quiz/flashcards, 7 infographic, 8 slides, 9 table. */
export function readStudioArtifact(raw:Json, typeCode:number|undefined, maxItems = 100):Readable {
 const app = findAppData(raw);
 if (app) {
  if (Array.isArray(app.quiz)) { const questions = parseQuiz(app.quiz, maxItems); if (questions.length) return {kind:'quiz', count:questions.length, questions, markdown:quizMarkdown(questions)}; }
  const cardsRaw = Array.isArray(app.flashcards) ? app.flashcards : Array.isArray(app.cards) ? app.cards : null;
  if (cardsRaw) { const cards = parseFlashcards(cardsRaw, maxItems); if (cards.length) return {kind:'flashcards', count:cards.length, cards, markdown:flashcardsMarkdown(cards)}; }
 }
 if (typeCode === 9) { const rows = findTable(raw); if (rows) return {kind:'data_table', rows, markdown:tableMarkdown(rows)}; }
 for (const s of collectStrings(raw)) {
  if (!/^\s*\{/.test(s) || !/"(name|title)"/.test(s) || !/"children"/.test(s)) continue;
  const mm = mindMapToOutline(tryJson(s)); if (mm) return {kind:'mindmap', ...mm};
 }
 if (typeCode === 1 || typeCode === 3) return {kind:'unknown', reason:'Audio and video have no text content here: use download_artifact for the file.'};
 const md = findReportMarkdown(raw);
 if (md) return {kind:'report', markdown:md};
 if (typeCode === 4) return {kind:'unknown', reason:'Quiz or flashcards still generating, or their content is not in this payload: retry once studio_status shows them completed.'};
 return {kind:'unknown', reason:'No readable text found in this artifact (images, slides and infographics are visual: open them in NotebookLM).'};
}

/** Adds a chat-ready "readable" view to device results that carry Studio content or mind maps. */
export function withReadable(result:Record<string, unknown>, maxItems = 100):Record<string, unknown> {
 if (result.rawArtifact !== undefined) {
  const readable = readStudioArtifact(result.rawArtifact, typeof result.typeCode === 'number' ? result.typeCode : undefined, maxItems);
  const {rawArtifact, ...rest} = result;
  return readable.kind === 'unknown' ? {...rest, readable, rawArtifact} : {...rest, readable};
 }
 if (typeof result.mindMap === 'string') {
  const mm = mindMapToOutline(tryJson(result.mindMap));
  const {mindMap, ...rest} = result;
  return mm ? {...rest, readable:{kind:'mindmap', ...mm}} : {...rest, mindMap};
 }
 if (Array.isArray(result.notes)) {
  const mindMaps = (result.notes as Array<Record<string, unknown>>).flatMap(n => {
   const mm = typeof n.content === 'string' && /^\s*\{/.test(n.content) ? mindMapToOutline(tryJson(n.content)) : null;
   return mm ? [{id:n.id, title:n.title, ...mm}] : [];
  });
  if (mindMaps.length) return {...result, notes:(result.notes as Array<Record<string, unknown>>).map(n => mindMaps.some(m => m.id === n.id) ? {...n, content:'(mind map: see mindMaps)'} : n), mindMaps};
 }
 return result;
}

export const STUDIO_READ_INSTRUCTIONS = 'Show readable.markdown (or readable.outline / mermaid for a mind map) to the user directly in the chat. For a quiz, ask the questions one by one and reveal the answers only when asked, unless the user wants everything at once.';
