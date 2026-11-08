// Univers des entreprises qui construisent l'IA.
// price = prix de référence (USD, approximatif) utilisé pour le mode démo et avant le 1er tick live.
// cap   = capitalisation approximative en milliards USD (sert à la taille des bulles).
// vol   = volatilité annualisée approximative (sert à la simulation et à la vitesse d'orbite).
// Les valeurs de référence sont indicatives : en mode LIVE, les prix sont remplacés par les vrais cours.

export const DOMAINS = [
  { id: 'chips', name: 'Puces & Semi-conducteurs', short: 'Puces', color: '#7c5cff' },
  { id: 'infra', name: 'Infrastructure & Énergie', short: 'Infra', color: '#ff8a3d' },
  { id: 'cloud', name: 'Cloud & Hyperscalers', short: 'Cloud', color: '#2ec5ff' },
  { id: 'software', name: 'Logiciel & Modèles', short: 'Logiciel', color: '#ff4fa3' },
  { id: 'data', name: 'Données & Cybersécurité', short: 'Data/Cyber', color: '#3dffb5' },
  { id: 'robotics', name: 'Robotique & Edge', short: 'Robotique', color: '#ffd23d' },
  { id: 'private', name: 'Laboratoires privés', short: 'Privés', color: '#b0b8d0' },
];

const c = (ticker, name, domain, price, cap, vol, country, role) => ({
  ticker, name, domain, price, cap, vol, country, role, listed: domain !== 'private',
});

export const COMPANIES = [
  // Puces & semi-conducteurs
  c('NVDA', 'NVIDIA', 'chips', 185, 4500, 0.5, 'US', 'GPU H100/B200 et CUDA : le moteur de quasiment tout l’entraînement IA.'),
  c('AVGO', 'Broadcom', 'chips', 340, 1600, 0.45, 'US', 'Puces IA sur mesure (TPU Google, Meta) et réseau Ethernet des datacenters.'),
  c('TSM', 'TSMC', 'chips', 290, 1500, 0.4, 'TW', 'Fonderie qui fabrique les puces de NVIDIA, AMD, Apple et Broadcom.'),
  c('AMD', 'AMD', 'chips', 240, 390, 0.55, 'US', 'GPU Instinct MI300/MI350, alternative principale à NVIDIA.'),
  c('ASML', 'ASML', 'chips', 1000, 390, 0.4, 'NL', 'Seul fabricant mondial des machines de lithographie EUV.'),
  c('MU', 'Micron', 'chips', 220, 245, 0.55, 'US', 'Mémoire HBM indispensable aux accélérateurs IA.'),
  c('QCOM', 'Qualcomm', 'chips', 170, 185, 0.35, 'US', 'IA embarquée sur smartphones et PC (NPU Snapdragon).'),
  c('ARM', 'Arm Holdings', 'chips', 160, 170, 0.6, 'GB', 'Architecture CPU utilisée dans les puces IA cloud et mobiles.'),
  c('AMAT', 'Applied Materials', 'chips', 230, 185, 0.4, 'US', 'Équipements de dépôt et gravure pour les puces avancées.'),
  c('LRCX', 'Lam Research', 'chips', 150, 190, 0.45, 'US', 'Équipements de gravure, critiques pour la HBM et le 3D.'),
  c('KLAC', 'KLA', 'chips', 1150, 150, 0.4, 'US', 'Inspection et métrologie des wafers.'),
  c('INTC', 'Intel', 'chips', 38, 170, 0.5, 'US', 'CPU Xeon, accélérateurs Gaudi et fonderie Intel Foundry.'),
  c('MRVL', 'Marvell', 'chips', 90, 78, 0.6, 'US', 'Puces custom et optique pour l’interconnexion des clusters IA.'),
  c('SMCI', 'Super Micro', 'chips', 45, 27, 0.8, 'US', 'Serveurs GPU refroidis par liquide pour l’IA.'),

  // Infrastructure & énergie
  c('ANET', 'Arista Networks', 'infra', 140, 175, 0.5, 'US', 'Switchs réseau haut débit des clusters IA.'),
  c('VRT', 'Vertiv', 'infra', 180, 68, 0.6, 'US', 'Refroidissement et alimentation des datacenters IA.'),
  c('ETN', 'Eaton', 'infra', 370, 145, 0.35, 'IE', 'Gestion électrique des datacenters.'),
  c('EQIX', 'Equinix', 'infra', 800, 78, 0.3, 'US', 'Plus grand réseau mondial de datacenters en colocation.'),
  c('DLR', 'Digital Realty', 'infra', 170, 58, 0.3, 'US', 'Campus de datacenters loués aux hyperscalers.'),
  c('CEG', 'Constellation Energy', 'infra', 350, 110, 0.5, 'US', 'Nucléaire : contrats d’électricité avec Microsoft et Meta.'),
  c('VST', 'Vistra', 'infra', 200, 68, 0.55, 'US', 'Production électrique pour la demande des datacenters.'),

  // Cloud & hyperscalers
  c('MSFT', 'Microsoft', 'cloud', 500, 3700, 0.3, 'US', 'Azure, partenaire d’OpenAI, Copilot.'),
  c('GOOGL', 'Alphabet', 'cloud', 280, 3400, 0.35, 'US', 'Google Cloud, TPU, DeepMind et Gemini.'),
  c('AMZN', 'Amazon', 'cloud', 245, 2600, 0.35, 'US', 'AWS, puces Trainium et investisseur d’Anthropic.'),
  c('ORCL', 'Oracle', 'cloud', 240, 680, 0.55, 'US', 'OCI : capacités GPU massives (Stargate).'),
  c('IBM', 'IBM', 'cloud', 300, 280, 0.3, 'US', 'watsonx et cloud hybride pour l’entreprise.'),
  c('CRWV', 'CoreWeave', 'cloud', 110, 55, 1.0, 'US', 'Néo-cloud spécialisé dans le calcul GPU.'),
  c('NBIS', 'Nebius', 'cloud', 100, 25, 0.9, 'NL', 'Cloud GPU européen dédié à l’IA.'),

  // Logiciel & modèles
  c('META', 'Meta', 'software', 620, 1550, 0.4, 'US', 'Modèles Llama et IA intégrée à ses applications.'),
  c('PLTR', 'Palantir', 'software', 180, 420, 0.65, 'US', 'Plateforme AIP pour l’IA en entreprise et défense.'),
  c('CRM', 'Salesforce', 'software', 245, 235, 0.35, 'US', 'Agents IA Agentforce pour le CRM.'),
  c('NOW', 'ServiceNow', 'software', 850, 175, 0.4, 'US', 'Automatisation des workflows par l’IA.'),
  c('ADBE', 'Adobe', 'software', 340, 145, 0.35, 'US', 'IA générative Firefly pour la création.'),
  c('SAP', 'SAP', 'software', 250, 290, 0.3, 'DE', 'IA Joule intégrée aux ERP.'),
  c('SNOW', 'Snowflake', 'software', 250, 85, 0.55, 'US', 'Données et IA dans le cloud (Cortex).'),
  c('PATH', 'UiPath', 'software', 14, 7.5, 0.6, 'US', 'Automatisation agentique.'),
  c('AI', 'C3.ai', 'software', 17, 2.3, 0.8, 'US', 'Applications IA pour l’industrie.'),
  c('SOUN', 'SoundHound', 'software', 14, 5.5, 1.0, 'US', 'IA vocale conversationnelle.'),

  // Données & cybersécurité
  c('CRWD', 'CrowdStrike', 'data', 520, 130, 0.45, 'US', 'Cybersécurité pilotée par l’IA (Charlotte AI).'),
  c('PANW', 'Palo Alto Networks', 'data', 205, 140, 0.4, 'US', 'Sécurité réseau et cloud augmentée par l’IA.'),
  c('NET', 'Cloudflare', 'data', 220, 77, 0.6, 'US', 'Inférence IA en périphérie (Workers AI).'),
  c('DDOG', 'Datadog', 'data', 160, 56, 0.5, 'US', 'Observabilité des applications et des LLM.'),
  c('MDB', 'MongoDB', 'data', 340, 28, 0.6, 'US', 'Base de données vectorielle pour les apps IA.'),

  // Robotique & edge
  c('TSLA', 'Tesla', 'robotics', 440, 1450, 0.65, 'US', 'Conduite autonome FSD, robot Optimus, supercalculateur.'),
  c('ISRG', 'Intuitive Surgical', 'robotics', 540, 195, 0.35, 'US', 'Robots chirurgicaux da Vinci.'),
  c('AAPL', 'Apple', 'robotics', 270, 4000, 0.3, 'US', 'Apple Intelligence et puces Neural Engine embarquées.'),
  c('SYM', 'Symbotic', 'robotics', 60, 35, 0.9, 'US', 'Robotique d’entrepôt pilotée par l’IA.'),
  c('ABBNY', 'ABB', 'robotics', 70, 130, 0.3, 'CH', 'Robots industriels et automatisation.'),

  // Laboratoires privés (valorisation uniquement, pas de cours)
  c('OPENAI', 'OpenAI', 'private', 0, 500, 0, 'US', 'ChatGPT et les modèles GPT. Valorisation privée.'),
  c('ANTHROPIC', 'Anthropic', 'private', 0, 180, 0, 'US', 'Modèles Claude. Valorisation privée.'),
  c('XAI', 'xAI', 'private', 0, 200, 0, 'US', 'Modèles Grok. Valorisation privée.'),
  c('DATABRICKS', 'Databricks', 'private', 0, 100, 0, 'US', 'Plateforme données + IA. Valorisation privée.'),
  c('MISTRAL', 'Mistral AI', 'private', 0, 14, 0, 'FR', 'Champion français des LLM open-weight. Valorisation privée.'),
];

export const domainById = Object.fromEntries(DOMAINS.map((d) => [d.id, d]));
