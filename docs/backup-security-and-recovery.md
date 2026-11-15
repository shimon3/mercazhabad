# Merkaz Habad — contrôle sauvegardes, accès et reprise

Dernière révision : 2026-11-15. Dépôt : shimon3/mercazhabad. Supabase : `bdalhyqpruefdbyirykp`.

## État contrôlé
- Supabase project `ACTIVE_HEALTHY`, région `eu-central-1`, Postgres 17.
- Les tables de produits, de commandes, de rôles et d'options de livraison possèdent des stratégies RLS. Les clients ne doivent voir que leurs commandes ; les employés autorisés doivent passer l'authentification multifacteur `aal2`.
- Options de livraison : `delivery` activée, tarif à confirmer ; `pickup` désactivée jusqu'à configuration explicite par l'administrateur.
- Supabase Security Advisor signale : **Leaked Password Protection Disabled**. À traiter dans la configuration Auth : https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Les URL de redirection d'Auth doivent autoriser exactement `https://mercaz-habad.pages.dev/account/` : https://supabase.com/docs/guides/auth/redirect-urls
- Le parcours d'e-mail de récupération dépend de la configuration Auth/SMTP, dont l'envoi réel reste à tester.
- **Aucune sauvegarde restaurable n'a été créée ni testée lors de cet audit.**

## Sauvegardes (sans service payant)
Le plan Supabase Free **n'inclut pas** les sauvegardes quotidiennes automatiques. Documentation : https://supabase.com/kb/faqs/platform/free-plan-backups et https://supabase.com/docs/guides/platform/backups

## Sauvegarde manuelle chiffrée — procédure actualisée

Utiliser `scripts/backup-merkaz-habad.ps1` du dépôt, documenté dans `docs/merchant-handover-readiness.md`, depuis un poste autorisé disposant de PostgreSQL CLI (`pg_dump`, `pg_restore`, `psql`), Git et `age`. Fournir une clé publique `age` appartenant au propriétaire, ainsi que les variables de connexion PostgreSQL dans la session, avec un fichier `PGPASSFILE` protégé.

Le script produit une archive ZIP **chiffrée**, avec le dump PostgreSQL, la copie GitHub incluant les photos statiques et, s'il y a des objets dans Supabase Storage, exige leur export binaire. Il vérifie la lisibilité du dump avec `pg_restore --list` et un SHA-256.

**Aucune sauvegarde chiffrée n'a été exécutée ni testée dans le cadre de cette mise à jour.** Un contrôle `pg_restore --list` ne remplace pas un test complet de restauration. Il faut restaurer sur un projet isolé distinct, et reconfigurer les fonctions, secrets, paramètres Auth et éléments Storage selon le besoin. Ne jamais essayer de restaurer directement sur la production.

Documentation officielle : https://supabase.com/docs/guides/platform/backups et https://supabase.com/docs/guides/platform/clone-project


## Contrôles de validation manuelle
- Compte visiteur non connecté : catalogue visible, commandes clients et interface vendeurs non visibles.
- Compte client : uniquement ses propres commandes.
- Compte gestionnaire : MFA obligatoire ; pas de modification des tarifs et modes de livraison réservée à l'administrateur.
- Compte administrateur : paramétrer `delivery` ou `pickup`; ne pas activer le retrait sans adresse et modalités.
- Mot de passe oublié : vérifier que l'e-mail arrive, que le lien retourne vers `/account/`, qu'il permet de changer le mot de passe et que l'ancien mot de passe ne fonctionne plus.
- Livraison : vérifier que l'option choisie apparaît dans le récapitulatif puis dans les notes de demande d'une commande **de test** ; aucun montant n'est débité automatiquement.
