<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		title: string;
		children?: Snippet;
	}

	let { title, children }: Props = $props();
</script>

<div class="flex items-center justify-between px-1">
	<span class="text-body-14 text-text-100">{title}</span>
	{#if children}
		{@render children()}
	{/if}
</div>
