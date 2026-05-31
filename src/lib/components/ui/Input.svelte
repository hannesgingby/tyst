<script lang="ts">
	import type { ClassValue } from "svelte/elements";
	import Icon from "$lib/components/Icon.svelte";
	import { formatDecimal, parseDecimal, snapToStep } from "$lib/numberInput";

	const DRAG_PIXELS_PER_STEP = 8;

	interface Props {
		value?: number | null;
		icon?: string;
		iconClass?: string;
		unit?: string;
		/** When provided (with >1 entry), the unit suffix becomes clickable and
		 * cycles through these options, reporting the new unit via `onunitchange`. */
		units?: readonly string[];
		min?: number;
		max?: number;
		step?: number;
		/** Step used when dragging the icon; defaults to `step`. */
		dragStep?: number;
		decimals?: number;
		emptyLabel?: string;
		disabled?: boolean;
		/** Dimmed like disabled but still clickable (e.g. "None" preset fields). */
		inactive?: boolean;
		/** Allow clearing the value to `null` with an empty commit. */
		nullable?: boolean;
		/** Background utility class for the field surface. */
		bg?: string;
		class?: ClassValue;
		onchange?: (value: number) => void;
		onnull?: () => void;
		onunitchange?: (unit: string) => void;
	}

	let {
		value = $bindable<number | null>(null),
		icon,
		iconClass = "size-[26px]",
		unit,
		units,
		min = 0,
		max = 100,
		step = 1,
		dragStep,
		decimals,
		emptyLabel,
		disabled = false,
		inactive = false,
		nullable = false,
		bg = "bg-bg-950",
		class: className,
		onchange,
		onnull,
		onunitchange,
	}: Props = $props();

	const canCycleUnit = $derived(
		!disabled && unit != null && units != null && units.length > 1,
	);
	const hasUnitSuffix = $derived(unit != null);

	function cycleUnit(): void {
		if (!canCycleUnit || unit == null || units == null) return;
		const i = units.indexOf(unit);
		const next = units[(i + 1) % units.length];
		onunitchange?.(next);
	}
	const isEditable = $derived(!disabled);

	let isEditing = $state(false);
	let editValue = $state("");
	let inputEl = $state<HTMLInputElement | null>(null);

	const gridColumns = $derived.by(() => {
		if (icon && hasUnitSuffix) return "26px minmax(0, 1fr) auto";
		if (icon) return "26px minmax(0, 1fr)";
		if (hasUnitSuffix) return "minmax(0, 1fr) auto";
		return "minmax(0, 1fr)";
	});

	function formatValue(): string {
		if (value == null) return emptyLabel ?? "";
		return formatDecimal(value, decimals);
	}

	const displayText = $derived(formatValue());

	const effectiveDragStep = $derived(dragStep ?? step);

	function setValue(next: number, snap = step): void {
		const snapped = snapToStep(next, snap, min, max);
		value = snapped;
		onchange?.(snapped);
	}

	function isEmptyCommit(text: string): boolean {
		if (text === "") return true;
		if (!emptyLabel) return false;
		return text.toLowerCase() === emptyLabel.toLowerCase();
	}

	function startEditing(): void {
		if (!isEditable) return;
		editValue = formatValue();
		isEditing = true;
		queueMicrotask(() => {
			inputEl?.focus();
			inputEl?.select();
		});
	}

	function commitEdit(): void {
		if (!isEditing) return;
		isEditing = false;
		const trimmed = editValue.trim();
		if (nullable && isEmptyCommit(trimmed)) {
			value = null;
			onnull?.();
			return;
		}
		const parsed = parseDecimal(trimmed);
		if (Number.isNaN(parsed)) return;
		setValue(parsed);
	}

	function cancelEdit(): void {
		isEditing = false;
	}

	function onInputKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter") {
			event.preventDefault();
			inputEl?.blur();
		} else if (event.key === "Escape") {
			event.preventDefault();
			cancelEdit();
			inputEl?.blur();
		}
	}

	function onIconPointerDown(event: PointerEvent): void {
		if (disabled || !icon || value == null) return;
		event.preventDefault();
		event.stopPropagation();
		if (isEditing) {
			inputEl?.blur();
		}

		const startY = event.clientY;
		const startValue = value;

		const onMove = (moveEvent: PointerEvent): void => {
			const deltaY = startY - moveEvent.clientY;
			const steps = Math.round(deltaY / DRAG_PIXELS_PER_STEP);
			setValue(startValue + steps * effectiveDragStep, effectiveDragStep);
		};

		const onUp = (): void => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onUp);
		};

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
	}
</script>

<div
	class={[
		"field-shell grid items-center gap-x-2 pl-3",
		bg,
		hasUnitSuffix ? "pr-4" : "pr-3",
		(disabled || inactive) && "opacity-50",
		className,
	]}
	style:grid-template-columns={gridColumns}
>
	{#if icon}
		<button
			type="button"
			class={[
				"flex size-[26px] items-center justify-center text-text-150 select-none",
				disabled || value == null
					? "cursor-default"
					: "cursor-ns-resize touch-none hover:text-text-100",
			]}
			tabindex={disabled || value == null ? -1 : 0}
			aria-label="Drag to adjust value"
			disabled={disabled || value == null}
			onpointerdown={onIconPointerDown}
		>
			<Icon name={icon} class={iconClass} />
		</button>
	{/if}

	{#if isEditing}
		<input
			bind:this={inputEl}
			bind:value={editValue}
			type="text"
			inputmode="decimal"
			class="min-w-0 border-none bg-transparent p-0 text-body-14-tight text-text-100 outline-none"
			onkeydown={onInputKeydown}
			onblur={commitEdit}
		/>
	{:else}
		<button
			type="button"
			class={[
				"min-w-0 truncate border-none bg-transparent p-0 text-left text-body-14-tight text-text-100",
				isEditable ? "cursor-text" : "cursor-default",
			]}
			disabled={!isEditable}
			onclick={startEditing}
		>
			{displayText}
		</button>
	{/if}

	{#if hasUnitSuffix}
		{#if canCycleUnit}
			<button
				type="button"
				class="shrink-0 cursor-pointer text-text-200 select-none hover:text-text-100"
				aria-label="Change unit"
				onclick={cycleUnit}
			>
				{unit}
			</button>
		{:else}
			<span class="shrink-0 text-text-200">{unit}</span>
		{/if}
	{/if}
</div>
