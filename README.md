# AI·ORBIT — les valeurs qui construisent l’IA

Un site interactif qui regroupe les entreprises qui construisent l’intelligence artificielle, classées par domaine, avec leurs cours en temps réel et un motion design en cercles.

**146 entreprises cotées + 11 laboratoires privés**, aux États-Unis, en Europe et en Asie. Le site couvre tout ce qui touche à l'IA, de près ou de loin, réparti en 9 domaines :

| Domaine | Exemples |
| --- | --- |
| Puces & Semi-conducteurs | NVIDIA, TSMC, Broadcom, ASML, Samsung, SK Hynix, Synopsys, Cadence, Tokyo Electron, Disco, SMIC, Cambricon… |
| Serveurs, Réseau & Stockage | Dell, HPE, Foxconn, Quanta, Super Micro, Arista, Corning, Coherent, Credo, Astera Labs, Amphenol, Western Digital, Seagate… |
| Énergie & Électricité | **Caterpillar**, GE Vernova, Siemens Energy, Schneider, Eaton, Vertiv, Constellation, Vistra, Cameco, Oklo, Prysmian… |
| Datacenters | Equinix, Digital Realty, Iron Mountain, Applied Digital, IREN, Core Scientific… |
| Cloud & Hyperscalers | Microsoft, Alphabet, Amazon, Oracle, CoreWeave, Nebius, Alibaba, Tencent, OVHcloud… |
| Logiciel & Modèles | Meta, Palantir, SAP, Salesforce, AppLovin, Shopify, Capgemini, SoftBank… |
| Données & Cybersécurité | CrowdStrike, Palo Alto, Zscaler, Fortinet, Cloudflare, Datadog, MongoDB… |
| Robotique & Edge | Tesla, Apple, Intuitive Surgical, Fanuc, ABB, Rockwell, Mobileye, Xiaomi… |
| Laboratoires privés | OpenAI, Anthropic, xAI, Databricks, Mistral, Perplexity, SSI, Figure AI, Scale AI… (valorisations estimées, non cotés) |

## Fonctionnalités

- **Vue Galaxie** : bulles regroupées par domaine (taille = capitalisation, couleur = variation du jour). Elles **flottent, se bousculent, et peuvent être attrapées et lancées** à la souris ou au doigt. Un clic sur un domaine zoome dessus.
- **Vue Bulles** : façon CoinGecko. Toutes les valeurs flottent librement, la **taille correspond à la variation du jour**, et les bulles rebondissent sur les bords.
- **Vue Orbites** : un système solaire avec l’« IA » au centre. Les trois vues animent les mêmes bulles grâce à une simulation physique continue (d3-force).
- **Design Apple** : un thème graphite et des couleurs système Apple. Les surfaces sont en **« Liquid Glass »** : verre dépoli, liseré lumineux, reflet qui suit le pointeur. Le contrôle segmenté a une lentille de verre qui coulisse avec un ressort, s’étire selon la vitesse et se tire au doigt. Les boutons ont un rebond élastique, et la fiche détaillée est une feuille de verre flottante (*bottom sheet* sur mobile).
- **Motion design** : une onde à chaque nouveau cours, des couleurs et des compteurs animés, un classement des hausses et baisses qui se réordonne en glissant, un fond d’ambiance lumineux.
- **Liste de valeurs façon app Bourse d’Apple** : symbole, nom, mini-courbe de séance, et **pastille verte ou rouge**. Toucher une pastille fait passer l’affichage de la variation au prix, puis à la capitalisation. Tri par variation, capitalisation ou A–Z, avec une animation de réordonnancement. Sur mobile, c’est l’onglet « Liste ».
- **Fiche entreprise façon app Bourse** : symbole, prix dans sa devise, variation en valeur et en %, périodes **1J · 1S · 1M · 6M · 1A**. Le graphique a une échelle à droite, un quadrillage léger et la clôture de la veille en pointillés. **En parcourant la courbe au doigt, le prix, la variation et la date de l’en-tête se mettent à jour**. Suivent un tableau de statistiques (clôture veille, haut et bas de séance, capitalisation, volatilité, place de cotation…), une section « À propos » et les **actualités**.
- **Chatbot « Orbit »** : l’onglet « Orbit IA » (ou le bouton en bas à droite sur mobile) ouvre une discussion sur les entreprises du site (cours, rôle dans l’IA, comparaisons, actualité). Relié gratuitement à **Groq** (ou Mistral, ou Perplexity), il cite ses sources, ses réponses s’affichent au fil de l’eau, et les symboles cités ouvrent la fiche. Sans clé Perplexity, un assistant local répond aux questions courantes à partir des données du site.
- **Partager** : génère une **image 1080×1350** (format Instagram, TikTok ou X) du tableau de bord, avec l’indice IA et le top 3 des hausses et des baisses. Une **légende est prête à poster**. Sur mobile, le bouton ouvre le partage natif.
- **Thème clair ou sombre** : se choisit avec le bouton soleil/lune (révélation circulaire, comme sur macOS) ou dans les Réglages. Le choix est mémorisé. À la première visite, le site suit le réglage de l'appareil. Le thème clair reprend le mode clair d'iOS, et l'image de partage suit le thème actif.
- **Bulles vivantes** : dans chaque domaine, les bulles tournent lentement autour du centre, dérivent et « respirent ». Elles s'écartent quand la souris passe, puis reviennent avec un ressort. Sur iPhone et iPad, elles glissent selon l'inclinaison de l'appareil (gyroscope), en parallaxe : les petites bulles bougent plus que les grandes.
- **Compte (gratuit, facultatif)** : connexion par **lien reçu par e-mail** (sans mot de passe) ou avec Google. Le compte synchronise sur tous les appareils :
  - la **liste de suivi** : ☆ sur chaque ligne et dans la fiche, filtre « ★ Ma liste », anneau doré autour des bulles suivies, et Orbit répond à « Comment va ma liste ? » ;
  - les **alertes de cours** (au-dessus de, en dessous de, variation du jour de ± X %) : une notification dans le site et dans le navigateur, au plus une fois par jour et par alerte, **tant que le site est ouvert** ;
  - les **portefeuilles virtuels** (« Mon ETF IA ») : modèles prêts à l’emploi ou votre liste, performance depuis la création comparée à l’indice AI Orbit, et lien de partage public `?portfolio=…` ;
  - les **préférences** : thème, vue, tri.
  Sans compte, tout fonctionne aussi, enregistré sur l’appareil. À la première connexion, ces données sont ajoutées au compte.
- Filtres par domaine, recherche (Entrée ouvre la fiche), version mobile, `prefers-reduced-motion` (aucune animation).

## Données

| Situation | Cours affichés |
| --- | --- |
| Site déployé sur **Vercel** | Toutes les bourses en **différé d’environ 1 min**, sans clé. Les fonctions `/api` interrogent Yahoo Finance. |
| Vercel + **clé Finnhub** | Valeurs US en **temps réel** (WebSocket), le reste du monde en différé |
| Clé Finnhub seule (sans `/api`) | Valeurs US en temps réel. Les valeurs internationales restent à leur prix de référence. |
| Aucune source | **DÉMO** : variations **simulées**, clairement signalées |

Chaque fiche indique la source du cours affiché : *Temps réel*, *Différé*, *Simulé* ou *Prix de référence*. En mode réel, elle indique aussi l’état du marché (ouvert, fermé, pré-ouverture, après clôture). Une valeur sans source est grisée (« — ») et sortie de l’indice. En démo, l’historique est simulé et marqué comme tel.

Une fois déployé, `/api/quotes` fournit aussi, quand Yahoo les donne, les **vraies capitalisations** (converties en USD), l’ouverture, le haut et le bas de séance, le volume et l’état du marché. La taille des bulles et l’indice IA se recalculent alors. Sinon, la capitalisation affichée est une estimation, signalée par « ≈ ».

Les fonctions `/api` n’acceptent que les entreprises du site (elles ne servent pas de proxy ouvert). Les appels vers Yahoo sont groupés, limités dans le temps et mis en cache 60 s.

**Clé Finnhub** (optionnelle, gratuite) : créez-la sur [finnhub.io](https://finnhub.io/register). Collez-la ensuite dans le site (icône ⚙, elle reste dans le navigateur), ou ajoutez-la sur Vercel comme variable d’environnement `VITE_FINNHUB_KEY`. Dans ce second cas, elle sera visible dans le code du site, ce qui est acceptable pour une clé gratuite.

> Les capitalisations et valorisations sont approximatives. Ce site est fourni à titre informatif et ne constitue pas un conseil en investissement.

## Lancer le projet

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # génère dist/
npm run preview
npm test         # tests unitaires (Vitest)
npm run lint     # vérification du code (ESLint)
npm run check    # lint + tests + build (lancé automatiquement sur GitHub à chaque push)
```

## Sources de données ouvertes (gratuites, sans clé)

L’agent Orbit et les fiches s’appuient, à chaque question, sur des sources ouvertes interrogées par la fonction `/api/knowledge` (cache CDN de 30 min) :

| Source | Ce qu’elle apporte | Licence |
| --- | --- | --- |
| **Wikipedia + Wikidata** | Présentation de l’entreprise, PDG, siège, date de création, effectifs, chiffre d’affaires | CC BY-SA / CC0 |
| **GDELT** | Derniers articles de presse (français et anglais), mis à jour toutes les 15 min | Données ouvertes |
| **SEC EDGAR** | Comptes officiels des sociétés américaines : chiffre d’affaires, résultat net, dernier trimestre, rapports 10-K / 10-Q / 8-K | Domaine public |

Sans clé Perplexity, Orbit rédige ses réponses à partir de ces sources et les cite. Avec la clé, Perplexity les reçoit en plus de sa recherche web. La SEC demande un contact dans les requêtes : ajoutez sur Vercel la variable `SEC_USER_AGENT`, par exemple `AI Orbit votre@email.fr`. Sans elle, la SEC peut refuser les requêtes, et la partie « résultats » est alors simplement omise.

## Cerveau de l’agent (gratuit) : Groq ou Mistral

Orbit rédige ses réponses avec un modèle d’IA appelé côté serveur par `/api/chat`. Le premier fournisseur dont la clé existe est utilisé, et en cas d’échec ou de quota dépassé, le suivant prend le relais :

| Fournisseur | Prix | Variable Vercel | Modèle par défaut |
| --- | --- | --- | --- |
| **Groq** (recommandé) | **Gratuit**, sans carte bancaire (~1 000 questions/jour) | `GROQ_API_KEY` | `openai/gpt-oss-120b` (open source, `GROQ_MODEL` pour changer) |
| **Mistral AI** | **Gratuit** en mode « free » (vérification par téléphone) | `MISTRAL_API_KEY` | `mistral-large-latest` (`MISTRAL_MODEL`) |
| **Perplexity** | Payant, avec recherche web | `PERPLEXITY_API_KEY` | `sonar-pro` (`PERPLEXITY_MODEL`) |

1. Créez une clé gratuite sur [console.groq.com/keys](https://console.groq.com/keys).
2. Sur Vercel : *Settings → Environment Variables*, ajoutez `GROQ_API_KEY`, puis redéployez.
3. Facultatif : `CHAT_PROVIDER=groq|mistral|perplexity` pour imposer un fournisseur.

Les clés restent côté serveur. Groq et Mistral n’ayant pas d’accès au web, Orbit leur fournit les cours en direct et les sources ouvertes (Wikipedia, GDELT, SEC), et leur demande de ne rien inventer. Sans aucune clé, Orbit répond quand même à partir de ces sources (mode « Sources ouvertes »).

## Chatbot : relier Perplexity

1. Créez une clé sur [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api) (facturation à l’usage).
2. Sur Vercel : *Settings → Environment Variables*, ajoutez `PERPLEXITY_API_KEY` avec cette clé. Facultatif : `PERPLEXITY_MODEL` (par défaut `sonar-pro` ; `sonar` coûte moins cher).
3. Redéployez (*Deployments → … → Redeploy*).

La clé reste côté serveur (fonction `/api/chat`) et n’est jamais envoyée au navigateur. Pour limiter les coûts, chaque question fait 600 caractères au maximum, la conversation est limitée à 10 messages, chaque réponse à environ 700 jetons, et chaque visiteur à 8 questions par minute.

## Comptes utilisateurs : relier Supabase (gratuit)

1. Créez un projet gratuit sur [supabase.com](https://supabase.com) (*New project*, région Europe conseillée).
2. *SQL Editor → New query* : collez tout le contenu de [`supabase/schema.sql`](supabase/schema.sql), puis *Run*. Le script crée les tables (profils, liste de suivi, alertes, portefeuilles) et active la **sécurité par ligne** : chaque utilisateur ne voit que ses propres données. Il peut être relancé sans risque.
3. *Authentication → URL Configuration* :
   - **Site URL** : l’adresse du site, par ex. `https://kalihack23-isgu.vercel.app` ;
   - **Redirect URLs** : la même adresse suivie de `/**`, plus `http://localhost:5173/**` pour le développement.
4. *Project Settings → API* : notez la **Project URL**, la clé **anon public** et la clé **service_role**.
5. Sur Vercel, *Settings → Environment Variables* :
   - `VITE_SUPABASE_URL` : la Project URL ;
   - `VITE_SUPABASE_ANON_KEY` : la clé anon (publique par nature, protégée par la sécurité par ligne) ;
   - `SUPABASE_SERVICE_ROLE_KEY` : la clé service_role. Elle est **secrète** : elle ne sert qu’à la fonction serveur `/api/account-delete` (« Supprimer mon compte ») et n’est jamais envoyée au navigateur.
6. Redéployez. Le bouton « Compte » (en haut à droite) propose alors la connexion.

Facultatif : la connexion avec Google s’active dans *Authentication → Providers → Google* (identifiants OAuth créés sur Google Cloud Console). Les e-mails de connexion de Supabase sont limités à quelques envois par heure sur l’offre gratuite. Pour plus, branchez votre propre SMTP dans *Authentication → Emails*.

## Mise en ligne sur Vercel

1. Créez un compte sur [vercel.com](https://vercel.com) avec votre GitHub.
2. *Add New → Project*, importez le dépôt. Vercel détecte Vite tout seul (`vercel.json` est fourni).
3. Facultatif : dans *Settings → Environment Variables*, ajoutez `VITE_FINNHUB_KEY`.
4. *Deploy*. Chaque push sur la branche principale redéploie le site. Un nom de domaine perso s’ajoute dans *Settings → Domains*.

L’aperçu lors du partage du lien (`og:image`) utilise automatiquement l’adresse Vercel. Pour un domaine perso, ajoutez la variable `SITE_URL=https://votre-domaine.fr`. Le site s’installe aussi sur l’écran d’accueil d’un téléphone (« Ajouter à l’écran d’accueil »).

En local, `npm run dev` sert aussi les fonctions `/api` (même code que sur Vercel).

## Structure

```
api/                  fonctions serveur Vercel : quotes, history, news (Yahoo Finance), chat (Perplexity),
                      knowledge (Wikipedia/Wikidata, GDELT, SEC EDGAR — api/_lib/open.js),
                      account-delete (suppression de compte Supabase)
supabase/schema.sql   tables + sécurité par ligne des comptes
src/
  data/companies.js   univers des entreprises et domaines
  data/feed.js        store de cotations + fournisseurs API / Finnhub / DÉMO
  data/history.js     historique et actualités
  data/markets.js     horaires des bourses (marché ouvert / fermé)
  data/derived.js     capitalisation réelle ou estimée, valeurs non actualisées
  data/assistant.js   assistant local du chatbot (sans clé)
  data/account.js     compte : Supabase ou stockage local, fusion à la connexion
  data/alerts.js      évaluation des alertes de cours
  data/portfolio.js   portefeuilles virtuels (modèles, performance vs indice)
  viz/galaxy.js       visualisation D3 + GSAP (Galaxie ⇄ Orbites)
  viz/historyChart.js graphique façon app Bourse (scrubbing) + mini-courbes
  ui/glass.js         composants Liquid Glass (contrôle segmenté, reflets, ressorts)
  ui/theme.js         thème clair / sombre (mémorisé, suit le système)
  ui/watchlist.js     liste de valeurs façon app Bourse
  ui/chat.js          chatbot « Orbit » (interface, flux Perplexity, Markdown sûr)
  ui/account.js       feuille Compte : connexion, ma liste, alertes, portefeuilles, préférences
  ui/toast.js         notifications dans le site
  ui/                 bandeau, panneau, infobulle, classement, réglages, ambiance, partage
  main.js             assemblage
public/               icônes, manifeste (installation), image d’aperçu og.png
tests/                tests unitaires (formatage, données, horaires, fonctions /api)
```

Stack : Vite, D3 v7, GSAP 3, Supabase (comptes), JavaScript sans framework.
