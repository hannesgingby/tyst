import type { PaperPreset, PageSize } from "./types";
import { cmToPt } from "./units";

/** Paper preset dimensions in points (portrait). */
export const PAPER_SIZES: Record<Exclude<PaperPreset, "Custom">, PageSize> = {
	A4: { width: cmToPt(21), height: cmToPt(29.7) },
	A3: { width: cmToPt(29.7), height: cmToPt(42) },
	A5: { width: cmToPt(14.8), height: cmToPt(21) },
	"US Letter": { width: 612, height: 792 },
	"US Legal": { width: 612, height: 1008 },
};

export const PAPER_PRESETS: PaperPreset[] = [
	"A4",
	"A3",
	"A5",
	"US Letter",
	"US Legal",
	"Custom",
];

/** Maps our preset names onto Typst's built-in `paper` identifiers. */
export const TYPST_PAPER_NAME: Partial<Record<PaperPreset, string>> = {
	A4: "a4",
	A3: "a3",
	A5: "a5",
	"US Letter": "us-letter",
	"US Legal": "us-legal",
};

/** Find the preset (if any) whose dimensions match the given size, within a tolerance. */
export function matchPreset(size: PageSize): PaperPreset {
	for (const [preset, dims] of Object.entries(PAPER_SIZES)) {
		if (
			Math.abs(dims.width - size.width) < 0.5 &&
			Math.abs(dims.height - size.height) < 0.5
		) {
			return preset as PaperPreset;
		}
	}
	return "Custom";
}
