import { save } from "@tauri-apps/plugin-dialog";
import { compilePdf, ensureDir, isTauri, writeBytesFile, writeTextFile } from "./tauri";
import { documentStore } from "$lib/document/store.svelte";
import { imageCache } from "./imageCache.svelte";

function sanitizeFileName(name: string): string {
	return name.trim().replace(/[\\/:*?"<>|]/g, "-") || "document";
}

/** Folder name (relative to the .typ file) where embedded image bytes live. */
function imagesFolderName(): string {
	const base =
		documentStore.model.name.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "_") ||
		"document";
	return `${base}_files`;
}

function dirNameOf(path: string): string {
	const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
	return i >= 0 ? path.slice(0, i) : ".";
}

function pathJoin(...parts: string[]): string {
	return parts.filter(Boolean).join("/");
}

/**
 * Walk all image blocks in the document and write their cached bytes into a
 * sibling folder next to the saved .typ file. Path scheme matches
 * `serialize.ts#imageRelativePath` so the emitted `#image("…")` calls resolve.
 */
async function writeEmbeddedImages(typPath: string): Promise<void> {
	const dir = dirNameOf(typPath);
	const folder = pathJoin(dir, imagesFolderName());
	let needsDir = false;
	for (const block of documentStore.model.blocks) {
		if (!block.image) continue;
		const cached = imageCache.get(block.id);
		if (!cached) continue;
		needsDir = true;
		break;
	}
	if (!needsDir) return;
	await ensureDir(folder);
	for (const block of documentStore.model.blocks) {
		if (!block.image) continue;
		const cached = imageCache.get(block.id);
		if (!cached) continue;
		const target = pathJoin(folder, `${block.id}.${block.image.ext}`);
		await writeBytesFile(target, cached.bytesBase64);
	}
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
	if (!path) return;
	await writeEmbeddedImages(path);
	await writeTextFile(path, documentStore.typ);
}

/** Export the current document to PDF via a native save dialog. */
export async function exportPdf(): Promise<void> {
	const path = await pickPath("pdf", "PDF");
	if (!path) return;
	// Typst CLI resolves #image paths relative to the source file, which lives
	// in a temp dir during compile. Write image bytes next to the chosen PDF
	// destination AND next to the temp .typ so the compile actually finds them.
	await writeEmbeddedImages(path);
	await compilePdf(documentStore.typ, path);
}
