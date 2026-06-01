<script lang="ts">
	import { getContext, untrack } from "svelte";
	import Icon from "$lib/components/Icon.svelte";
	import {
		HOVER_POPUP_PIN_KEY,
		type HoverPopupPin,
	} from "$lib/components/ui/hoverPopupContext";
	import { documentStore } from "$lib/document/store.svelte";
	import ContextGroup from "./ContextGroup.svelte";
	import LinkDisplayTextMenu from "./LinkDisplayTextMenu.svelte";
	import ReferenceDisplayTextMenu from "./ReferenceDisplayTextMenu.svelte";
	import type { ReferenceItem, ReferenceSection } from "./referenceTypes";

	interface Props {
		/** When false, only the "Add sources to cite" row is shown (no search). */
		hasElements?: boolean;
		/** Called when the user picks a reference or citation item. */
		onselect?: (kind: "reference" | "citation", id: string) => void;
		/** Block ID or source ID of the currently active reference/citation — pre-selects the matching row. */
		activeTargetId?: string | null;
		/** True when the active block is a citation (vs cross-reference). */
		isCitationActive?: boolean;
		/** Called when display text or page form changes for the selected item. */
		onmenuchange?: (displayText: string, pageForm: boolean) => void;
		/** Called when the link URL or display text changes. */
		onlinkchange?: (url: string, displayText: string) => void;
	}

	let {
		hasElements = true,
		onselect,
		activeTargetId = null,
		isCitationActive = false,
		onmenuchange,
		onlinkchange,
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
	let pageForm = $state(false);
	let searchFocused = $state(false);
	let popupHovered = $state(false);
	let linkUrl = $state("");
	let linkDisplayText = $state("");
	let linkRowEl = $state<HTMLElement | null>(null);

	const hoverPin = getContext<HoverPopupPin | undefined>(HOVER_POPUP_PIN_KEY);
	const isSearching = $derived(searchQuery.trim() !== "");

	// Build sections from the real store data
	const sections = $derived.by((): ReferenceSection[] => {
		const { headings, figures } = documentStore.referenceSections;
		const bib = documentStore.bibliographySettings;

		const headingItems: ReferenceItem[] = headings.map(b => ({
			id: b.id,
			label: b.text || "Heading",
			location: `Page ${documentStore.blockPageIndex(b.id) + 1}`,
			displayText: b.text || "Heading",
		}));

		const figureItems: ReferenceItem[] = figures.map(b => ({
			id: b.id,
			label: b.image?.fileName || "Figure",
			location: `Page ${documentStore.blockPageIndex(b.id) + 1}`,
			displayText: b.image?.fileName || "Figure",
		}));

		const citationItems: ReferenceItem[] = bib.sources.map(s => {
			const parts = [s.title, s.authors, s.date].filter(Boolean);
			const label = parts.join(", ") || s.id;
			return {
				id: s.id,
				label,
				location: "",
				displayText: s.title || s.id,
			};
		});

		return [
			{ title: "Citation", items: citationItems },
			{ title: "Sections", items: headingItems },
			{ title: "Figures", items: figureItems },
		];
	});

	const hasCitations = $derived(sections.find(s => s.title === "Citation")?.items.length ?? 0 > 0);

	const contentSections = $derived(
		sections.filter((s) => s.title !== "Citation"),
	);

	const allFilterableSections = $derived(sections);

	const filteredItems = $derived.by((): (ReferenceItem & { sectionTitle: string })[] => {
		const q = searchQuery.trim().toLowerCase();
		const out: (ReferenceItem & { sectionTitle: string })[] = [];
		for (const section of allFilterableSections) {
			for (const item of section.items) {
				if (!q || item.label.toLowerCase().includes(q)) out.push({ ...item, sectionTitle: section.title });
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

	const citationSectionItems = $derived.by((): ReferenceItem[] => {
		const s = sections.find(s => s.title === "Citation");
		if (!s) return [];
		const q = searchQuery.trim().toLowerCase();
		return q ? s.items.filter(i => i.label.toLowerCase().includes(q)) : s.items;
	});

	const activeItem = $derived(
		activeItemIndex >= 0 ? filteredItems[activeItemIndex] : null,
	);
	const showLinkMenu = $derived(linkUrl.trim() !== "");
	const showReferenceMenu = $derived(
		activeItemIndex >= 0 && activeItem?.sectionTitle !== "Citation",
	);
	const showMenu = $derived(showLinkMenu || showReferenceMenu);
	const activeRowEl = $derived(
		showLinkMenu ? linkRowEl : (rowEls[activeItemIndex] ?? null),
	);

	// Initialize menu values when the selected item changes.
	// If the active block already has a reference pointing to this item, restore its settings.
	$effect(() => {
		const item = activeItem;
		if (!item) { displayText = ""; pageForm = false; return; }
		const ref = untrack(() => documentStore.activeBlock.reference);
		if (ref && ref.targetBlockId === item.id) {
			displayText = ref.displayText ?? "";
			pageForm = ref.pageForm ?? false;
		} else {
			displayText = "";
			pageForm = false;
		}
	});

	// Propagate menu changes back to the store whenever displayText or pageForm change.
	$effect(() => {
		const dt = displayText;
		const pf = pageForm;
		untrack(() => {
			if (activeItemIndex < 0) return;
			const item = filteredItems[activeItemIndex];
			if (!item || item.sectionTitle === "Citation") return;
			onmenuchange?.(dt, pf);
		});
	});

	let linkSyncedBlockId = $state<string | null>(null);

	// Restore link fields when the active link chip changes.
	$effect(() => {
		const block = documentStore.activeBlock;
		if (!block.link) {
			linkSyncedBlockId = null;
			return;
		}
		if (linkSyncedBlockId === block.id) return;
		linkSyncedBlockId = block.id;
		linkUrl = block.link.url;
		linkDisplayText = block.link.displayText ?? "";
		activeItemIndex = -1;
	});

	$effect(() => {
		const url = linkUrl;
		const dt = linkDisplayText;
		untrack(() => {
			if (!url.trim()) return;
			onlinkchange?.(url, dt);
		});
	});

	// Pre-select the row matching the active block's target when the popup opens.
	$effect(() => {
		if (!activeTargetId) return;
		const idx = filteredItems.findIndex(
			(f) =>
				f.id === activeTargetId &&
				(isCitationActive ? f.sectionTitle === "Citation" : f.sectionTitle !== "Citation"),
		);
		if (idx >= 0) activeItemIndex = idx;
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

	function handleItemClick(item: ReferenceItem & { sectionTitle: string }): void {
		if (item.sectionTitle === "Citation") {
			onselect?.("citation", item.id);
		} else {
			onselect?.("reference", item.id);
		}
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
					isSearching ? "min-h-[400px] max-h-[400px]" : "max-h-[400px]",
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
							{#if citationSectionItems.length > 0}
								<ul class="flex flex-col gap-0.5" role="list">
									{#each citationSectionItems as item (item.id)}
										{@const itemInFiltered = filteredItems.findIndex(f => f.id === item.id && f.sectionTitle === "Citation")}
										<li role="presentation">
											<button
												type="button"
												use:rowRef={itemInFiltered}
												class={[
													"flex h-8 w-full items-center justify-between gap-2 rounded-md px-3 text-body-14-tight text-text-100 transition-colors duration-150",
													itemInFiltered === activeItemIndex
														? "bg-bg-950"
														: "hover:bg-bg-950",
												]}
												onmouseenter={() => selectItem(itemInFiltered)}
												onfocus={() => selectItem(itemInFiltered)}
												onclick={() => handleItemClick({ ...item, sectionTitle: "Citation" })}
											>
												<span class="min-w-0 truncate text-left">{item.label}</span>
											</button>
										</li>
									{/each}
								</ul>
							{:else}
								<button
									type="button"
									class="flex h-8 w-full items-center justify-between rounded-md bg-[#EBE2DF] px-3 text-body-14-tight text-[#a85a45] transition-opacity duration-150 hover:opacity-80"
									onmouseenter={() => (activeItemIndex = -1)}
									onfocus={() => (activeItemIndex = -1)}
									onclick={() => documentStore.openSettings("references")}
								>
									<span>Add sources to cite</span>
									<Icon name="arrow-up-right" class="size-4 shrink-0" />
								</button>
							{/if}
						</div>
					{/if}

					{#if hasElements}
						{#each sectionBlocks as block, blockIndex (block.title)}
							{#if !isSearching || blockIndex > 0 || citationSectionItems.length > 0}
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
											(f) => f.id === item.id && f.sectionTitle === block.title,
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
												onclick={() => handleItemClick({ ...item, sectionTitle: block.title })}
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

					{#if hasElements}
						<div
							class="my-3 h-px w-full shrink-0 bg-bg-600"
							aria-hidden="true"
						></div>
						<div>
							<p class="pb-2 text-body-14 text-text-250">Link</p>
							<div
								bind:this={linkRowEl}
								class="field-shell flex h-9 w-full items-center bg-bg-950 pl-4 pr-4"
							>
								<input
									type="url"
									class="h-full w-full border-none bg-transparent text-body-14-tight text-text-100 outline-none placeholder:text-text-250"
									placeholder="https://example.com"
									bind:value={linkUrl}
									onfocus={() => (activeItemIndex = -1)}
									spellcheck="false"
									autocomplete="off"
								/>
							</div>
						</div>
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
			{#if showLinkMenu}
				<LinkDisplayTextMenu bind:value={linkDisplayText} />
			{:else}
				<ReferenceDisplayTextMenu bind:value={displayText} bind:pageForm />
			{/if}
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
