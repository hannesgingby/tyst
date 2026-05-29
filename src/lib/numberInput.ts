export function snapToStep(value: number, step: number, min: number, max: number): number {
	const snapped = Math.round(value / step) * step;
	const precision = step < 1 ? Math.ceil(-Math.log10(step)) : 0;
	const fixed = Number(snapped.toFixed(precision));
	return Math.min(max, Math.max(min, fixed));
}

export function formatDecimal(value: number, decimals?: number): string {
	const d = decimals ?? (Number.isInteger(value) ? 0 : 2);
	return value.toFixed(d).replace(".", ",");
}

export function parseDecimal(text: string): number {
	return Number.parseFloat(text.replace(",", "."));
}
