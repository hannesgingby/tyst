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
	}

	let { levelIndex = 0 }: Props = $props();

	let activeIndex = $state(0);
	let rowEls = $state<HTMLElement[]>([]);
	let menuEl = $state<HTMLElement | null>(null);

	$effect(() => {
		activeIndex = levelIndex;
	});

	const activeRowEl = $derived(rowEls[activeIndex] ?? null);
	const showNumbering = $derived(activeIndex > 0);
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
		/>
	{/snippet}
	{#snippet menu()}
		<div bind:this={menuEl} class="absolute inset-x-0 bottom-0">
			<HeadingNumberingMenu />
		</div>
	{/snippet}
</ContextGroup>
