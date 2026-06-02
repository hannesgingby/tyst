<script lang="ts" module>
	import type { SelectableItem } from "./SelectableList.svelte";
	import {
		getDocLocale,
		headingPlaceholder,
		type HeadingMenuLevel,
	} from "$lib/document/docLocale";

	export function headingLevelItems(lang: string | undefined): SelectableItem[] {
		const locale = getDocLocale(lang);
		const levels: HeadingMenuLevel[] = [0, 1, 2, 3, 4];
		const hints = ["#title", "=", "==", "===", "===="] as const;
		return levels.map((level, i) => ({
			label: headingPlaceholder(locale, level),
			hint: hints[i],
		}));
	}
</script>

<script lang="ts">
	import type { HeadingLevel } from "$lib/document/types";
	import { documentStore } from "$lib/document/store.svelte";
	import ContextGroup from "./ContextGroup.svelte";
	import HeadingNumberingMenu from "./HeadingNumberingMenu.svelte";
	import SelectableList from "./SelectableList.svelte";

	interface Props {
		levelIndex?: number;
		/** Fired when the user clicks a level. Level 0 = Title, 1-4 = heading levels. */
		onselect?: (level: 0 | 1 | 2 | 3 | 4) => void;
	}

	let { levelIndex = 0, onselect }: Props = $props();

	let activeIndex = $state(0);
	let rowEls = $state<HTMLElement[]>([]);
	let menuEl = $state<HTMLElement | null>(null);

	const headingLevels = $derived(headingLevelItems(documentStore.model.lang));

	$effect(() => {
		activeIndex = levelIndex;
	});

	$effect(() => {
		// The right-hand panel always follows the hovered/selected row so the
		// user can configure any level's numbering/spacing — even while their
		// caret sits inside a different heading block.
		documentStore.headingMenuIsTitle = activeIndex === 0;
		if (activeIndex > 0) {
			documentStore.headingMenuLevel = activeIndex as HeadingLevel;
		}
	});

	const activeRowEl = $derived(rowEls[activeIndex] ?? null);

	function handleSelect(index: number): void {
		onselect?.(index as 0 | 1 | 2 | 3 | 4);
	}
</script>

<ContextGroup showMenu={true} {activeRowEl} {menuEl}>
	{#snippet list()}
		<SelectableList
			items={headingLevels}
			bind:activeIndex
			width={316}
			ariaLabel="Heading level"
			shell={false}
			onrows={(rows) => (rowEls = rows)}
			onselect={handleSelect}
		/>
	{/snippet}
	{#snippet menu()}
		<div bind:this={menuEl} class="w-full">
			<HeadingNumberingMenu />
		</div>
	{/snippet}
</ContextGroup>
