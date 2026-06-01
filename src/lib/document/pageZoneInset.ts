import { ptToPx } from "./units";

export const DEFAULT_HEADER_ASCENT = "30%";
export const DEFAULT_FOOTER_DESCENT = "30%";

export const ZONE_INSET_UNITS = ["%", "pt"] as const;
export type ZoneInsetUnit = (typeof ZONE_INSET_UNITS)[number];

export function parseZoneInset(raw: string | undefined): {
	value: number;
	unit: ZoneInsetUnit;
} {
	if (!raw?.trim()) return { value: 30, unit: "%" };
	const match = raw.trim().match(/^([\d.,]+)(%|pt)$/);
	if (!match) return { value: 30, unit: "%" };
	const value = Number.parseFloat(match[1].replace(",", "."));
	if (Number.isNaN(value)) return { value: 30, unit: "%" };
	return { value, unit: match[2] as ZoneInsetUnit };
}

export function formatZoneInset(value: number, unit: ZoneInsetUnit): string {
	return `${value.toFixed(unit === "%" ? 0 : 1)}${unit}`;
}

/** Pixel inset within a page margin (render pixels, already scaled). */
export function marginInsetPx(
	value: string | undefined,
	marginPx: number,
	renderScale: number,
	defaultPercent = 30,
): number {
	const raw = value?.trim();
	if (!raw) return marginPx * (defaultPercent / 100);
	const match = raw.match(/^([\d.,]+)(%|pt)$/);
	if (!match) return marginPx * (defaultPercent / 100);
	const n = Number.parseFloat(match[1].replace(",", "."));
	if (Number.isNaN(n)) return marginPx * (defaultPercent / 100);
	if (match[2] === "%") return marginPx * (n / 100);
	return ptToPx(n) * renderScale;
}
