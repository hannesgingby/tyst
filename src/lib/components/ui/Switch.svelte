<script lang="ts">
	interface Props {
		checked?: boolean;
		disabled?: boolean;
		label?: string;
		onchange?: (checked: boolean) => void;
	}

	let { checked = $bindable(false), disabled = false, label, onchange }: Props = $props();

	function toggle(): void {
		if (disabled) return;
		checked = !checked;
		onchange?.(checked);
	}
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-label={label}
	{disabled}
	class={[
		"relative inline-flex h-5 w-[34px] shrink-0 items-center rounded-full px-0.5 transition-colors duration-200 ease-out",
		checked ? "bg-tag-blue-text" : "bg-bg-switch-off",
		disabled && "opacity-50",
	]}
	onclick={toggle}
>
	<span
		class={[
			"size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out",
			checked ? "translate-x-[14px]" : "translate-x-0",
		]}
	></span>
</button>
