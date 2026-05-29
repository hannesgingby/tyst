<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		label: string;
		children: Snippet;
	}

	let { label, children }: Props = $props();
</script>

<div class="flex flex-col gap-1.5">
	<span class="px-1 text-body-14 text-text-100">{label}</span>
	{@render children()}
</div>
