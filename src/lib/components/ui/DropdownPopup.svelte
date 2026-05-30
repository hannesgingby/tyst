<script lang="ts">
	import type { Snippet } from "svelte";
	import type { ClassValue } from "svelte/elements";

	export type DropdownPopupPlacement = "below" | "right";
	/** Horizontal alignment when `placement` is `below`. */
	export type DropdownPopupAlign = "stretch" | "start" | "end";

	interface Props {
		placement?: DropdownPopupPlacement;
		align?: DropdownPopupAlign;
		searchable?: boolean;
		searchPlaceholder?: string;
		searchQuery?: string;
		class?: ClassValue;
		listClass?: ClassValue;
		maxHeightClass?: string;
		children: Snippet;
	}

	let {
		placement = "below",
		align = "stretch",
		searchable = false,
		searchPlaceholder = "Search…",
		searchQuery = $bindable(""),
		class: className,
		listClass,
		maxHeightClass = "max-h-60",
		children,
	}: Props = $props();

	const placementClass = $derived(
		placement === "right"
			? "left-full top-0 ml-1 min-w-full w-max"
			: align === "end"
				? "top-full right-0 mt-1 w-max min-w-full"
				: align === "start"
					? "top-full left-0 mt-1 w-max min-w-full"
					: "top-full right-0 left-0 mt-1",
	);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class={[
		"absolute z-10 overflow-hidden rounded-[6px] border border-border-checkbox-off bg-bg-950 shadow-tooltip",
		placementClass,
		className,
	]}
	onpointerdown={(event) => event.stopPropagation()}
>
	{#if searchable}
		<div class="border-b border-border-checkbox-off px-2.5 pt-2.5 pb-2.5">
			<input
				type="text"
				role="searchbox"
				autocomplete="off"
				spellcheck="false"
				bind:value={searchQuery}
				placeholder={searchPlaceholder}
				class="h-8 w-full border-none bg-transparent px-0.5 text-body-14-tight text-text-100 outline-none placeholder:text-text-250"
				onpointerdown={(event) => event.stopPropagation()}
				onclick={(event) => event.stopPropagation()}
			/>
		</div>
	{/if}
	<div class={["overflow-y-auto", maxHeightClass, listClass]} role="listbox">
		{@render children()}
	</div>
</div>
