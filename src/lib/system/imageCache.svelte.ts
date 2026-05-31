/**
 * In-memory cache of image bytes keyed by document block ID. Populated when an
 * image block is inserted (read once via the Tauri backend) and consumed by:
 *   - the editor preview, which renders the cached `dataUrl` in an <img>
 *   - the save flow, which writes the cached `bytesBase64` into a sibling
 *     folder next to the user's .typ file so the document is portable.
 *
 * The cache is not part of the serialized `DocumentModel` — it lives only for
 * the current editor session. (We can't open a previously-saved document yet,
 * so there's nothing to rehydrate.)
 */

import { isTauri, readFileBase64 } from "./tauri";
import { open } from "@tauri-apps/plugin-dialog";

const MIME_BY_EXT: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
	bmp: "image/bmp",
};

export interface CachedImage {
	bytesBase64: string;
	dataUrl: string;
	ext: string;
}

class ImageCache {
	private cache = $state<Record<string, CachedImage>>({});

	get(blockId: string): CachedImage | undefined {
		return this.cache[blockId];
	}

	set(blockId: string, image: CachedImage): void {
		this.cache[blockId] = image;
	}

	delete(blockId: string): void {
		delete this.cache[blockId];
	}
}

export const imageCache = new ImageCache();

function extOf(fileName: string): string {
	const dot = fileName.lastIndexOf(".");
	return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

function baseName(path: string): string {
	const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
	return i >= 0 ? path.slice(i + 1) : path;
}

/**
 * Show the system file picker, read the chosen image into the cache, and
 * return its metadata. Resolves to `null` if the user cancels or we're in the
 * browser (no Tauri backend).
 */
export async function pickAndLoadImage(blockId: string): Promise<{
	fileName: string;
	ext: string;
} | null> {
	if (!isTauri()) return null;
	const selected = await open({
		multiple: false,
		directory: false,
		filters: [
			{
				name: "Image",
				extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"],
			},
		],
	});
	if (!selected || typeof selected !== "string") return null;

	const fileName = baseName(selected);
	const ext = extOf(fileName) || "png";
	const bytesBase64 = await readFileBase64(selected);
	const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
	const dataUrl = `data:${mime};base64,${bytesBase64}`;
	imageCache.set(blockId, { bytesBase64, dataUrl, ext });
	return { fileName, ext };
}
