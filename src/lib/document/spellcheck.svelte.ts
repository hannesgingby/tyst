import { LANGUAGE_CODE, DEFAULT_LANGUAGE } from "./languages";

export interface SpellMatch {
	offset: number;
	length: number;
	message: string;
	suggestions: string[];
	/** "spell" → red squiggly; "grammar" → blue squiggly. */
	type: "spell" | "grammar";
	/** The exact word/phrase that was flagged. */
	word: string;
}

// ── Language code mapping ────────────────────────────────────────────────────

function toLanguageToolCode(displayName: string | undefined): string {
	const code = LANGUAGE_CODE[displayName ?? DEFAULT_LANGUAGE] ?? "en";
	// LanguageTool requires a region for English; bare "zh" maps to Simplified.
	if (code === "en") return "en-US";
	if (code === "zh") return "zh-CN";
	return code;
}

// ── CSS Custom Highlight management ─────────────────────────────────────────
// Two named highlights: one for spelling errors (red), one for grammar (blue).
// Each block contributes its own Range objects; we track them so we can remove
// them without rebuilding the full sets every time.

const SPELL_HL = "tyst-spell";
const GRAMMAR_HL = "tyst-grammar";

let spellHL: InstanceType<typeof Highlight> | null = null;
let grammarHL: InstanceType<typeof Highlight> | null = null;
const hlRanges = new Map<string, { spell: Range[]; grammar: Range[] }>();

function ensureHighlights(): boolean {
	if (typeof CSS === "undefined" || !CSS.highlights) return false;
	if (!spellHL) {
		spellHL = new Highlight();
		CSS.highlights.set(SPELL_HL, spellHL);
	}
	if (!grammarHL) {
		grammarHL = new Highlight();
		CSS.highlights.set(GRAMMAR_HL, grammarHL);
	}
	return true;
}

export function setBlockHighlights(blockId: string, spell: Range[], grammar: Range[]): void {
	if (!ensureHighlights()) return;
	const prev = hlRanges.get(blockId);
	if (prev) {
		for (const r of prev.spell) spellHL!.delete(r);
		for (const r of prev.grammar) grammarHL!.delete(r);
	}
	for (const r of spell) spellHL!.add(r);
	for (const r of grammar) grammarHL!.add(r);
	hlRanges.set(blockId, { spell, grammar });
}

export function clearBlockHighlights(blockId: string): void {
	if (!ensureHighlights()) return;
	const prev = hlRanges.get(blockId);
	if (!prev) return;
	for (const r of prev.spell) spellHL!.delete(r);
	for (const r of prev.grammar) grammarHL!.delete(r);
	hlRanges.delete(blockId);
}

// ── LanguageTool API ─────────────────────────────────────────────────────────

interface LTMatch {
	offset: number;
	length: number;
	message: string;
	replacements?: { value: string }[];
	rule?: { issueType?: string };
}

async function fetchMatches(text: string, lang: string | undefined): Promise<SpellMatch[]> {
	const language = toLanguageToolCode(lang);
	const body = new URLSearchParams({ language, text });
	const resp = await fetch("https://api.languagetool.org/v2/check", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	});
	if (!resp.ok) return [];
	const data = (await resp.json()) as { matches?: LTMatch[] };
	return (data.matches ?? []).map((m) => ({
		offset: m.offset,
		length: m.length,
		message: m.message,
		suggestions: (m.replacements ?? []).slice(0, 5).map((r) => r.value),
		type: m.rule?.issueType === "misspelling" ? "spell" : "grammar",
		word: text.slice(m.offset, m.offset + m.length),
	}));
}

// ── Store ────────────────────────────────────────────────────────────────────

class SpellcheckStore {
	/** Reactive map of blockId → matches for that block. */
	matches = $state<Record<string, SpellMatch[]>>({});

	/** The currently open spell-check popup, owned by Document.svelte. */
	activePopup = $state<{ blockId: string; match: SpellMatch; anchorRect: DOMRect } | null>(null);

	readonly #ignored = new Set<string>();
	readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();

	/** Schedule a debounced check for the given block. */
	check(blockId: string, text: string, lang: string | undefined): void {
		const existing = this.#timers.get(blockId);
		if (existing !== undefined) clearTimeout(existing);

		if (!text.trim()) {
			delete this.matches[blockId];
			return;
		}

		this.#timers.set(
			blockId,
			setTimeout(async () => {
				this.#timers.delete(blockId);
				try {
					const all = await fetchMatches(text, lang);
					const filtered = all.filter((m) => !this.#ignored.has(m.word));
					if (filtered.length > 0) {
						this.matches[blockId] = filtered;
					} else {
						delete this.matches[blockId];
					}
				} catch {
					// Silently fail — spell check is best-effort
				}
			}, 500),
		);
	}

	/** Add a word to the ignore list and remove it from all current matches. */
	ignore(word: string): void {
		this.#ignored.add(word);
		for (const [id, list] of Object.entries(this.matches)) {
			const filtered = list.filter((m) => m.word !== word);
			if (filtered.length === 0) {
				delete this.matches[id];
			} else {
				this.matches[id] = filtered;
			}
		}
	}

	/** Cancel any pending check and remove matches for a block. */
	clear(blockId: string): void {
		const timer = this.#timers.get(blockId);
		if (timer !== undefined) {
			clearTimeout(timer);
			this.#timers.delete(blockId);
		}
		delete this.matches[blockId];
	}
}

export const spellcheckStore = new SpellcheckStore();
