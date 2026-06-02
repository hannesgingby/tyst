<script lang="ts">
	import type { SpellMatch } from "$lib/document/spellcheck.svelte";

	interface Props {
		match: SpellMatch;
		anchorRect: DOMRect;
		onsuggestion: (suggestion: string) => void;
		onignore: () => void;
		ondismiss: () => void;
	}

	let { match, anchorRect, onsuggestion, onignore, ondismiss }: Props = $props();

	let el = $state<HTMLElement | null>(null);

	// Position: centred on the word, 6 px below its baseline.
	// Clamp to viewport so it doesn't overflow left/right.
	const POPUP_WIDTH = 220;
	const OFFSET_Y = 6;

	const left = $derived.by(() => {
		const ideal = anchorRect.left + anchorRect.width / 2 - POPUP_WIDTH / 2;
		const maxLeft = window.innerWidth - POPUP_WIDTH - 8;
		return Math.max(8, Math.min(ideal, maxLeft));
	});

	const top = $derived(anchorRect.bottom + OFFSET_Y);

	// Dismiss on click outside.
	$effect(() => {
		function onPointerDown(e: PointerEvent) {
			if (el && !el.contains(e.target as Node)) ondismiss();
		}
		window.addEventListener("pointerdown", onPointerDown, { capture: true });
		return () => window.removeEventListener("pointerdown", onPointerDown, { capture: true });
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={el}
	class="spellcheck-popup shell rounded-lg"
	style:position="fixed"
	style:left="{left}px"
	style:top="{top}px"
	style:width="{POPUP_WIDTH}px"
	style:z-index="9000"
	onpointerdown={(e) => e.stopPropagation()}
>
	{#if match.suggestions.length > 0}
		<div class="suggestions">
			{#each match.suggestions as suggestion}
				<button
					class="suggestion-row"
					onclick={() => onsuggestion(suggestion)}
				>
					{suggestion}
				</button>
			{/each}
		</div>
		<div class="divider"></div>
	{:else}
		<p class="no-suggestions">No suggestions</p>
		<div class="divider"></div>
	{/if}
	<button class="ignore-row" onclick={onignore}>Ignore</button>
</div>

<style>
	.spellcheck-popup {
		padding: 4px 0;
		overflow: hidden;
		font-family: "Geist", sans-serif;
	}

	.suggestions {
		display: flex;
		flex-direction: column;
	}

	.suggestion-row {
		display: block;
		width: 100%;
		padding: 5px 12px;
		text-align: left;
		font-size: 13px;
		font-weight: 500;
		color: var(--color-text-100);
		background: none;
		border: none;
		cursor: pointer;
	}

	.suggestion-row:hover {
		background-color: var(--color-bg-700, #f5f5f5);
	}

	.no-suggestions {
		padding: 5px 12px;
		font-size: 12px;
		color: var(--color-text-250, #aaa);
	}

	.divider {
		height: 1px;
		background-color: var(--color-bg-600, #e5e5e5);
		margin: 3px 0;
	}

	.ignore-row {
		display: block;
		width: 100%;
		padding: 5px 12px;
		text-align: left;
		font-size: 12px;
		color: var(--color-text-200, #767676);
		background: none;
		border: none;
		cursor: pointer;
	}

	.ignore-row:hover {
		background-color: var(--color-bg-700, #f5f5f5);
	}
</style>
