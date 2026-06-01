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

/** True when `text` looks like a hostname without a scheme (e.g. google.com, www.foo). */
function looksLikeBareHostname(text: string): boolean {
	return /^www\./i.test(text) || /[a-z0-9]\.[a-z0-9]/i.test(text);
}

/** Ensure a URL has an http(s) scheme for Typst `#link(...)`. */
export function normalizeUrl(text: string): string {
	const t = text.trim();
	if (!t) return t;
	// Scheme present or still being typed (https, https:, https://, http:/, …).
	if (/^https?(\:|\/\/|\/|$)/i.test(t)) return t;
	// Only prefix bare domains; leave partial fragments (p, htt, google) unchanged.
	if (!looksLikeBareHostname(t)) return t;
	return `https://${t}`;
}
