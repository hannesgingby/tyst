<script lang="ts" module>
	import type { SelectableItem } from "./SelectableList.svelte";

	export const LIST_TYPES: SelectableItem[] = [
		{ label: "Bullet list", hint: "*" },
		{ label: "Numbered list", hint: "1." },
	];
</script>

<script lang="ts">
	import { untrack } from "svelte";
	import type { ListSettings } from "$lib/document/types";
	import { documentStore } from "$lib/document/store.svelte";
	import ContextGroup from "./ContextGroup.svelte";
	import ListBulletSettingsMenu from "./ListBulletSettingsMenu.svelte";
	import ListNumberedSettingsMenu from "./ListNumberedSettingsMenu.svelte";
	import SelectableList from "./SelectableList.svelte";
	import TwoPanelMenu from "./TwoPanelMenu.svelte";

	interface Props {
		onselect?: (settings: ListSettings) => void;
	}

	let { onselect }: Props = $props();

	let activeIndex = $state(0);
	let rowEls = $state<HTMLElement[]>([]);
	let menuEl = $state<HTMLElement | null>(null);
	let twoPanelMenu = $state<{ releaseHold: () => void } | null>(null);
	/** First block id of the list group being edited; null = insert preview only. */
	let listEditAnchorId = $state<string | null>(null);

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

	const activeRowEl = $derived(rowEls[activeIndex] ?? null);

	function buildBulletSettings(): ListSettings {
		return {
			kind: "bullet",
			marker: bulletMarker.trim() || undefined,
			spacing: bulletSpacing,
			indent: bulletIndent,
			bodyIndent: bulletBodyIndent,
			tight: bulletTight,
		};
	}

	function listSettingsEqual(a: ListSettings, b: ListSettings): boolean {
		return (
			a.kind === b.kind &&
			(a.marker ?? "") === (b.marker ?? "") &&
			a.spacing === b.spacing &&
			(a.indent ?? 0) === (b.indent ?? 0) &&
			(a.bodyIndent ?? 0.5) === (b.bodyIndent ?? 0.5) &&
			(a.tight !== false) === (b.tight !== false) &&
			(a.start ?? null) === (b.start ?? null) &&
			(a.full === true) === (b.full === true) &&
			(a.reversed === true) === (b.reversed === true)
		);
	}

	function buildNumberedSettings(): ListSettings {
		return {
			kind: "numbered",
			marker: numberedMarker.trim() || undefined,
			start: numberedStart,
			spacing: numberedSpacing,
			indent: numberedIndent,
			bodyIndent: numberedBodyIndent,
			tight: numberedTight,
			full: numberedFull,
			reversed: numberedReversed,
		};
	}

	function loadPanelFromList(list: ListSettings): void {
		if (list.kind === "bullet") {
			bulletMarker = list.marker ?? "";
			bulletSpacing = list.spacing ?? null;
			bulletIndent = list.indent ?? 0;
			bulletBodyIndent = list.bodyIndent ?? 0.5;
			bulletTight = list.tight !== false;
		} else {
			numberedMarker = list.marker ?? "1.";
			numberedStart = list.start ?? null;
			numberedSpacing = list.spacing ?? null;
			numberedIndent = list.indent ?? 0;
			numberedBodyIndent = list.bodyIndent ?? 0.5;
			numberedTight = list.tight !== false;
			numberedFull = list.full === true;
			numberedReversed = list.reversed === true;
		}
	}

	$effect(() => {
		const kind = documentStore.activeBlock.list?.kind;
		if (kind === "bullet") activeIndex = 0;
		else if (kind === "numbered") activeIndex = 1;
	});

	$effect(() => {
		if (!documentStore.isEditingListBlock) {
			documentStore.listMenuKind = activeIndex === 1 ? "numbered" : "bullet";
		}
	});

	$effect(() => {
		documentStore.activeBlockId;
		documentStore.model.blocks;
		const first = documentStore.listGroupFirstForActive();
		if (!first?.list) {
			listEditAnchorId = null;
			return;
		}
		listEditAnchorId = first.id;
		untrack(() => loadPanelFromList(first.list!));
	});

	$effect(() => {
		const anchor = listEditAnchorId;
		if (!anchor) return;
		const first = documentStore.findBlock(anchor);
		if (!first?.list) return;

		if (first.list.kind === "bullet") {
			bulletMarker;
			bulletSpacing;
			bulletIndent;
			bulletBodyIndent;
			bulletTight;
			untrack(() => {
				const next = buildBulletSettings();
				if (!listSettingsEqual(first.list!, next)) {
					documentStore.applyListGroupSettings(anchor, next);
				}
			});
		} else {
			numberedMarker;
			numberedStart;
			numberedSpacing;
			numberedIndent;
			numberedBodyIndent;
			numberedTight;
			numberedFull;
			numberedReversed;
			untrack(() => {
				const next = buildNumberedSettings();
				if (!listSettingsEqual(first.list!, next)) {
					documentStore.applyListGroupSettings(anchor, next);
				}
			});
		}
	});

	function handleSelect(index: number): void {
		onselect?.(index === 0 ? buildBulletSettings() : buildNumberedSettings());
	}
</script>

<ContextGroup {activeRowEl} {menuEl} onClipHeightTransitionEnd={() => twoPanelMenu?.releaseHold()}>
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
		<TwoPanelMenu bind:this={twoPanelMenu} {activeIndex} bind:menuEl>
			{#snippet panelA()}
				<ListBulletSettingsMenu
					bind:marker={bulletMarker}
					bind:spacing={bulletSpacing}
					bind:indent={bulletIndent}
					bind:bodyIndent={bulletBodyIndent}
					bind:tight={bulletTight}
				/>
			{/snippet}
			{#snippet panelB()}
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
			{/snippet}
		</TwoPanelMenu>
	{/snippet}
</ContextGroup>
