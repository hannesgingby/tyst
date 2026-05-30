<script lang="ts" module>
	import type { SelectableItem } from "./SelectableList.svelte";

	export const HEADING_LEVELS: SelectableItem[] = [
		{ label: "Title", hint: "#title" },
		{ label: "Heading 1", hint: "=" },
		{ label: "Heading 2", hint: "==" },
		{ label: "Heading 3", hint: "===" },
		{ label: "Heading 4", hint: "====" },
	];
</script>

<script lang="ts">
	import ContextGroup from "./ContextGroup.svelte";
	import HeadingNumberingMenu from "./HeadingNumberingMenu.svelte";
	import SelectableList from "./SelectableList.svelte";

	interface Props {
		levelIndex?: number;
		/** Fired when the user clicks a level. Level 0 = Title, 1-4 = heading levels. */
		onselect?: (level: 0 | 1 | 2 | 3 | 4, opts: { numbering?: string; outlined?: boolean }) => void;
	}

	let { levelIndex = 0, onselect }: Props = $props();

	let activeIndex = $state(0);
	let rowEls = $state<HTMLElement[]>([]);
	let menuEl = $state<HTMLElement | null>(null);
	let numbering = $state("");
	let outlined = $state(true);

	$effect(() => {
		activeIndex = levelIndex;
	});

	const activeRowEl = $derived(rowEls[activeIndex] ?? null);
	// Title (index 0) has no numbering panel; everything else does.
	const showNumbering = $derived(activeIndex > 0);

	function handleSelect(index: number): void {
		const level = index as 0 | 1 | 2 | 3 | 4;
		const opts: { numbering?: string; outlined?: boolean } =
			level === 0
				? {}
				: {
						numbering: numbering.trim() || undefined,
						outlined,
					};
		onselect?.(level, opts);
	}
</script>

<ContextGroup showMenu={showNumbering} {activeRowEl} {menuEl}>
	{#snippet list()}
		<SelectableList
			items={HEADING_LEVELS}
			bind:activeIndex
			width={316}
			ariaLabel="Heading level"
			shell={false}
			onrows={(rows) => (rowEls = rows)}
			onselect={handleSelect}
		/>
	{/snippet}
	{#snippet menu()}
		<div bind:this={menuEl} class="absolute inset-x-0 bottom-0">
			<HeadingNumberingMenu bind:numbering bind:outlined />
		</div>
	{/snippet}
</ContextGroup>
