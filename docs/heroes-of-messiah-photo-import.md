# גיבורי אל משיח — Import des photos produit

Sous-catégorie : `PhoneStickers / HeroesOfMessiah` (מדבקות לפלאפון → גיבורי אל משיח).

Les originaux de l’utilisateur sont conservés dans son chat. Ils ont été préparés en WebP haute qualité dans `merkaz-habad-18-photos-webp.zip` (fichier remis dans la conversation), sans remplacement par un montage d’IA.

## Mode d’emploi

1. Télécharger l’archive ZIP depuis la conversation, puis l’extraire.
2. Ouvrir **/admin/** avec un compte administrateur et MFA, trouver **גיבורי אל משיח · יבוא 18 תמונות**.
3. Sélectionner ensemble les **18 fichiers** depuis le dossier `photos/`, pas l’archive ZIP.
4. Cliquer sur **יבוא תמונות לפי מק״ט** ; vérifier la confirmation `18/18` (le système affiche séparément toute erreur).
5. Les trois références historiques `s/1`, `s/2`, `s/3` sont actives et leurs photos sont remplacées. Les 15 nouveaux produits restent **inactifs et sans prix** : chacun doit être vérifié, tarifé et activé individuellement par le vendeur.

Le système d’import utilise la session MFA de l’administrateur et le stockage Supabase existant ; aucune clé secrète n’est publiée. Ne pas activer une variante sans prix réel ni photo.

## Correspondances déterministes

| Fichier | ID de produit | État |
|---|---|---|
| `messiah-black-gold.webp` | `s/3` | מק״ט MH-000001 |
| `messiah-gold-black.webp` | `s/1` | מק״ט MH-000003 |
| `messiah-israel-blue-white.webp` | `hero/israel` | draft |
| `messiah-white-black.webp` | `s/2` | מק״ט MH-000002 |
| `messiah-silver-white.webp` | `hero/silver` | draft |
| `messiah-blue-rings.webp` | `hero/blue` | draft |
| `messiah-green-rings.webp` | `hero/green` | draft |
| `messiah-pink.webp` | `hero/pink` | draft |
| `messiah-orange-rings.webp` | `hero/orange` | draft |
| `messiah-brown-rings.webp` | `hero/brown` | draft |
| `messiah-yellow-blue-red.webp` | `hero/yellow` | draft |
| `messiah-turquoise-rings.webp` | `hero/turquoise` | draft |
| `messiah-magenta-rings.webp` | `hero/magenta` | draft |
| `messiah-temple.webp` | `hero/temple` | draft |
| `messiah-set-10-colors.webp` | `hero/set-10` | draft |
| `messiah-770.webp` | `hero/770` | draft |
| `messiah-black-white.webp` | `hero/black-white` | draft |
| `messiah-purple-pink.webp` | `hero/purple` | draft |

Les autres articles du catalogue (autocollants de drapeaux, insignes militaires, etc.) restent inchangés, faute de photos correspondantes fournies.
