<script lang="ts" module>
	import type { SelectableItem } from "./SelectableList.svelte";

	export const LIST_TYPES: SelectableItem[] = [
		{ label: "Bullet list", hint: "*" },
		{ label: "Numbered list", hint: "1." },
	];
</script>

<script lang="ts">
	import ContextGroup from "./ContextGroup.svelte";
	import ListBulletSettingsMenu from "./ListBulletSettingsMenu.svelte";
	import ListNumberedSettingsMenu from "./ListNumberedSettingsMenu.svelte";
	import SelectableList from "./SelectableList.svelte";

	let activeIndex = $state(0);
	let rowEls = $state<HTMLElement[]>([]);
	let bulletPanelEl = $state<HTMLElement | null>(null);
	let numberedPanelEl = $state<HTMLElement | null>(null);

	const isNumbered = $derived(activeIndex === 1);
	const activeRowEl = $derived(rowEls[activeIndex] ?? null);
	const menuEl = $derived(isNumbered ? numberedPanelEl : bulletPanelEl);
</script>

<ContextGroup {activeRowEl} {menuEl}>
	{#snippet list()}
		<SelectableList
			items={LIST_TYPES}
			bind:activeIndex
			width={280}
			ariaLabel="List type"
			shell={false}
			onrows={(rows) => (rowEls = rows)}
		/>
	{/snippet}
	{#snippet menu()}
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
	{/snippet}
</ContextGroup>
