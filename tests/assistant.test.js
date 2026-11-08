import { describe, expect, it } from 'vitest';
import { createSimProvider, createStore } from '../src/data/feed.js';
import { findCompanies, findDomain, localAnswer } from '../src/data/assistant.js';
import { renderMarkdown } from '../src/ui/chat.js';

const store = createStore();
createSimProvider(store);
store.set('NVDA', 110, 100);
store.set('AMD', 95, 100);

describe('reconnaissance des entreprises et domaines', () => {
  it('par nom ou par symbole, sans confondre les mots courants', () => {
    expect(findCompanies('combien vaut nvidia ?').map((c) => c.ticker)).toEqual(['NVDA']);
    expect(findCompanies('compare AMD et NVIDIA').map((c) => c.ticker)).toEqual(['AMD', 'NVDA']);
    expect(findCompanies('Que fait CAT pour les datacenters ?').map((c) => c.ticker)).toContain('CAT');
    // « on », « ai », « now », « cat » en minuscules ne sont pas des symboles
    expect(findCompanies('on parle de ai now, le cat dort').length).toBe(0);
  });
  it('domaines', () => {
    expect(findDomain('qui alimente les datacenters en énergie ?').id).toBe('datacenters');
    expect(findDomain('les plus fortes baisses dans l’énergie').id).toBe('energy');
    expect(findDomain('top des puces').id).toBe('chips');
  });
});

describe('assistant local', () => {
  it('cours et rôle d’une entreprise', () => {
    const a = localAnswer('Combien vaut NVIDIA ?', store);
    expect(a).toContain('NVIDIA (NVDA)');
    expect(a).toMatch(/\+10,00\s%/);
    expect(a).toContain('Rôle dans l’IA');
  });
  it('classement des baisses dans un domaine', () => {
    const a = localAnswer('plus fortes baisses dans les puces', store);
    expect(a).toContain('Plus fortes baisses · Puces');
    expect(a).toMatch(/^1\. /m);
  });
  it('comparaison', () => {
    const a = localAnswer('compare AMD et NVIDIA', store);
    expect(a).toContain('Comparaison');
    expect(a).toContain('**NVIDIA** fait mieux');
  });
  it('question hors sujet → suggestions, et mention Perplexity sans clé', () => {
    const a = localAnswer('quelle est la recette des crêpes ?', store, { noKey: true });
    expect(a).toContain('Essayez par exemple');
    expect(a).toContain('Perplexity');
  });
  it('« elle » renvoie à la fiche ouverte', () => {
    const a = localAnswer('pourquoi elle bouge ?', store, { focus: { ticker: 'AMD', name: 'AMD', listed: true, domain: 'chips', role: 'GPU' } });
    expect(a).toContain('(AMD)');
  });
});

describe('rendu Markdown du chat', () => {
  it('échappe le HTML et n’autorise que les liens http(s)', () => {
    const h = renderMarkdown('<img src=x onerror=alert(1)> **gras** [ok](https://a.com) [ko](javascript:alert(1))');
    expect(h).not.toContain('<img');
    expect(h).toContain('<b>gras</b>');
    expect(h).toContain('href="https://a.com"');
    expect(h).not.toContain('href="javascript');
  });
  it('listes, renvois de sources et symboles cliquables', () => {
    const h = renderMarkdown('- NVIDIA (NVDA) monte [1]\n- Inconnu (ZZZZ)', [{ title: 'Reuters', url: 'https://reuters.com/x' }]);
    expect(h).toContain('<ul>');
    expect(h).toContain('data-ticker="NVDA"');
    expect(h).not.toContain('data-ticker="ZZZZ"');
    expect(h).toContain('<sup><a href="https://reuters.com/x"');
  });
});
