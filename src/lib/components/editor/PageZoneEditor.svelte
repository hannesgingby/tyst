<script lang="ts">
	import { documentStore } from "$lib/document/store.svelte";
	import PageZonePopup from "./PageZonePopup.svelte";

	interface Props {
		kind: "header" | "footer";
		pageIdx: number;
	}

	let { kind, pageIdx }: Props = $props();

	const isActive = $derived(documentStore.activeZone === kind);
	const zone = $derived(documentStore.getZone(kind));
	const numbering = $derived(zone?.numbering);
	const previewText = $derived(zone?.text ?? "");

	let containerEl = $state<HTMLElement | null>(null);
	let popupEl = $state<HTMLElement | null>(null);

	function counterDisplay(): string {
		if (!numbering) return "";
		const p = numbering.pattern;
		const n = pageIdx + 1;
		if (p === "1/1") return `${n}/${n + 2}`;
		if (p === "I") return toRoman(n).toUpperCase();
		if (p === "i") return toRoman(n);
		if (p === "A") return String.fromCharCode(64 + Math.min(n, 26));
		if (p === "a") return String.fromCharCode(96 + Math.min(n, 26));
		return String(n);
	}

	function toRoman(num: number): string {
		const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
		const syms = ["m", "cm", "d", "cd", "c", "xc", "l", "xl", "x", "ix", "v", "iv", "i"];
		let r = "";
		for (let i = 0; i < vals.length; i++) {
			while (num >= vals[i]) { r += syms[i]; num -= vals[i]; }
		}
		return r;
	}

	$effect(() => {
		if (!isActive) return;
		function onPointerDown(e: PointerEvent): void {
			const target = e.target;
			if (!(target instanceof Node)) return;
			if (containerEl?.contains(target) || popupEl?.contains(target)) return;
			documentStore.deactivateZone();
		}
		document.addEventListener("pointerdown", onPointerDown, true);
		return () => document.removeEventListener("pointerdown", onPointerDown, true);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div
	bind:this={containerEl}
	class="relative h-full w-full cursor-pointer"
	onclick={() => documentStore.activateZone(kind)}
	onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") documentStore.activateZone(kind); }}
	role="button"
	tabindex="0"
>
	<!-- Zone preview row -->
	<div
		class={[
			"flex h-full w-full items-center gap-2 px-1 transition-colors duration-150",
			isActive
				? "bg-blue-50/20 ring-1 ring-inset ring-blue-200/40"
				: "hover:bg-bg-800/30",
		]}
	>
		{#if numbering}
			{@const counter = counterDisplay()}
			{#if numbering.align === "left"}
				<span class="zone-num shrink-0">{counter}</span>
				{#if previewText}<span class="zone-text">{previewText}</span>{/if}
			{:else if numbering.align === "center"}
				{#if previewText}<span class="zone-text">{previewText}</span>{/if}
				<span class="flex-1"></span>
				<span class="zone-num">{counter}</span>
				<span class="flex-1"></span>
			{:else}
				{#if previewText}<span class="zone-text">{previewText}</span>{/if}
				<span class="flex-1"></span>
				<span class="zone-num">{counter}</span>
			{/if}
		{:else if previewText}
			<span class="zone-text">{previewText}</span>
		{:else}
			<span class="zone-placeholder"
				>{kind === "header" ? "Page header" : "Page footer"}</span
			>
		{/if}
	</div>

	<!-- Popup -->
	{#if isActive}
		<div
			bind:this={popupEl}
			class={[
				"absolute z-50 left-0",
				kind === "header" ? "top-full" : "bottom-full",
			]}
		>
			<PageZonePopup {kind} {pageIdx} />
		</div>
	{/if}
</div>

<style>
	.zone-text {
		font-size: 12px;
		color: var(--color-text-150);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.zone-num {
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		color: var(--color-text-200);
	}

	.zone-placeholder {
		font-size: 12px;
		color: var(--color-text-300);
		font-style: italic;
	}
</style>
