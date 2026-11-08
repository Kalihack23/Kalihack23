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

describe('assistant + données ouvertes', () => {
  const knowledge = {
    NVDA: {
      company: { ticker: 'NVDA', name: 'NVIDIA' },
      wiki: { summary: 'Nvidia est une entreprise américaine.', url: 'https://fr.wikipedia.org/wiki/Nvidia', facts: { ceo: 'Jensen Huang', hq: 'Santa Clara', founded: '1993', employees: { value: 36000, year: '2025' } } },
      news: [{ title: 'Nvidia bat les attentes', url: 'https://www.lesechos.fr/a', source: 'lesechos.fr', date: '2026-11-07' }],
      sec: { revenue: { end: '2026-01-25', value: 130e9 }, netIncome: { end: '2026-01-25', value: 72e9 }, quarter: { end: '2026-10-25', value: 57e9, yoy: 62.9 }, filings: [{ form: '10-Q', date: '2026-10-25', url: 'https://www.sec.gov/x' }] },
      sources: [{ name: 'Wikipedia / Wikidata', url: 'https://fr.wikipedia.org/wiki/Nvidia' }, { name: 'SEC EDGAR', url: 'https://www.sec.gov/c' }],
    },
  };
  it('présentation : résumé Wikipedia, fiche, actus et sources', () => {
    const a = localAnswer('Que fait NVIDIA ?', store, { knowledge });
    expect(a).toContain('Nvidia est une entreprise américaine.');
    expect(a).toContain('PDG : **Jensen Huang**');
    expect(a).toContain('[Nvidia bat les attentes](https://www.lesechos.fr/a)');
    expect(a).toContain('_Sources ouvertes :_');
  });
  it('résultats : chiffres SEC', () => {
    const a = localAnswer('Quel est le chiffre d’affaires de NVIDIA ?', store, { knowledge });
    expect(a).toContain('Résultats officiels (SEC EDGAR)');
    expect(a).toContain('130 Md$');
    expect(a).toContain('+63 % sur un an');
  });
  it('actualité et dirigeant', () => {
    expect(localAnswer('Pourquoi NVIDIA bouge ?', store, { knowledge })).toContain('Dernières actualités');
    expect(localAnswer('Qui est le PDG de NVIDIA ?', store, { knowledge })).toContain('dirigée par **Jensen Huang**');
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
