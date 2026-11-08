# AI·ORBIT — les valeurs qui construisent l’IA

Un site interactif qui regroupe les entreprises qui construisent l’intelligence artificielle, classées par domaine, avec leurs cours en temps réel et un motion design en cercles.

**Environ 70 entreprises cotées + 5 laboratoires privés**, aux États-Unis, en Europe et en Asie :

| Domaine | Exemples |
| --- | --- |
| Puces & Semi-conducteurs | NVIDIA, TSMC, Broadcom, ASML, Samsung, SK Hynix, Tokyo Electron, Infineon, STMicro… |
| Infrastructure & Énergie | Arista, Vertiv, Schneider Electric, Siemens, Hitachi, Legrand, Constellation… |
| Cloud & Hyperscalers | Microsoft, Alphabet, Amazon, Oracle, Alibaba, Tencent, OVHcloud, CoreWeave… |
| Logiciel & Modèles | Meta, Palantir, SAP, Capgemini, Dassault Systèmes, SoftBank, Infosys… |
| Données & Cybersécurité | CrowdStrike, Palo Alto, Cloudflare, Datadog, MongoDB |
| Robotique & Edge | Tesla, Apple, Fanuc, Keyence, ABB, Xiaomi, Intuitive Surgical… |
| Laboratoires privés | OpenAI, Anthropic, xAI, Databricks, Mistral (valorisation, non cotés) |

## Fonctionnalités

- **Vue Galaxie** : bulles regroupées par domaine (taille = capitalisation, couleur = variation du jour). Elles **flottent, se bousculent, et peuvent être attrapées et lancées** à la souris ou au doigt. Un clic sur un domaine zoome dessus.
- **Vue Bulles** : façon CoinGecko. Toutes les valeurs flottent librement, la **taille correspond à la variation du jour**, et les bulles rebondissent sur les bords.
- **Vue Orbites** : un système solaire avec l’« IA » au centre. Les trois vues animent les mêmes bulles grâce à une simulation physique continue (d3-force).
- **Design Apple** : un thème graphite et des couleurs système Apple. Les surfaces sont en **« Liquid Glass »** : verre dépoli, liseré lumineux, reflet qui suit le pointeur. Le contrôle segmenté a une lentille de verre qui coulisse avec un ressort, s’étire selon la vitesse et se tire au doigt. Les boutons ont un rebond élastique, et la fiche détaillée est une feuille de verre flottante (*bottom sheet* sur mobile).
- **Motion design** : une onde à chaque nouveau cours, des couleurs et des compteurs animés, un classement des hausses et baisses qui se réordonne en glissant, un fond d’ambiance lumineux.
- **Fiche entreprise** : prix en direct (dans sa devise), source du cours, **historique interactif** (séance, 5 jours, 1 mois, 6 mois, 1 an) avec réticule, et **actualités récentes**.
- **Partager** : génère une **image 1080×1350** (format Instagram, TikTok ou X) du tableau de bord, avec l’indice IA et le top 3 des hausses et des baisses. Une **légende est prête à poster**. Sur mobile, le bouton ouvre le partage natif.
- Filtres par domaine, recherche (Entrée ouvre la fiche), version mobile, `prefers-reduced-motion`.

## Données

| Situation | Cours affichés |
| --- | --- |
| Site déployé sur **Vercel** | Toutes les bourses en **différé d’environ 1 min**, sans clé. Les fonctions `/api` interrogent Yahoo Finance. |
| Vercel + **clé Finnhub** | Valeurs US en **temps réel** (WebSocket), le reste du monde en différé |
| Clé Finnhub seule (sans `/api`) | Valeurs US en temps réel. Les valeurs internationales restent à leur prix de référence. |
| Aucune source | **DÉMO** : variations **simulées**, clairement signalées |

Chaque fiche indique la source du cours affiché : *Temps réel*, *Différé*, *Simulé* ou *Prix de référence*. En démo, l’historique est simulé et marqué comme tel.

**Clé Finnhub** (optionnelle, gratuite) : créez-la sur [finnhub.io](https://finnhub.io/register). Collez-la ensuite dans le site (icône ⚙, elle reste dans le navigateur), ou ajoutez-la sur Vercel comme variable d’environnement `VITE_FINNHUB_KEY`. Dans ce second cas, elle sera visible dans le code du site, ce qui est acceptable pour une clé gratuite.

> Les capitalisations et valorisations sont approximatives. Ce site est fourni à titre informatif et ne constitue pas un conseil en investissement.

## Lancer le projet

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # génère dist/
npm run preview
```

## Mise en ligne sur Vercel

1. Créez un compte sur [vercel.com](https://vercel.com) avec votre GitHub.
2. *Add New → Project*, importez le dépôt. Vercel détecte Vite tout seul (`vercel.json` est fourni).
3. Facultatif : dans *Settings → Environment Variables*, ajoutez `VITE_FINNHUB_KEY`.
4. *Deploy*. Chaque push sur la branche principale redéploie le site. Un nom de domaine perso s’ajoute dans *Settings → Domains*.

En local, `npm run dev` sert aussi les fonctions `/api` (même code que sur Vercel).

## Structure

```
api/                  fonctions serveur Vercel : quotes, history, news (Yahoo Finance)
src/
  data/companies.js   univers des entreprises et domaines
  data/feed.js        store de cotations + fournisseurs API / Finnhub / DÉMO
  data/history.js     historique et actualités
  viz/galaxy.js       visualisation D3 + GSAP (Galaxie ⇄ Orbites)
  viz/sparkline.js    mini-graphiques
  viz/historyChart.js graphique d’historique interactif
  ui/glass.js         composants Liquid Glass (contrôle segmenté, reflets, ressorts)
  ui/                 bandeau, panneau, infobulle, classement, réglages, ambiance, partage
  main.js             assemblage
```

Stack : Vite, D3 v7, GSAP 3, JavaScript sans framework.
