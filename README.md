# SON OF A…! — Legacy Forge

Jeu d’action-RPG roguelite autonome pour navigateur. Choisissez deux origines, façonnez leur enfant, combinez leurs pouvoirs et traversez douze vagues réparties dans trois royaumes afin de bâtir une dynastie sur plusieurs générations. La version 1.1 consolide la boucle complète sur ordinateur et mobile, de l’onboarding à la reprise de mission.

## Lancer le jeu

### Méthode la plus simple

1. Décompressez l’archive.
2. Double-cliquez sur `PLAY_SON_OF_A_LEGACY_FORGE.html`.
3. Le jeu s’ouvre directement dans Edge, Chrome ou Firefox, sans installation.

Sous Windows, `LANCER_LE_JEU.bat` ouvre automatiquement ce fichier.

### Version source / PWA

Le fichier `index.html` utilise les sources séparées du dossier `src`. Pour profiter du cache hors connexion et de l’installation PWA, servez le dossier avec un serveur local ou déployez-le comme site statique.

Exemple avec Python :

```bash
python -m http.server 4173
```

Ouvrez ensuite `http://localhost:4173`.

## Commandes

| Action | Commande |
|---|---|
| Déplacement | ZQSD ou WASD |
| Visée | Souris |
| Attaque principale | Clic gauche |
| Pouvoir du parent A | 1 |
| Pouvoir du parent B | 2 |
| Pouvoir fusionné | R |
| Esquive | Espace |
| Pause | Échap |

Des commandes tactiles apparaissent automatiquement sur téléphone ou tablette, y compris en paysage. La visée tactile sélectionne la menace la plus proche.

## Contenu jouable

- 12 Origines originales et 78 associations de départ en comptant les lignées spécialisées avec deux parents identiques.
- Héritage des statistiques, couleurs, silhouettes, faiblesses, éléments et pouvoirs.
- Trois décisions d’éducation par enfant : mentor, discipline et événement fondateur.
- Mutations rares, graines déterministes et codes génétiques partageables.
- Système de combat temps réel avec attaques, esquive, statuts élémentaires, projectiles, particules et temps de recharge.
- 12 vagues, cinq archétypes ennemis, trois royaumes et trois boss : Gardien Null, Gueule Composite et Progéniteur.
- Améliorations de niveau et adaptations entre les royaumes.
- Score, combo, expérience, soins, critique, boucliers, vol de vie et Essence dynastique.
- Sauvegarde locale transactionnelle, reprise au début de la vague courante, export/import JSON validé et arbre généalogique.
- Méta-progression permanente : Vitalité, Puissance et Résonance peuvent être améliorées avec l’Essence.
- Onboarding, réglages de qualité, mouvements réduits et contraste renforcé.
- Les enfants archivés deviennent des parents jouables pour les générations suivantes.
- Mode campagne et laboratoire libre.
- Version autonome jouable hors connexion, sans ressource graphique externe.

## Sauvegarde

La progression est enregistrée dans le stockage local du navigateur. La forge est sauvegardée à chaque décision et une mission commencée reprend au début de la dernière vague sécurisée. L’écran **Arbre généalogique** permet aussi d’exporter une copie JSON validée et de la réimporter ultérieurement.

Changer de navigateur ou déplacer le fichier autonome peut créer un nouvel espace de sauvegarde ; utilisez alors l’export JSON pour conserver la dynastie.

## Structure

- `PLAY_SON_OF_A_LEGACY_FORGE.html` : édition autonome en un seul fichier.
- `index.html` : édition web/PWA.
- `styles.css` : interface et responsive.
- `src/data.js` : roster, éléments, royaumes, ennemis et améliorations.
- `src/fusion.js` : génération déterministe des héritiers.
- `src/arena.js` : moteur de combat et campagne.
- `src/render.js` : personnages et effets générés en Canvas 2D.
- `src/validation.js` : validation et migration des données persistées.
- `src/storage.js` : dynastie, checkpoints et transactions de sauvegarde.
- `src/audio.js` : effets audio synthétisés par Web Audio.
- `scripts/` : gates de test, build reproductible et génération du standalone.

## Développement et validation

Node.js est requis pour les gates de livraison :

    npm run lint
    npm test
    npm run build
    npm run qa

Le build propre est écrit dans `dist/`. Pour régénérer explicitement l’édition autonome suivie par Git :

    npm run sync:standalone

## Compatibilité

Résolution recommandée : 1280×720 ou davantage. Le jeu adapte l’interface aux écrans plus petits et propose des contrôles tactiles pour les appareils à pointeur grossier. Les graphismes sont dessinés en temps réel dans le navigateur et ne nécessitent aucune carte graphique particulière.
