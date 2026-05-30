<script lang="ts">
	import { tick } from "svelte";
	import ListBulletSettingsMenu from "./ListBulletSettingsMenu.svelte";
	import ListNumberedSettingsMenu from "./ListNumberedSettingsMenu.svelte";
	import ListTypeList from "./ListTypeList.svelte";

	const GAP_PX = 10;

	let activeIndex = $state(0);
	let rowEls = $state<HTMLElement[]>([]);
	let trackEl = $state<HTMLElement | null>(null);
	let listShellEl = $state<HTMLElement | null>(null);
	let bulletPanelEl = $state<HTMLElement | null>(null);
	let numberedPanelEl = $state<HTMLElement | null>(null);
	let trackHeight = $state(0);
	let listWidth = $state(0);
	let menuBottom = $state(0);
	let menuHeight = $state(0);

	const isNumbered = $derived(activeIndex === 1);

	function updateLayout(): void {
		const track = trackEl;
		const listShell = listShellEl;
		const row = rowEls[activeIndex];

		if (listShell) {
			trackHeight = listShell.offsetHeight;
			listWidth = listShell.offsetWidth;
		}

		const bulletH = bulletPanelEl?.offsetHeight ?? 0;
		const numberedH = numberedPanelEl?.offsetHeight ?? 0;
		menuHeight = isNumbered ? numberedH : bulletH;

		if (!track || !row || menuHeight === 0) {
			menuBottom = 0;
			return;
		}

		const trackTop = track.getBoundingClientRect().top;
		const rowRect = row.getBoundingClientRect();
		const rowBottom = rowRect.top - trackTop + rowRect.height;

		let bottom = trackHeight - rowBottom;
		if (rowBottom - menuHeight < 0) {
			bottom = 0;
		}
		menuBottom = bottom;
	}

	$effect(() => {
		activeIndex;
		isNumbered;
		rowEls;
		trackEl;
		listShellEl;
		bulletPanelEl;
		numberedPanelEl;
		tick().then(updateLayout);
	});

	$effect(() => {
		const track = trackEl;
		const listShell = listShellEl;
		const bullet = bulletPanelEl;
		const numbered = numberedPanelEl;
		if (!track && !listShell && !bullet && !numbered) return;
		const ro = new ResizeObserver(() => updateLayout());
		if (track) ro.observe(track);
		if (listShell) ro.observe(listShell);
		if (bullet) ro.observe(bullet);
		if (numbered) ro.observe(numbered);
		return () => ro.disconnect();
	});

	function onRows(rows: HTMLElement[]): void {
		rowEls = rows;
	}
</script>

<div
	class="relative z-[60] mb-4"
	bind:this={trackEl}
	style:height={trackHeight > 0 ? `${trackHeight}px` : undefined}
>
	<div class="flex gap-2.5">
		<div bind:this={listShellEl} class="shrink-0">
			<ListTypeList bind:activeIndex shell={false} onrows={onRows} />
		</div>
	</div>
	<div
		class="absolute w-[324px] overflow-hidden transition-[height,bottom] duration-100 ease-[cubic-bezier(0.33,1,0.68,1)]"
		style:left="{listWidth + GAP_PX}px"
		style:bottom="{menuBottom}px"
		style:height="{menuHeight}px"
	>
		<div
			bind:this={bulletPanelEl}
			class={[
				"absolute inset-x-0 bottom-0",
				isNumbered && "pointer-events-none invisible",
			]}
			aria-hidden={isNumbered}
		>
			<ListBulletSettingsMenu />
		</div>
		<div
			bind:this={numberedPanelEl}
			class={[
				"absolute inset-x-0 bottom-0",
				!isNumbered && "pointer-events-none invisible",
			]}
			aria-hidden={!isNumbered}
		>
			<ListNumberedSettingsMenu />
		</div>
	</div>
</div>
