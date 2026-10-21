# Démarrage et installation mobile — vérification du 21 octobre 2026

## Périmètre et décisions

- Application importée conservée, sans migration ni changement Railway.
- Affichage du catalogue dès qu'il est prêt, sans durée minimale artificielle.
  La consigne ultérieure de rapidité prévaut sur l'ancienne durée fixe de
  3–5 secondes. L'animation reste visible pendant le chargement nécessaire.
- Le dessin du logo actuel n'est pas remplacé. Le WebP d'affichage est une
  copie technique de la même photographie : 65 184 → 9 452 octets.
- Une proposition vectorielle a été rendue et présentée dans la conversation :
  SVG maître, PNG HD 2400 × 2220, WebP 768 × 710 et icône proposée 512 × 512.
  Elle conserve le nom, les couleurs et les références lisibles de la source.
  Elle reste hors de l'application tant que le propriétaire ne l'approuve pas.

## Corrections mobiles complémentaires

1. Le rappel d'installation définissait un délai de 24 heures sans l'appliquer.
   Le refus est maintenant respecté entre navigations lorsque le stockage local
   est disponible. L'état installé reste respecté.
2. L'invitation utilisait la grande photo source. Elle charge maintenant la
   copie d'affichage officielle légère, sans changement d'identité.
3. Une application déjà ouverte ne recherchait un nouveau worker qu'au
   chargement initial. La vérification est aussi effectuée au retour au premier
   plan, au rétablissement du réseau et lors du contrôle périodique. Les
   vérifications simultanées partagent la même opération.
4. Un remplacement de worker pouvait être suivi d'une nouvelle invitation à
   mettre à jour alors que le contenu venait déjà d'être rechargé. Un marqueur
   de session éphémère évite cette interruption redondante.
5. La récupération manuelle avait deux chemins de navigation indépendants.
   Le délai de secours et la fin du nettoyage convergent maintenant vers une
   seule navigation. Le nettoyage n'enregistre pas de nouveau délai obligatoire,
   ne désinscrit que le worker de la racine de cette application, et ne supprime
   ni panier ni préférences ni caches d'une autre application.

Les pages partagent le script de mise à jour versionné `20261021-mobile2`,
également utilisé comme nouvelle version de worker.

## Vérifications réalisées

```sh
MOBILE_CAPTURE_DIR=generated-artifacts/mobile-startup-validation \
ADMIN_CAPTURE_DIR=generated-artifacts/mobile-startup-validation \
TRANSFER_CAPTURE_DIR=generated-artifacts/mobile-startup-validation npm test

node --test tests/pwa-recovery.test.cjs
```

- Suite complète : **36 tests réussis**, aucun échec.
- Deux tests unitaires de récupération ajoutés ensuite : **2 réussis**.
- Navigateur réel Chromium avec viewport mobile : installation d'un ancien
  worker, reprise de l'application après nouvelle version, exactement un
  rechargement, suppression de l'ancien cache de cette application seulement,
  conservation de données locales et absence de boîte de mise à jour redondante.
- Contrat de l'invitation native simulé : refus récent, rechargement, nouvelle
  éligibilité après 24 heures et état installé. Ce n'est pas une installation
  physique sur un téléphone Android.
- Démarrage normal, connexion lente, panne du script ou du logo, Réessayer,
  mouvement réduit et chemin de lancement en mode PWA vérifiés par les tests
  existants.
- Produits, prix, offres historiques, tarifs négociables, panier, commande
  WhatsApp et transferts vérifiés par la suite existante.
- Authentification et protection Admin vérifiées dans les tests PostgreSQL
  isolés, sans modification du code d'authentification dans cette partie.
- Preview redémarré, capture mobile vérifiée et démarrage sans erreur observé.
- Aucune modification des images originales, des icônes installées, des données
  catalogue, du serveur, de la base de production ou des paramètres Railway.

## Mesures à froid

Comparaison avec le code public du commit `8cc13c5`, sur le même serveur de
fichiers compressés et le même Chromium. Un échantillon par profil ; ce ne sont
pas des percentiles terrain. Réseau ralenti : 150 ms et 200 Kio/s.

| Profil | Version | Catalogue prêt JS | Chargement complet | Premier contenu peint | Ressources |
|---|---|---:|---:|---:|---:|
| Normal | Avant | 423 ms | 1 100 ms | 1 052 ms | 352 186 octets |
| Normal | Après | 553 ms | 777 ms | 628 ms | 297 156 octets |
| Ralenti | Avant | 897 ms | 2 114 ms | 628 ms | 352 186 octets |
| Ralenti | Après | 848 ms | 1 218 ms | 708 ms | 297 156 octets |

Les ressources diminuent d'environ 15,6 %. Certains marqueurs fluctuent ou
régressent dans cet échantillon ; aucune amélioration universelle n'est annoncée.
La disponibilité JavaScript et la première peinture sont des mesures distinctes.

## Preuves et limites

Le rapport HTML autonome et le GIF de capture sont livrés dans la Bibliothèque.
Les fichiers de mesure et captures restent dans
`generated-artifacts/mobile-startup-validation/`, ignoré par Git et le déploiement.
Le GIF provient d'images réellement capturées, sous réseau ralenti ; son maintien
de dernière image sert seulement à la lecture, pas à temporiser l'application.

Aucun téléphone Android physique ni installation réelle via l'interface système
n'est disponible ici. Le rendu mobile et le mode installé sont émulés.

La nouvelle version de ces ajustements reste à synchroniser et à vérifier sur
Railway dans le travail de publication prévu. Le refus Admin HTTP 401 constaté
sur le domaine officiel avant cette partie n'est pas déclaré résolu ; les
statistiques privées et l'authentification de production sont un travail distinct.
