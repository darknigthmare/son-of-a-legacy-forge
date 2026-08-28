# Rapport de validation — Legacy Forge 1.0

Validation automatisée réalisée sous Chromium headless en 1440×1000 et 1280×800.

## Parcours vérifiés

- Chargement de l’écran d’accueil et rendu Canvas.
- Affichage des 12 Origines.
- Sélection des deux parents et remplacement des emplacements A/B.
- Sélection des trois décisions d’éducation.
- Génération déterministe de l’héritier.
- Encodage puis décodage du code génétique `SOA1-`.
- Lancement de l’arène et activation des commandes 1, 2 et R.
- Apparition et élimination d’une vague complète.
- Apparition du Gardien Null et exécution de son comportement.
- Simulation intégrale des 12 vagues et des trois boss.
- Écran de victoire et attribution de l’Essence.
- Archivage dans l’arbre généalogique.
- Réutilisation d’un héritier comme parent.
- Création correcte d’un descendant de génération 2.

## Résultat

- Aucune erreur JavaScript non gérée détectée pendant les parcours.
- Les trois boss enregistrés à la fin de la campagne : Gardien Null, Gueule Composite et Progéniteur.
- Sauvegarde, import/export et dynastie fonctionnels lors des tests.
