<script lang="ts" module>
	export type SelectableItem = { label: string; hint?: string };
</script>

<script lang="ts">
	import Popup from "$lib/components/ui/Popup.svelte";

	interface Props {
		items: readonly SelectableItem[];
		activeIndex?: number;
		width: number;
		ariaLabel: string;
		/** When false, renders without the Popup wrapper (for use inside a group). */
		shell?: boolean;
		/** Called when row elements change (for aligning a side panel). */
		onrows?: (rows: HTMLElement[]) => void;
		/** Called when the user clicks a row. */
		onselect?: (index: number) => void;
	}

	let {
		items,
		activeIndex = $bindable(0),
		width,
		ariaLabel,
		shell = true,
		onrows,
		onselect,
	}: Props = $props();

	let rowEls = $state<HTMLElement[]>([]);

	function rowRef(node: HTMLElement, index: number) {
		const next = [...rowEls];
		next[index] = node;
		rowEls = next;
		onrows?.(rowEls);
		return {
			destroy() {
				const cleared = [...rowEls];
				delete cleared[index];
				rowEls = cleared.filter(Boolean);
				onrows?.(rowEls);
			},
		};
	}
</script>

{#snippet listContent()}
	<ul class="flex flex-col gap-0.5" role="listbox" aria-label={ariaLabel}>
		{#each items as item, i (item.label)}
			<li role="presentation">
				<button
					type="button"
					use:rowRef={i}
					class={[
						"flex h-8 w-full items-center justify-between rounded-md px-3 text-body-14-tight transition-colors duration-150",
						i === activeIndex
							? "bg-bg-950 text-text-100"
							: "text-text-100 hover:bg-bg-950",
					]}
					role="option"
					aria-selected={i === activeIndex}
					onmouseenter={() => (activeIndex = i)}
					onclick={() => onselect?.(i)}
				>
					<span>{item.label}</span>
					{#if item.hint}
						<span class="text-text-250">{item.hint}</span>
					{/if}
				</button>
			</li>
		{/each}
	</ul>
{/snippet}

{#if shell}
	<Popup padding={8} style="width:{width}px">
		{@render listContent()}
	</Popup>
{:else}
	<div class="shell shrink-0 rounded-lg px-2 py-2.5" style:width="{width}px">
		{@render listContent()}
	</div>
{/if}
