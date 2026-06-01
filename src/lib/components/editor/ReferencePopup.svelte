<script lang="ts">
	import { documentStore } from "$lib/document/store.svelte";
	import ReferenceContextGroup from "./ReferenceContextGroup.svelte";

	function handleSelect(kind: "reference" | "citation", id: string): void {
		if (kind === "reference") {
			documentStore.insertReference(id);
		} else {
			documentStore.insertCitation(id);
		}
	}
</script>

<ReferenceContextGroup onselect={handleSelect} />
