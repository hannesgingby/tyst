import { save } from "@tauri-apps/plugin-dialog";
import { compilePdf, isTauri, writeTextFile } from "./tauri";
import { documentStore } from "$lib/document/store.svelte";

function sanitizeFileName(name: string): string {
	return name.trim().replace(/[\\/:*?"<>|]/g, "-") || "document";
}

/** Prompt the user for a destination path, or null if cancelled / not in Tauri. */
async function pickPath(extension: string, filterName: string): Promise<string | null> {
	if (!isTauri()) {
		console.warn(`${filterName} is only available in the desktop app.`);
		return null;
	}
	const base = sanitizeFileName(documentStore.model.name);
	return await save({
		defaultPath: `${base}.${extension}`,
		filters: [{ name: filterName, extensions: [extension] }],
	});
}

/** Save the current document as a `.typ` file via a native save dialog. */
export async function saveTypFile(): Promise<void> {
	const path = await pickPath("typ", "Typst");
	if (path) await writeTextFile(path, documentStore.typ);
}

/** Export the current document to PDF via a native save dialog. */
export async function exportPdf(): Promise<void> {
	const path = await pickPath("pdf", "PDF");
	if (path) await compilePdf(documentStore.typ, path);
}
