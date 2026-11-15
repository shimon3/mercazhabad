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

Procédure à exécuter depuis une machine autorisée disposant du CLI Supabase et d'un accès DB valide, en suivant la documentation officielle : https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

1. Utiliser une connexion PostgreSQL **sécurisée**, conservée hors du dépôt Git et des journaux. Ne jamais publier le mot de passe, les clés d'administration ou un dump contenant des données clients.
2. Sauvegarder séparément les rôles, le schéma et les données : `supabase db dump --remote="$DB_URL" -f roles.sql --role-only`, puis `supabase db dump --remote="$DB_URL" -f schema.sql`, puis `supabase db dump --remote="$DB_URL" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"`.
3. Sauvegarder **séparément** les images et autres objets Supabase Storage : un dump PostgreSQL ne contient pas les fichiers binaires de Storage.
4. Chiffrer les archives, conserver des copies hors site, définir une rétention et contrôler l'intégrité des fichiers.
5. Tester une restauration **sur une base de test isolée**, sans remplacer la production, comparer le nombre de produits/commandes, tester l'accès aux images et les permissions RLS.
6. Programmer des exports récurrents uniquement depuis une machine ou une CI disposant de secrets protégés, après validation du propriétaire.

## Contrôles de validation manuelle
- Compte visiteur non connecté : catalogue visible, commandes clients et interface vendeurs non visibles.
- Compte client : uniquement ses propres commandes.
- Compte gestionnaire : MFA obligatoire ; pas de modification des tarifs et modes de livraison réservée à l'administrateur.
- Compte administrateur : paramétrer `delivery` ou `pickup`; ne pas activer le retrait sans adresse et modalités.
- Mot de passe oublié : vérifier que l'e-mail arrive, que le lien retourne vers `/account/`, qu'il permet de changer le mot de passe et que l'ancien mot de passe ne fonctionne plus.
- Livraison : vérifier que l'option choisie apparaît dans le récapitulatif puis dans les notes de demande d'une commande **de test** ; aucun montant n'est débité automatiquement.
