import nlp from 'compromise';

export interface TreeNode {
  id: string;
  name: string;
  children?: TreeNode[];
}

type Tag = 'N' | 'V' | 'Adj' | 'Adv' | 'Det' | 'P' | 'Conj' | 'Pro' | 'Aux' | 'X';

interface Token {
  word: string;
  pos: Tag;
}

// compromise occasionally mis-tags common prepositions (e.g. "over" as an
// adjective), so we override these by surface form before falling back to tags.
const COMMON_PREPOSITIONS = new Set([
  'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around',
  'at', 'before', 'behind', 'below', 'beneath', 'beside', 'between', 'beyond',
  'by', 'down', 'during', 'for', 'from', 'in', 'inside', 'into', 'near', 'of',
  'off', 'on', 'onto', 'out', 'outside', 'over', 'past', 'through', 'to',
  'toward', 'towards', 'under', 'underneath', 'until', 'up', 'upon', 'with',
  'within', 'without',
]);

function getPos(tags: string[], word?: string): Tag {
  if (word && COMMON_PREPOSITIONS.has(word.toLowerCase())) return 'P';
  // Order matters: more specific roles are checked before generic ones.
  if (tags.includes('Copula')) return 'V'; // is/are/was as the main (copular) verb
  if (tags.includes('Modal') || tags.includes('Auxiliary')) return 'Aux';
  if (tags.includes('Determiner') || tags.includes('Article')) return 'Det';
  if (tags.includes('Pronoun')) return 'Pro';
  if (tags.includes('Preposition')) return 'P';
  if (tags.includes('Conjunction')) return 'Conj';
  if (tags.includes('Verb')) return 'V';
  if (tags.includes('Adjective')) return 'Adj';
  if (tags.includes('Adverb')) return 'Adv';
  if (tags.includes('Noun')) return 'N';
  return 'X';
}

// ---------------------------------------------------------------------------
// X-bar node builders. Every phrase XP projects an intermediate X' bar level,
// and every head X dominates the actual word (a childless leaf node).
// ---------------------------------------------------------------------------

function n(name: string, children: TreeNode[]): TreeNode {
  return { id: generateId(), name, children };
}

function word(w: string): TreeNode {
  return { id: generateId(), name: w }; // terminal / leaf
}

function head(label: string, w: string): TreeNode {
  return { id: generateId(), name: label, children: [word(w)] };
}

function buildAdjP(w: string): TreeNode {
  return n('AdjP', [n("Adj'", [head('Adj', w)])]);
}

function buildAdvP(w: string): TreeNode {
  return n('AdvP', [n("Adv'", [head('Adv', w)])]);
}

// N' with the head noun innermost; noun-noun compounds and pre-modifiers
// (AdjP/AdvP) stack as adjuncts, outermost = leftmost in the sentence.
function buildNbar(modifiers: TreeNode[], nounWords: string[]): TreeNode {
  let nbar = n("N'", [head('N', nounWords[nounWords.length - 1])]);
  for (let k = nounWords.length - 2; k >= 0; k--) {
    nbar = n("N'", [head('N', nounWords[k]), nbar]); // compound noun adjunct
  }
  for (let k = modifiers.length - 1; k >= 0; k--) {
    nbar = n("N'", [modifiers[k], nbar]);
  }
  return nbar;
}

interface Chunk {
  node: TreeNode;
  next: number;
}

// A nominal: a DP (with a D head taking an NP complement) when there is a
// determiner, a DP headed by a pronoun, or a bare NP otherwise.
function parseNominal(tokens: Token[], i: number): Chunk | null {
  if (tokens[i] && tokens[i].pos === 'Pro') {
    return { node: n('DP', [n("D'", [head('D', tokens[i].word)])]), next: i + 1 };
  }

  let detWord: string | null = null;
  if (tokens[i] && tokens[i].pos === 'Det') {
    detWord = tokens[i].word;
    i++;
  }

  const modifiers: TreeNode[] = [];
  while (tokens[i]) {
    if (tokens[i].pos === 'Adj') {
      modifiers.push(buildAdjP(tokens[i].word));
      i++;
    } else if (
      tokens[i].pos === 'Adv' &&
      tokens[i + 1] &&
      (tokens[i + 1].pos === 'Adj' || tokens[i + 1].pos === 'Adv')
    ) {
      modifiers.push(buildAdvP(tokens[i].word));
      i++;
    } else {
      break;
    }
  }

  const nounWords: string[] = [];
  while (tokens[i] && tokens[i].pos === 'N') {
    nounWords.push(tokens[i].word);
    i++;
  }

  if (nounWords.length === 0) {
    // A lone determiner still heads a DP; otherwise this isn't a nominal.
    if (detWord) {
      return { node: n('DP', [n("D'", [head('D', detWord)])]), next: i };
    }
    return null;
  }

  const np = n('NP', [buildNbar(modifiers, nounWords)]);
  if (detWord) {
    return { node: n('DP', [n("D'", [head('D', detWord), np])]), next: i };
  }
  return { node: np, next: i };
}

// PP -> P' -> P (DP complement).
function parsePP(tokens: Token[], i: number): Chunk {
  const p = tokens[i].word;
  i++;
  const pbarChildren: TreeNode[] = [head('P', p)];
  const comp = parseNominal(tokens, i);
  if (comp) {
    pbarChildren.push(comp.node);
    i = comp.next;
  }
  return { node: n('PP', [n("P'", pbarChildren)]), next: i };
}

interface VPChunk {
  node: TreeNode;
  tWord: string | null; // auxiliary/modal that heads T
  next: number;
}

// VP -> V' -> V (complements). Auxiliaries surface in T; pre-verbal adverbs
// stack as V' adjuncts.
function parseVP(tokens: Token[], i: number): VPChunk | null {
  const auxes: string[] = [];
  while (tokens[i] && tokens[i].pos === 'Aux') {
    auxes.push(tokens[i].word);
    i++;
  }

  const preAdvs: TreeNode[] = [];
  while (tokens[i] && tokens[i].pos === 'Adv') {
    preAdvs.push(buildAdvP(tokens[i].word));
    i++;
  }

  let verbWord: string | null = null;
  if (tokens[i] && tokens[i].pos === 'V') {
    verbWord = tokens[i].word;
    i++;
  }

  if (!verbWord && auxes.length === 0) return null;

  // First aux becomes T; any extra auxes sit inside the VP.
  const tWord = auxes.length ? auxes[0] : null;
  const extraAux = auxes.slice(1).map((w) => head('Aux', w));

  const comps: TreeNode[] = [];
  while (i < tokens.length) {
    const pos = tokens[i].pos;
    if (pos === 'P') {
      const pp = parsePP(tokens, i);
      comps.push(pp.node);
      i = pp.next;
    } else if (pos === 'Det' || pos === 'N' || pos === 'Pro' || pos === 'Adj') {
      const nm = parseNominal(tokens, i);
      if (nm && nm.next > i) {
        comps.push(nm.node);
        i = nm.next;
      } else {
        comps.push(head(tokens[i].pos, tokens[i].word));
        i++;
      }
    } else if (pos === 'Adv') {
      comps.push(buildAdvP(tokens[i].word));
      i++;
    } else {
      comps.push(head(tokens[i].pos, tokens[i].word));
      i++;
    }
  }

  const vbarChildren: TreeNode[] = [...extraAux];
  if (verbWord) vbarChildren.push(head('V', verbWord));
  vbarChildren.push(...comps);

  let vbar = n("V'", vbarChildren);
  for (let k = preAdvs.length - 1; k >= 0; k--) {
    vbar = n("V'", [preAdvs[k], vbar]);
  }

  return { node: n('VP', [vbar]), tWord, next: i };
}

export function generateTreeFromSentence(text: string): TreeNode {
  if (!text.trim()) return { id: 'root', name: 'TP' };

  const doc = nlp(text);
  const termsJson = doc.terms().json();

  const tokens: Token[] = termsJson
    .map((termObj: any) => {
      const term = termObj.terms?.[0];
      if (!term) return null;
      return { word: term.text, pos: getPos(term.tags || [], term.text) };
    })
    .filter((t: Token | null): t is Token => t !== null);

  if (tokens.length === 0) return { id: 'root', name: 'TP' };

  // compromise sometimes tags a clause's only verb as a plural noun
  // (e.g. "fox jumps"). If nothing is verbal but there are at least two
  // nouns, promote the last noun to the main verb so the clause has a predicate.
  const hasVerbal = tokens.some((t) => t.pos === 'V' || t.pos === 'Aux');
  if (!hasVerbal) {
    const nounIndexes = tokens
      .map((t, idx) => (t.pos === 'N' ? idx : -1))
      .filter((idx) => idx >= 0);
    if (nounIndexes.length >= 2) {
      tokens[nounIndexes[nounIndexes.length - 1]].pos = 'V';
    }
  }

  // Subject DP/NP.
  const subject = parseNominal(tokens, 0);
  let i = subject ? subject.next : 0;

  // Predicate VP (and its auxiliary, which heads T).
  const predicate = parseVP(tokens, i);

  if (subject && predicate) {
    i = predicate.next;
    const tbar = n(
      "T'",
      predicate.tWord ? [head('T', predicate.tWord), predicate.node] : [predicate.node],
    );
    const tp = n('TP', [subject.node, tbar]);
    appendLeftovers(tp, tokens, i);
    return tp;
  }

  if (predicate) {
    // Imperative / subjectless clause.
    i = predicate.next;
    const tbar = n(
      "T'",
      predicate.tWord ? [head('T', predicate.tWord), predicate.node] : [predicate.node],
    );
    const tp = n('TP', [tbar]);
    appendLeftovers(tp, tokens, i);
    return tp;
  }

  if (subject) {
    // A bare nominal with no predicate (a fragment).
    appendLeftovers(subject.node, tokens, subject.next);
    return subject.node;
  }

  // Fallback: attach every word as a leaf under S.
  return n('S', tokens.map((t) => head(t.pos, t.word)));
}

function appendLeftovers(parent: TreeNode, tokens: Token[], i: number): void {
  for (; i < tokens.length; i++) {
    parent.children = parent.children || [];
    parent.children.push(head(tokens[i].pos, tokens[i].word));
  }
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}
