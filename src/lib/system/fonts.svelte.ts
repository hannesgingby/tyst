import { FALLBACK_FONTS, listSystemFonts } from "./tauri";

/** Reactive registry of font families available for the document. */
class FontStore {
	families = $state<string[]>([...FALLBACK_FONTS]);
	loaded = $state(false);

	/** Load system fonts once; subsequent calls are no-ops. */
	async ensureLoaded(): Promise<void> {
		if (this.loaded) return;
		this.loaded = true;
		const families = await listSystemFonts();
		if (families.length > 0) this.families = families;
	}
}

export const fontStore = new FontStore();
