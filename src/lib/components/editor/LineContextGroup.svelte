<script lang="ts" module>
	import type { SelectableItem } from "./SelectableList.svelte";

	export const SHAPE_TYPES: SelectableItem[] = [
		{ label: "Line", hint: "line" },
		{ label: "Rectangle", hint: "rect" },
	];
</script>

<script lang="ts">
	import { documentStore } from "$lib/document/store.svelte";
	import type { LineSettings, RectSettings } from "$lib/document/types";
	import ContextGroup from "./ContextGroup.svelte";
	import LineSettingsMenu from "./LineSettingsMenu.svelte";
	import RectangleSettingsMenu from "./RectangleSettingsMenu.svelte";
	import SelectableList from "./SelectableList.svelte";
	import TwoPanelMenu from "./TwoPanelMenu.svelte";

	// Stable defaults for the preview panels when no shape is active yet
	// (i.e. when the user opens the Line popup from the toolbar but hasn't
	// inserted anything yet). These are not written back anywhere.
	const previewLine = $derived<LineSettings>(documentStore.defaultLineSettings());
	const previewRect = $derived<RectSettings>(documentStore.defaultRectSettings());

	const activeBlock = $derived(documentStore.activeBlock);
	const activeLine = $derived<LineSettings | null>(activeBlock.line ?? null);
	const activeRect = $derived<RectSettings | null>(activeBlock.rect ?? null);

	// SelectableList drives `activeIndex` via hover. We sync from the active
	// block whenever its shape kind changes — so opening the popup on an
	// existing line jumps the picker to row 0 even before the user hovers.
	let activeIndex = $state(0);
	$effect(() => {
		if (activeLine) activeIndex = 0;
		else if (activeRect) activeIndex = 1;
	});

	let rowEls = $state<HTMLElement[]>([]);
	let menuEl = $state<HTMLElement | null>(null);
	let twoPanelMenu = $state<{ releaseHold: () => void } | null>(null);

	const activeRowEl = $derived(rowEls[activeIndex] ?? null);

	function handleSelect(index: number): void {
		activeIndex = index;
		if (index === 0 && !activeLine) {
			documentStore.insertEmbed({ text: "", line: documentStore.defaultLineSettings() });
		} else if (index === 1 && !activeRect) {
			documentStore.insertEmbed({ text: "", rect: documentStore.defaultRectSettings() });
		}
	}

	function patchLine(p: Partial<LineSettings>): void {
		if (activeLine) documentStore.updateLine(activeBlock.id, p);
	}
	function patchRect(p: Partial<RectSettings>): void {
		if (activeRect) documentStore.updateRect(activeBlock.id, p);
	}
</script>

<ContextGroup
	{activeRowEl}
	{menuEl}
	onClipHeightTransitionEnd={() => twoPanelMenu?.releaseHold()}
>
	{#snippet list()}
		<SelectableList
			items={SHAPE_TYPES}
			bind:activeIndex
			width={280}
			ariaLabel="Shape type"
			shell={false}
			onrows={(rows) => (rowEls = rows)}
			onselect={handleSelect}
		/>
	{/snippet}
	{#snippet menu()}
		<TwoPanelMenu bind:this={twoPanelMenu} {activeIndex} bind:menuEl>
			{#snippet panelA()}
				<LineSettingsMenu
					line={() => activeLine ?? previewLine}
					onchange={patchLine}
				/>
			{/snippet}
			{#snippet panelB()}
				<RectangleSettingsMenu
					rect={() => activeRect ?? previewRect}
					onchange={patchRect}
				/>
			{/snippet}
		</TwoPanelMenu>
	{/snippet}
</ContextGroup>
