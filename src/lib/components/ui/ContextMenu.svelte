<script lang="ts">
	import { tick } from "svelte";
	import type { Snippet } from "svelte";
	import type { ClassValue } from "svelte/elements";

	export type ContextMenuPlacement = "right" | "left";

	interface Props {
		open: boolean;
		/** Element the menu is anchored to (viewport coordinates). */
		anchor: HTMLElement | null;
		placement?: ContextMenuPlacement;
		/** Gap between anchor and menu panel, in px. */
		gap?: number;
		class?: ClassValue;
		children: Snippet;
	}

	let {
		open,
		anchor,
		placement = "right",
		gap = 10,
		class: className,
		children,
	}: Props = $props();

	let panel = $state<HTMLDivElement | null>(null);
	let style = $state("");

	function updatePosition(): void {
		if (!open || !anchor) {
			style = "";
			return;
		}
		const rect = anchor.getBoundingClientRect();
		const panelEl = panel;
		const panelHeight = panelEl?.offsetHeight ?? 0;
		const top = rect.top + rect.height / 2 - panelHeight / 2;
		const left =
			placement === "right" ? rect.right + gap : rect.left - gap;
		const translateX = placement === "left" ? "translateX(-100%)" : "";
		style = `top:${top}px;left:${left}px;transform:${translateX};`;
	}

	$effect(() => {
		if (!open || !anchor) return;
		tick().then(updatePosition);
		const onLayout = () => updatePosition();
		window.addEventListener("scroll", onLayout, true);
		window.addEventListener("resize", onLayout);
		const ro = new ResizeObserver(onLayout);
		ro.observe(anchor);
		const panelEl = panel;
		if (panelEl) ro.observe(panelEl);
		return () => {
			window.removeEventListener("scroll", onLayout, true);
			window.removeEventListener("resize", onLayout);
			ro.disconnect();
		};
	});

	$effect(() => {
		if (open && panel) updatePosition();
	});
</script>

{#if open && anchor}
	<div
		bind:this={panel}
		class={["pointer-events-auto fixed z-50", className]}
		{style}
		role="menu"
		tabindex="-1"
		onpointerdown={(event) => event.stopPropagation()}
	>
		{@render children()}
	</div>
{/if}
