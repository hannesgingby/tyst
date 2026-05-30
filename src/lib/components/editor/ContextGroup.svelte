<script lang="ts">
	import { tick } from "svelte";
	import type { Snippet } from "svelte";

	const GAP_PX = 10;

	interface Props {
		/** When true, the side menu is rendered next to the list. */
		showMenu?: boolean;
		menuWidth?: number;
		/** Currently active row element; the menu aligns its bottom to this row. */
		activeRowEl?: HTMLElement | null;
		/** Element whose height drives the clip (may differ from visible panel while shrinking). */
		menuEl?: HTMLElement | null;
		/** Fired when the clip height transition finishes. */
		onClipHeightTransitionEnd?: () => void;
		list: Snippet;
		menu?: Snippet;
	}

	let {
		showMenu = true,
		menuWidth = 324,
		activeRowEl = null,
		menuEl = null,
		onClipHeightTransitionEnd,
		list,
		menu,
	}: Props = $props();

	let trackEl = $state<HTMLElement | null>(null);
	let listShellEl = $state<HTMLElement | null>(null);
	let trackHeight = $state(0);
	let menuBottom = $state(0);
	let menuHeight = $state(0);

	function updateLayout(): void {
		if (listShellEl) trackHeight = listShellEl.offsetHeight;
		menuHeight = menuEl?.offsetHeight ?? 0;

		if (!showMenu || !trackEl || !activeRowEl || menuHeight === 0) {
			menuBottom = 0;
			return;
		}

		const trackTop = trackEl.getBoundingClientRect().top;
		const rowRect = activeRowEl.getBoundingClientRect();
		const rowBottom = rowRect.top - trackTop + rowRect.height;
		menuBottom = rowBottom - menuHeight < 0 ? 0 : trackHeight - rowBottom;
	}

	function handleClipTransitionEnd(event: TransitionEvent): void {
		if (event.propertyName !== "height") return;
		onClipHeightTransitionEnd?.();
	}

	$effect(() => {
		showMenu;
		activeRowEl;
		menuEl;
		trackEl;
		listShellEl;
		tick().then(updateLayout);
	});

	$effect(() => {
		const targets = [trackEl, listShellEl, menuEl, activeRowEl].filter(
			(el): el is HTMLElement => el != null,
		);
		if (targets.length === 0) return;
		const ro = new ResizeObserver(() => updateLayout());
		for (const el of targets) ro.observe(el);
		return () => ro.disconnect();
	});
</script>

<div
	class="relative z-[60] mb-4"
	bind:this={trackEl}
	style:height={trackHeight > 0 ? `${trackHeight}px` : undefined}
>
	<div class="flex">
		<div bind:this={listShellEl} class="shrink-0">
			{@render list()}
		</div>
		{#if showMenu && menu}
			<!-- Explicit spacer: flex gap is not hoverable; this keeps the 10px gap open. -->
			<div class="shrink-0" style:width="{GAP_PX}px" aria-hidden="true"></div>
			<div class="relative shrink-0" style:width="{menuWidth}px">
				<div
					class="absolute inset-x-0 flex flex-col justify-end overflow-hidden transition-[height,bottom] duration-100 ease-[cubic-bezier(0.33,1,0.68,1)]"
					style:bottom="{menuBottom}px"
					style:height="{menuHeight}px"
					ontransitionend={handleClipTransitionEnd}
				>
					{@render menu()}
				</div>
			</div>
		{/if}
	</div>
</div>
