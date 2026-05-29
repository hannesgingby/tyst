const modules = import.meta.glob("./assets/icons/*.svg", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;

function iconNameFromPath(path: string): string {
	const match = path.match(/\/([^/]+)\.svg$/);
	return match?.[1] ?? path;
}

const registry = Object.fromEntries(
	Object.entries(modules).map(([path, svg]) => [iconNameFromPath(path), normalizeSvg(svg)]),
) as Record<string, string>;

function normalizeSvg(svg: string): string {
	return svg
		.replace(/stroke="#[^"]*"/gi, 'stroke="currentColor"')
		.replace(/stroke="black"/gi, 'stroke="currentColor"')
		.replace(/fill="#171717"/gi, 'fill="currentColor"')
		.replace(/fill="black"/gi, 'fill="currentColor"')
		.replace(/color="#[^"]*"/gi, 'color="currentColor"');
}

export function getIconSvg(name: string): string | undefined {
	return registry[name];
}

export type IconName = keyof typeof registry;
