<script lang="ts">
	import LineContextGroup from "./LineContextGroup.svelte";

	interface Props {
		onhover?: (icon: string | null) => void;
	}
	let { onhover }: Props = $props();
</script>

<LineContextGroup {onhover} />
