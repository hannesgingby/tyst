/**
 * Thin wrappers around Tauri APIs that degrade gracefully when the app is run
 * in a plain browser (e.g. `bun run dev` without the desktop shell).
 */
import { invoke, isTauri } from "@tauri-apps/api/core";

export { isTauri };

/** Enumerate the font families installed on the user's system (Tauri only). */
export async function listSystemFonts(): Promise<string[]> {
	if (!isTauri()) return [];
	try {
		return await invoke<string[]>("list_system_fonts");
	} catch (error) {
		console.error("Failed to list system fonts:", error);
		return [];
	}
}

/** Write a UTF-8 text file to disk via the Rust backend. */
export async function writeTextFile(path: string, contents: string): Promise<void> {
	await invoke("write_text_file", { path, contents });
}

/**
 * Compile Typst source to a PDF at `outPath`. Returns nothing on success and
 * throws with a human-readable message on failure.
 */
export async function compilePdf(typSource: string, outPath: string): Promise<void> {
	await invoke("export_pdf", { typSource, outPath });
}
