/**
 * DUNAZOE Currency Service
 * Converts NGN ↔ USD for Stripe international payments.
 * Uses ExchangeRate-API (free tier) with a 1-hour in-memory cache.
 * Falls back to a conservative static rate if the API is unreachable.
 */

const FALLBACK_USD_RATE = 1600; // NGN per 1 USD — update quarterly if needed
const CACHE_TTL_MS      = 60 * 60 * 1000; // 1 hour

let _cachedRate  = null;
let _cachedAt    = 0;

/**
 * Returns current NGN→USD exchange rate (how many NGN per 1 USD).
 * @returns {Promise<number>}
 */
export async function getExchangeRate() {
  const now = Date.now();
  if (_cachedRate && (now - _cachedAt) < CACHE_TTL_MS) return _cachedRate;

  // Primary: ExchangeRate-API (free, no key needed for NGN→USD)
  try {
    const ctrl  = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    const res   = await fetch(
      "https://open.er-api.com/v6/latest/USD",
      { signal: ctrl.signal, next: { revalidate: 3600 } }
    );
    if (res.ok) {
      const data = await res.json();
      const rate = data?.rates?.NGN;
      if (rate && rate > 0) {
        _cachedRate = rate;
        _cachedAt   = now;
        return rate;
      }
    }
  } catch (_) {}

  // Secondary fallback: Frankfurter
  try {
    const ctrl  = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    const res   = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=NGN",
      { signal: ctrl.signal }
    );
    if (res.ok) {
      const data = await res.json();
      const rate = data?.rates?.NGN;
      if (rate && rate > 0) {
        _cachedRate = rate;
        _cachedAt   = now;
        return rate;
      }
    }
  } catch (_) {}

  // Static fallback — never break payments
  console.warn("[Currency] Could not fetch live rate; using fallback:", FALLBACK_USD_RATE);
  return _cachedRate || FALLBACK_USD_RATE;
}

/**
 * Convert NGN amount to USD, rounded to 2 decimal places.
 * @param {number} amountNgn
 * @returns {Promise<{usd: number, rate: number, source: "live"|"cache"|"fallback"}>}
 */
export async function convertNGNtoUSD(amountNgn) {
  const rate = await getExchangeRate();
  const usd  = Math.max(0.5, parseFloat((amountNgn / rate).toFixed(2)));
  return {
    usd,
    rate,
    ngn:    amountNgn,
    source: _cachedAt > 0 ? "live" : "fallback",
  };
}

/**
 * Stripe requires amount in smallest currency unit (cents).
 * @param {number} amountNgn
 * @returns {Promise<{amountCents: number, usd: number, rate: number}>}
 */
export async function ngnToStripeCents(amountNgn) {
  const { usd, rate } = await convertNGNtoUSD(amountNgn);
  return {
    amountCents: Math.round(usd * 100),
    usd,
    rate,
  };
}
