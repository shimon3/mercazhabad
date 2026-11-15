# Merkaz Habad — points 1–24 : paramètres manuels, tests et limites

Date : 15 novembre 2026. **Ne pas activer la production Grow avant validation sandbox.**

## Paramètres Supabase Auth (point 14)

Projet : https://supabase.com/dashboard/project/bdalhyqpruefdbyirykp

1. **Authentication > Sign In / Providers > Email** : activer la confirmation des adresses e-mail. Définir un mot de passe de longueur minimale 12 caractères, avec catégories de caractères robustes adaptées au public. Les nouvelles exigences sont appliquées aux changements de mot de passe / inscriptions, pas automatiquement aux mots de passe existants.
2. **Authentication > URL Configuration** : Site URL `https://mercaz-habad.pages.dev/`, URL de redirection autorisée `https://mercaz-habad.pages.dev/account/`. Ne pas utiliser de wildcard général.
3. **Authentication > Rate Limits** : conserver ou durcir les limites IP pour inscription et récupération (documenté par Supabase : 30 appels/5 min par défaut avec rafales, et 60 secondes entre deux demandes de réinitialisation pour le même compte). Protéger aussi le point de connexion `/auth/v1/token`, dont la valeur par défaut est 150/5 minutes. Adapter les valeurs selon tests réels ; ne pas créer un blocage injustifié.
4. **Authentication > Bot and Abuse Protection** : configurer Cloudflare Turnstile avec clé publique de widget et clé secrète Turnstile. Les secrets ne doivent être enregistrés que dans le Dashboard. Ajouter ensuite le composant Turnstile au formulaire du site et transmettre le jeton CAPTCHA sur inscription, connexion et récupération ; **ne pas activer cette protection avant la modification des formulaires**, sans quoi les connexions échoueront. Aucune clé Turnstile n'a été fournie et aucun challenge n'est activé dans cette livraison.
5. **Protection native contre les mots de passe compromis** : Supabase la réserve à Pro et au-delà. Sur Free, elle restera désactivée ; ne pas annoncer le contraire.
6. Confirmer les e-mails avec une boîte de test autorisée. Le service e-mail intégré Supabase peut être limité aux membres de l'équipe et à deux e-mails par heure ; utiliser un SMTP transactionnel configuré par le commerçant pour le lancement public.

Sources :
- https://supabase.com/docs/guides/auth/auth-captcha
- https://supabase.com/docs/guides/auth/rate-limits
- https://supabase.com/docs/guides/auth/testing-auth-flows
- https://supabase.com/docs/guides/auth/password-security

## Grow (points 16–23)

Les fonctions Cloudflare Pages utilisent exclusivement les secrets Cloudflare, jamais le dépôt :
- `GROW_MODE=sandbox` : environnement test uniquement. Les autres valeurs sont refusées.
- `GROW_ENABLE_PAYMENTS=true` : **interrupteur de sécurité** ; laisser absent tant que la recette sandbox n'est pas validée.
- `GROW_USER_ID`, `GROW_PAGE_CODE` : identifiants sandbox Grow, en **secrets Cloudflare**.
- `GROW_API_KEY` : clé Grow si exigée, **secret Cloudflare**.
- `GROW_DB_ADMIN_TOKEN` : clé Supabase `service_role` réservée à la Function, **secret Cloudflare**. Aucun accès côté navigateur.
- En production, `GROW_MODE=production` n'est admis que si `GROW_PRODUCTION_APPROVED=true`, après approbation Grow et revue d'intégration. Utiliser alors les identifiants fournis par Grow pour la production.

Les fonctions :
- `/api/grow/status` : rapporte `enabled:false` lorsque l'intégration est désactivée, sans secrets.
- `/api/grow/create-payment` : POST JSON `{"orderId":"uuid"}` et `Authorization: Bearer <token-client>`. Refuse les autres champs, valide la session, le propriétaire de la commande, relit `total_agorot` en base et renvoie **seulement une URL** `https://sandbox.meshulam.co.il/...`.
- `/api/grow/webhook` : POST Grow server-to-server, vérifie `getTransactionInfo`, compare ID de transaction, code 2, référence de commande confirmée par Grow et montant en base ; utilise le registre idempotent `mercaz_private.mercaz_grow_transactions`, puis envoie `approveTransaction`. **Aucune donnée carte ni corps brut enregistré ou loggé.**
- `successUrl` : simple redirection vers la page de compte, sans changement du statut payé.

Tests : démarrer **uniquement** en sandbox avec une commande de test, observer une redirection sans iframe, une transaction payée après notification serveur, un seul débit de stock et un seul registre pour deux notifications identiques, rejet d'une référence de commande ou d'un montant incorrect. Les essais avec portefeuille externe (Bit/Apple Pay/Google Pay) peuvent entraîner une véritable charge même en sandbox : les éviter durant la recette.

**Limite non levée :** sans identifiants Grow ni accès à une transaction sandbox, aucune validation positive de bout en bout n'a été réalisée. Ne pas activer `GROW_ENABLE_PAYMENTS` ou la production sans vérification de la corrélation `customFields` / `description` et des paramètres d'approbation auprès de Grow.

Sources :
- https://developers.grow.business/reference/create-payment-process
- https://developers.grow.business/reference/server-response
- https://developers.grow.business/reference/get-transaction-info
- https://developers.grow.business/reference/approve-transaction-2
- https://developers.grow.business/reference/live-environment

## Accès staff et sécurité (points 9–13)

Les pages HTML statiques `/admin/` et `/manager/` contiennent uniquement la connexion et le MFA ; `/api/staff/dashboard?panel=admin|manager` retourne le tableau de bord seulement si le JWT est revérifié auprès de Supabase, `aal2` et rôle requis. Le serveur ne renvoie jamais ce HTML à un visiteur non connecté. L'accès à la base reste assuré par les policies RLS ; la protection du seul HTML n'est pas une autorisation.

SQL appliqué et versionné :
- `sql/admin-mfa-catalogue-and-order-validation.sql`
- `sql/grow-verified-webhook-payments.sql`

Vérifier :
- Visiteur anonyme : réponse **401** sur `/api/staff/dashboard?panel=admin`.
- Compte client : rejeté sur l'endpoint et n'accède pas aux commandes d'autres clients.
- Manager MFA : accès aux commandes, produits en lecture seule ; `PATCH` ou `INSERT` produits refusé par RLS.
- Admin MFA : modification des produits et réglages livraison possible. Contrôler la portée `aal2` après expiration de session.
- Direct REST `INSERT` de commande : refusé ; création avec RPC `mercaz_create_order` uniquement.
- Direct REST `UPDATE` de totaux, paiement et rôles : refusé.
- Vérifier les contraintes sur nom, téléphone, adresse, notes et ligne de commande dans PostgreSQL ; aucune commande réelle n'a été altérée pendant les tests.

## Confidentialité et conformité

La page `/privacy/` a des sections `#he/#fr/#en`, une identité et un e-mail **à remplir**, des durées de conservation **annoncées** (7 ans commandes, 24 mois comptes inactifs, 12 mois service client, 90 jours journaux gérés par la boutique) et la mention de Grow. **Ces durées doivent être effectivement mises en œuvre, vérifiées avec l'exploitant et le droit applicable avant publication définitive.** Le webhook de Grow peut recevoir des métadonnées de carte transitoires imposées par Grow : le code ne les stocke ni ne les journalise.

## Tests statiques reproductibles

Exécuter depuis la racine du dépôt :
`node tests/security-smoke.mjs`

Ce test est non destructif et ne simule ni des paiements réels ni l'authentification complète : les tests réels client, vendeur MFA, Grow et e-mail sont distincts.
