<script lang="ts">
	import ReferenceContextGroup from "./ReferenceContextGroup.svelte";
	import type { ReferenceSection } from "./referenceTypes";
	import { MOCK_REFERENCE_SECTIONS } from "./referenceTypes";

	interface Props {
		/**
		 * When false, only “Add sources to cite” is shown (no search bar).
		 * Toggle for mock empty-document state until wired to the store.
		 */
		hasElements?: boolean;
		sections?: ReferenceSection[];
	}

	let {
		hasElements = true,
		sections = MOCK_REFERENCE_SECTIONS,
	}: Props = $props();
</script>

<ReferenceContextGroup {hasElements} {sections} />
