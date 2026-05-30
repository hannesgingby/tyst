<script lang="ts">
	import SelectableList, { type SelectableItem } from "./SelectableList.svelte";

	const ALIGNMENT_TYPES: SelectableItem[] = [
		{ label: "Center", hint: "horizontally" },
		{ label: "Left" },
		{ label: "Right" },
		{ label: "Top" },
		{ label: "Bottom" },
		{ label: "Horizon", hint: "vertically" },
	];
</script>

<SelectableList items={ALIGNMENT_TYPES} width={316} ariaLabel="Alignment" />
