import { listSystemFonts } from "./tauri";
import type { FontWeightName } from "$lib/document/types";

/** Fonts shown before system enumeration (and the only fonts in browser dev). */
const FALLBACK_FONTS = [
    "Libertinus Serif",
    "Arial",
    "Georgia",
    "Helvetica",
    "Times New Roman",
];

const ALL_WEIGHTS: FontWeightName[] = ["Regular", "Medium", "Bold"];

/** Numeric weight values for each FontWeightName. */
const WEIGHT_VALUE: Record<FontWeightName, number> = {
    Regular: 400,
    Medium: 500,
    Bold: 700,
};

/** Reactive registry of font families available for the document. */
class FontStore {
    families = $state<string[]>([...FALLBACK_FONTS]);
    /** Map from family name to set of available numeric weights. */
    private weightsByFamily = $state<Map<string, Set<number>>>(new Map());
    loaded = $state(false);

    /** Load system fonts once; subsequent calls are no-ops. */
    async ensureLoaded(): Promise<void> {
        if (this.loaded) return;
        this.loaded = true;
        const fonts = await listSystemFonts();
        if (fonts.length > 0) {
            this.families = fonts.map((f) => f.name);
            this.weightsByFamily = new Map(
                fonts.map((f) => [f.name, new Set(f.weights)]),
            );
        }
    }

    /**
     * Returns the weight names available for the given font family.
     * Falls back to all three options when font data isn't loaded yet
     * (browser dev mode or before load completes).
     */
    availableWeights(family: string): FontWeightName[] {
        const weights = this.weightsByFamily.get(family);
        if (!weights || weights.size === 0) return ALL_WEIGHTS;
        return ALL_WEIGHTS.filter((w) => weights.has(WEIGHT_VALUE[w]));
    }
}

export const fontStore = new FontStore();
