/**
 * Typst-style `numbering` patterns for the editor preview.
 *
 * See https://typst.app/docs/reference/model/numbering/
 */

const COUNTING_SYMBOLS = new Set([
	"1", "a", "A", "i", "I", "α", "Α", "一", "壹", "あ", "い", "ア", "イ", "א",
	"가", "ㄱ", "*", "١", "۱", "१", "ৱ", "ক", "①", "⓵",
]);

const SYMBOL_SUFFIXES = ["†", "‡", "§", "¶", "‖"];

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
		case "*": {
			if (n <= 0) return "";
			if (n <= SYMBOL_SUFFIXES.length) return SYMBOL_SUFFIXES[n - 1];
			const base = SYMBOL_SUFFIXES[SYMBOL_SUFFIXES.length - 1];
			return base.repeat(Math.ceil(n / SYMBOL_SUFFIXES.length));
		}
		default: return String(n);
	}
}

function symbolIndices(pattern: string): number[] {
	const indices: number[] = [];
	for (let i = 0; i < pattern.length; i++) {
		if (COUNTING_SYMBOLS.has(pattern[i])) indices.push(i);
	}
	return indices;
}

/**
 * Format numbers with a Typst numbering pattern.
 *
 * Examples (matching Typst):
 *   formatNumbering("1.", [3])     → "3."
 *   formatNumbering("1.a", [3])    → "3"
 *   formatNumbering("1.a)", [3])   → "3)"
 *   formatNumbering("1.1", [1, 2]) → "1.2"
 */
export function formatNumbering(pattern: string, numbers: readonly number[]): string {
	const indices = symbolIndices(pattern);
	if (indices.length === 0 || numbers.length === 0) return pattern;

	const lastSym = indices[indices.length - 1];
	const globalSuffix = pattern.slice(lastSym + 1);

	const n = numbers.length;
	const lastSlot = indices.length - 1;
	let out = "";

	for (let level = 0; level < n; level++) {
		const symbolSlot = Math.min(level, lastSlot);
		const symIdx = indices[symbolSlot]!;
		if (level === 0) {
			out += pattern.slice(0, symIdx);
		} else {
			const prevSymIdx = indices[Math.min(level - 1, lastSlot)]!;
			if (symbolSlot === lastSlot && level >= indices.length) {
				// More numbers than symbols: repeat the last symbol and its prefix.
				const prevLastIdx = lastSlot > 0 ? indices[lastSlot - 1]! : -1;
				out += pattern.slice(prevLastIdx + 1, symIdx);
			} else {
				out += pattern.slice(prevSymIdx + 1, symIdx);
			}
		}
		out += renderSymbol(pattern[symIdx], numbers[level]!);
	}

	out += globalSuffix;
	return out;
}

/** Shorthand for a single counter (flat lists). */
export function formatItem(pattern: string, index: number): string {
	return formatNumbering(pattern, [index]);
}
