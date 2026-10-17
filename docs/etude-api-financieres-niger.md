# Étude des API financières — Ibn_Djibril Niger Tech

État des sources publiques consultées le 17 octobre 2026.

## Conclusion et limites

Des pistes sérieuses existent pour une entreprise établie au Niger : iFUTUR / iMoney Encaissement, FedaPay, Airtel Money Niger et NITA / MyNITA. Cela ne signifie pas que votre entreprise a déjà un compte marchand accepté, un contrat, un mandat de transfert ou un accès Live.

Cette étude n’active aucune API. Aucun compte n’a été créé, aucun prestataire contacté en votre nom, aucune clé demandée et aucune transaction lancée. Les disponibilités ci-dessous proviennent des sources officielles citées ; aucun appel authentifié ou essai de sandbox n’a été réalisé.

Trois activités doivent être distinguées :
- Encaisser le paiement de ses propres téléphones, équipements ou prestations.
- Verser des fonds à des bénéficiaires dans un cadre professionnel contractuellement autorisé.
- Proposer au public des transferts d’argent pour compte de tiers, notamment transfrontaliers.

Un accès technique à une API ne donne pas automatiquement le droit d’exercer la troisième activité. Le parcours actuel par WhatsApp ou téléphone reste inchangé tant que les autorisations et contrats ne sont pas validés.

## 1. iFUTUR — iMoney Encaissement / iPay Money

### Disponibilité et couverture

Site officiel : https://i-pay.money/
Écosystème : https://i-futur.com/fintech/
Documentation : https://docs.i-pay.money/

La liste BCEAO au 31 août 2026 mentionne iFUTUR au Niger, agrément EP.NG.001/2025, accordé le 6 mai 2025 [S1]. Il s’agit d’une preuve réglementaire indépendante, pas d’un partenariat avec Ibn_Djibril Niger Tech.

Le guide API de reversement et frais [S3] documente les moyens Mobile Money AIRTEL Niger, MOOV Niger, Zamani Niger, MTN Bénin et MOOV Bénin. Il cite aussi Amana, Nita Online, BOA Niger et les cartes. Leur activation dépend du compte marchand. Le paiement direct documenté est limité au Mobile Money ; les autres moyens passent par les liens de paiement hébergés. Ne pas confondre une banque affichée sur la page commerciale avec un connecteur bancaire directement activé.

### Compte marchand, documents et tarifs

La création du compte demande l’e-mail, la société/institution, le pays et le téléphone. La confirmation de l’e-mail ouvre la sandbox. Le Live nécessite la soumission des informations légales et une validation par l’équipe ; l’activation n’est pas instantanée [S2].

La liste exhaustive des pièces KYB n’est pas détaillée dans le guide consulté. Demander à l’équipe commerciale le dossier exact pour une entreprise nigérienne. Préparer, à titre de dossier à confirmer et non de liste officielle vérifiée : RCCM, NIF, identité du représentant, bénéficiaires effectifs, justificatif d’activité et coordonnées de règlement.

Les frais d’encaissement dépendent de l’opérateur et du contrat : demander une grille écrite, y compris taxes, frais fixes, annulations, remboursements et éventuels frais de mise en service.

Frais de reversement publiés dans le guide [S3] : My NITA 1 %, Amana 1 %, virement bancaire et rechargement du compte PayOUT 0 % dans la configuration décrite. Ces frais ne sont pas les frais d’encaissement et ne constituent pas un devis contractuel pour votre compte. Le guide indique que les paiements réussis deviennent éligibles au reversement après plus de trois jours ; cela ne promet pas un règlement instantané.

### API, tests et décaissements

Documentation officielle, API REST, liens hébergés, consultation des statuts et webhooks disponibles. La sandbox est explicitement documentée et séparée du Live [S2].

Limite importante : le reversement marchand décrit se fait dans le dashboard. Le guide précise qu’aucune API publique de création de reversement n’est déclarée dans le contrat documenté [S3]. L’offre iMoney Cash Transfert / paiements de masse existe dans l’écosystème [S4], mais son accès et ses conditions techniques doivent faire l’objet d’un contrat distinct. Un reversement du solde marchand n’est pas une API universelle de transfert à tous les clients.

### Avis pratique

Priorité commerciale élevée : opérateur agréé localement, support au Niger et agrégation documentée de plusieurs moyens locaux. Demander un devis et un périmètre écrit collecte/décaissement avant de choisir. Conformité : KYB, contrat, canaux réellement autorisés et validation du modèle marchand ou agent.

## 2. FedaPay

### Disponibilité et couverture

Site officiel : https://www.fedapay.com/
Documentation actuelle : https://docs.fedapay.com/fr/payment-methods
Éligibilité des pays : https://support.fedapay.com/portal/fr/kb/articles/fedapay-fonctionne-t-il-dans-mon-pays-20-3-2025

L’assistance officielle cite explicitement le Niger parmi les domiciles légaux admissibles. La liste BCEAO au 31 août 2026 mentionne FEDAPAY Bénin, EP.BN.004/2026, agréé le 2 avril 2026 [S1]. Cet agrément au Bénin ne doit pas être présenté comme un agrément nigérien indépendant : demander la base contractuelle et réglementaire de la prestation au Niger.

Le tableau API actuel [S5] est plus précis que certaines anciennes pages :
- Niger : collecte Airtel, y compris le mode sans redirection.
- Bénin : MTN, Moov, Celtiis, BMO, Coris Money.
- Togo : Mixx By Yas et Moov.
- Côte d’Ivoire : MTN.
- Sénégal : Free Sénégal.
- Cartes Visa/Mastercard : couverture régionale ou mondiale selon configuration et validation du compte [S6].

Le Niger ne figure pas dans le tableau actuel des méthodes de dépôts/décaissements, qui liste le Bénin, le Togo et la Côte d’Ivoire [S5]. Ne pas annoncer une API de versement Airtel Niger sur cette seule base, même si l’API générale des dépôts existe.

### Compte marchand, documents et tarifs

Le mode test est disponible après inscription et confirmation de l’e-mail. Le Live exige l’activation et l’examen du dossier [S7].

Pour le compte Business, les pièces publiées sont : RCCM ou enregistrement de l’entreprise et justificatif, nom du gérant, identité du dirigeant et copie du document, numéro fiscal et justificatif. La documentation emploie le terme IFU : faire confirmer l’acceptation du NIF nigérien et les autres pièces adaptées à votre forme juridique [S8].

Les frais varient selon le moyen de paiement. Aucun taux d’encaissement Airtel Niger suffisamment vérifiable n’a été établi dans cette recherche. L’ancien lien de tarification indiqué par l’assistance renvoie une page introuvable lors de la consultation. Demander la grille Niger écrite : encaissement, versement au marchand, carte, remboursement, retenues et taxes. Ne pas transformer une ancienne mention de virement gratuit en promesse tarifaire universelle [S9].

### API, tests et avis pratique

API REST, SDK Node.js, collecte, création de liens de paiement et webhooks sont documentés ; sandbox disponible [S7, S10]. Aucun test authentifié n’a été réalisé ici.

Piste solide pour commencer par la collecte Airtel Niger de ses propres ventes, sous réserve de validation du compte, de la méthode de règlement et du contrat. Couverture d’un moyen au Niger ne signifie pas que tous les logos du catalogue sont intégrables via cette API. Respecter KYB, obligations du contrat et contrôle des statuts ; toute activité de transfert à des tiers nécessite une qualification spécifique.

## 3. Airtel Money Niger — accès opérateur direct

### Disponibilité et couverture

Site local : https://www.airtel.ne/
Portail développeurs : https://developers.airtel.africa/developer
Offre professionnelle locale : https://www.airtel.ne/airtelmoney/portail-des-entreprises

Le portail officiel affiche Niger parmi les filiales sélectionnables. Il liste aussi Ouganda, Kenya, Tanzanie, Rwanda, Madagascar, RDC, Gabon, Zambie, Tchad, Malawi, Congo-Brazzaville et Seychelles. Cela ne constitue pas une autorisation de transfert entre ces pays : les produits, contrats et habilitations sont propres à chaque filiale [S11].

Le site local confirme un service de paiement marchand et un service de paiements en masse. Le portail développeurs est une piste réelle pour collecte et décaissement Airtel Money ; les produits API précisément activables au Niger et leur accès Live restent à faire confirmer par l’équipe locale.

### Compte marchand, pièces et frais

Le site Airtel Niger exige un contrat signé pour le service professionnel de paiement en masse [S12]. Pièces explicitement demandées :
- Registre de commerce, ou autorisation d’exercice pour une ONG.
- Numéro d’identification fiscale.
- Pièce d’identité du signataire.
- Code de conduite Airtel Money rempli, signé et cacheté.
- Formulaire de due diligence rempli, signé et cacheté.

La page locale de paiement marchand publie 1,2 % [S13]. Ce tarif concerne le service affiché : ce n’est pas une confirmation du prix de l’API, du décaissement ou de votre futur contrat. Demander un devis distinct pour les produits API, leurs plafonds et le règlement des fonds.

### Documentation, sandbox et conformité

L’entrée développeur est publique, mais la documentation produit et les accès de test nécessitent le parcours développeur et le choix de la filiale. Aucun accès sandbox Niger ni compte API n’a été obtenu ici. Faire confirmer les modalités d’essai sans mouvement réel avant de développer.

Option directe adaptée si le besoin prioritaire est Airtel Niger et si le contrat local couvre votre activité. Le service de paiement en masse aux salariés/bénéficiaires ne permet pas, à lui seul, de devenir opérateur de transferts publics ou transfrontaliers.

## 4. NITA / MyNITA — E-Paiement et partenariat professionnel

### Disponibilité réelle et pays

Site officiel : https://www.nitatransfert.com/
Offre API officielle : https://www.nitatransfert.com/services/e-paiement/
Réseau : https://www.nitatransfert.com/presence/

NITA annonce explicitement une API REST E-Paiement pour intégrer MyNITA à un site marchand ou une application, avec sandbox, exemples, webhooks et réconciliation [S14]. L’offre API est donc identifiable ; toutefois la documentation détaillée, les conditions d’accès et les habilitations de votre entreprise ne sont pas obtenues dans cette étude.

Le réseau commercial publié comprend treize pays : Niger, Bénin, Nigeria, Ghana, Togo, Sénégal, Mali, Burkina Faso, Côte d’Ivoire, Guinée Conakry, Guinée-Bissau, Mauritanie et Tchad [S15]. Cette présence commerciale ne prouve ni une couverture E-Paiement identique dans les treize pays ni une API de transfert transfrontalier ouverte au marchand.

### Conditions commerciales, pièces et frais

Contacter l’équipe entreprise par la page officielle, sans transmettre de pièces sensibles dans cette conversation. Le dossier marchand, les pièces exactes, les éventuels minimums de volume, les limites, les devises autorisées, les frais de collecte/transfert et les délais de règlement ne sont pas publiés sur la page consultée : obtenir la liste officielle et le contrat. Une liste préparatoire RCCM/NIF/identité/représentation et bénéficiaires effectifs reste à confirmer par NITA.

La page annonce des paiements en FCFA et d’autres devises selon configuration, pas toutes les devises sans autorisation. La disponibilité de la sandbox est une annonce officielle ; nous n’avons ni compte, ni identifiants, ni essai effectué.

### Avis pratique et conformité

Piste à traiter avec priorité pour intégrer MyNITA ou négocier une relation professionnelle de transfert. Demander séparément le contrat E-Paiement pour ses ventes et, si souhaité, le mandat de distribution/transfert pour compte de tiers. Vérifier le statut réglementaire, le périmètre du mandat, l’identification des clients, les contrôles AML/CFT et les obligations des pays concernés avant activation.

## 5. Transferts transfrontaliers et autres pistes étudiées

Thunes publie une véritable API Money Transfer : découverte des pays/payers, devis avec frais et change, création, confirmation, suivi de transactions et fonctions de simulation [S16]. Cela démontre une capacité technique B2B, pas l’éligibilité d’un commerçant nigérien ni la disponibilité d’un corridor précis pour son contrat.

Site : https://www.thunes.com/
Documentation : https://developers.thunes.com/money-transfer/v2/

Pays/opérateurs : la liste des payers réellement habilités doit être obtenue dans le contrat et par la découverte authentifiée. Aucun corridor Niger–Bénin, Niger–Nigeria ou Niger–Ghana n’a été validé pour votre entreprise. Conditions, dossier KYB/bénéficiaires effectifs, éventuel statut réglementé du client, préfinancement, frais, taux de change et accès sandbox sont à négocier ; aucun compte marchand local ni prix ne sont confirmés. Ce n’est donc pas une solution prête à brancher dans l’application.

Les APIs publiques de PayDunya et CinetPay existent, mais leur existence ou leur agrément dans un autre État ne suffit pas à établir l’acceptation de votre structure et des opérateurs nigériens. Elles ne sont pas recommandées comme disponibles au Niger sans confirmation contractuelle spécifique. Le même principe vaut pour les banques et marques internationales du catalogue. Aucun fournisseur déjà exclu n’est réintroduit dans l’application.

Pour un besoin de transferts transfrontaliers, la démarche la plus adaptée à ce stade est un entretien commercial avec un prestataire local autorisé, notamment NITA ou iFUTUR, en demandant un mandat et des corridors précis ; aucune promesse d’autorisation n’est faite par cette étude.

## 6. Obligations et architecture avant toute intégration

Cadre principal : Instruction BCEAO n°001-01-2024 sur les services de paiement, notamment agrément préalable, agents et partenariats/externalisation [S17]. La qualification juridique doit être validée avec le prestataire et un conseil compétent ; ce rapport ne remplace pas un avis juridique.

Avant tout pilote ou contrat :
- Définir si l’application encaisse ses propres ventes, décaisse dans un cadre professionnel ou intervient pour compte de tiers.
- Vérifier le prestataire et son périmètre d’agrément dans les listes officielles à jour ; vérifier les formalités applicables au mandat d’agent ou à la sous-traitance.
- Valider KYB, bénéficiaires effectifs, KYC des utilisateurs si applicable, AML/CFT, filtrage réglementaire, plafonds et suivi des opérations.
- Préciser conservation des données, confidentialité, hébergement/transferts de données, recours client, litiges, remboursements et partage des responsabilités.
- Ne pas conserver les PIN Mobile Money, mots de passe financiers ou données carte dans l’application ; privilégier un parcours hébergé quand il est adapté.

Architecture technique envisageable, non implémentée :
- Express crée les demandes exclusivement côté serveur. La clé secrète reste dans le gestionnaire de secrets de production, jamais dans le JavaScript public.
- Configuration sandbox distincte du Live et désactivée par défaut en production.
- Montants issus de prix autorisés et validés ; un produit « Prix à discuter » doit faire l’objet d’un devis confirmé avant tout paiement.
- Références uniques, montants en unités monétaires correctes, idempotence et transitions d’état explicites.
- Confirmation finale par webhook authentifié et vérification serveur du montant, de la devise et de la référence ; une redirection navigateur n’est jamais une preuve de paiement.
- Traiter signatures, rejeu, doublons, délais, échecs et réconciliation conformément à la documentation retenue.
- Toute évolution de la base se prépare séparément, avec sauvegarde et migration non destructive approuvée.

## 7. Prochaines démarches, sans activation automatique

1. Décrire le premier cas d’usage : encaisser ses propres ventes, ou service financier pour tiers. Ce choix change les contrats et obligations.
2. Demander à iFUTUR, FedaPay, Airtel et NITA une confirmation écrite d’éligibilité au Niger, des moyens/corridors, du statut applicable, des tarifs complets, des reversements, de la documentation et de la sandbox.
3. Comparer les réponses sur des montants et volumes réels, y compris frais de règlement et charge de conformité, pas seulement le pourcentage d’encaissement.
4. Choisir un seul prestataire pour un premier pilote sandbox. Obtenir votre autorisation spécifique avant de développer ce connecteur.
5. Tester succès, refus, annulation, réseau indisponible, webhook dupliqué/falsifié, erreur de montant et de devise, remboursement et rapprochement.
6. N’envisager le Live qu’après validation contractuelle, réglementaire, technique et votre accord explicite.

Les documents d’identité, RCCM/NIF, coordonnées bancaires et clés doivent être transmis uniquement via les canaux sécurisés du prestataire concerné, jamais dans la conversation ou le dépôt Git.

## Sources officielles

[S1] BCEAO, liste au 31 août 2026 : https://www.bceao.int/fr/communique-presse/liste-des-etablissements-de-paiement-agrees-dans-lumoa-au-31-aout-2026
PDF officiel : https://www.bceao.int/sites/default/files/2026-10/LISTE_DES_ETABLISSEMENTS_DE_PAIEMENT_AGR%C3%89%C3%89S_DANS_L-UMOA_au_31_ao%C3%BBt_2026.pdf

[S2] iMoney, mise en route et séparation Sandbox/Live : https://docs.i-pay.money/demarrer/mise-en-route
[S3] iMoney, reversement, moyens et frais : https://docs.i-pay.money/guides/reversement
[S4] iFUTUR, offres locales : https://i-futur.com/fintech/
[S5] FedaPay, méthodes actuelles et distinction collecte/dépôts : https://docs.fedapay.com/fr/payment-methods
[S6] FedaPay, domiciliation et couverture carte : https://support.fedapay.com/portal/fr/kb/articles/fedapay-fonctionne-t-il-dans-mon-pays-20-3-2025
[S7] FedaPay, inscription test et validation Live : https://docs.fedapay.com/fr/introduction/createaccount
[S8] FedaPay, comptes et pièces KYB : https://docs.fedapay.com/fr/introduction/compte
[S9] FedaPay, nature des frais : https://support.fedapay.com/portal/fr/kb/articles/tarification-et-frais-sur-fedapay-20-3-2025
[S10] FedaPay, index de documentation : https://docs.fedapay.com/llms.txt
[S11] Airtel, choix du pays développeur : https://developers.airtel.africa/developer
[S12] Airtel Niger, contrat et pièces : https://www.airtel.ne/airtelmoney/portail-des-entreprises
[S13] Airtel Niger, tarif marchand publié : https://www.airtel.ne/paiement-marchand
[S14] NITA, offre E-Paiement : https://www.nitatransfert.com/services/e-paiement/
[S15] NITA, présence commerciale : https://www.nitatransfert.com/presence/
[S16] Thunes, API de transferts : https://developers.thunes.com/money-transfer/v2/
[S17] BCEAO, Instruction relative aux services de paiement : https://www.bceao.int/fr/reglementations/instruction-ndeg001-01-2024-du-23-janvier-2024-relative-aux-services-de-paiement
