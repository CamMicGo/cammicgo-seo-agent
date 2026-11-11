import assert from 'node:assert/strict';
import test from 'node:test';
import {findTable, mindMapToOutline, readStudioArtifact, withReadable} from '../lib/notebooklm-studio-read.ts';

const quizApp = {quiz:[
 {question:'Quelle est la capitale de la France ?',answerOptions:[{text:'Lyon',isCorrect:false,rationale:'Non.'},{text:'Paris',isCorrect:true,rationale:'Paris est la capitale.'},{text:'Nice',isCorrect:false}],hint:'Tour Eiffel'},
 {question:'2 + 2 ?',answerOptions:[{text:'3'},{text:'4',isCorrect:true}]},
]};
const html = (o:unknown) => '<div class="app" data-app-data="' + JSON.stringify(o).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"></div>';

test('quiz in a data-app-data attribute becomes questions, choices and answers', () => {
 const r = readStudioArtifact(['id', null, 4, [null, [html(quizApp)]]], 4);
 assert.equal(r.kind, 'quiz');
 if (r.kind !== 'quiz') return;
 assert.equal(r.count, 2);
 assert.deepEqual(r.questions[0].choices.map(c => c.letter + c.text), ['ALyon', 'BParis', 'CNice']);
 assert.equal(r.questions[0].answer, 'B');
 assert.equal(r.questions[0].explanation, 'Paris est la capitale.');
 assert.equal(r.questions[0].hint, 'Tour Eiffel');
 assert.match(r.markdown, /\*\*Réponses\*\*\n1\. B — Paris est la capitale\.\n2\. B/);
});

test('maxItems limits the number of questions', () => {
 const r = readStudioArtifact([html(quizApp)], 4, 1);
 assert.equal(r.kind === 'quiz' && r.count, 1);
});

test('flashcards (f/b) are read', () => {
 const r = readStudioArtifact([[html({flashcards:[{f:'Photosynthèse',b:'Conversion de la lumière en énergie chimique'},{f:'ADN',b:'Support de l&#39;information génétique'}]})]], 4);
 assert.equal(r.kind, 'flashcards');
 if (r.kind === 'flashcards') { assert.equal(r.cards[1].back, "Support de l'information génétique"); assert.match(r.markdown, /^\*\*1\. Photosynthèse\*\*/); }
});

test('reports return their Markdown', () => {
 const md = '# Fiche de révision\n\n## Points clés\n- ' + 'Le cycle de l\'eau comprend évaporation, condensation et précipitations. '.repeat(6);
 const r = readStudioArtifact(['id', 'Study Guide', 2, [md]], 2);
 assert.equal(r.kind, 'report');
 assert.equal(r.kind === 'report' && r.markdown.startsWith('# Fiche de révision'), true);
});

test('mind maps become an outline and a Mermaid mindmap', () => {
 const mm = mindMapToOutline({name:'IA', children:[{name:'Apprentissage (ML)', children:[{name:'Supervisé'}]}, {name:'Éthique'}]});
 assert.ok(mm);
 assert.equal(mm!.nodes, 4);
 assert.equal(mm!.outline, '- IA\n  - Apprentissage (ML)\n    - Supervisé\n  - Éthique');
 assert.match(mm!.mermaid, /^mindmap\n  root\(\(IA\)\)\n    Apprentissage ML\n/);
 const fromCreate = withReadable({mindMapId:'abc', mindMap:JSON.stringify({name:'IA', children:[]})});
 assert.equal((fromCreate.readable as {kind:string}).kind, 'mindmap');
 const fromNotes = withReadable({notes:[{id:'n1', title:'Carte', content:JSON.stringify({name:'IA', children:[{name:'ML'}]})}, {id:'n2', title:'Note', content:'texte'}]});
 assert.equal((fromNotes.mindMaps as unknown[]).length, 1);
});

test('data tables become Markdown tables', () => {
 assert.deepEqual(findTable([1, [['Ville', 'Habitants'], ['Paris', '2,1 M'], ['Lyon', 520000]]]), [['Ville', 'Habitants'], ['Paris', '2,1 M'], ['Lyon', '520000']]);
 const r = readStudioArtifact([null, [['Ville', 'Habitants'], ['Paris', '2,1 M']]], 9);
 assert.equal(r.kind === 'data_table' && r.markdown, '| Ville | Habitants |\n| --- | --- |\n| Paris | 2,1 M |');
});

test('unreadable payloads say why and keep the raw data', () => {
 const r = withReadable({artifactId:'x', typeCode:1, rawArtifact:['x', null, 1]});
 assert.equal((r.readable as {kind:string}).kind, 'unknown');
 assert.ok(r.rawArtifact);
 const ok = withReadable({artifactId:'x', typeCode:4, rawArtifact:[html(quizApp)]});
 assert.equal(ok.rawArtifact, undefined);
});
