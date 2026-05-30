<script lang="ts">
	import Popup from "$lib/components/ui/Popup.svelte";

	export type HeadingLevel = {
		label: string;
		marker: string;
	};

	export const HEADING_LEVELS: HeadingLevel[] = [
		{ label: "Title", marker: "#title" },
		{ label: "Heading 1", marker: "=" },
		{ label: "Heading 2", marker: "==" },
		{ label: "Heading 3", marker: "===" },
		{ label: "Heading 4", marker: "====" },
	];

	interface Props {
		activeIndex?: number;
		/** Called when row elements change (for aligning the numbering panel). */
		onrows?: (rows: HTMLElement[]) => void;
		/** When false, renders without the popup shell (for use inside a group). */
		shell?: boolean;
	}

	let {
		activeIndex = $bindable(0),
		onrows,
		shell = true,
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
	<ul class="flex flex-col gap-0.5" role="listbox" aria-label="Heading level">
		{#each HEADING_LEVELS as level, i (level.label)}
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
				>
					<span>{level.label}</span>
					<span class="text-text-250">{level.marker}</span>
				</button>
			</li>
		{/each}
	</ul>
{/snippet}

{#if shell}
	<Popup padding={8} class="w-[316px]">
		{@render listContent()}
	</Popup>
{:else}
	<div class="shell w-[316px] shrink-0 rounded-lg px-2 py-2.5">
		{@render listContent()}
	</div>
{/if}
