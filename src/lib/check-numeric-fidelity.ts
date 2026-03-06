import { stripCuratedMarkers } from "./clean-markdown";

export interface NumericFidelityResult {
  passed: boolean;
  mismatches: string[]; // human-readable, merged into hallucinationDetails
}

function stripFormatting(text: string): string {
  // Strip __curated__ markers, then **bold** markers
  return stripCuratedMarkers(text).replace(/\*\*([^*\n]+)\*\*/g, "$1");
}

function isYear(token: string): boolean {
  // Strip $ and commas to get the raw number, then check if it's a 4-digit year
  const raw = token.replace(/[$,]/g, "");
  return /^(19|20)\d{2}$/.test(raw);
}

function normalizeToken(token: string): string {
  // Remove commas from the token
  const t = token.replace(/,/g, "");
  // Expand suffix — MM must be tried before M (financial notation: $3MM = $3M = 3 million)
  const match = t.match(/^(\$?)(\d+(?:\.\d+)?)(MM|[KMBkm])(%?)$/);
  if (match) {
    const [, prefix, numStr, suffix] = match;
    const num = parseFloat(numStr);
    const multipliers: Record<string, number> = {
      MM: 1e6, // financial double-M notation
      K: 1e3, k: 1e3,
      M: 1e6, m: 1e6,
      B: 1e9,
    };
    const expanded = Math.round(num * (multipliers[suffix] ?? 1));
    return `${prefix}${expanded}`;
  }
  return t;
}

function normalizeCuratedText(text: string): string {
  const cleaned = stripFormatting(text);
  // Strip commas from within numeric sequences (handles "1,000,000" → "1000000")
  let result = cleaned;
  let prev: string;
  do {
    prev = result;
    result = result.replace(/(\d),(\d)/g, "$1$2");
  } while (result !== prev);
  // Expand K/M/B suffixes in the curated text so value-based comparison works
  // bidirectionally: original "15,000" ↔ curated "15K", original "$2M" ↔ curated "$2,000,000"
  // Uses \b to avoid matching "15KB" (kilobytes) or "15km" — both K and next char are word chars.
  // MM before M so "3MM" expands correctly as a unit (not "3M" + leftover "M")
  result = result.replace(
    /(\$?)(\d+(?:\.\d+)?)(MM|[KMBkm])\b/g,
    (_, prefix, numStr, suffix) => {
      const multipliers: Record<string, number> = {
        MM: 1e6,
        K: 1e3, k: 1e3,
        M: 1e6, m: 1e6,
        B: 1e9,
      };
      return `${prefix}${Math.round(parseFloat(numStr) * (multipliers[suffix] ?? 1))}`;
    }
  );
  return result;
}

export function checkNumericFidelity(
  originalResume: string,
  curatedResume: string
): NumericFidelityResult {
  const cleanOriginal = stripFormatting(originalResume);
  const cleanCurated = normalizeCuratedText(curatedResume);

  // Note: no \b at end — \b would prevent matching tokens ending in % (non-word char).
  // MM must be tried before M so "$3MM" is captured as one token (= 3 million), not "$3M" + orphan "M".
  const tokenRegex = /\$?[\d,]+(?:\.\d+)?(?:MM|[KMBkm%])?/g;
  const tokens = cleanOriginal.match(tokenRegex) ?? [];

  const mismatches: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    if (isYear(token)) continue;

    const normalized = normalizeToken(token);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    if (!cleanCurated.includes(normalized)) {
      mismatches.push(
        `Metric '${token}' from original resume not found in curated resume`
      );
    }
  }

  return { passed: mismatches.length === 0, mismatches };
}
