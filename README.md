# AI·ORBIT — les valeurs qui construisent l’IA

Un site interactif qui regroupe les entreprises qui construisent l’intelligence artificielle, classées par domaine, avec leurs cours en temps réel et un motion design en cercles.

**Domaines couverts** (≈ 55 entreprises) :

| Domaine | Exemples |
| --- | --- |
| Puces & Semi-conducteurs | NVIDIA, TSMC, Broadcom, AMD, ASML, Micron, Arm… |
| Infrastructure & Énergie | Arista, Vertiv, Eaton, Equinix, Constellation Energy… |
| Cloud & Hyperscalers | Microsoft, Alphabet, Amazon, Oracle, CoreWeave, Nebius… |
| Logiciel & Modèles | Meta, Palantir, Salesforce, ServiceNow, SAP, Snowflake… |
| Données & Cybersécurité | CrowdStrike, Palo Alto, Cloudflare, Datadog, MongoDB |
| Robotique & Edge | Tesla, Apple, Intuitive Surgical, Symbotic, ABB |
| Laboratoires privés | OpenAI, Anthropic, xAI, Databricks, Mistral (valorisation, non cotés) |

## Fonctionnalités

- **Vue Galaxie** : *circle packing*. Les domaines sont de grands cercles, les entreprises des bulles (taille = capitalisation, couleur = variation du jour). Cliquez sur un domaine pour zoomer dessus.
- **Vue Orbites** : un système solaire avec l’« IA » au centre. Chaque domaine est une orbite et les entreprises sont des planètes. Le passage d’une vue à l’autre est un *morph* animé des mêmes bulles.
- Chaque nouveau cours produit une onde qui pulse sur la bulle. La couleur glisse vers sa nouvelle valeur et les pourcentages défilent comme un compteur.
- En haut : un bandeau défilant des cours, un indice IA pondéré par la capitalisation, la capitalisation totale et le nombre de hausses et de baisses.
- Un classement animé des plus fortes hausses et baisses.
- Un panneau de détail par entreprise : prix en direct, sparkline et rôle dans l’IA.
- Filtres par domaine, recherche (Entrée ouvre la fiche), affichage mobile adapté, prise en compte de `prefers-reduced-motion`.

## Données : LIVE ou DÉMO

- **Sans clé**, le site tourne en **mode DÉMO**. Les variations sont **simulées** (mouvement brownien corrélé par secteur) à partir de prix de référence approximatifs. Le badge en haut indique clairement « DÉMO · cours simulés ».
- **Pour les vrais cours en temps réel**, créez une clé gratuite sur [finnhub.io](https://finnhub.io/register), puis :
  - cliquez sur le badge ou l’icône ⚙ et collez la clé (elle reste dans votre navigateur) ;
  - ou bien mettez-la dans un fichier `.env` : `VITE_FINNHUB_KEY=...` (voir `.env.example`).

En mode LIVE, le site charge d’abord la clôture de la veille de chaque valeur via l’API REST. Ces appels sont espacés pour respecter la limite de 60 requêtes par minute du plan gratuit. Les échanges arrivent ensuite en direct via le WebSocket Finnhub. Hors séance US, les cours restent sur la dernière valeur connue.

> Les capitalisations et valorisations sont approximatives. Ce site est fourni à titre informatif et ne constitue pas un conseil en investissement.

## Lancer le projet

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # génère dist/
npm run preview
```

## Déploiement

Le workflow `.github/workflows/deploy.yml` publie le site sur **GitHub Pages** à chaque push sur `main`. Pour l’activer : *Settings → Pages → Source : GitHub Actions*. Pour le mode LIVE en production, vous pouvez ajouter le secret `VITE_FINNHUB_KEY`. Attention : la clé sera alors visible dans le code du site, ce qui est acceptable pour une clé gratuite.

## Structure

```
src/
  data/companies.js   univers des entreprises et domaines
  data/feed.js        store de cotations + fournisseurs DÉMO / LIVE Finnhub
  viz/galaxy.js       visualisation D3 + GSAP (Galaxie ⇄ Orbites)
  viz/sparkline.js    mini-graphiques
  ui/                 bandeau, panneau, infobulle, classement, réglages, étoiles
  main.js             assemblage
```

Stack : Vite, D3 v7, GSAP 3, JavaScript sans framework.
