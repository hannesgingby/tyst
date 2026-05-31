import type { ParagraphSettings, TypographySettings } from "./types";

/**
 * Typst's per-line text box height in `em` (Libertinus Serif 11pt, default
 * `text` top/bottom edges), measured with `measure(text[…]).height / size`.
 *
 * Typst advances each line by `text-height + par.leading` (baseline to
 * baseline), *not* by CSS `line-height: 1` or the font's full ascender+
 * descender (~1.14em for Libertinus). See `par.leading` in the Typst docs and
 * `scripts/measure-line-metrics.typ` to re-check after font/Typst upgrades.
 */
export const LINE_ADVANCE_BASE = 0.658;

/** Baseline-to-baseline step for one line in the editor preview. */
export function bodyLineHeightEm(leading: number): number {
	return leading + LINE_ADVANCE_BASE;
}

/** Whether paragraph spacing is tied to line height (first-line indent flow). */
export function parSpacingMatchesLeading(
	paragraph: ParagraphSettings,
	typography: TypographySettings,
): boolean {
	if (paragraph.spacingFollowsLeading) return true;
	if (paragraph.firstLineIndent == null) return false;
	return Math.abs(paragraph.spacing - typography.leading) < 0.001;
}

/**
 * Visual height of the empty parbreak block between paragraphs.
 *
 * The editor uses one block per line at CSS `line-height: text-height + leading`.
 * Stacking two text blocks already consumes one full line step. When Typst has
 * `par.spacing == par.leading` (recommended with first-line indent), there is
 * no extra edge gap beyond that — only the indent marks the new paragraph.
 * Otherwise `par.spacing` is the additional gap between paragraph edges.
 */
export function parbreakGapEm(
	paragraph: ParagraphSettings,
	typography: TypographySettings,
	fallbackSpacing?: number,
): number {
	if (parSpacingMatchesLeading(paragraph, typography)) return 0;
	return fallbackSpacing ?? paragraph.spacing;
}
