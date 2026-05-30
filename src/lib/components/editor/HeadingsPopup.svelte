<script lang="ts">
	import { documentStore } from "$lib/document/store.svelte";
	import HeadingContextGroup, { HEADING_LEVELS } from "./HeadingContextGroup.svelte";

	function handleSelect(
		level: 0 | 1 | 2 | 3 | 4,
		opts: { numbering?: string; outlined?: boolean },
	): void {
		const label = HEADING_LEVELS[level].label;
		documentStore.insertOrTransformActive({
			text: "",
			heading: { level, numbering: opts.numbering, outlined: opts.outlined },
			placeholder: label,
		});
	}
</script>

<HeadingContextGroup onselect={handleSelect} />
