<script lang="ts">
	import { getIconSvg } from "$lib/iconRegistry";

	interface Props {
		name: string;
		class?: string;
		title?: string;
	}

	let { name, class: className = "", title }: Props = $props();

	const svg = $derived(getIconSvg(name));
</script>

{#if svg}
	<span
		class="icon-wrap inline-flex shrink-0 items-center justify-center {className}"
		role={title ? "img" : undefined}
		aria-hidden={title ? undefined : true}
		aria-label={title}
	>
		{@html svg}
	</span>
{/if}
