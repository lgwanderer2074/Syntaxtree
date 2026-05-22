import nlp from 'compromise';

export interface TreeNode {
  id: string;
  name: string;
  children?: TreeNode[];
}

export function generateTreeFromSentence(text: string): TreeNode {
  if (!text.trim()) return { id: 'root', name: 'S' };
  
  const doc = nlp(text);
  const terms = doc.terms().json();
  
  const children: TreeNode[] = [];
  
  terms.forEach((termObj: any) => {
    const term = termObj.terms[0];
    const tags = term.tags || [];
    
    let pos = 'X'; // Unknown
    if (tags.includes('Noun')) pos = 'N';
    else if (tags.includes('Verb')) pos = 'V';
    else if (tags.includes('Adjective')) pos = 'Adj';
    else if (tags.includes('Adverb')) pos = 'Adv';
    else if (tags.includes('Determiner')) pos = 'Det';
    else if (tags.includes('Preposition')) pos = 'P';
    else if (tags.includes('Conjunction')) pos = 'Conj';
    else if (tags.includes('Pronoun')) pos = 'Pro';
    
    children.push({
      id: generateId(),
      name: pos,
      children: [
        {
          id: generateId(),
          name: term.text
        }
      ]
    });
  });

  return {
    id: generateId(),
    name: 'S',
    children
  };
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}
