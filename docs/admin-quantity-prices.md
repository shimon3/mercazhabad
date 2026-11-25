# מחירי כמות בממשק הניהול

בכרטיס מוצר מסוג ״מגנטים לרכב״ נוספו מחיר ליחידה מ־10, מחיר ליחידה מ־20 והנחה מ־20 יחידות באחוזים. השדה הקיים נקרא כעת ״מחיר באתר ליחידה״. נוסף גם מחיר רגיל לפני מבצע, שאפשר להשאיר ריק.

לדוגמה: מחיר ליחידה 20 ₪, מחיר מ־10 יחידות 15 ₪ והנחה מ־20 יחידות 40% נותנים מחיר 12 ₪ ליחידה מ־20. סל של 20 יחידות מאותו מוצר עולה 240 ₪.

הזנת האחוז מעדכנת את מחיר ה־20. הזנת מחיר ה־20 מעדכנת את האחוז. האחוז מחושב מול מחיר האתר ליחידה, לא מול המחיר המחוק. שני מחירי הכמות צריכים להיות מלאים יחד, או ריקים יחד לביטול הנחת הכמות. אפשר להזין 0 בכוונה. המחיר חייב לרדת או להישאר זהה ככל שהכמות עולה.

מחירי הכמות מחושבים לכל דגם בנפרד. מחירי מארזי המדבקות לא השתנו. אין הנחת 40% קבועה או החלה אוטומטית על כל הקטלוג. יש לשמור את השינוי במוצר הרצוי.

רק מנהל ראשי עם אימות דו־שלבי רשאי לשמור. מחיר הבסיס, המחיר המחוק, מחירי הכמות ושאר פרטי המוצר נשמרים בעסקת מסד נתונים אחת. הסל, סיכום ההזמנה והחישוב בצד השרת משתמשים באותן מדרגות. אין הסתמכות על מחיר שנשלח מהדפדפן.

## Installation

1. Apply `sql/magnet-quantity-prices.sql` (new table, read policies, atomic admin save RPC).
2. Apply `sql/magnet-order-pricing.sql` (the existing private checkout function with only its non-pack unit-price lookup changed).
3. Apply `sql/magnet-admin-invoker.sql` (the atomic save runs with the caller's RLS permissions rather than bypassing them).
4. Deploy the frontend and Pages Functions in this PR. The script tags for staff and account pages must remain ES modules.

The schema migration does not populate tiers or change existing product prices. Existing products continue at their current price until an administrator saves quantity prices. The optional table read tolerates a 404 before the schema is installed, but the new save RPC requires installation before the admin update goes live.

## Validation

Run `node --test tests/quantity-prices.test.mjs`. SQL integration checks are in `tests/quantity-prices.sql`; execute them inside a transaction with both migrations and roll back the entire transaction. They verify MFA, anonymous write denial, public/hidden row policies, threshold boundaries and the checkout lookup without creating customer orders or persistent price edits.

The existing `tests/security-smoke.mjs` fails on the same storefront logo assertion on the unchanged base commit `ef780ce`. Its unrelated assertions have not been rewritten in this change.

Google Sheets synchronization is deferred. The created sheet remains private and is not used by this implementation.
