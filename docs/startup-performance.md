# Démarrage et performances mobiles

## Comportement

L'accueil utilise le logo officiel inchangé, encodé et réduit pour l'affichage
mobile. Le fichier original reste conservé. Aucun logo retouché n'est publié
sans validation du propriétaire.

L'écran se retire quand les cartes du catalogue existent, sans durée minimale.
Il n'attend ni les photographies de détail ni les polices. Après 3 secondes,
le message indique un chargement lent ; après 10 secondes sans catalogue, un
message et un bouton de rechargement remplacent l'attente. La progression est
indéterminée : aucun pourcentage fictif. Une protection inline fonctionne même
si le script d'animation est bloqué. JavaScript désactivé ne masque pas la page.

Le mode standalone n'impose pas un second délai après le lancement natif du
navigateur. La réduction des animations est respectée. Un navigateur ne permet
pas de contrôler complètement la durée ou l'apparence de son écran natif.

## Ressources et conservation des données

- Photographies : dérivés WebP de 720 px maximum, qualité 82, sélectionnés par
  `picture` ; originaux conservés et utilisés en repli et dans les galeries.
- Logo mobile : réduction à 256 px, encodage WebP sans perte supplémentaire ;
  pas de redessin ni de modification des références.
- Images hors écran : chargement différé et décodage asynchrone.
- Compression HTTP des scripts/CSS publics ; pas des réponses authentifiées.
- Images dérivées : cache HTTP limité à une heure et cache PWA limité à
  60 entrées, renouvelé à chaque version du worker.
- HTML, scripts, CSS, API et prix : toujours réseau, sans repli vers une
  ancienne interface ou des prix périmés.
- Navigation hors ligne sous contrôle d'un worker déjà installé : page
  explicite de reconnexion, sans données financières ni commandes fictives.
- Aucun changement de schéma PostgreSQL, de secrets ou de prix.
- Aucun catalogue, pays, prestataire ou logo financier supprimé.

Les originaux peuvent être régénérés en dérivés avec ImageMagick :
`magick source.jpg -auto-orient -resize '720x720>' -quality 82 destination.webp`.
Ajouter le dérivé correspondant lorsqu'une nouvelle photo locale du catalogue
est référencée. Les photos originales restent la source de vérité.

## Mesures comparables

Chromium mobile simulé, viewport 390×844, nouveau contexte sans cache pour
chaque mesure, même serveur statique de test avant/après, sans compression
HTTP pour isoler l'effet des images. Connexion lente : latence 150 ms,
débit descendant 200 Kio/s, montant 75 Kio/s. Une exécution par scénario :
ces résultats ne sont ni des percentiles ni des mesures Railway/Lighthouse.

| Indicateur | Avant | Après |
| --- | ---: | ---: |
| Chargement complet, normal | 1,15 s | 1,24 s |
| Chargement complet, lent | 18,69 s | 2,89 s |
| Ressources transférées, normal | 3 767 489 octets | 473 289 octets |
| Ressources transférées, lent | 3 725 546 octets | 431 346 octets |
| Logo transféré | 1 046 553 octets | 65 484 octets |
| Catalogue utilisable après correction, normal | non instrumenté | 0,97 s |
| Catalogue utilisable après correction, lent | non instrumenté | 1,69 s |
| Catalogue utilisable après correction, standalone simulé | non instrumenté | 0,68 s |

`load` n'est pas la disponibilité du catalogue : le catalogue peut être
utilisé avant que les images visibles soient entièrement transférées.
Les ressources lazy peuvent se charger après `load` lors du défilement.
Les données et captures brutes sont dans `generated-artifacts/startup/`,
exclu de Git et des déploiements.

## Vérifications

La suite complète a exécuté 30 tests : 29 ont réussi à la première exécution.
Le seul échec concernait la concordance des versions CSS/JS entre l'accueil
et l'ancien accès dashboard. Les références ont été alignées sans modifier la
logique. Les 12 tests de démarrage, transfert et portabilité ont ensuite tous
réussi, y compris le repli sur la photo originale quand un WebP est absent.
Les valeurs après correction ci-dessus sont celles de cette dernière exécution.
La variation normale (1,15 à 1,24 s) n'indique pas une accélération démontrée
sur connexion rapide ; le gain majeur mesuré concerne la connexion lente.

Les tests réussis comprennent catalogue, panier, WhatsApp, prestataires
financiers, paramètres, authentification Admin, statistiques et PostgreSQL
dans un schéma de test transactionnel annulé, démarrage normal/lent,
blocage de script, bouton Réessayer, mouvement réduit, mode standalone simulé,
cache et navigation hors ligne/reconnexion avec un vrai Service Worker.

Une installation propre des dépendances de production a réussi dans un
répertoire temporaire ; les URLs npm du verrou sont publiques en HTTPS.
Le serveur Express de prévisualisation a redémarré correctement. Il désactive
volontairement PostgreSQL : les preuves SQL viennent de la fixture dédiée,
pas de ce serveur.

Non vérifié : téléphone Android physique, installation native effective sur
celui-ci, performances de la nouvelle version en production, écran Admin
authentifié de production et statut exact du tableau Railway. Ces points ne
peuvent pas être déduits de tests locaux.

## Propositions graphiques

Propositions non intégrées, produites à partir du PNG existant de 1200 px :
netteté modérément renforcée en 1200 px, réduction 360 px et agrandissement
Lanczos 2400 px. Aucune réécriture de caractères ni reconstruction générative.
L'agrandissement ne recrée pas les détails absents de la photographie.
Pour une vraie qualité d'impression, demander le fichier original vectoriel
ou l'export original haute résolution ; ne pas inventer de références lisibles.
