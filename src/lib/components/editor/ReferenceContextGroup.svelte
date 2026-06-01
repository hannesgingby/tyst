<script lang="ts">
	import { getContext } from "svelte";
	import Icon from "$lib/components/Icon.svelte";
	import {
		HOVER_POPUP_PIN_KEY,
		type HoverPopupPin,
	} from "$lib/components/ui/hoverPopupContext";
	import ContextGroup from "./ContextGroup.svelte";
	import ReferenceDisplayTextMenu from "./ReferenceDisplayTextMenu.svelte";
	import {
		MOCK_REFERENCE_SECTIONS,
		type ReferenceItem,
		type ReferenceSection,
	} from "./referenceTypes";

	interface Props {
		/** When false, only the “Add sources to cite” row is shown (no search). */
		hasElements?: boolean;
		sections?: ReferenceSection[];
	}

	let {
		hasElements = true,
		sections = MOCK_REFERENCE_SECTIONS,
	}: Props = $props();

	const LIST_WIDTH = 300;

	let searchQuery = $state("");
	let activeItemIndex = $state(-1);
	let rowEls = $state<HTMLElement[]>([]);
	let menuEl = $state<HTMLElement | null>(null);
	let popupRegionEl = $state<HTMLElement | null>(null);
	let scrollEl = $state<HTMLElement | null>(null);
	let showScrollFade = $state(false);
	let displayText = $state("");
	let searchFocused = $state(false);
	let popupHovered = $state(false);

	const hoverPin = getContext<HoverPopupPin | undefined>(HOVER_POPUP_PIN_KEY);
	const isSearching = $derived(searchQuery.trim() !== "");

	const contentSections = $derived(
		sections.filter((s) => s.title !== "Citation"),
	);

	const filteredItems = $derived.by((): ReferenceItem[] => {
		const q = searchQuery.trim().toLowerCase();
		const out: ReferenceItem[] = [];
		for (const section of contentSections) {
			for (const item of section.items) {
				if (!q || item.label.toLowerCase().includes(q)) out.push(item);
			}
		}
		return out;
	});

	const sectionBlocks = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		return contentSections
			.map((section) => ({
				title: section.title,
				items: section.items.filter(
					(item) => !q || item.label.toLowerCase().includes(q),
				),
			}))
			.filter((block) => block.items.length > 0);
	});

	const activeItem = $derived(
		activeItemIndex >= 0 ? filteredItems[activeItemIndex] : null,
	);
	const activeRowEl = $derived(rowEls[activeItemIndex] ?? null);
	const showMenu = $derived(activeItemIndex >= 0);

	$effect(() => {
		displayText = activeItem?.displayText ?? activeItem?.label ?? "";
	});

	$effect(() => {
		if (activeItemIndex >= filteredItems.length) {
			activeItemIndex = filteredItems.length > 0 ? 0 : -1;
		}
	});

	function rowRef(node: HTMLElement, index: number) {
		const next = [...rowEls];
		next[index] = node;
		rowEls = next;
		return {
			destroy() {
				const cleared = [...rowEls];
				delete cleared[index];
				rowEls = cleared.filter(Boolean);
			},
		};
	}

	function selectItem(index: number): void {
		activeItemIndex = index;
	}

	function updateScrollFade(): void {
		if (!scrollEl) {
			showScrollFade = false;
			return;
		}
		const { scrollTop, scrollHeight, clientHeight } = scrollEl;
		showScrollFade =
			scrollHeight > clientHeight + 1 &&
			scrollTop + clientHeight < scrollHeight - 1;
	}

	$effect(() => {
		hasElements;
		sectionBlocks;
		searchQuery;
		const el = scrollEl;
		if (!el) return;

		updateScrollFade();
		el.addEventListener("scroll", updateScrollFade, { passive: true });
		const ro = new ResizeObserver(() => updateScrollFade());
		ro.observe(el);
		return () => {
			el.removeEventListener("scroll", updateScrollFade);
			ro.disconnect();
		};
	});

	// Pin while searching (caret in search, pointer may leave) or pointer is over the popup.
	$effect(() => {
		const pinned = searchFocused || popupHovered;
		hoverPin?.setPinned(pinned);
		return () => hoverPin?.setPinned(false);
	});

	$effect(() => {
		function onDocumentPointerDown(event: PointerEvent): void {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (popupRegionEl?.contains(target)) return;
			searchFocused = false;
			popupHovered = false;
			hoverPin?.dismiss();
		}
		document.addEventListener("pointerdown", onDocumentPointerDown, true);
		return () =>
			document.removeEventListener("pointerdown", onDocumentPointerDown, true);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={popupRegionEl}
	onmouseenter={() => (popupHovered = true)}
	onmouseleave={() => (popupHovered = false)}
	onfocusin={() => (popupHovered = true)}
	onfocusout={(e) => {
		const next = e.relatedTarget;
		if (
			next instanceof Node &&
			e.currentTarget instanceof Node &&
			e.currentTarget.contains(next)
		) {
			return;
		}
		popupHovered = false;
	}}
>
<ContextGroup showMenu={showMenu} {activeRowEl} {menuEl} menuAlign="center">
	{#snippet list()}
		<div
			class="shell reference-list-shell relative shrink-0 overflow-hidden rounded-lg"
			style:width="{LIST_WIDTH}px"
		>
			<div
				bind:this={scrollEl}
				class={[
					"reference-list-scroll overflow-x-hidden overflow-y-auto",
					hasElements ? "min-h-[400px] max-h-[400px]" : "max-h-[400px]",
				]}
			>
				{#if hasElements}
					<div class="px-3 pt-2.5 pb-2">
						<input
							type="text"
							role="searchbox"
							aria-label="Search references"
							class="reference-search w-full border-none bg-transparent text-body-14-tight text-text-100 outline-none placeholder:text-text-250"
							placeholder="Type to search..."
							bind:value={searchQuery}
							onfocus={() => (searchFocused = true)}
							onblur={() => (searchFocused = false)}
							spellcheck="false"
							autocomplete="off"
						/>
					</div>
				{/if}

				<div class="px-3 pb-2 pt-2">
					{#if !isSearching}
						<div class="pb-1">
							<p class="pb-2 text-body-14 text-text-250">Citation</p>
							<button
								type="button"
								class="flex h-8 w-full items-center justify-between rounded-md bg-[#EBE2DF] px-3 text-body-14-tight text-[#a85a45] transition-opacity duration-150 hover:opacity-80"
								onmouseenter={() => (activeItemIndex = -1)}
								onfocus={() => (activeItemIndex = -1)}
							>
								<span>Add sources to cite</span>
								<Icon name="arrow-up-right" class="size-4 shrink-0" />
							</button>
						</div>
					{/if}

					{#if hasElements}
						{#each sectionBlocks as block, blockIndex (block.title)}
							{#if !isSearching || blockIndex > 0}
								<div
									class="my-3 h-px w-full shrink-0 bg-bg-600"
									aria-hidden="true"
								></div>
							{/if}
							<div>
								<p class="pb-2 text-body-14 text-text-250">{block.title}</p>
								<ul class="flex flex-col gap-0.5" role="list">
									{#each block.items as item (item.id)}
										{@const itemIndex = filteredItems.findIndex(
											(f) => f.id === item.id,
										)}
										<li role="presentation">
											<button
												type="button"
												use:rowRef={itemIndex}
												class={[
													"flex h-8 w-full items-center justify-between gap-2 rounded-md px-3 text-body-14-tight text-text-100 transition-colors duration-150",
													itemIndex === activeItemIndex
														? "bg-bg-950"
														: "hover:bg-bg-950",
												]}
												onmouseenter={() => selectItem(itemIndex)}
												onfocus={() => selectItem(itemIndex)}
											>
												<span class="min-w-0 truncate text-left">{item.label}</span>
												<span class="shrink-0 text-text-250">{item.location}</span>
											</button>
										</li>
									{/each}
								</ul>
							</div>
						{/each}
					{/if}
				</div>
			</div>
			{#if showScrollFade}
				<div
					class="reference-list-fade pointer-events-none absolute inset-x-0 bottom-0 h-6"
					aria-hidden="true"
				></div>
			{/if}
		</div>
	{/snippet}
	{#snippet menu()}
		<div bind:this={menuEl} class="w-full">
			<ReferenceDisplayTextMenu bind:value={displayText} />
		</div>
	{/snippet}
</ContextGroup>
</div>

<style>
	/* Safari may still decorate type="text" search roles — hide any clear control. */
	.reference-search::-webkit-search-cancel-button,
	.reference-search::-webkit-search-decoration {
		display: none;
	}

	.reference-list-fade {
		background: linear-gradient(
			to top,
			var(--color-bg-800) 0%,
			color-mix(in srgb, var(--color-bg-800) 65%, transparent) 45%,
			transparent 100%
		);
	}

	.reference-list-scroll {
		scrollbar-width: thin;
		scrollbar-color: var(--color-bg-600) transparent;
	}

	.reference-list-scroll::-webkit-scrollbar {
		width: 3px;
	}

	.reference-list-scroll::-webkit-scrollbar-track {
		background: transparent;
	}

	.reference-list-scroll::-webkit-scrollbar-thumb {
		border-radius: 9999px;
		background: var(--color-bg-600);
	}
</style>
