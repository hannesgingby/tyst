<script lang="ts">
	import type { ClassValue } from "svelte/elements";
	import Icon from "$lib/components/Icon.svelte";

	interface Props {
		label: string;
		checked?: boolean;
		class?: ClassValue;
		onchange?: (checked: boolean) => void;
	}

	let { label, checked = $bindable(false), class: className, onchange }: Props = $props();

	function handleChange(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		checked = input.checked;
		onchange?.(checked);
	}
</script>

<label class={["inline-flex cursor-pointer select-none items-center gap-3", className]}>
	<input type="checkbox" class="sr-only" bind:checked onchange={handleChange} />
	<span
		class={[
			"flex size-5 shrink-0 items-center justify-center rounded border transition-colors duration-150",
			checked
				? "border-border-checkbox-on bg-bg-checkbox-on"
				: "border-border-checkbox-off bg-bg-checkbox-off",
		]}
		aria-hidden="true"
	>
		<Icon
			name="check"
			class="size-4 text-tag-blue-text {!checked ? 'opacity-0' : ''}"
		/>
	</span>
	<span class="text-body-14-tight text-text-100">{label}</span>
</label>
