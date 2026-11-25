// Shared browser calculation. The database independently computes the order total.
export function quantityUnitPrice(base, quantity, tiers) {
  if (!Number.isSafeInteger(base) || base < 0) return null;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || !tiers) return base;
  const tier = quantity >= 20 ? tiers.price_20_agorot : quantity >= 10 ? tiers.price_10_agorot : base;
  return Number.isSafeInteger(tier) && tier >= 0 ? Math.min(base, tier) : base;
}

export function choicePrice(choice, quantity) {
  return quantityUnitPrice(choice.price, quantity, choice.quantityPrices);
}

export async function loadQuantityPrices(base, key, fetcher = fetch) {
  const response = await fetcher(base + '/rest/v1/mercaz_quantity_prices?select=product_id,price_10_agorot,price_20_agorot', {
    headers: {apikey: key}, cache: 'no-store', signal: AbortSignal.timeout(8000),
  });
  // A preview can run before the additive migration has been installed.
  if (response.status === 404) return new Map();
  if (!response.ok) throw Error('Quantity prices unavailable');
  const rows = await response.json();
  return new Map(rows.map(row => [row.product_id, row]));
}
