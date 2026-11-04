# Wi-Fi Business — gestion des Link Zones

Cette rubrique étend l’administration existante : `/admin/wifi-business`.
La page, ses fichiers et toutes ses API exigent la session Admin existante et
ne sont pas mis en cache. Aucun compte ni mécanisme d’authentification n’est remplacé.

## Initialisation et données

Le démarrage du serveur initialise de façon additive les tables préfixées
`wifi_business_` dans le PostgreSQL déjà configuré. Il ne remplace pas la base
et ne modifie pas les produits, prix du catalogue, commandes ou utilisateurs.
Cette modification du code n’applique rien à Railway avant un déploiement autorisé.

Les 18 zones demandées sont créées une seule fois, avec un statut commercial
« À confirmer ». Leur identité d’initialisation reste stable après renommage ou
archivage : un redémarrage ne recrée pas leur ancien nom.

Les forfaits initiaux sont 2 heures, 5 heures, 24 heures, 7 jours et 30 jours.
Leurs prix sont initialement non définis. Aucun tarif ni objectif commercial
n’est inventé.

LINK ZONE TARA 1.5 possède une indication initiale de démonstration de 30 %.
Elle est clairement marquée, affichée en rouge et exclue des statistiques
globales réelles, du classement et des recettes.

## Utilisation

1. Dans **Zones**, confirmer manuellement le statut commercial de la zone.
   « Actif » n’indique jamais une disponibilité réseau.
2. Configurer les tarifs dans **Offres & prix** si les valeurs sont connues.
3. Saisir les montants réellement encaissés, le forfait et le nombre de tickets
   dans **Ventes**. La quantité vaut 1 par défaut.
4. Définir, si connus, les objectifs journaliers, hebdomadaires et mensuels par zone.
   Un champ vide reste non défini et ne produit pas de pourcentage calculé.

Les périodes et heures utilisent UTC+1, heure du Niger. Les objectifs journaliers
s’appliquent à « Aujourd’hui », les hebdomadaires à 7 jours et les mensuels à
30 jours ou au mois en cours. Une période personnalisée utilise l’objectif
journalier multiplié par son nombre de jours, seulement s’il est défini.
Le mois en cours montre la progression vers l’objectif mensuel complet.

La performance réelle est `recettes / objectif × 100` :
rouge sous 40 %, jaune de 40 % à moins de 70 %, vert à partir de 70 %.
Le cercle est limité à 100 %, mais le pourcentage réel et le dépassement
en FCFA restent visibles.

## Corrections et conservation

Une correction exige un motif et ajoute une nouvelle écriture liée à l’ancienne.
Elle ne supprime pas l’historique. Les tableaux de bord et le CSV ne comptent
que la dernière écriture effective de chaque chaîne de corrections, pour éviter
de doubler les recettes. Le registre et le journal permettent de consulter
les écritures précédentes.

Archiver une zone ne supprime ni ses ventes ni les recettes historiques.
Les changements de statut, nom, objectif et prix sont audités.

## Limites assumées

La saisie est manuelle. Aucune liaison MikroTik n’est configurée et aucun état
« connecté » ou « en ligne » n’est prétendu. Le classement mesure les recettes,
pas un bénéfice : aucune donnée de coûts n’a été fournie.

## Vérification

`npm test` exécute les contrôles existants et ceux de Wi-Fi Business.
Les tests d’intégration utilisent un schéma PostgreSQL aléatoire dans une
transaction annulée en fin de test et un compte Admin éphémère.
Ils doivent être exécutés uniquement avec la base de développement/test,
jamais avec une connexion de production.
