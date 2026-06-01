/** True when `text` looks like a web URL (http(s) or www.). */
export function isUrl(text: string): boolean {
	const t = text.trim();
	if (!t) return false;
	if (/^https?:\/\//i.test(t)) {
		try {
			const u = new URL(t);
			return u.protocol === "http:" || u.protocol === "https:";
		} catch {
			return false;
		}
	}
	if (/^www\./i.test(t)) return true;
	return false;
}

/** Ensure a URL has an http(s) scheme for Typst `#link(...)`. */
export function normalizeUrl(text: string): string {
	const t = text.trim();
	if (/^https?:\/\//i.test(t)) return t;
	return `https://${t}`;
}
