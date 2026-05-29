<script lang="ts">
	import type { Snippet } from "svelte";
	import type { ClassValue } from "svelte/elements";
	import Icon from "$lib/components/Icon.svelte";

	interface Props {
		value: string;
		options?: readonly string[];
		disabled?: boolean;
		class?: ClassValue;
		onchange?: (value: string) => void;
		menu?: Snippet;
	}

	let {
		value = $bindable(),
		options = [],
		disabled = false,
		class: className,
		onchange,
		menu,
	}: Props = $props();

	let open = $state(false);
	let root = $state<HTMLDivElement | null>(null);

	function toggle(): void {
		if (disabled) return;
		open = !open;
	}

	function select(option: string): void {
		value = option;
		onchange?.(option);
		open = false;
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

<div class={["relative", className]} bind:this={root}>
	<button
		type="button"
		class={[
			"field-shell flex w-full items-center gap-2 pl-3 pr-3",
			disabled && "pointer-events-none opacity-50",
		]}
		aria-expanded={open}
		aria-haspopup="listbox"
		{disabled}
		onclick={toggle}
	>
		<span class="min-w-0 flex-1 truncate text-left">{value}</span>
		<Icon name="nav-arrow-down" class="size-4 shrink-0 text-text-150" />
	</button>

	{#if open}
		<div
			class="absolute top-full right-0 left-0 z-10 mt-1 overflow-hidden rounded-md border border-border-checkbox-off bg-bg-950 py-1 shadow-tooltip"
			role="listbox"
		>
			{#if menu}
				{@render menu()}
			{:else}
				{#each options as option}
					<button
						type="button"
						class={[
							"flex w-full px-3 py-1.5 text-left text-body-14-tight transition-colors duration-150",
							option === value
								? "bg-bg-850 text-text-100"
								: "text-text-100 hover:bg-bg-850",
						]}
						role="option"
						aria-selected={option === value}
						onclick={() => select(option)}
					>
						{option}
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>
