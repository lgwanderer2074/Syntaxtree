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

function leaf(token: Token): TreeNode {
  // A terminal: the part-of-speech node with the word as its single child.
  return {
    id: generateId(),
    name: token.pos,
    children: [{ id: generateId(), name: token.word }],
  };
}

function phrase(name: string, children: TreeNode[]): TreeNode {
  return { id: generateId(), name, children };
}

interface Chunk {
  node: TreeNode;
  next: number;
}

// Noun phrase: (Det)? (Adv? Adj)* (N)+ , or a standalone Pronoun.
function parseNP(tokens: Token[], i: number): Chunk | null {
  // A pronoun forms a complete NP on its own.
  if (tokens[i] && tokens[i].pos === 'Pro') {
    return { node: phrase('NP', [leaf(tokens[i])]), next: i + 1 };
  }

  const start = i;
  const children: TreeNode[] = [];

  if (tokens[i] && tokens[i].pos === 'Det') {
    children.push(leaf(tokens[i]));
    i++;
  }

  // Adjectives, plus adverbs that modify a following adjective/adverb.
  while (tokens[i]) {
    if (tokens[i].pos === 'Adj') {
      children.push(leaf(tokens[i]));
      i++;
    } else if (
      tokens[i].pos === 'Adv' &&
      tokens[i + 1] &&
      (tokens[i + 1].pos === 'Adj' || tokens[i + 1].pos === 'Adv')
    ) {
      children.push(leaf(tokens[i]));
      i++;
    } else {
      break;
    }
  }

  let hasNoun = false;
  while (tokens[i] && tokens[i].pos === 'N') {
    children.push(leaf(tokens[i]));
    i++;
    hasNoun = true;
  }

  // Only a real NP if we found a noun, or at least a determiner/adjective head.
  if (!hasNoun && i === start) return null;

  return { node: phrase('NP', children), next: i };
}

// Prepositional phrase: P followed by an NP complement.
function parsePP(tokens: Token[], i: number): Chunk | null {
  if (!tokens[i] || tokens[i].pos !== 'P') return null;
  const children: TreeNode[] = [leaf(tokens[i])];
  const np = parseNP(tokens, i + 1);
  if (np) {
    children.push(np.node);
    return { node: phrase('PP', children), next: np.next };
  }
  return { node: phrase('PP', children), next: i + 1 };
}

// Verb phrase: (Aux)* (Adv)* V (NP | PP | Adv | ...)* — the predicate.
function parseVP(tokens: Token[], i: number): Chunk | null {
  const children: TreeNode[] = [];

  while (tokens[i] && tokens[i].pos === 'Aux') {
    children.push(leaf(tokens[i]));
    i++;
  }
  while (tokens[i] && tokens[i].pos === 'Adv') {
    children.push(leaf(tokens[i]));
    i++;
  }

  if (tokens[i] && tokens[i].pos === 'V') {
    children.push(leaf(tokens[i]));
    i++;
  } else if (children.length === 0) {
    return null;
  }

  // Complements and adjuncts following the verb.
  while (i < tokens.length) {
    const pos = tokens[i].pos;
    if (pos === 'P') {
      const pp = parsePP(tokens, i)!;
      children.push(pp.node);
      i = pp.next;
    } else if (pos === 'Det' || pos === 'N' || pos === 'Pro' || pos === 'Adj') {
      const np = parseNP(tokens, i);
      if (np && np.next > i) {
        children.push(np.node);
        i = np.next;
      } else {
        children.push(leaf(tokens[i]));
        i++;
      }
    } else {
      children.push(leaf(tokens[i]));
      i++;
    }
  }

  return { node: phrase('VP', children), next: i };
}

export function generateTreeFromSentence(text: string): TreeNode {
  if (!text.trim()) return { id: 'root', name: 'S' };

  const doc = nlp(text);
  const termsJson = doc.terms().json();

  const tokens: Token[] = termsJson
    .map((termObj: any) => {
      const term = termObj.terms?.[0];
      if (!term) return null;
      return { word: term.text, pos: getPos(term.tags || [], term.text) };
    })
    .filter((t: Token | null): t is Token => t !== null);

  if (tokens.length === 0) return { id: 'root', name: 'S' };

  const children: TreeNode[] = [];
  let i = 0;

  // Subject NP.
  const subject = parseNP(tokens, i);
  if (subject) {
    children.push(subject.node);
    i = subject.next;
  }

  // Predicate VP.
  const vp = parseVP(tokens, i);
  if (vp) {
    children.push(vp.node);
    i = vp.next;
  }

  // Anything left over attaches directly to S as a fallback.
  while (i < tokens.length) {
    children.push(leaf(tokens[i]));
    i++;
  }

  return { id: generateId(), name: 'S', children };
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}
