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

/**
 * Cyclable units for the font-size input. The model stores the size in points
 * (Typst's native unit), so each entry knows how many points one of its units
 * is worth and how it should be displayed/stepped in the UI.
 */
export interface FontSizeUnit {
	unit: string;
	/** Points per 1 of this unit. */
	ptPer: number;
	decimals: number;
	step: number;
}

export const FONT_SIZE_UNITS: readonly FontSizeUnit[] = [
	{ unit: "pt", ptPer: 1, decimals: 1, step: 0.5 },
	{ unit: "px", ptPer: 1 / PX_PER_PT, decimals: 1, step: 1 },
];

export function fontSizeUnit(unit: string): FontSizeUnit {
	return FONT_SIZE_UNITS.find((u) => u.unit === unit) ?? FONT_SIZE_UNITS[0];
}

export function ptToUnit(pt: number, unit: string): number {
	return pt / fontSizeUnit(unit).ptPer;
}

export function unitToPt(value: number, unit: string): number {
	return value * fontSizeUnit(unit).ptPer;
}

/** Format a number for `.typ` output without a trailing `.0` and with a max precision. */
export function typstNumber(value: number, precision = 4): string {
	const rounded = Number(value.toFixed(precision));
	return String(rounded);
}
