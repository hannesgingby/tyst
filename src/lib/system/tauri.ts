/**
 * Thin wrappers around Tauri APIs that degrade gracefully when the app is run
 * in a plain browser (e.g. `bun run dev` without the desktop shell).
 */
import { invoke, isTauri } from "@tauri-apps/api/core";

export { isTauri };

export interface FontFamilyInfo {
	name: string;
	/** Available weight values, e.g. [400, 700]. Sorted ascending. */
	weights: number[];
}

/** Enumerate the font families installed on the user's system (Tauri only). */
export async function listSystemFonts(): Promise<FontFamilyInfo[]> {
	if (!isTauri()) return [];
	try {
		return await invoke<FontFamilyInfo[]>("list_system_fonts");
	} catch (error) {
		console.error("Failed to list system fonts:", error);
		return [];
	}
}

/** Write a UTF-8 text file to disk via the Rust backend. */
export async function writeTextFile(path: string, contents: string): Promise<void> {
	await invoke("write_text_file", { path, contents });
}

/** Read a file from disk and return its bytes as a base64 string. */
export async function readFileBase64(path: string): Promise<string> {
	return await invoke<string>("read_file_base64", { path });
}

/** Decode `dataBase64` and write it to `path` (creating parent dirs as needed). */
export async function writeBytesFile(path: string, dataBase64: string): Promise<void> {
	await invoke("write_bytes_file", { path, dataBase64 });
}

/** Create a directory (and any missing parents). No-op if it already exists. */
export async function ensureDir(path: string): Promise<void> {
	await invoke("ensure_dir", { path });
}

/**
 * Compile Typst source to a PDF at `outPath`. Returns nothing on success and
 * throws with a human-readable message on failure.
 */
export async function compilePdf(typSource: string, outPath: string): Promise<void> {
	await invoke("export_pdf", { typSource, outPath });
}
