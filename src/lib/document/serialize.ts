import type {
	Block,
	DocumentModel,
	FontWeightName,
	Margins,
	PageSettings,
	ParagraphSettings,
	TypographySettings,
} from "./types";
import { TYPST_PAPER_NAME } from "./paperSizes";
import { typstNumber } from "./units";

const WEIGHT_KEYWORD: Record<FontWeightName, string> = {
	Regular: "regular",
	Medium: "medium",
	Bold: "bold",
};

/** Escape characters that are significant in Typst markup. */
function escapeText(text: string): string {
	return text.replace(/([\\#$*_`<>@~\[\]])/g, "\\$1");
}

function hexToRgb(hex: string): string {
	return `rgb("${hex.toUpperCase()}")`;
}

/** Build `text(...)` argument lines from a (possibly partial) typography object. */
function textArgs(t: Partial<TypographySettings>): string[] {
	const lines: string[] = [];
	if (t.fontFamily !== undefined) lines.push(`font: "${t.fontFamily}"`);
	if (t.size !== undefined) lines.push(`size: ${typstNumber(t.size)}pt`);
	if (t.weight !== undefined) lines.push(`weight: "${WEIGHT_KEYWORD[t.weight]}"`);
	if (t.color !== undefined) lines.push(`fill: ${hexToRgb(t.color)}`);
	if (t.tracking !== undefined && t.tracking !== 0) {
		lines.push(`tracking: ${typstNumber(t.tracking / 100)}em`);
	}
	return lines;
}

/** Build `par(...)` argument lines. `leading` comes from the typography object. */
function parArgs(leading: number | undefined, p: Partial<ParagraphSettings>): string[] {
	const lines: string[] = [];
	if (leading !== undefined) lines.push(`leading: ${typstNumber(leading)}em`);
	if (p.spacing !== undefined) lines.push(`spacing: ${typstNumber(p.spacing)}em`);
	if (p.justify !== undefined) lines.push(`justify: ${p.justify ? "true" : "false"}`);
	if (p.firstLineIndent != null) lines.push(`first-line-indent: ${typstNumber(p.firstLineIndent)}em`);
	if (p.hangingIndent != null) lines.push(`hanging-indent: ${typstNumber(p.hangingIndent)}em`);
	return lines;
}

/** Serialize margins to a Typst margin(...) expression. */
function serializeMargins(m: Margins): string {
	const parts: string[] = [];
	if (m.x != null) parts.push(`x: ${typstNumber(m.x)}pt`);
	if (m.y != null) parts.push(`y: ${typstNumber(m.y)}pt`);
	parts.push(`left: ${typstNumber(m.left)}cm`);
	parts.push(`right: ${typstNumber(m.right)}cm`);
	parts.push(`top: ${typstNumber(m.top)}cm`);
	parts.push(`bottom: ${typstNumber(m.bottom)}cm`);
	return `(${parts.join(", ")})`;
}

/** Serialize a full #set page(...) call for a given PageSettings. */
function serializePageSetFull(page: PageSettings): string {
	const lines: string[] = [];
	const paperName = TYPST_PAPER_NAME[page.preset];
	if (paperName) {
		lines.push(`  paper: "${paperName}",`);
	} else {
		lines.push(`  width: ${typstNumber(page.size.width)}pt,`);
		lines.push(`  height: ${typstNumber(page.size.height)}pt,`);
	}
	if (page.landscape) lines.push(`  flipped: true,`);
	lines.push(`  margin: ${serializeMargins(page.margins)},`);
	lines.push(`  fill: ${hexToRgb(page.fill)},`);
	return `#set page(\n${lines.join("\n")}\n)`;
}

/**
 * Compute the `#set page(...)` calls needed to transition from `prev`'s
 * resolved settings to `curr`'s resolved settings. Returns an empty array when
 * nothing changed. Only outputs the sections that actually differ, since Typst's
 * `#set page` is additive (unchanged properties keep their previous value).
 */
function serializePageTransition(
	defaultPage: PageSettings,
	prev: PageSettings,
	curr: PageSettings,
): string[] {
	// Resolve each section through the link system.
	const prevMargin = prev.linked.margin ? defaultPage : prev;
	const currMargin = curr.linked.margin ? defaultPage : curr;
	const prevPaper = prev.linked.paper ? defaultPage : prev;
	const currPaper = curr.linked.paper ? defaultPage : curr;
	const prevColor = prev.linked.color ? defaultPage : prev;
	const currColor = curr.linked.color ? defaultPage : curr;

	const pageArgs: string[] = [];

	// Paper / size
	if (
		currPaper.preset !== prevPaper.preset ||
		currPaper.size.width !== prevPaper.size.width ||
		currPaper.size.height !== prevPaper.size.height ||
		currPaper.landscape !== prevPaper.landscape
	) {
		const paperName = TYPST_PAPER_NAME[currPaper.preset];
		if (paperName) {
			pageArgs.push(`paper: "${paperName}"`);
		} else {
			pageArgs.push(`width: ${typstNumber(currPaper.size.width)}pt`);
			pageArgs.push(`height: ${typstNumber(currPaper.size.height)}pt`);
		}
		if (currPaper.landscape !== prevPaper.landscape) {
			pageArgs.push(`flipped: ${currPaper.landscape}`);
		}
	}

	// Margins
	const pm = prevMargin.margins;
	const cm = currMargin.margins;
	if (
		pm.left !== cm.left || pm.right !== cm.right ||
		pm.top !== cm.top || pm.bottom !== cm.bottom ||
		pm.x !== cm.x || pm.y !== cm.y
	) {
		pageArgs.push(`margin: ${serializeMargins(cm)}`);
	}

	// Fill / color
	if (currColor.fill !== prevColor.fill) {
		pageArgs.push(`fill: ${hexToRgb(currColor.fill)}`);
	}

	// Only emit #set page() if something changed; the caller always emits the pagebreak.
	return pageArgs.length > 0 ? [`#set page(${pageArgs.join(", ")})`] : [];
}

/** The document preamble: page, default text and default paragraph set rules. */
function serializePreamble(doc: DocumentModel): string {
	const textRule = `#set text(\n${textArgs(doc.typography)
		.map((l) => `  ${l},`)
		.join("\n")}\n)`;
	const parRule = `#set par(\n${parArgs(doc.typography.leading, doc.paragraph)
		.map((l) => `  ${l},`)
		.join("\n")}\n)`;

	return [serializePageSetFull(doc.pages[0]), textRule, parRule].join("\n\n");
}

/** Serialize a single block, wrapping it in scoped set rules if it has overrides. */
function serializeBlock(block: Block, docTypo: TypographySettings): string {
	const text = escapeText(block.text);
	const typo = block.typography ?? {};
	const para = block.paragraph ?? {};

	if (block.continuation) {
		// Inline block: use #text(...)[content] with only the args that differ
		// from the document defaults. The #[...] scoped-block form is block-level
		// in Typst and would break the line — the function-call form stays inline.
		const diffTypo: Partial<TypographySettings> = {};
		for (const key of Object.keys(typo) as (keyof TypographySettings)[]) {
			if (typo[key] !== docTypo[key]) diffTypo[key] = typo[key] as never;
		}
		const tArgs = textArgs(diffTypo);
		if (tArgs.length === 0) return text;
		return `#text(${tArgs.join(", ")})[${text}]`;
	}

	const overrides: string[] = [];
	const tArgs = textArgs(typo);
	if (tArgs.length > 0) overrides.push(`#set text(${tArgs.join(", ")})`);
	const pArgs = parArgs(typo.leading, para);
	if (pArgs.length > 0) overrides.push(`#set par(${pArgs.join(", ")})`);

	if (overrides.length === 0) return text;
	return ["#[", ...overrides.map((o) => `  ${o}`), `  ${text}`, "]"].join("\n");
}

/**
 * Serialize the whole document model into a `.typ` source string.
 *
 * `pageBreakBlockIds` is an ordered list of block IDs that each start a new
 * page in the editor's visual layout. A `#pagebreak()` (plus any changed
 * `#set page(...)` calls) is inserted before each such block.
 *
 * Continuation blocks (marked `block.continuation`) are joined to the previous
 * block without any separator — they're inline on the same line.
 *
 * Two adjacent non-continuation, non-empty lines become `#linebreak()`.
 * One or more blank lines become `#parbreak()` + extra `#linebreak()`s.
 */
export function serializeDocument(
	doc: DocumentModel,
	pageBreakBlockIds: string[] = [],
): string {
	const preamble = serializePreamble(doc);

	const pageBreakSet = new Set(pageBreakBlockIds);
	const defaultPage = doc.pages[0];

	// Build a map: blockId → page index (1-based for pages after the first).
	// We walk pageBreakBlockIds in order to assign increasing page indices.
	const blockPageIndex = new Map<string, number>();
	let pi = 1;
	for (const id of pageBreakBlockIds) blockPageIndex.set(id, pi++);

	let currentPageIdx = 0;

	const parts: string[] = [];
	let pendingBlanks = 0;
	let hasContent = false;

	for (const block of doc.blocks) {
		// ── Page break ──────────────────────────────────────────────────────
		if (pageBreakSet.has(block.id)) {
			const nextPageIdx = blockPageIndex.get(block.id)!;
			const prevPage = doc.pages[currentPageIdx] ?? defaultPage;
			const nextPage = doc.pages[nextPageIdx] ?? defaultPage;
			currentPageIdx = nextPageIdx;
			hasContent = false;
			pendingBlanks = 0;

			parts.push("#pagebreak()");
			parts.push(...serializePageTransition(defaultPage, prevPage, nextPage));
		}

		// ── Blank block (empty line / parbreak placeholder) ──────────────────
		if (block.text === "") {
			if (hasContent && !block.continuation) pendingBlanks += 1;
			continue;
		}

		// ── Content block ────────────────────────────────────────────────────
		const serialized = serializeBlock(block, doc.typography);
		if (hasContent && block.continuation) {
			// Concatenate directly onto the previous part — no newline so Typst
			// keeps everything on the same line without inserting extra whitespace.
			parts[parts.length - 1] += serialized;
		} else {
			if (hasContent) {
				if (pendingBlanks === 0) {
					parts.push("#linebreak()");
				} else {
					parts.push("#parbreak()");
					for (let k = 1; k < pendingBlanks; k++) parts.push("#linebreak()");
				}
			}
			parts.push(serialized);
		}
		pendingBlanks = 0;
		hasContent = true;
	}

	const body = parts.join("\n");
	return `${preamble}\n\n${body}\n`;
}
