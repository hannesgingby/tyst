<script lang="ts">
	import { tick } from "svelte";
	import HeadingNumberingMenu from "./HeadingNumberingMenu.svelte";
	import HeadingsLevelList from "./HeadingsLevelList.svelte";

	interface Props {
		/** Initial / synced active level index (0 = Title, 1 = Heading 1, …). */
		levelIndex?: number;
	}

	let { levelIndex = 0 }: Props = $props();

	let activeIndex = $state(0);
	let rowEls = $state<HTMLElement[]>([]);
	let listShellEl = $state<HTMLElement | null>(null);
	let menuEl = $state<HTMLElement | null>(null);
	let listHeight = $state(0);
	let menuOffset = $state(0);

	const showNumbering = $derived(activeIndex > 0);

	$effect(() => {
		activeIndex = levelIndex;
	});

	function updateLayout(): void {
		const listShell = listShellEl;
		if (listShell) listHeight = listShell.offsetHeight;

		if (!showNumbering) {
			menuOffset = 0;
			return;
		}

		const row = rowEls[activeIndex];
		const menu = menuEl;
		if (!listShell || !row || !menu) {
			menuOffset = 0;
			return;
		}
		const listTop = listShell.getBoundingClientRect().top;
		const rowRect = row.getBoundingClientRect();
		const rowCenter = rowRect.top - listTop + rowRect.height / 2;
		menuOffset = rowCenter - menu.offsetHeight / 2;
	}

	$effect(() => {
		activeIndex;
		showNumbering;
		rowEls;
		listShellEl;
		menuEl;
		tick().then(updateLayout);
	});

	$effect(() => {
		const listShell = listShellEl;
		const menu = menuEl;
		if (!listShell && !menu) return;
		const ro = new ResizeObserver(() => updateLayout());
		if (listShell) ro.observe(listShell);
		if (menu) ro.observe(menu);
		return () => ro.disconnect();
	});

	function onRows(rows: HTMLElement[]): void {
		rowEls = rows;
	}
</script>

<!-- mb-4 matches Popup `my-4` bottom margin on TypographyPopup -->
<div class="relative z-[60] mb-4 flex items-start gap-2.5">
	<div bind:this={listShellEl} class="shrink-0">
		<HeadingsLevelList bind:activeIndex shell={false} onrows={onRows} />
	</div>
	{#if showNumbering}
		<div class="relative w-[324px] shrink-0" style:min-height="{listHeight}px">
			<div
				bind:this={menuEl}
				class="absolute left-0 top-0 transition-[top] duration-150"
				style:top="{menuOffset}px"
			>
				<HeadingNumberingMenu />
			</div>
		</div>
	{/if}
</div>
