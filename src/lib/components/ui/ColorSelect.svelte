<script lang="ts">
	import type { ClassValue } from "svelte/elements";

	interface Props {
		value?: string;
		class?: ClassValue;
		onchange?: (value: string) => void;
	}

	let { value = $bindable("#FFFFFF"), class: className, onchange }: Props = $props();

	let hexInput = $state<HTMLInputElement | null>(null);

	function normalizeHex(raw: string): string | null {
		let hex = raw.trim().replace(/^#/, "");
		if (/^[0-9a-fA-F]{3}$/.test(hex)) {
			hex = hex
				.split("")
				.map((c) => c + c)
				.join("");
		}
		if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toUpperCase()}`;
		return null;
	}

	function commit(next: string): void {
		const normalized = normalizeHex(next);
		if (!normalized) return;
		value = normalized;
		onchange?.(normalized);
	}

	function onPicker(event: Event): void {
		commit((event.currentTarget as HTMLInputElement).value);
	}

	function onHexKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter") {
			event.preventDefault();
			hexInput?.blur();
		}
	}

	function onHexBlur(event: FocusEvent): void {
		const input = event.currentTarget as HTMLInputElement;
		const normalized = normalizeHex(input.value);
		if (normalized) commit(normalized);
		input.value = value;
	}
</script>

<div
	class={[
		"flex h-8 w-28 items-center gap-2 rounded-md bg-bg-input-on-pure-white p-1 pr-2.5",
		className,
	]}
>
	<label
		class="relative size-6 shrink-0 cursor-pointer rounded border border-bg-600/60"
		style:background-color={value}
		aria-label="Pick colour"
	>
		<input
			type="color"
			class="absolute inset-0 size-full cursor-pointer opacity-0"
			value={value}
			oninput={onPicker}
		/>
	</label>
	<input
		bind:this={hexInput}
		type="text"
		spellcheck="false"
		value={value}
		class="min-w-0 flex-1 border-none bg-transparent p-0 text-body-14-tight text-text-100 uppercase outline-none"
		onkeydown={onHexKeydown}
		onblur={onHexBlur}
	/>
</div>
