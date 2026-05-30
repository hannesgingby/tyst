<script lang="ts">
	import type { Snippet } from "svelte";
	import Icon from "$lib/components/Icon.svelte";
	import Tooltip from "$lib/components/Tooltip.svelte";

	interface Props {
		label: string;
		ariaLabel?: string;
		icon: string;
		iconClass?: string;
		shortcut?: string;
		/** Extra classes for the absolutely-positioned popup wrapper. */
		popupClass?: string;
		/** Highlights the trigger when the cursor is on a matching block type. */
		active?: boolean;
		popup?: Snippet;
	}

	let {
		label,
		ariaLabel,
		icon,
		iconClass = "size-6",
		shortcut,
		popupClass = "-left-8",
		active = false,
		popup,
	}: Props = $props();

	let open = $state(false);
</script>

<!--
  A toolbar control that opens a popup on hover. The popup lives inside the
  same hover region (with `pb-2.5`) so the gap between trigger and panel doesn't
  close the menu. Leaving the wrapper closes it immediately.
-->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="relative flex items-center"
	onmouseenter={() => (open = true)}
	onmouseleave={() => (open = false)}
>
	<Tooltip {label} {shortcut} position="bottom" disabled={open}>
		<button
			type="button"
			class={[
				"tool-btn relative flex h-6 items-center justify-center gap-0.5 rounded-md transition-opacity duration-150 [transition-timing-function:cubic-bezier(0.33,1,0.68,1)]",
				active ? "toolbar-tool-active" : "hover:opacity-50",
			]}
			aria-expanded={open}
		>
			<Icon name={icon} class="{iconClass} {active ? 'text-current' : 'text-icon'}" />
			<span class="chevron" class:active class:open>
				<Icon name="nav-arrow-down" class="size-3.5 {active ? 'text-current' : 'text-icon'}" />
			</span>
		</button>
	</Tooltip>

	{#if open && popup}
		<div
			class={["absolute bottom-full z-[60] pb-2.5", popupClass]}
			role="dialog"
			aria-label={ariaLabel ?? label}
		>
			{@render popup()}
		</div>
	{/if}
</div>

<style>
	.chevron {
		display: inline-flex;
		transform: rotate(0deg);
		transform-origin: center;
		transition: transform 300ms cubic-bezier(0.33, 1, 0.68, 1);
	}

	.chevron.open,
	.tool-btn:hover .chevron {
		transform: rotate(180deg);
	}
</style>
