# Données & Activités — administration privée

## Architecture et déploiement

L’écran `/admin/activities` et ses fichiers sont protégés par la session Admin
existante. Les API de consultation, chronologie et export exigent la même
authentification ; aucun compte ni mot de passe supplémentaire n’est créé.

Les seules tables ajoutées au démarrage sont `activity_sessions` et
`activity_events`, avec des index sur les dates, sessions, visiteurs et services.
L’initialisation est additive et idempotente. Elle utilise le pool PostgreSQL
existant ; elle ne recrée pas la base et ne modifie ni `products` ni la structure
de `prices`. L’application attend la fin de cette initialisation avant d’écouter.
Une erreur PostgreSQL fait échouer explicitement le démarrage.

Les historiques commencent à l’installation de cette fonctionnalité. Aucune
visite antérieure n’est inventée. La conservation est de 90 jours : nettoyage
au démarrage puis quotidiennement, uniquement dans les deux tables d’activités.
La rétention n’efface jamais les produits, les prix ou les autres données métier.

## Prix existants

La route Admin de modification conserve sa validation et n’accepte que les
identifiants déjà gérés. PostgreSQL utilise désormais `UPDATE`, pas un ajout
de prix. La route `/prix-produits.js` existante est produite à la demande depuis
le même magasin de prix, avant le service des fichiers statiques.

`/api/prices` expose uniquement les tarifs publics, avec `Cache-Control:
no-store`. Une page ouverte les revalide toutes les 15 secondes lorsqu’elle est
visible, à son retour au premier plan et à `pageshow`. Les mêmes objets produit
alimentent le catalogue et le panier ; les vues ouvertes sont rafraîchies sans
changement de présentation. Les produits sans tarif géré ne sont pas modifiés.
Les fichiers HTML publics, les services financiers, leurs logos et leurs liens
restent inchangés.

## Confidentialité et limites

Le serveur ajoute un choix de consentement et un collecteur de première partie aux pages HTML
publiques. Il n’est jamais ajouté aux pages Admin. Le suivi nécessite un accord explicite et respecte DNT et
Global Privacy Control ; il ne lit aucun champ de formulaire.

Un identifiant visiteur aléatoire expire après 30 jours. Une session par onglet
expire après 30 minutes d’inactivité. Le navigateur peut réinitialiser ces
identifiants en effaçant son stockage. Les visiteurs uniques sont donc des
identifiants de navigateur, pas des personnes vérifiées.

Seuls des types d’événement, chemins de pages et identifiants de services
autorisés sont acceptés. Aucun texte libre, destination de lien, paramètre
d’URL, IP brute, user-agent brut, contenu de formulaire ou secret n’est stocké.
Navigateur, système et type d’appareil sont des classifications grossières.

Les pages, consultations du catalogue/produit/service, ouvertures financières,
changements de catégorie, clics externes et actions utiles sont suivis. Les
formulaires/boutons de calcul ou test identifiables par leur ID peuvent produire
une action sans enregistrer leurs valeurs. Les mouvements de souris, frappes,
recherches saisies et actions Admin ne sont pas suivis.

Le pays est estimé localement avec la base GeoLite2 Country incluse dans
`geoip-country`, après consentement. Aucune IP n'est conservée ni envoyée à un
service externe. Sur Railway, seul `X-Real-IP`, documenté comme réécrit par son
edge, est accepté dans le contexte Railway/HTTPS/domaine connu. Les appelants du
réseau privé Railway doivent rester de confiance ; les en-têtes arbitraires ne
sont pas acceptés dans les autres environnements. Ailleurs, seule une adresse
publique de socket direct peut être utilisée. IP privée, réservée ou absente :
pays `NULL`. Ne jamais déduire un pays d’une langue ou d’un fuseau horaire.
La ville et la région ne sont pas déduites du pays ou de sa capitale.
`ANALYTICS_COUNTRY_HEADER` peut également désigner un en-tête géographique
**écrasé par un proxy de confiance** si l’hébergement en fournit un. Ne pas
activer ce réglage pour un en-tête librement contrôlable par le client. Aucun
changement de configuration Railway n’est imposé.

La base GeoLite2 est créée par [MaxMind](https://www.maxmind.com/) :
consulter la [licence/EULA](https://www.maxmind.com/en/geolite2/eula) incluse
dans la dépendance et maintenir ses données à jour, au moins mensuellement.
La dépendance et sa base sont verrouillées dans npm, sans téléchargement à
l'exécution. Les sorties sont des estimations du réseau, pas une localisation
certaine : les VPN et opérateurs peuvent déplacer le pays apparent.

L'accusé HTTP `X-Activity-Status: recorded` et `X-Activity-Count` n'est envoyé
qu'après l'insertion PostgreSQL. `duplicate` signifie une réception déjà faite ;
`disabled` signifie aucun accord ou protection navigateur. Les retries sont
limités à deux, seulement en mémoire, avec les mêmes UUID et le même corps.
Un changement de consentement annule les retries de la génération précédente.

Le diagnostic `/api/admin/activities/diagnostic`, protégé par la session Admin,
montre les totaux réels tous filtres confondus et le dernier enregistrement.
Le tableau visible s'actualise toutes les 30 secondes, hors édition ou dialogue.
Les liens privés avec `session` ou `visitor` UUID et période permettent de
retrouver précisément une visite de test sans exposer les statistiques publiques.

Les anciennes colonnes ajoutées sans données restent `NULL` après migration :
ni IP historique ni user-agent complet n'ont été stockés, donc les anciennes
informations ne peuvent pas être reconstruites. Une nouvelle requête réelle
peut compléter une session encore active ; `technical_observed_at` horodate
cette observation et ne constitue pas la reconstitution de son passé.

L’ingestion refuse les origines différentes, valide les champs et limite
les événements par visiteur et globalement par processus/minute. Les événements
sont dédupliqués par UUID. Il ne s’agit pas de statistiques anti-fraude certifiées :
des blocages navigateur ou réseaux et des requêtes automatisées peuvent modifier
les comptes. Un échec du suivi ne bloque jamais l’application ni un lien externe.

Les périodes suivent `Africa/Porto-Novo` (UTC+1), dates de début et de fin
incluses. Les tableaux sont paginés par 50 événements. Les chronologies affichent
au maximum 2 000 événements avec avertissement explicite. L’export CSV parcourt
tous les résultats filtrés par lots, échappe les cellules et protège contre
l’injection de formules de tableur.

## Tests sans modifier les données existantes

`npm test` exécute les tests de transfert/PWA et les tests Admin. Le navigateur
Chromium est recherché à `/repl/tools/bin/chromium` dans cet environnement.

Les tests Admin utilisent PostgreSQL avec une transaction, un schéma de test
au nom aléatoire et les prix existants du fichier local comme fixtures.
Ils ne lancent pas l’import initial des produits. La transaction entière est
annulée dans `finally`, y compris les tables et le schéma temporaires.
Aucune table du schéma public n’est modifiée. Des identifiants Admin aléatoires
sont générés uniquement dans le processus de test et ne sont ni affichés ni
enregistrés comme Secrets.

Ces tests valident le code d’authentification et les flux réels HTTP/PostgreSQL,
mais ne remplacent pas une connexion avec le véritable compte sur Railway ni
la vérification de sa base et de ses journaux après publication.
