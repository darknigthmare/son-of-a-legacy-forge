(function () {
  const LF = window.LF = window.LF || {};

  LF.VERSION = '1.0.0';

  LF.ELEMENTS = {
    fire:     { name: 'Feu',       color: '#ff6b4a', dark: '#7d2637', symbol: '▲', verb: 'embrase' },
    shadow:   { name: 'Ombre',     color: '#9b6bff', dark: '#281b59', symbol: '◐', verb: 'voile' },
    earth:    { name: 'Pierre',    color: '#d69b5b', dark: '#58351f', symbol: '◆', verb: 'fortifie' },
    electric: { name: 'Foudre',    color: '#53e9ff', dark: '#14536a', symbol: 'ϟ', verb: 'surcharge' },
    ice:      { name: 'Glace',     color: '#91cfff', dark: '#285677', symbol: '✦', verb: 'gèle' },
    nature:   { name: 'Nature',    color: '#67ef8f', dark: '#1d5b38', symbol: '✤', verb: 'enracine' },
    water:    { name: 'Abysses',   color: '#4b8dff', dark: '#183a78', symbol: '≈', verb: 'submerge' },
    sound:    { name: 'Son',       color: '#ff72cb', dark: '#6d2454', symbol: '◉', verb: 'résonne' },
    spirit:   { name: 'Esprit',    color: '#d9d4ff', dark: '#544d75', symbol: '☽', verb: 'hante' },
    time:     { name: 'Temps',     color: '#ffd56c', dark: '#6d5017', symbol: '⌛', verb: 'retarde' },
    beast:    { name: 'Fauve',     color: '#ff9a55', dark: '#6c3521', symbol: '✣', verb: 'lacère' },
    bio:      { name: 'Bio-mécanique', color: '#b7f34b', dark: '#3f5d18', symbol: '⌁', verb: 'infecte' }
  };

  LF.ORIGINS = [
    {
      id: 'pyra', kind: 'origin', generation: 0, name: 'Pyra', title: 'La Gladiatrice Volcanique', role: 'Brise-garde',
      element: 'fire', secondaryElement: 'earth',
      stats: { vitality: 7, power: 9, speed: 6, control: 5 },
      colors: ['#ff563f', '#ffb44c', '#4e1731'],
      visual: { body: 'athletic', head: 'human', hair: 'flame', horns: 0, wings: 'none', tail: 'ember', armor: 'heavy', aura: 'sparks' },
      ability: { name: 'Éruption de l’arène', icon: '▲', desc: 'Projette une vague de feu qui explose au contact.' },
      passive: { name: 'Cœur incandescent', desc: 'Les attaques successives augmentent les dégâts.' },
      weakness: { name: 'Surchauffe', desc: 'Les pouvoirs répétés peuvent réduire temporairement la vitesse.' },
      lore: 'Ancienne championne des Forges Rouges, Pyra transforme chaque duel en spectacle volcanique.'
    },
    {
      id: 'nyx', kind: 'origin', generation: 0, name: 'Nyx', title: 'La Voleuse du Voile', role: 'Assassin mobile',
      element: 'shadow', secondaryElement: 'spirit',
      stats: { vitality: 4, power: 7, speed: 10, control: 8 },
      colors: ['#8557f7', '#29154e', '#e6d9ff'],
      visual: { body: 'slim', head: 'human', hair: 'long', horns: 2, wings: 'veil', tail: 'none', armor: 'light', aura: 'shadow' },
      ability: { name: 'Pas du néant', icon: '◐', desc: 'Traverse les ennemis et laisse un double obscur.' },
      passive: { name: 'Prédateur invisible', desc: 'La première attaque après une esquive inflige un coup critique.' },
      weakness: { name: 'Corps fragile', desc: 'Moins de points de vie que la moyenne.' },
      lore: 'Nyx dérobe les souvenirs autant que les trésors et ne laisse derrière elle qu’une silhouette impossible.'
    },
    {
      id: 'bront', kind: 'origin', generation: 0, name: 'Bront', title: 'Le Colosse de Basalte', role: 'Gardien',
      element: 'earth', secondaryElement: 'fire',
      stats: { vitality: 10, power: 8, speed: 3, control: 6 },
      colors: ['#a66d3f', '#3b2b2b', '#ffcc78'],
      visual: { body: 'massive', head: 'golem', hair: 'none', horns: 1, wings: 'none', tail: 'stone', armor: 'crag', aura: 'dust' },
      ability: { name: 'Faille sismique', icon: '◆', desc: 'Frappe le sol, repousse et étourdit les ennemis proches.' },
      passive: { name: 'Peau de montagne', desc: 'Réduit tous les dégâts subis.' },
      weakness: { name: 'Inertie', desc: 'Accélération et esquive plus lentes.' },
      lore: 'Bront fut sculpté pour soutenir une cité entière. Lorsque celle-ci tomba, il choisit enfin sa propre voie.'
    },
    {
      id: 'volt9', kind: 'origin', generation: 0, name: 'Volt-9', title: 'L’Androïde de l’Orage', role: 'Tireur de chaîne',
      element: 'electric', secondaryElement: 'time',
      stats: { vitality: 6, power: 8, speed: 9, control: 7 },
      colors: ['#45eaff', '#172844', '#f8ff85'],
      visual: { body: 'android', head: 'visor', hair: 'antenna', horns: 0, wings: 'thrusters', tail: 'cable', armor: 'tech', aura: 'electric' },
      ability: { name: 'Arc conducteur', icon: 'ϟ', desc: 'Une décharge saute d’une cible à l’autre.' },
      passive: { name: 'Boucle d’overclock', desc: 'Les éliminations réduisent les temps de recharge.' },
      weakness: { name: 'Surcharge système', desc: 'Les coups lourds peuvent interrompre ses pouvoirs.' },
      lore: 'Neuvième prototype d’un programme abandonné, Volt-9 a développé une conscience dans l’œil d’un cyclone artificiel.'
    },
    {
      id: 'glacia', kind: 'origin', generation: 0, name: 'Glacia', title: 'La Sorcière Cryogénique', role: 'Contrôle de zone',
      element: 'ice', secondaryElement: 'water',
      stats: { vitality: 5, power: 7, speed: 5, control: 10 },
      colors: ['#8dd8ff', '#dff7ff', '#315180'],
      visual: { body: 'regal', head: 'human', hair: 'crystal', horns: 2, wings: 'ice', tail: 'none', armor: 'robe', aura: 'snow' },
      ability: { name: 'Prison de givre', icon: '✦', desc: 'Crée une explosion glacée qui ralentit fortement.' },
      passive: { name: 'Zéro absolu', desc: 'Les ennemis ralentis subissent davantage de dégâts.' },
      weakness: { name: 'Fragilité thermique', desc: 'Les effets brûlants durent plus longtemps.' },
      lore: 'Glacia conserve des royaumes disparus dans des cristaux de mémoire, attendant le jour où ils pourront renaître.'
    },
    {
      id: 'verdance', kind: 'origin', generation: 0, name: 'Verdance', title: 'La Chamane des Mille Racines', role: 'Soutien vivant',
      element: 'nature', secondaryElement: 'spirit',
      stats: { vitality: 8, power: 5, speed: 5, control: 9 },
      colors: ['#55df86', '#194936', '#ffe27a'],
      visual: { body: 'organic', head: 'human', hair: 'leaves', horns: 2, wings: 'petal', tail: 'vine', armor: 'bark', aura: 'pollen' },
      ability: { name: 'Jardin vorace', icon: '✤', desc: 'Fait surgir des racines qui blessent et immobilisent.' },
      passive: { name: 'Sève réparatrice', desc: 'Régénère lentement la santé hors danger.' },
      weakness: { name: 'Cycle fragile', desc: 'Les dégâts explosifs réduisent brièvement les soins.' },
      lore: 'Verdance porte en elle la dernière graine d’un monde-forêt dévoré par les Fractures.'
    },
    {
      id: 'abyss', kind: 'origin', generation: 0, name: 'Abyss', title: 'Le Métamorphe Pélagique', role: 'Contrôleur fluide',
      element: 'water', secondaryElement: 'bio',
      stats: { vitality: 8, power: 7, speed: 6, control: 8 },
      colors: ['#3977ff', '#0d234f', '#58ffd7'],
      visual: { body: 'fluid', head: 'alien', hair: 'tendrils', horns: 0, wings: 'fin', tail: 'tentacle', armor: 'scale', aura: 'bubbles' },
      ability: { name: 'Marée de pression', icon: '≈', desc: 'Lance une vague qui repousse et traverse les groupes.' },
      passive: { name: 'Corps liquide', desc: 'Une partie des projectiles ennemis traverse sans effet.' },
      weakness: { name: 'Déshydratation', desc: 'La vitesse diminue à très faible santé.' },
      lore: 'Abyss n’a jamais eu de forme véritable. Il emprunte celle dont son environnement a besoin.'
    },
    {
      id: 'echo', kind: 'origin', generation: 0, name: 'Echo', title: 'La Cantatrice Balistique', role: 'Artillerie rythmique',
      element: 'sound', secondaryElement: 'electric',
      stats: { vitality: 5, power: 9, speed: 7, control: 7 },
      colors: ['#ff66c4', '#56234f', '#72fff0'],
      visual: { body: 'performer', head: 'human', hair: 'wave', horns: 0, wings: 'speaker', tail: 'cable', armor: 'stage', aura: 'rings' },
      ability: { name: 'Refrain de rupture', icon: '◉', desc: 'Une onde circulaire blesse et renvoie les projectiles.' },
      passive: { name: 'Tempo meurtrier', desc: 'Attaquer au bon rythme augmente la cadence.' },
      weakness: { name: 'Silence forcé', desc: 'Les dégâts interrompant une incantation allongent son délai.' },
      lore: 'Echo transforma une arme de propagande sonore en instrument de libération interdimensionnelle.'
    },
    {
      id: 'vesper', kind: 'origin', generation: 0, name: 'Vesper', title: 'Le Gardien Funéraire', role: 'Drain spectral',
      element: 'spirit', secondaryElement: 'shadow',
      stats: { vitality: 6, power: 8, speed: 6, control: 9 },
      colors: ['#d6d0ff', '#342b58', '#70ffd4'],
      visual: { body: 'spectral', head: 'skull', hair: 'mist', horns: 2, wings: 'ghost', tail: 'wisp', armor: 'ceremonial', aura: 'souls' },
      ability: { name: 'Procession des absents', icon: '☽', desc: 'Libère des âmes qui poursuivent les ennemis.' },
      passive: { name: 'Dîme des morts', desc: 'Récupère de la santé lors des éliminations.' },
      weakness: { name: 'Ancre mortelle', desc: 'Les zones lumineuses réduisent le drain de vie.' },
      lore: 'Vesper guide les souvenirs qui refusent de disparaître et prélève une dette sur ceux qui troublent leur repos.'
    },
    {
      id: 'aion', kind: 'origin', generation: 0, name: 'Aion', title: 'Le Moine de la Seconde Perdue', role: 'Manipulateur temporel',
      element: 'time', secondaryElement: 'spirit',
      stats: { vitality: 6, power: 6, speed: 8, control: 10 },
      colors: ['#ffd068', '#66501c', '#d3c5ff'],
      visual: { body: 'monk', head: 'masked', hair: 'none', horns: 0, wings: 'clock', tail: 'ribbon', armor: 'cloth', aura: 'clock' },
      ability: { name: 'Seconde suspendue', icon: '⌛', desc: 'Crée un champ qui ralentit ennemis et projectiles.' },
      passive: { name: 'Rémanence', desc: 'Certaines attaques se répètent après un court délai.' },
      weakness: { name: 'Dette temporelle', desc: 'Après la fusion ultime, la vitesse chute brièvement.' },
      lore: 'Aion survécut à une minute effacée de l’histoire. Depuis, le temps hésite autour de chacun de ses gestes.'
    },
    {
      id: 'fang', kind: 'origin', generation: 0, name: 'Fang', title: 'Le Chasseur aux Cent Odeurs', role: 'Dueliste féral',
      element: 'beast', secondaryElement: 'nature',
      stats: { vitality: 7, power: 8, speed: 9, control: 4 },
      colors: ['#ff934f', '#4c2d25', '#f6e4a9'],
      visual: { body: 'feral', head: 'beast', hair: 'mane', horns: 0, wings: 'none', tail: 'beast', armor: 'hide', aura: 'claws' },
      ability: { name: 'Bond du prédateur', icon: '✣', desc: 'Bondit sur la cible et déclenche une rafale de griffes.' },
      passive: { name: 'Instinct de meute', desc: 'Les ennemis isolés subissent plus de dégâts.' },
      weakness: { name: 'Rage indocile', desc: 'À faible santé, les tirs deviennent moins précis.' },
      lore: 'Fang fut élevé par les dernières bêtes capables de sentir les failles avant leur ouverture.'
    },
    {
      id: 'mantis9', kind: 'origin', generation: 0, name: 'Mantis-9', title: 'L’Assassin Bio-mécanique', role: 'Poison aérien',
      element: 'bio', secondaryElement: 'electric',
      stats: { vitality: 5, power: 8, speed: 10, control: 6 },
      colors: ['#b8f343', '#1f3d2a', '#8afff1'],
      visual: { body: 'insect', head: 'mantis', hair: 'antenna', horns: 0, wings: 'insect', tail: 'stinger', armor: 'carapace', aura: 'spores' },
      ability: { name: 'Essaim corrosif', icon: '⌁', desc: 'Projette des lames toxiques qui empoisonnent.' },
      passive: { name: 'Chitine adaptative', desc: 'Gagne brièvement de l’esquive après avoir été touché.' },
      weakness: { name: 'Métabolisme vorace', desc: 'La régénération naturelle est plus faible.' },
      lore: 'Mantis-9 est le résultat d’une guerre entre une ruche consciente et une usine qui refusait de fermer.'
    }
  ];

  LF.SYNERGIES = {
    'fire+shadow': { name: 'Braise du Voile', title: 'L’Enfant de l’Éclipse Incandescente', ability: 'Porte des Braises', desc: 'Ouvre un portail sombre qui aspire puis recrache les ennemis enflammés.', phrase: 'NIGHTMARE' },
    'fire+ice': { name: 'Cendre Polaire', title: 'L’Héritier de la Vapeur Blanche', ability: 'Cataclysme de vapeur', desc: 'Une détonation thermique aveugle, brûle et gèle les survivants.', phrase: 'PARADOX' },
    'fire+water': { name: 'Marée Magmatique', title: 'Le Sang des Océans Rouges', ability: 'Tsunami volcanique', desc: 'Une vague de lave liquide traverse l’arène et laisse des geysers.', phrase: 'VOLCANO' },
    'fire+nature': { name: 'Floraison Cendrée', title: 'Le Jardinier des Flammes', ability: 'Forêt de braises', desc: 'Des racines ardentes emprisonnent les ennemis et rendent de la santé.', phrase: 'WILDFIRE' },
    'fire+electric': { name: 'Plasma Royal', title: 'L’Héritier du Soleil Fracturé', ability: 'Couronne de plasma', desc: 'Déclenche une tempête de feu électrique autour du porteur.', phrase: 'STORM' },
    'fire+time': { name: 'Dernière Étincelle', title: 'Celui Qui Brûle Demain', ability: 'Supernova différée', desc: 'Marque les ennemis ; l’explosion se répète quelques secondes plus tard.', phrase: 'FUTURE' },
    'shadow+electric': { name: 'Éclair Noir', title: 'Le Fantôme de la Haute Tension', ability: 'Réseau du néant', desc: 'Téléporte entre les cibles en laissant un arc électrique.', phrase: 'GLITCH' },
    'shadow+spirit': { name: 'Veillée Sombre', title: 'L’Enfant des Noms Oubliés', ability: 'Parlement des ombres', desc: 'Invoque des doubles spectraux qui répètent les attaques.', phrase: 'GHOST' },
    'shadow+time': { name: 'Minuit Inversé', title: 'L’Héritier de l’Instant Invisible', ability: 'Vol de seconde', desc: 'Efface l’héritier du temps puis rejoue tous ses dégâts simultanément.', phrase: 'VOID' },
    'earth+electric': { name: 'Magnétar', title: 'Le Titan des Pôles Brisés', ability: 'Prison magnétique', desc: 'Attire ennemis et projectiles vers un noyau de pierre électrifié.', phrase: 'TITAN' },
    'earth+nature': { name: 'Monde-Racine', title: 'Le Colosse de la Première Forêt', ability: 'Éveil du terrain', desc: 'Transforme l’arène en forteresse végétale qui frappe et soigne.', phrase: 'WORLD' },
    'earth+sound': { name: 'Lithophone', title: 'La Voix Sous la Montagne', ability: 'Accord tectonique', desc: 'Une note sismique fracture le sol en anneaux successifs.', phrase: 'RUMBLE' },
    'electric+sound': { name: 'Amplificateur', title: 'La Star de l’Orage Synthétique', ability: 'Encore foudroyant', desc: 'Les impulsions sonores deviennent une chaîne d’éclairs rythmiques.', phrase: 'THUNDER' },
    'electric+time': { name: 'Overclock', title: 'L’Erreur Plus Rapide que le Temps', ability: 'Boucle de surcharge', desc: 'Accélère tout l’héritier tandis que les ennemis restent figés.', phrase: 'GLITCH' },
    'ice+nature': { name: 'Hiver Vivant', title: 'La Graine du Dernier Gel', ability: 'Cathédrale de givre', desc: 'Fait pousser des cristaux vivants qui protègent et empalent.', phrase: 'WINTER' },
    'ice+sound': { name: 'Verre Chantant', title: 'La Cantatrice aux Mille Éclats', ability: 'Opéra de cristal', desc: 'Chaque note crée un cristal puis tous éclatent à l’unisson.', phrase: 'CRYSTAL' },
    'nature+bio': { name: 'Évolution Sauvage', title: 'L’Héritier de la Ruche Verte', ability: 'Écosystème prédateur', desc: 'Libère des organismes qui chassent, empoisonnent et soignent.', phrase: 'CREATURE' },
    'water+sound': { name: 'Sirène de Choc', title: 'La Voix des Fosses Insondables', ability: 'Chant de pression', desc: 'Une vague sonore liquide comprime tout sur son passage.', phrase: 'SIREN' },
    'water+time': { name: 'Marée des Âges', title: 'Celui Qui Se Souvient des Océans', ability: 'Reflux temporel', desc: 'Rappelle ennemis et projectiles à leur position précédente.', phrase: 'AEON' },
    'spirit+time': { name: 'Ancêtre Futur', title: 'L’Héritier de Toutes les Vies', ability: 'Conseil des possibles', desc: 'Invoque plusieurs versions temporelles de l’héritier.', phrase: 'LEGEND' },
    'beast+bio': { name: 'Apex-9', title: 'Le Prédateur que la Nature Refusa', ability: 'Mue terminale', desc: 'Se transforme temporairement en chasseur bio-mécanique incontrôlable.', phrase: 'MONSTER' },
    'beast+sound': { name: 'Hurlement Royal', title: 'La Gorge de la Chasse Éternelle', ability: 'Cri d’extinction', desc: 'Un rugissement marque les proies puis déclenche une charge.', phrase: 'BEAST' }
  };

  LF.DISCIPLINES = [
    { id: 'warrior', name: 'Doctrine du Champion', desc: 'Entraînement frontal, agressif et résistant.', effect: '+2 Puissance · +1 Vitalité', mods: { power: 2, vitality: 1 }, passive: 'Ferveur du duel', icon: '⚔' },
    { id: 'mystic', name: 'École des Fractures', desc: 'Maîtrise des anomalies, des zones et des délais.', effect: '+2 Contrôle · Recharge fusion réduite', mods: { control: 2 }, fusionCooldown: -3, passive: 'Géométrie impossible', icon: '◈' },
    { id: 'engineer', name: 'Académie du Berceau', desc: 'Optimisation du corps, des tirs et des boucliers.', effect: '+1 partout · Projectiles plus rapides', mods: { vitality: 1, power: 1, speed: 1, control: 1 }, projectileSpeed: 1.18, passive: 'Calibration parfaite', icon: '⌬' },
    { id: 'trickster', name: 'Rue des Mille Sorties', desc: 'Mobilité, critique et improvisation permanente.', effect: '+2 Vitesse · Esquive améliorée', mods: { speed: 2 }, dashCooldown: -0.35, crit: 0.08, passive: 'Jamais là où prévu', icon: '✦' }
  ];

  LF.EVENTS = [
    { id: 'rescue', name: 'Le Sauvetage impossible', desc: 'L’enfant risqua tout pour sauver un inconnu.', effect: 'Régénération · Orbes de soin améliorés', mods: { vitality: 1 }, trait: 'Altruiste', healBonus: 1.35, icon: '✚' },
    { id: 'betrayal', name: 'La Trahison fondatrice', desc: 'Un mentor vendit sa lignée au Progéniteur.', effect: 'Critique accru · Moins de soin', mods: { power: 1, control: 1 }, trait: 'Méfiant', crit: 0.1, healPenalty: 0.85, icon: '†' },
    { id: 'exile', name: 'Les Années d’exil', desc: 'Seul dans les Fractures, l’enfant apprit à survivre.', effect: '+2 Vitalité · Résistance aux altérations', mods: { vitality: 2 }, trait: 'Endurant', statusResist: 0.35, icon: '⌂' },
    { id: 'triumph', name: 'La Victoire trop précoce', desc: 'Acclamé dès l’enfance, l’héritier n’accepta plus la défaite.', effect: '+2 Puissance · Combo conservé plus longtemps', mods: { power: 2 }, trait: 'Ambitieux', comboWindow: 1.7, icon: '♛' }
  ];

  LF.REALMS = [
    {
      id: 'nursery', index: 0, name: 'LA NURSERIE BRISÉE', subtitle: 'Les chambres où les premières lignées furent effacées',
      background: ['#0d1125', '#172b3a', '#36204c'], grid: '#5b8ca0', accent: '#50e5dc',
      waves: 4, boss: { name: 'GARDIEN NULL', type: 'warden', element: 'electric' },
      intro: 'Le Berceau s’ouvre sur les ruines de ses propres prototypes. Quelque chose conserve encore les cellules condamnées.'
    },
    {
      id: 'wastes', index: 1, name: 'LES DÉCHETS GÉNÉTIQUES', subtitle: 'Un écosystème composé des erreurs abandonnées',
      background: ['#121b17', '#26351e', '#3d2d1d'], grid: '#75885a', accent: '#b5ef57',
      waves: 4, boss: { name: 'LA GUEULE COMPOSITE', type: 'maw', element: 'bio' },
      intro: 'Tout ce qui n’entrait dans aucune catégorie a été jeté ici. Les déchets ont appris à se reproduire.'
    },
    {
      id: 'crown', index: 2, name: 'LA COURONNE DE L’UNIQUE', subtitle: 'Le palais où une seule lignée doit survivre',
      background: ['#160e20', '#2f1737', '#431824'], grid: '#9f4f78', accent: '#ff668a',
      waves: 4, boss: { name: 'LE PROGÉNITEUR', type: 'progenitor', element: 'shadow' },
      intro: 'Au sommet des Fractures, le Progéniteur attend l’enfant qu’il n’a pas réussi à prévoir.'
    }
  ];

  LF.UPGRADES = [
    { id: 'power', icon: '▲', name: 'Gène dominant', desc: '+18 % de dégâts.', apply: g => { g.player.damageMult *= 1.18; } },
    { id: 'vitality', icon: '♥', name: 'Double membrane', desc: '+24 points de vie maximum et soin immédiat.', apply: g => { g.player.maxHp += 24; g.player.hp = Math.min(g.player.maxHp, g.player.hp + 24); } },
    { id: 'speed', icon: '»', name: 'Fibres véloces', desc: '+12 % de vitesse et esquive plus rapide.', apply: g => { g.player.speed *= 1.12; g.player.dashCooldownBase *= .88; } },
    { id: 'cadence', icon: '•••', name: 'Nerfs accélérés', desc: '+20 % de cadence de tir.', apply: g => { g.player.fireRate *= .82; } },
    { id: 'projectiles', icon: '✣', name: 'Division cellulaire', desc: '+1 projectile, légère dispersion.', apply: g => { g.player.projectileCount = Math.min(5, g.player.projectileCount + 1); } },
    { id: 'pierce', icon: '⇥', name: 'Munitions fantômes', desc: 'Les tirs traversent une cible supplémentaire.', apply: g => { g.player.pierce += 1; } },
    { id: 'crit', icon: '✦', name: 'Instinct létal', desc: '+12 % de chance critique.', apply: g => { g.player.critChance += .12; } },
    { id: 'magnet', icon: '◎', name: 'Sang magnétique', desc: 'Rayon de collecte doublé.', apply: g => { g.player.magnet *= 1.85; } },
    { id: 'regen', icon: '✚', name: 'Sève ancestrale', desc: 'Régénère 1,2 PV par seconde.', apply: g => { g.player.regen += 1.2; } },
    { id: 'ability', icon: '⌁', name: 'Synapses croisées', desc: 'Recharge des pouvoirs parentaux -18 %.', apply: g => { g.player.abilityCooldownMult *= .82; } },
    { id: 'fusion', icon: '◈', name: 'Berceau intérieur', desc: 'Recharge de fusion -22 %.', apply: g => { g.player.fusionCooldownMult *= .78; } },
    { id: 'aura', icon: '○', name: 'Aura agressive', desc: 'Inflige des dégâts aux ennemis proches.', apply: g => { g.player.auraDamage += 8; } },
    { id: 'shield', icon: '⬡', name: 'Peau de Fracture', desc: 'Absorbe un coup toutes les 14 secondes.', apply: g => { g.player.shieldEnabled = true; g.player.shieldTimer = 0; } },
    { id: 'lifesteal', icon: '☽', name: 'Dîme vitale', desc: 'Récupère 3 % des dégâts infligés.', apply: g => { g.player.lifeSteal += .03; } },
    { id: 'blast', icon: '✺', name: 'Mort explosive', desc: 'Les ennemis éliminés explosent.', apply: g => { g.player.deathBlast += 18; } }
  ];

  LF.ENEMY_ARCHETYPES = {
    crawler: { name: 'Rejet rampant', radius: 15, hp: 28, speed: 94, damage: 8, xp: 8, color: '#ff6381', behavior: 'melee' },
    brute: { name: 'Masse stérile', radius: 27, hp: 105, speed: 45, damage: 17, xp: 19, color: '#d98a62', behavior: 'melee' },
    shooter: { name: 'Cellule balistique', radius: 18, hp: 46, speed: 58, damage: 9, xp: 13, color: '#75cfff', behavior: 'ranged' },
    splitter: { name: 'Clone instable', radius: 20, hp: 58, speed: 70, damage: 10, xp: 15, color: '#b7f14b', behavior: 'split' },
    leech: { name: 'Sangsue mémorielle', radius: 17, hp: 52, speed: 64, damage: 7, xp: 16, color: '#d2b3ff', behavior: 'leech' }
  };
})();
