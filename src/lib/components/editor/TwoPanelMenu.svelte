<script lang="ts">
	import { tick } from "svelte";
	import type { Snippet } from "svelte";

	interface Props {
		/** Index 0 = panel A (shorter), index 1 = panel B (taller). */
		activeIndex: number;
		/** The element ContextGroup should use to measure menu height. Updated internally. */
		menuEl?: HTMLElement | null;
		panelA: Snippet;
		/** The taller of the two panels; held visible while ContextGroup's clip animates down. */
		panelB: Snippet;
	}

	let { activeIndex, menuEl = $bindable<HTMLElement | null>(null), panelA, panelB }: Props =
		$props();

	let panelAEl = $state<HTMLElement | null>(null);
	let panelBEl = $state<HTMLElement | null>(null);
	let hold = $state(false);
	let prevActiveIndex = 0;

	const isB = $derived(activeIndex === 1);
	const showB = $derived(isB || hold);

	$effect(() => {
		menuEl = hold ? panelAEl : isB ? panelBEl : panelAEl;
	});

	$effect(() => {
		if (prevActiveIndex === 1 && activeIndex === 0) {
			hold = true;
			// If both panels are the same height, no height transition fires — release immediately.
			void tick().then(() => {
				if (activeIndex !== 0 || !hold) return;
				if ((panelAEl?.offsetHeight ?? 0) >= (panelBEl?.offsetHeight ?? 0) - 1) hold = false;
			});
		}
		if (activeIndex === 1) hold = false;
		prevActiveIndex = activeIndex;
	});

	export function releaseHold(): void {
		hold = false;
	}
</script>

<div class="relative w-full">
	<div
		bind:this={panelBEl}
		class={[!showB && "pointer-events-none invisible absolute inset-x-0 top-0"]}
		aria-hidden={!showB}
	>
		{@render panelB()}
	</div>
	<div
		bind:this={panelAEl}
		class={[showB && "pointer-events-none invisible absolute inset-x-0 top-0"]}
		aria-hidden={showB}
	>
		{@render panelA()}
	</div>
</div>
