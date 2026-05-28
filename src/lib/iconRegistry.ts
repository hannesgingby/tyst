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
		.replace(/stroke="#[^"]*"/g, 'stroke="currentColor"')
		.replace(/fill="#171717"/g, 'fill="currentColor"')
		.replace(/color="#[^"]*"/g, 'color="currentColor"');
}

export function getIconSvg(name: string): string | undefined {
	return registry[name];
}

export type IconName = keyof typeof registry;
