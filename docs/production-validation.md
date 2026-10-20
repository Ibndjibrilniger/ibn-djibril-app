# Vérification réelle de production

## Constats du 20 octobre 2026

La branche GitHub `main` et `/api/app-version` ont été contrôlées séparément :
elles correspondent au même commit `1e0c2ae`, contenant les améliorations
mobiles du commit `1b71ca8`. Le SHA-256 du script de lancement publié correspond
exactement au fichier local. Le Service Worker publié annonce `startup1`.
Il n'y a donc plus, au moment de ce contrôle, de désynchronisation constatée
entre cette branche et le serveur public.

L'API publique GitHub fournit également un statut Railway `success` pour
cette version, contexte `Ibn_Djibril Niger Tech - ibn-djibril-app`, description
`Success - ibndjibrilnigertech.com`, et un statut de déploiement production
`success`. Cela confirme le résultat du déploiement de **cette version**, pas
la qualité de toutes ses fonctionnalités, ni le résultat d'un commit ultérieur.
Les journaux internes Railway ne sont pas accessibles sans connexion autorisée.
Aucun hébergement Replit n'a été publié.

## Défaut précisément reproduit

Sur le navigateur mobile simulé utilisant le vrai domaine :

- le splash est visible ;
- `.ibn-splash-loader` a `display: none` ;
- la règle `:has(.ibn-splash-progress)` masque cette barre animée ;
- le `progress` indéterminé personnalisé a `animation-name: none` ;
- `getAnimations({subtree:true})` retourne zéro animation.

La cause de l'absence d'animation est donc une règle CSS, pas une preuve de
panne PostgreSQL, de fichier absent ou d'ancien cache.

Correction ciblée : conserver visible la barre animée existante ; rendre le
`progress` accessible mais visuellement masqué ; conserver les états d'erreur,
le retrait dès disponibilité et les préférences de mouvement réduit.
La version du CSS et celle du worker passent à `startup2`.

La vidéo fournie montre le lancement de MyNITA. Elle sert de référence au
principe de lancement et ne prouve pas une panne de l'application contrôlée.
Le PNG de 192 px fourni est exactement identique (SHA-256) à l'icône officielle
déjà présente : aucun remplacement graphique n'est nécessaire ni autorisé.

## Contrôles exécutés sur le vrai domaine

Chromium mobile Android simulé, 390×844, nouveau contexte pour chaque profil.
Ce n'est pas un essai sur téléphone Android physique.

| Mesure | Connexion normale | Connexion limitée |
| --- | ---: | ---: |
| Catalogue utilisable | 0,91 s | 1,00 s |
| Événement de chargement complet | 1,12 s | 2,22 s |
| Cartes catalogue présentes | 35 | 35 |
| Erreurs JavaScript non interceptées | 0 | 0 |

Connexion limitée : latence 150 ms, débit descendant 200 Kio/s, montant
75 Kio/s, appliqués par DevTools. Mesures ponctuelles depuis l'environnement
de test, pas des percentiles du réseau mobile au Niger. Certaines images
différées peuvent se charger après `load`.

Contrôles fonctionnels :

- logo léger disponible et décodé ;
- catalogue et fenêtre des services financiers réellement ouverts ;
- huit services affichés : MyNITA, AMANATA, Airtel Money, Moov Flooz, Wave,
  Orange Money, Coris Money et Zamani Cash ;
- aucun identifiant statistique et aucun POST d'activité avant consentement ;
- après acceptation : trois réponses HTTP 204 avec
  `X-Activity-Status: recorded`, chacune indiquant deux événements insérés ;
- reçu du navigateur également à `recorded` ;
- API Admin et diagnostic non authentifiés : 401 ;
- page Admin non authentifiée : redirection vers connexion ;
- Service Worker réellement enregistré et contrôlant la page ;
- hors ligne : page explicite 503 avec lien Réessayer ;
- après reconnexion : accueil utilisable ;
- CSS public : `Cache-Control: no-store` et compression gzip.

Les reçus SQL sont émis après la validation de l'écriture par le stockage
PostgreSQL. Ils attestent le chemin d'écriture, **pas** la lecture du détail
de la visite dans l'écran Admin de production. Ce dernier contrôle reste
nécessaire avec la session Admin du propriétaire. Aucun cookie n'a été forgé,
aucun mot de passe ou secret n'a été demandé ou lu pour l'effectuer.

Les captures et résultats bruts sont conservés dans
`generated-artifacts/production-validation/`, exclus de Git.

## Tests de la correction

La suite disponible contient 31 tests. Première exécution complète : 30
réussites et une assertion de test prématurée sur `currentSrc` d'une image
différée. La correction de l'animation visible réussit déjà dans cette suite,
avec comparaison de la transformation à deux instants et contrôle du mouvement
réduit.

Le test des images attend désormais la sélection réelle du dérivé WebP sans
faire attendre le démarrage de l'application. Une relance a validé les 20
premiers tests, dont le contrôle corrigé et les trois tests de démarrage/PWA,
avant la limite d'exécution de 180 secondes. Aucun échec n'était présent dans
cette relance ; les 11 autres contrôles avaient réussi dans la première suite.
Ne pas présenter cette relance interrompue comme une exécution intégrale réussie.

Les tests couvrent aussi les prix, le catalogue, le panier et WhatsApp, les
services financiers, les paramètres, l'authentification Admin et le stockage
PostgreSQL transactionnel de test annulé. Aucun schéma ou secret de production
n'est modifié pour cette correction CSS.

## Validation restant à effectuer

Après synchronisation du commit correctif : relire le SHA public, comparer le
CSS/worker publiés, puis observer l'animation sur le vrai domaine. Lire le
statut Railway rattaché au **nouveau** SHA, sans réutiliser le succès précédent.
Ouvrir la nouvelle visite consentie et sa fiche dans l'Admin de production avec
une session autorisée. Les journaux Railway et l'essai sur appareil physique
restent distincts de ces vérifications.
