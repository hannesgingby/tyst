<script lang="ts" module>
	import type { SelectableItem } from "./SelectableList.svelte";

	export const LIST_TYPES: SelectableItem[] = [
		{ label: "Bullet list", hint: "*" },
		{ label: "Numbered list", hint: "1." },
	];
</script>

<script lang="ts">
	import type { ListSettings } from "$lib/document/types";
	import ContextGroup from "./ContextGroup.svelte";
	import ListBulletSettingsMenu from "./ListBulletSettingsMenu.svelte";
	import ListNumberedSettingsMenu from "./ListNumberedSettingsMenu.svelte";
	import SelectableList from "./SelectableList.svelte";

	interface Props {
		onselect?: (settings: ListSettings) => void;
	}

	let { onselect }: Props = $props();

	let activeIndex = $state(0);
	let rowEls = $state<HTMLElement[]>([]);
	let bulletPanelEl = $state<HTMLElement | null>(null);
	let numberedPanelEl = $state<HTMLElement | null>(null);
	/** Keep the taller numbered panel visible while the clip shrinks to bullet height. */
	let holdNumbered = $state(false);
	let prevActiveIndex = 0;

	// Bullet settings
	let bulletMarker = $state("");
	let bulletSpacing = $state<number | null>(null);
	let bulletIndent = $state(0);
	let bulletBodyIndent = $state(0.5);
	let bulletTight = $state(true);

	// Numbered settings
	let numberedMarker = $state("1.");
	let numberedStart = $state<number | null>(null);
	let numberedSpacing = $state<number | null>(null);
	let numberedIndent = $state(0);
	let numberedBodyIndent = $state(0.5);
	let numberedTight = $state(true);
	let numberedFull = $state(false);
	let numberedReversed = $state(false);

	const isNumbered = $derived(activeIndex === 1);
	const showNumbered = $derived(isNumbered || holdNumbered);
	const activeRowEl = $derived(rowEls[activeIndex] ?? null);
	const menuEl = $derived(
		holdNumbered ? bulletPanelEl : isNumbered ? numberedPanelEl : bulletPanelEl,
	);

	$effect(() => {
		if (prevActiveIndex === 1 && activeIndex === 0) {
			holdNumbered = true;
		}
		if (activeIndex === 1) {
			holdNumbered = false;
		}
		prevActiveIndex = activeIndex;
	});

	function finishHeightTransition(): void {
		holdNumbered = false;
	}

	function handleSelect(index: number): void {
		if (index === 0) {
			onselect?.({
				kind: "bullet",
				marker: bulletMarker.trim() || undefined,
				spacing: bulletSpacing,
				indent: bulletIndent,
				bodyIndent: bulletBodyIndent,
				tight: bulletTight,
			});
		} else {
			onselect?.({
				kind: "numbered",
				marker: numberedMarker.trim() || undefined,
				start: numberedStart,
				spacing: numberedSpacing,
				indent: numberedIndent,
				bodyIndent: numberedBodyIndent,
				tight: numberedTight,
				full: numberedFull,
				reversed: numberedReversed,
			});
		}
	}
</script>

<ContextGroup {activeRowEl} {menuEl} onClipHeightTransitionEnd={finishHeightTransition}>
	{#snippet list()}
		<SelectableList
			items={LIST_TYPES}
			bind:activeIndex
			width={280}
			ariaLabel="List type"
			shell={false}
			onrows={(rows) => (rowEls = rows)}
			onselect={handleSelect}
		/>
	{/snippet}
	{#snippet menu()}
		<div class="relative w-full">
			<div
				bind:this={numberedPanelEl}
				class={[!showNumbered && "pointer-events-none invisible absolute inset-x-0 top-0"]}
				aria-hidden={!showNumbered}
			>
				<ListNumberedSettingsMenu
					bind:marker={numberedMarker}
					bind:start={numberedStart}
					bind:spacing={numberedSpacing}
					bind:indent={numberedIndent}
					bind:bodyIndent={numberedBodyIndent}
					bind:tight={numberedTight}
					bind:full={numberedFull}
					bind:reversed={numberedReversed}
				/>
			</div>
			<div
				bind:this={bulletPanelEl}
				class={[showNumbered && "pointer-events-none invisible absolute inset-x-0 top-0"]}
				aria-hidden={showNumbered}
			>
				<ListBulletSettingsMenu
					bind:marker={bulletMarker}
					bind:spacing={bulletSpacing}
					bind:indent={bulletIndent}
					bind:bodyIndent={bulletBodyIndent}
					bind:tight={bulletTight}
				/>
			</div>
		</div>
	{/snippet}
</ContextGroup>
