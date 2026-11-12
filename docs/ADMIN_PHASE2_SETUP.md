# Administration D1 — phase 2 (branche de revue, ne pas publier avant validation)

Le site public actuel reste une **démo** ; aucun paiement réel. Cette branche ajoute `/admin/`, une API de gestion et des migrations D1 non destructives.

## Configuration indispensable avant activation

1. Créer une base Cloudflare D1 **de test** (pas une base déjà utilisée par un autre projet). Lier la base à Pages/Functions avec le binding `DB`, dans **Preview** d'abord.
2. Appliquer `migrations/0001_products.sql` puis `migrations/0002_import_84_products.sql` sur la base de test. La migration utilise `ON CONFLICT(id) DO NOTHING` : elle ne remplace pas les champs modifiés.
3. Créer un bucket R2 **de test** pour les photos des futurs produits. Le lier avec le binding `PRODUCT_IMAGES`. Les 84 fichiers `assets-v7/` déjà présents sont conservés.
4. Dans Cloudflare Zero Trust, configurer une application Access couvrant **`/admin/*`** et **`/api/admin/*`**, autorisée uniquement aux responsables de la boutique, avec MFA. Ne pas protéger `/api/catalog` ni `/api/images/*` (lecture publique).
5. Dans les variables d'environnement Cloudflare Pages **Preview** : `CF_ACCESS_TEAM_DOMAIN` (ex. `xxx.cloudflareaccess.com`), `CF_ACCESS_AUD` (Audience Tag exact de l'application), `ADMIN_EMAILS` (liste d'e-mails administrateurs explicitement autorisés, séparés par virgules). Ne pas enregistrer des secrets dans Git. L'API valide la signature RS256 et refuse l'accès si la configuration manque.
6. Exécuter `python scripts/test_admin_phase2.py`, tester login admin via Access, modification de prix / stock / photo, déconnexion, tentative d'accès non autorisée (403), chargement public, 84 produits, prix inconnus inchangés, panier toujours fictif.
7. Après validation seulement : rattacher la base D1 et R2 **de production** et exécuter les migrations. Ne pas réutiliser les identifiants de Preview. Prévoir une sauvegarde D1 et un retour arrière du code.

## Données et fonctionnalités

- Catalogue : 84 SKU uniques, 9 prix inconnus sous forme de NULL, **stock initial 0** (aucune disponibilité inventée).
- Les modifications produits sont écrites dans `product_audit` avec la date et l'adresse e-mail de l'administrateur.
- GET `/api/catalog` est public et renvoie les articles actifs. Sans DB, l'interface publique conserve son catalogue statique existant.
- `/admin/` permet d'éditer le nom hébreu, la description, les prix en centimes de shekel, le stock, la visibilité et d'envoyer une nouvelle photo PNG/JPEG/WebP (5 Mo max) vers R2.
- Aucun endpoint ne peut créer une vraie commande ou encaisser un paiement.

## À vérifier avant la fusion

La vérification Node/SQLite est un **test hors ligne**, pas une preuve de sécurité complète. Valider les politiques Cloudflare Access, les paramètres de binding et les parcours d'administration avec un navigateur réel sur un environnement de test.
