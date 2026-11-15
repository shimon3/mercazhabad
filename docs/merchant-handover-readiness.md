# Merkaz Habad — dossier de remise au commerçant (15 novembre 2026)

> **Document de recette, pas une attestation de conformité ou de sécurité.**
> Ne pas publier ce dossier sur la boutique : il comporte une liste de vérifications et de décisions à prendre entre le développeur et l'exploitant.

## 1. Périmètre identifié

- Site client : https://mercaz-habad.pages.dev/
- Dépôt source : https://github.com/shimon3/mercazhabad
- Projet Cloudflare Pages : `mercaz-habad`
- Projet Supabase : `bdalhyqpruefdbyirykp`, organisation **shmouel6@gmail.com's Org**, forfait **Free**, région `eu-central-1`
- Catalogue : **103 produits** (dont **15 brouillons** dans la nouvelle sous-catégorie `גיבורי אל משיח`), **0 commande**, **0 ligne de commande** au moment du contrôle. Supabase Storage : **0 objet** au moment du contrôle. Les photos statiques se trouvent dans le dépôt GitHub.
- Carte bancaire : **non activée**. Confirmation manuelle de réception du paiement : fonctionnalité ajoutée, mais scénario positif MFA non encore testé avec une commande de démonstration.

## 2. Sécurité des comptes : constat et procédure

1. Supabase Security Advisor affiche `auth_leaked_password_protection` : protection contre les mots de passe compromis **désactivée**.
2. Le contrôle natif des mots de passe compromis est réservé au **forfait Pro ou supérieur**. **Ne pas prétendre** qu'il a été activé sur Free. Voir : https://supabase.com/docs/guides/auth/password-security
3. Sur le forfait Free, vérifier et configurer dans le Dashboard **Authentication > Providers > Email** une longueur minimale et une politique de caractères adaptée ; noter la configuration finale et tester sur un compte dédié. Les seules validations JavaScript côté navigateur ne garantissent pas la sécurité.
4. URL de retour à autoriser dans **Authentication > URL Configuration** : `https://mercaz-habad.pages.dev/account/` (sans ouvrir de joker large à des domaines inconnus).
5. Tester avec **une adresse e-mail de test autorisée** : « שכחתי סיסמה » → e-mail reçu → lien → nouveau mot de passe → connexion avec le nouveau mot de passe → rejet de l'ancien. Vérifier que le lien est à usage limité et que le journal ne conserve pas de jeton.
6. Contrôler l'envoi SMTP (expéditeur, délivrabilité et limitation). Ce test **n'a pas été réalisé** ; ne pas déclarer « récupération fonctionnelle vérifiée » avant son succès.
7. Vérifier sur un compte admin et un compte manager que le MFA est demandé avant toute action sensible, et que le compte client ne peut pas voir les commandes d'autrui. Ne pas transmettre d'identifiants partagés.

## 3. Sauvegarde chiffrée et restauration

Le forfait Supabase Free ne fournit pas de sauvegardes quotidiennes automatiques (https://supabase.com/docs/guides/platform/backups). Faire une sauvegarde avant **tout** transfert de propriété.

**Script de préparation :** `scripts/backup-merkaz-habad.ps1`. Il nécessite les clients PostgreSQL, Git et le logiciel gratuit `age`, une clé publique de chiffrement appartenant au commerçant, et des variables d'environnement `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSFILE` d'un compte autorisé. Aucun mot de passe ne doit être commité.

Le script :
- relève le nombre d'objets Supabase Storage ; refuse d'annoncer une sauvegarde complète si des objets existent sans export binaire fourni ;
- archive une copie PostgreSQL `pg_dump` et vérifie la **lisibilité de l'archive** avec `pg_restore --list` ;
- inclut une copie du dépôt GitHub, donc des photos statiques versionnées ;
- chiffre le ZIP avec `age`, conserve seulement l'archive chiffrée et sa somme SHA-256, et nettoie les fichiers temporaires non chiffrés.

**Limites :** aucun lancement du script ni sauvegarde chiffrée récupérable n'a été confirmé dans l'agent ; la lisibilité `pg_restore --list` **ne prouve pas** une restauration complète. Le script utilise une copie du dépôt au moment de son exécution, qui peut être postérieure à la base : noter la date et le commit.

**Test de restauration obligatoire :** sur une instance PostgreSQL/Supabase de test **distincte et vide**, sous contrôle du propriétaire, restaurer le fichier chiffré avec la clé privée `age`, puis le dump et les médias. Comparer 103 produits, 0 commande à la date de l'audit (ces chiffres doivent être actualisés), les SKU, les rôles, la connexion d'un compte de test, les fonctions SQL, les images et les politiques RLS. **Ne jamais restaurer sur le projet de production comme essai.** Le clonage/restauration Supabase peut nécessiter de reconfigurer Storage, clés Auth et Edge Functions : https://supabase.com/docs/guides/platform/clone-project.

**Conservation :** deux copies chiffrées dans des emplacements distincts, procédure et clé de déchiffrement remises au propriétaire par un canal sûr, périodicité et responsable convenus par écrit. Ne pas placer de dump client ou de clé privée dans un dépôt Git public.

## 4. Transfert de propriété : à décider et à documenter

| Élément | Situation actuelle | Action avant cession |
| --- | --- | --- |
| Dépôt GitHub | `shimon3/mercazhabad` | Choisir entre transfert du dépôt vers le compte du commerçant ou accès collaborateur ; conserver l'historique et les secrets |
| Cloudflare Pages | Projet `mercaz-habad` sur le compte actuel | Choisir le futur compte propriétaire ; vérifier intégration GitHub, domaine, DNS, accès et redéploiement sur le compte cible |
| Supabase | Org `shmouel6@gmail.com's Org` (Free) | Ajouter le nouveau propriétaire à une organisation cible, puis organiser le transfert **après sauvegarde** et tests |
| Administration de la boutique | Rôles `admin` / `manager` avec MFA | Créer et valider un compte nominatif pour l'acheteur ; révoquer les comptes techniques non nécessaires après recette |
| Numéro WhatsApp | `053-377-0073` est affiché sur le site | Faire confirmer au commerçant qu'il possède ce numéro et autorise son utilisation |
| Domaine | `mercaz-habad.pages.dev` | Décider s'il faut un domaine commercial propre ; contrôler le DNS et le budget |
| Frais | Supabase Free / Cloudflare Pages, usages soumis aux limites des offres | Préciser qui paie les éventuels dépassements, le domaine, l'e-mail transactionnel et les options futures |

**Ne pas transférer ni supprimer les accès techniques prématurément.** Un transfert GitHub se fait dans Settings > Danger Zone > Transfer ; selon la destination, un changement de connexion Cloudflare peut nécessiter une reconfiguration. Supabase permet un transfert de projet entre organisations sous conditions (https://supabase.com/docs/guides/platform/project-transfer). Aucun transfert de compte n'a été entrepris.

## 5. Mentions légales / conditions de vente : manque bloquant pour l'ouverture commerciale

**Constats vérifiés dans le code :**
- Page `/privacy/` existante en hébreu, français et anglais ; elle précise explicitement que l'identité juridique de l'exploitant doit être complétée.
- Pages publiques `/terms/`, `/shipping/` et `/returns/` non présentes dans le dépôt vérifié.
- Le pied de page public inclut un numéro de téléphone et la politique de confidentialité, mais pas de lien distinct de rétractation/annulation.
- La livraison est « tarif à confirmer » ; le retrait reste désactivé. L'option de carte bancaire est désactivée.

**À collecter auprès de l'acheteur, sans deviner :**
- Nom légal / raison commerciale, numéro d'immatriculation, adresse de l'entreprise, e-mail de contact et moyen officiel pour l'annulation.
- Conditions de vente : étapes de validation de commande, confirmation du paiement, moyens de paiement réellement acceptés, prix TTC le cas échéant, frais et zone de livraison, délai et modalités de livraison, procédure de retour, exclusions légales, garantie et service après-vente.
- Modalités de réclamation et d'annulation : créer un mécanisme en ligne visible et adapté au droit israélien **avant** ouverture commerciale ; faire valider le texte par une personne compétente en droit local.
- Définir une durée de conservation des données et vérifier la conformité de l'information des personnes sur le traitement et la protection de leurs données.

Sources : Autorité israélienne de protection du consommateur (https://www.gov.il/he/pages/returns) et amendement 52 de 2017 (https://fs.knesset.gov.il/20/law/20_lsr_390329.pdf). La réglementation peut varier suivant le type de produit et le contrat.

## 6. Recette de livraison (à signer par le client après tests)

- [ ] Commande de test client complète, sans paiement réel : catalogue, panier, choix livraison, validation, statut en gestion.
- [ ] Test positif d'une confirmation de paiement **fictive uniquement sur une commande de test** et contrôle de la non-duplication du stock ; nettoyer le test de façon documentée.
- [ ] Mot de passe oublié : e-mail réel et mot de passe changé.
- [ ] MFA et permissions : invité, client, manager, admin.
- [ ] 18 photos du groupe `גיבורי אל משיח` importées et associées (au moment de cet audit : **non** ; seules trois variantes anciennes sont visibles).
- [ ] Prix, textes, stocks et photos validés par le commerçant.
- [ ] Sauvegarde chiffrée conservée et restauration isolée validée.
- [ ] Conditions et identité légale approuvées et publiées.
- [ ] Nom du propriétaire, accès GitHub/Cloudflare/Supabase/MFA, fréquence des sauvegardes, coût et durée de maintenance définis par écrit.

**Situation à ce jour :** projet présentable et cessible comme développement personnalisé, **pas encore validé pour une ouverture commerciale sans réserve**.
