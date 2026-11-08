// Univers des entreprises qui construisent l'IA.
// price = prix de référence (devise locale, approximatif) utilisé pour le mode démo et avant le 1er cours réel.
// symbol = symbole Yahoo Finance (bourses hors US : .PA Paris, .DE Francfort, .T Tokyo, .KS Séoul, .HK Hong Kong…).
// (pas de valeurs de Londres : cotées en pence, GBp)
// us    = coté aux États-Unis → éligible au temps réel Finnhub (WebSocket).
// cap   = capitalisation approximative en milliards USD (sert à la taille des bulles).
// vol   = volatilité annualisée approximative (sert à la simulation et à la vitesse d'orbite).
// Les valeurs de référence sont indicatives : en mode LIVE, les prix sont remplacés par les vrais cours.

export const DOMAINS = [
  { id: 'chips', name: 'Puces & Semi-conducteurs', short: 'Puces', color: '#bf5af2' },
  { id: 'hardware', name: 'Serveurs, Réseau & Stockage', short: 'Matériel', color: '#5e5ce6' },
  { id: 'energy', name: 'Énergie & Électricité', short: 'Énergie', color: '#ff9f0a' },
  { id: 'datacenters', name: 'Datacenters', short: 'Datacenters', color: '#ac8e68' },
  { id: 'cloud', name: 'Cloud & Hyperscalers', short: 'Cloud', color: '#0a84ff' },
  { id: 'software', name: 'Logiciel & Modèles', short: 'Logiciel', color: '#ff375f' },
  { id: 'data', name: 'Données & Cybersécurité', short: 'Data/Cyber', color: '#63e6e2' },
  { id: 'robotics', name: 'Robotique & Edge', short: 'Robotique', color: '#ffd60a' },
  { id: 'private', name: 'Laboratoires privés', short: 'Privés', color: '#8e8e93' },
];

const c = (ticker, name, domain, price, cap, vol, country, role) => ({
  ticker, symbol: ticker, currency: 'USD', us: domain !== 'private',
  name, domain, price, cap, vol, country, role, listed: domain !== 'private',
});

// Valeur cotée hors des États-Unis (cours via Yahoo Finance, en devise locale).
const x = (ticker, symbol, currency, name, domain, price, cap, vol, country, role) => ({
  ticker, symbol, currency, us: false,
  name, domain, price, cap, vol, country, role, listed: true,
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
  c('SMCI', 'Super Micro', 'hardware', 45, 27, 0.8, 'US', 'Serveurs GPU refroidis par liquide pour l’IA.'),

  // Infrastructure & énergie
  c('ANET', 'Arista Networks', 'hardware', 140, 175, 0.5, 'US', 'Switchs réseau haut débit des clusters IA.'),
  c('VRT', 'Vertiv', 'energy', 180, 68, 0.6, 'US', 'Refroidissement et alimentation des datacenters IA.'),
  c('ETN', 'Eaton', 'energy', 370, 145, 0.35, 'IE', 'Gestion électrique des datacenters.'),
  c('EQIX', 'Equinix', 'datacenters', 800, 78, 0.3, 'US', 'Plus grand réseau mondial de datacenters en colocation.'),
  c('DLR', 'Digital Realty', 'datacenters', 170, 58, 0.3, 'US', 'Campus de datacenters loués aux hyperscalers.'),
  c('CEG', 'Constellation Energy', 'energy', 350, 110, 0.5, 'US', 'Nucléaire : contrats d’électricité avec Microsoft et Meta.'),
  c('VST', 'Vistra', 'energy', 200, 68, 0.55, 'US', 'Production électrique pour la demande des datacenters.'),

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
  x('ABB', 'ABBN.SW', 'CHF', 'ABB', 'robotics', 55, 130, 0.3, 'CH', 'Robots industriels et automatisation.'),

  // ---------- International ----------
  x('SMSN', '005930.KS', 'KRW', 'Samsung Electronics', 'chips', 95000, 450, 0.4, 'KR', 'Mémoire HBM et DRAM, fonderie et smartphones Galaxy AI.'),
  x('HYNIX', '000660.KS', 'KRW', 'SK Hynix', 'chips', 450000, 300, 0.55, 'KR', 'Leader de la mémoire HBM qui équipe les GPU NVIDIA.'),
  x('TEL', '8035.T', 'JPY', 'Tokyo Electron', 'chips', 30000, 100, 0.45, 'JP', 'Équipements de dépôt et de gravure pour les puces avancées.'),
  x('ADVNT', '6857.T', 'JPY', 'Advantest', 'chips', 15000, 75, 0.6, 'JP', 'Testeurs de puces, indispensables pour valider les GPU IA.'),
  x('MDTK', '2454.TW', 'TWD', 'MediaTek', 'chips', 1400, 75, 0.4, 'TW', 'Puces mobiles avec NPU et ASIC IA sur mesure.'),
  x('IFX', 'IFX.DE', 'EUR', 'Infineon', 'chips', 35, 55, 0.4, 'DE', 'Électronique de puissance pour l’alimentation des datacenters.'),
  x('ASMI', 'ASM.AS', 'EUR', 'ASM International', 'chips', 500, 28, 0.45, 'NL', 'Dépôt de couches atomiques (ALD) pour les puces de pointe.'),
  c('STM', 'STMicroelectronics', 'chips', 25, 25, 0.45, 'FR', 'Microcontrôleurs et capteurs pour l’IA embarquée. Franco-italien.'),
  x('SU', 'SU.PA', 'EUR', 'Schneider Electric', 'energy', 230, 150, 0.3, 'FR', 'Énergie et refroidissement des datacenters IA.'),
  x('SIE', 'SIE.DE', 'EUR', 'Siemens', 'energy', 230, 210, 0.3, 'DE', 'Automatisation industrielle et IA industrielle.'),
  x('HTCH', '6501.T', 'JPY', 'Hitachi', 'energy', 4500, 140, 0.35, 'JP', 'Réseaux électriques et infrastructures numériques.'),
  x('LR', 'LR.PA', 'EUR', 'Legrand', 'energy', 130, 40, 0.3, 'FR', 'Équipements électriques et baies pour datacenters.'),
  c('BABA', 'Alibaba', 'cloud', 160, 380, 0.5, 'CN', 'Alibaba Cloud et modèles Qwen.'),
  x('TCEHY', '0700.HK', 'HKD', 'Tencent', 'cloud', 600, 700, 0.4, 'CN', 'Tencent Cloud et modèles Hunyuan.'),
  c('BIDU', 'Baidu', 'cloud', 120, 40, 0.5, 'CN', 'Modèles Ernie et conduite autonome Apollo.'),
  x('OVH', 'OVH.PA', 'EUR', 'OVHcloud', 'cloud', 10, 1.7, 0.6, 'FR', 'Cloud souverain européen avec offres GPU.'),
  x('CAP', 'CAP.PA', 'EUR', 'Capgemini', 'software', 140, 28, 0.35, 'FR', 'Intégration de l’IA générative dans les entreprises.'),
  x('DSY', 'DSY.PA', 'EUR', 'Dassault Systèmes', 'software', 28, 42, 0.35, 'FR', 'Jumeaux numériques et IA pour l’industrie.'),
  x('SFTBY', '9984.T', 'JPY', 'SoftBank Group', 'software', 20000, 150, 0.7, 'JP', 'Investisseur massif dans OpenAI, propriétaire d’Arm, projet Stargate.'),
  c('INFY', 'Infosys', 'software', 18, 75, 0.3, 'IN', 'Services IT et plateforme Topaz d’IA générative.'),
  x('FANUC', '6954.T', 'JPY', 'Fanuc', 'robotics', 4500, 30, 0.35, 'JP', 'Robots industriels pilotés par l’IA.'),
  x('KYNC', '6861.T', 'JPY', 'Keyence', 'robotics', 55000, 100, 0.35, 'JP', 'Capteurs et vision industrielle.'),
  x('XIAOMI', '1810.HK', 'HKD', 'Xiaomi', 'robotics', 45, 150, 0.55, 'CN', 'IA embarquée, véhicules électriques et robotique grand public.'),

  // ---------- Élargissement : tout ce qui touche à l'IA, de près ou de loin ----------
  // Puces : conception (EDA), puissance, équipements, assemblage, Chine
  c('SNPS', 'Synopsys', 'chips', 450, 85, 0.4, 'US', 'Logiciels de conception de puces (EDA) : chaque puce IA est dessinée avec.'),
  c('CDNS', 'Cadence Design', 'chips', 320, 88, 0.4, 'US', 'Conception et simulation de puces, partenaire de tous les fondeurs IA.'),
  c('TXN', 'Texas Instruments', 'chips', 165, 150, 0.35, 'US', 'Puces analogiques et de gestion d’énergie des serveurs.'),
  c('ON', 'ON Semiconductor', 'chips', 50, 21, 0.55, 'US', 'Semi-conducteurs de puissance (SiC) pour alimenter les datacenters.'),
  c('MCHP', 'Microchip', 'chips', 55, 30, 0.5, 'US', 'Microcontrôleurs pour l’IA embarquée.'),
  c('TER', 'Teradyne', 'chips', 140, 22, 0.55, 'US', 'Testeurs de puces IA et robots collaboratifs Universal Robots.'),
  c('LSCC', 'Lattice Semiconductor', 'chips', 65, 9, 0.55, 'US', 'FPGA basse consommation pour l’IA en périphérie.'),
  c('ENTG', 'Entegris', 'chips', 85, 13, 0.5, 'US', 'Matériaux ultra-purs et filtration pour la fabrication des puces.'),
  c('ONTO', 'Onto Innovation', 'chips', 130, 6.5, 0.55, 'US', 'Inspection du packaging avancé des puces IA (CoWoS, HBM).'),
  c('ASX', 'ASE Technology', 'chips', 11, 24, 0.4, 'TW', 'Leader mondial de l’assemblage et du test des puces.'),
  c('GFS', 'GlobalFoundries', 'chips', 35, 19, 0.45, 'US', 'Fonderie de puces (photonique sur silicium, RF).'),
  x('DISCO', '6146.T', 'JPY', 'Disco', 'chips', 45000, 33, 0.55, 'JP', 'Machines de découpe et de meulage des wafers, clés pour la HBM.'),
  x('LSRTC', '6920.T', 'JPY', 'Lasertec', 'chips', 20000, 12, 0.65, 'JP', 'Inspection des masques de lithographie EUV.'),
  x('SMIC', '0981.HK', 'HKD', 'SMIC', 'chips', 60, 70, 0.6, 'CN', 'Première fonderie chinoise, fabrique les puces IA domestiques.'),
  x('CAMBR', '688256.SS', 'CNY', 'Cambricon', 'chips', 1300, 75, 0.75, 'CN', 'Puces IA chinoises, alternative à NVIDIA en Chine.'),

  // Serveurs, réseau, optique, stockage
  c('DELL', 'Dell Technologies', 'hardware', 130, 90, 0.5, 'US', 'Serveurs IA PowerEdge pour entreprises et néo-clouds.'),
  c('HPE', 'Hewlett Packard Enterprise', 'hardware', 23, 30, 0.45, 'US', 'Serveurs et supercalculateurs IA (Cray), réseau Juniper.'),
  x('FOXCN', '2317.TW', 'TWD', 'Foxconn (Hon Hai)', 'hardware', 230, 105, 0.45, 'TW', 'Premier assembleur des serveurs IA de NVIDIA (GB200).'),
  x('QUANTA', '2382.TW', 'TWD', 'Quanta Computer', 'hardware', 290, 37, 0.45, 'TW', 'Serveurs IA pour les hyperscalers.'),
  x('WIWYNN', '6669.TW', 'TWD', 'Wiwynn', 'hardware', 2500, 15, 0.55, 'TW', 'Serveurs sur mesure pour Microsoft et Meta.'),
  x('ACCTON', '2345.TW', 'TWD', 'Accton', 'hardware', 900, 16, 0.5, 'TW', 'Switchs réseau pour datacenters.'),
  c('CLS', 'Celestica', 'hardware', 300, 35, 0.7, 'CA', 'Switchs et serveurs sur mesure pour les hyperscalers.'),
  c('JBL', 'Jabil', 'hardware', 210, 23, 0.45, 'US', 'Fabrication d’équipements pour datacenters IA.'),
  c('FLEX', 'Flex', 'hardware', 60, 23, 0.5, 'US', 'Alimentation et refroidissement liquide pour datacenters.'),
  c('GLW', 'Corning', 'hardware', 85, 72, 0.4, 'US', 'Fibre optique des datacenters IA.'),
  c('COHR', 'Coherent', 'hardware', 130, 20, 0.65, 'US', 'Transceivers optiques 800G / 1,6T des clusters IA.'),
  c('LITE', 'Lumentum', 'hardware', 180, 12, 0.7, 'US', 'Lasers et composants optiques des liaisons datacenters.'),
  c('CIEN', 'Ciena', 'hardware', 180, 25, 0.55, 'US', 'Réseaux optiques qui relient les datacenters IA.'),
  c('CRDO', 'Credo', 'hardware', 150, 25, 0.8, 'US', 'Câbles actifs et puces de connectivité haut débit.'),
  c('ALAB', 'Astera Labs', 'hardware', 170, 28, 0.85, 'US', 'Puces de connectivité PCIe / CXL pour serveurs IA.'),
  c('APH', 'Amphenol', 'hardware', 130, 160, 0.4, 'US', 'Connecteurs et câbles des racks IA.'),
  c('FN', 'Fabrinet', 'hardware', 400, 14, 0.6, 'US', 'Fabrication de composants optiques pour NVIDIA.'),
  c('WDC', 'Western Digital', 'hardware', 120, 42, 0.6, 'US', 'Disques durs haute capacité pour stocker les données de l’IA.'),
  c('STX', 'Seagate', 'hardware', 230, 49, 0.55, 'IE', 'Disques durs haute capacité pour les datacenters.'),
  c('PSTG', 'Pure Storage', 'hardware', 85, 28, 0.55, 'US', 'Stockage flash pour l’entraînement IA.'),
  c('NTAP', 'NetApp', 'hardware', 115, 23, 0.4, 'US', 'Stockage de données d’entreprise pour l’IA.'),
  x('FUJIKR', '5803.T', 'JPY', 'Fujikura', 'hardware', 15000, 28, 0.65, 'JP', 'Câbles à fibre optique haute densité pour datacenters.'),

  // Énergie & électricité
  c('CAT', 'Caterpillar', 'energy', 550, 260, 0.35, 'US', 'Groupes électrogènes et turbines au gaz qui alimentent les datacenters IA.'),
  c('GEV', 'GE Vernova', 'energy', 600, 165, 0.5, 'US', 'Turbines à gaz et réseaux électriques pour la demande des datacenters.'),
  x('ENR', 'ENR.DE', 'EUR', 'Siemens Energy', 'energy', 110, 100, 0.5, 'DE', 'Turbines et transformateurs pour alimenter les datacenters.'),
  c('CMI', 'Cummins', 'energy', 450, 62, 0.4, 'US', 'Générateurs de secours des datacenters.'),
  c('BE', 'Bloom Energy', 'energy', 100, 23, 0.9, 'US', 'Piles à combustible pour alimenter des datacenters sur site.'),
  c('OKLO', 'Oklo', 'energy', 100, 15, 1.0, 'US', 'Petits réacteurs nucléaires conçus pour les datacenters.'),
  c('SMR', 'NuScale Power', 'energy', 35, 10, 1.0, 'US', 'Petits réacteurs nucléaires modulaires (SMR).'),
  c('CCJ', 'Cameco', 'energy', 85, 37, 0.5, 'CA', 'Uranium pour les centrales nucléaires qui alimentent l’IA.'),
  c('TLN', 'Talen Energy', 'energy', 380, 17, 0.55, 'US', 'Centrale nucléaire qui alimente un campus de datacenters d’Amazon.'),
  c('NRG', 'NRG Energy', 'energy', 160, 31, 0.45, 'US', 'Production d’électricité pour les datacenters du Texas.'),
  c('PWR', 'Quanta Services', 'energy', 420, 62, 0.4, 'US', 'Construction des réseaux électriques qui raccordent les datacenters.'),
  c('EME', 'EMCOR', 'energy', 650, 29, 0.45, 'US', 'Travaux électriques et mécaniques des datacenters.'),
  c('HUBB', 'Hubbell', 'energy', 430, 23, 0.35, 'US', 'Équipements électriques pour réseaux et datacenters.'),
  c('NVT', 'nVent', 'energy', 100, 16, 0.45, 'US', 'Refroidissement liquide et armoires pour racks IA.'),
  x('PRYSM', 'PRY.MI', 'EUR', 'Prysmian', 'energy', 85, 28, 0.45, 'IT', 'Câbles haute tension et fibre pour les datacenters.'),
  x('NEXANS', 'NEX.PA', 'EUR', 'Nexans', 'energy', 120, 6, 0.45, 'FR', 'Câbles électriques pour raccorder les datacenters.'),
  x('MHI', '7011.T', 'JPY', 'Mitsubishi Heavy Industries', 'energy', 3800, 85, 0.5, 'JP', 'Turbines à gaz pour les centrales des datacenters.'),
  x('DELTA', '2308.TW', 'TWD', 'Delta Electronics', 'energy', 900, 75, 0.45, 'TW', 'Alimentations électriques des serveurs IA.'),

  // Datacenters
  c('IRM', 'Iron Mountain', 'datacenters', 100, 30, 0.4, 'US', 'Datacenters et stockage de données.'),
  c('APLD', 'Applied Digital', 'datacenters', 30, 8, 1.0, 'US', 'Campus de datacenters dédiés au calcul IA.'),
  c('IREN', 'IREN', 'datacenters', 55, 15, 1.0, 'AU', 'Datacenters GPU alimentés en énergies renouvelables.'),
  c('CORZ', 'Core Scientific', 'datacenters', 17, 5.5, 0.8, 'US', 'Datacenters convertis pour héberger le calcul de CoreWeave.'),
  c('WULF', 'TeraWulf', 'datacenters', 13, 5.5, 1.0, 'US', 'Datacenters IA alimentés par une énergie bas carbone.'),
  c('CIFR', 'Cipher Mining', 'datacenters', 17, 6.5, 1.0, 'US', 'Datacenters loués pour le calcul IA.'),

  // Logiciel & applications
  c('APP', 'AppLovin', 'software', 650, 220, 0.8, 'US', 'Moteur publicitaire piloté par l’IA (AXON).'),
  c('SHOP', 'Shopify', 'software', 160, 210, 0.55, 'CA', 'Assistants IA pour les marchands (Sidekick).'),
  c('INTU', 'Intuit', 'software', 660, 185, 0.35, 'US', 'Assistants IA pour la finance et la comptabilité.'),
  c('WDAY', 'Workday', 'software', 240, 64, 0.4, 'US', 'Agents IA pour les RH et la finance.'),
  c('DUOL', 'Duolingo', 'software', 300, 14, 0.6, 'US', 'Apprentissage des langues propulsé par l’IA générative.'),
  c('TEM', 'Tempus AI', 'software', 80, 14, 0.9, 'US', 'IA appliquée au diagnostic médical.'),

  // Données & cybersécurité
  c('ZS', 'Zscaler', 'data', 300, 47, 0.5, 'US', 'Sécurité cloud « zéro confiance » augmentée par l’IA.'),
  c('FTNT', 'Fortinet', 'data', 85, 65, 0.45, 'US', 'Pare-feux et cybersécurité avec IA intégrée.'),
  c('ESTC', 'Elastic', 'data', 85, 9, 0.55, 'US', 'Recherche vectorielle et observabilité pour l’IA.'),
  c('CFLT', 'Confluent', 'data', 25, 8.5, 0.6, 'US', 'Flux de données en temps réel pour les applications IA.'),

  // Robotique & edge
  c('ROK', 'Rockwell Automation', 'robotics', 350, 40, 0.35, 'US', 'Automatisation industrielle et usines intelligentes.'),
  c('MBLY', 'Mobileye', 'robotics', 15, 12, 0.6, 'IL', 'Puces et IA de conduite autonome.'),
  c('SERV', 'Serve Robotics', 'robotics', 12, 0.7, 1.1, 'US', 'Robots de livraison autonomes.'),
  x('YASKW', '6506.T', 'JPY', 'Yaskawa Electric', 'robotics', 3800, 6.5, 0.45, 'JP', 'Robots industriels et variateurs.'),

  // Laboratoires privés (valorisation uniquement, pas de cours)
  c('OPENAI', 'OpenAI', 'private', 0, 500, 0, 'US', 'ChatGPT et les modèles GPT. Valorisation privée.'),
  c('ANTHROPIC', 'Anthropic', 'private', 0, 180, 0, 'US', 'Modèles Claude. Valorisation privée.'),
  c('XAI', 'xAI', 'private', 0, 200, 0, 'US', 'Modèles Grok. Valorisation privée.'),
  c('DATABRICKS', 'Databricks', 'private', 0, 100, 0, 'US', 'Plateforme données + IA. Valorisation privée.'),
  c('MISTRAL', 'Mistral AI', 'private', 0, 14, 0, 'FR', 'Champion français des LLM open-weight. Valorisation privée.'),
  c('PERPLEXITY', 'Perplexity', 'private', 0, 20, 0, 'US', 'Moteur de réponses par IA. Valorisation privée estimée.'),
  c('SSI', 'Safe Superintelligence', 'private', 0, 32, 0, 'US', 'Laboratoire d’Ilya Sutskever. Valorisation privée estimée.'),
  c('FIGURE', 'Figure AI', 'private', 0, 39, 0, 'US', 'Robots humanoïdes pilotés par l’IA. Valorisation privée estimée.'),
  c('SCALE', 'Scale AI', 'private', 0, 29, 0, 'US', 'Données d’entraînement pour les modèles. Valorisation privée estimée.'),
  c('COHERE', 'Cohere', 'private', 0, 7, 0, 'CA', 'Modèles de langage pour les entreprises. Valorisation privée estimée.'),
  c('HF', 'Hugging Face', 'private', 0, 4.5, 0, 'US', 'Plateforme de référence des modèles open source. Valorisation privée estimée.'),
];

export const domainById = Object.fromEntries(DOMAINS.map((d) => [d.id, d]));
