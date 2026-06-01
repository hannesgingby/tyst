<script lang="ts">
	import type { Snippet } from "svelte";
	import type { ClassValue } from "svelte/elements";
	import Icon from "$lib/components/Icon.svelte";

	interface Props {
		children?: Snippet;
		type?: "button" | "submit";
		disabled?: boolean;
		class?: ClassValue;
		/** Trailing icon name from the icon registry. */
		icon?: string;
		iconClass?: string;
		onclick?: (event: MouseEvent) => void;
	}

	let {
		children,
		type = "button",
		disabled = false,
		class: className,
		icon,
		iconClass = "size-4 shrink-0",
		onclick,
	}: Props = $props();
</script>

<button
	{type}
	{disabled}
	class={[
		"inline-flex items-center gap-1 rounded-md bg-tag-blue-bg px-3 py-1.5 text-body-14-tight text-tag-blue-text transition-opacity duration-150 hover:opacity-80 disabled:pointer-events-none disabled:opacity-50",
		className,
	]}
	{onclick}
>
	{#if children}
		{@render children()}
	{/if}
	{#if icon}
		<Icon name={icon} class={iconClass} />
	{/if}
</button>
