import { save } from "@tauri-apps/plugin-dialog";
import { compilePdf, isTauri, writeTextFile } from "./tauri";
import { documentStore } from "$lib/document/store.svelte";

function sanitizeFileName(name: string): string {
	return name.trim().replace(/[\\/:*?"<>|]/g, "-") || "document";
}

/** Save the current document as a `.typ` file via a native save dialog. */
export async function saveTypFile(): Promise<void> {
	if (!isTauri()) {
		console.warn("Saving is only available in the desktop app.");
		return;
	}
	const base = sanitizeFileName(documentStore.model.name);
	const path = await save({
		defaultPath: `${base}.typ`,
		filters: [{ name: "Typst", extensions: ["typ"] }],
	});
	if (!path) return;
	await writeTextFile(path, documentStore.typ);
}

/** Export the current document to PDF via a native save dialog. */
export async function exportPdf(): Promise<void> {
	if (!isTauri()) {
		console.warn("PDF export is only available in the desktop app.");
		return;
	}
	const base = sanitizeFileName(documentStore.model.name);
	const path = await save({
		defaultPath: `${base}.pdf`,
		filters: [{ name: "PDF", extensions: ["pdf"] }],
	});
	if (!path) return;
	await compilePdf(documentStore.typ, path);
}
