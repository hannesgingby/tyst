<script lang="ts">
	import type { Snippet } from "svelte";
	import Icon from "$lib/components/Icon.svelte";
	import Tooltip from "$lib/components/Tooltip.svelte";

	interface Props {
		label: string;
		ariaLabel?: string;
		icon: string;
		iconClass?: string;
		shortcut?: string;
		popupClass?: string;
		active?: boolean;
		popup?: Snippet;
	}

	let {
		label,
		ariaLabel,
		icon,
		iconClass = "size-6",
		shortcut,
		popupClass = "-left-8",
		active = false,
		popup,
	}: Props = $props();

	let open = $state(false);
	let root = $state<HTMLDivElement | null>(null);

	function toggle(): void {
		open = !open;
	}

	function onDocumentPointerDown(event: PointerEvent): void {
		if (!open || !root) return;
		const target = event.target;
		if (target instanceof Node && root.contains(target)) return;
		open = false;
	}

	$effect(() => {
		if (!open) return;
		document.addEventListener("pointerdown", onDocumentPointerDown, true);
		return () => document.removeEventListener("pointerdown", onDocumentPointerDown, true);
	});
</script>

<div class="relative flex items-center" bind:this={root}>
	<Tooltip {label} {shortcut} position="bottom" disabled={open}>
		<button
			type="button"
			class={[
				"relative flex h-6 items-center justify-center rounded-md transition-opacity duration-150 [transition-timing-function:cubic-bezier(0.33,1,0.68,1)]",
				active ? "toolbar-tool-active" : "hover:opacity-50",
			]}
			aria-expanded={open}
			onclick={toggle}
		>
			<Icon name={icon} class="{iconClass} {active ? 'text-current' : 'text-icon'}" />
		</button>
	</Tooltip>

	{#if open && popup}
		<div
			class={["absolute bottom-full z-[60] pb-2.5", popupClass]}
			role="dialog"
			aria-label={ariaLabel ?? label}
		>
			{@render popup()}
		</div>
	{/if}
</div>
