/**
 * Unit conversions for the document system.
 *
 * Typst (and PDF) work in typographic points (pt), where 1pt = 1/72 inch.
 * CSS uses px where 1px = 1/96 inch. To render the document so that it matches
 * the eventual PDF output exactly, we lay the page out at its *true* size in CSS
 * pixels (derived from pt) and then visually scale the whole page with a CSS
 * transform. See `Document.svelte`.
 */

export const PT_PER_INCH = 72;
export const PX_PER_INCH = 96;

/** CSS pixels per typographic point. */
export const PX_PER_PT = PX_PER_INCH / PT_PER_INCH; // 1.3333…

/** Points per centimetre / millimetre. */
export const PT_PER_CM = PT_PER_INCH / 2.54; // 28.3464…
export const PT_PER_MM = PT_PER_CM / 10;

export function ptToPx(pt: number): number {
	return pt * PX_PER_PT;
}

export function pxToPt(px: number): number {
	return px / PX_PER_PT;
}

export function cmToPt(cm: number): number {
	return cm * PT_PER_CM;
}

export function ptToCm(pt: number): number {
	return pt / PT_PER_CM;
}

export function cmToPx(cm: number): number {
	return ptToPx(cmToPt(cm));
}

/** Format a number for `.typ` output without a trailing `.0` and with a max precision. */
export function typstNumber(value: number, precision = 4): string {
	const rounded = Number(value.toFixed(precision));
	return String(rounded);
}
