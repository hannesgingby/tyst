/**
 * Lightweight implementation of Typst's `numbering` patterns for the editor
 * preview. We support the symbols `1`, `a`, `A`, `i`, `I` which is the
 * subset useful for flat (non-nested) lists.
 *
 * See https://typst.app/docs/reference/model/numbering/ for the full reference.
 */

const SYMBOLS = new Set(["1", "a", "A", "i", "I"]);

function toAlpha(n: number, upper: boolean): string {
	if (n <= 0) return "";
	let result = "";
	while (n > 0) {
		n--;
		result = String.fromCharCode((upper ? 65 : 97) + (n % 26)) + result;
		n = Math.floor(n / 26);
	}
	return result;
}

function toRoman(n: number, upper: boolean): string {
	if (n <= 0) return "";
	const map: Array<[string, number]> = [
		["M", 1000], ["CM", 900], ["D", 500], ["CD", 400],
		["C", 100], ["XC", 90], ["L", 50], ["XL", 40],
		["X", 10], ["IX", 9], ["V", 5], ["IV", 4], ["I", 1],
	];
	let out = "";
	for (const [r, v] of map) {
		while (n >= v) {
			out += r;
			n -= v;
		}
	}
	return upper ? out : out.toLowerCase();
}

function renderSymbol(symbol: string, n: number): string {
	switch (symbol) {
		case "1": return String(n);
		case "a": return toAlpha(n, false);
		case "A": return toAlpha(n, true);
		case "i": return toRoman(n, false);
		case "I": return toRoman(n, true);
		default: return String(n);
	}
}

/**
 * Format a 1-based index with a Typst-style numbering pattern. Only the first
 * symbol in the pattern is used (sub-level symbols are ignored — we don't
 * support nested lists in the editor preview).
 *
 * Examples:
 *   formatItem("1.", 3)  → "3."
 *   formatItem("a)", 2)  → "b)"
 *   formatItem("I.", 4)  → "IV."
 *   formatItem("1.a", 5) → "5." (sub-symbol stripped)
 */
export function formatItem(pattern: string, index: number): string {
	let symbolIdx = -1;
	for (let i = 0; i < pattern.length; i++) {
		if (SYMBOLS.has(pattern[i])) {
			symbolIdx = i;
			break;
		}
	}
	if (symbolIdx < 0) return pattern;

	const prefix = pattern.slice(0, symbolIdx);
	const symbol = pattern[symbolIdx];
	// Strip any further symbol chars (those address nested levels).
	let suffix = "";
	let nestedSeen = false;
	for (let i = symbolIdx + 1; i < pattern.length; i++) {
		if (SYMBOLS.has(pattern[i])) nestedSeen = true;
		else if (!nestedSeen) suffix += pattern[i];
	}
	return prefix + renderSymbol(symbol, index) + suffix;
}
