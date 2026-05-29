<script lang="ts">
    import ColorSelect from "$lib/components/ui/ColorSelect.svelte";
    import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
    import Icon from "$lib/components/Icon.svelte";
    import Input from "$lib/components/ui/Input.svelte";
    import Switch from "$lib/components/ui/Switch.svelte";
    import Tag from "$lib/components/ui/Tag.svelte";
    import { documentStore } from "$lib/document/store.svelte";
    import { PAPER_PRESETS } from "$lib/document/paperSizes";
    import { cmToPt } from "$lib/document/units";
    import type { PageSection, PaperPreset } from "$lib/document/types";

    const FIELD_BG = "bg-bg-input-on-pure-white";

    const model = $derived(documentStore.model);
    const pageCount = $derived(documentStore.pageCount);
    const activeIndex = $derived(model.activePageIndex);
    const isDefaultPage = $derived(activeIndex === 0);

    const paper = $derived(documentStore.activePaperSource);
    const marginSrc = $derived(documentStore.activeMarginSource);
    const colorSrc = $derived(documentStore.activeColorSource);
    const isCustom = $derived(paper.preset === "Custom");

    const previewSize = $derived(
        paper.landscape
            ? { width: paper.size.height, height: paper.size.width }
            : paper.size,
    );

    const marginPct = $derived({
        left: (cmToPt(marginSrc.margins.left) / previewSize.width) * 100,
        right: (cmToPt(marginSrc.margins.right) / previewSize.width) * 100,
        top: (cmToPt(marginSrc.margins.top) / previewSize.height) * 100,
        bottom: (cmToPt(marginSrc.margins.bottom) / previewSize.height) * 100,
    });

    // Keep the active page in range when the page count shrinks.
    $effect(() => {
        if (activeIndex > pageCount - 1)
            documentStore.setActivePage(pageCount - 1);
    });

    let pageMenuOpen = $state(false);

    function selectPage(index: number): void {
        documentStore.setActivePage(index);
        pageMenuOpen = false;
    }

    $effect(() => {
        if (!pageMenuOpen) return;
        const close = () => (pageMenuOpen = false);
        window.addEventListener("pointerdown", close);
        return () => window.removeEventListener("pointerdown", close);
    });
</script>

{#snippet sectionHeader(title: string, section: PageSection)}
    <div
        class="mb-5 flex items-center justify-between border-b border-bg-600 pb-3"
    >
        <span class="text-body-16 text-text-100">{title}</span>
        {#if isDefaultPage}
            <Tag label="default" variant="purple" linked={true} />
        {:else}
            <Tag
                label="default"
                variant="purple"
                linked={documentStore.isSectionLinked(section)}
                onUnlink={() => documentStore.toggleSectionLink(section)}
                onLink={() => documentStore.toggleSectionLink(section)}
            />
        {/if}
    </div>
{/snippet}

<div class="flex flex-col gap-1">
    <div class="relative w-fit">
        <button
            type="button"
            class="flex items-center gap-1.5 text-2xl leading-[1.2] tracking-[-0.01em] text-text-100"
            onclick={(event) => {
                event.stopPropagation();
                pageMenuOpen = !pageMenuOpen;
            }}
        >
            Page {activeIndex + 1}
            <Icon name="nav-arrow-down" class="size-4 text-text-200" />
        </button>

        {#if pageMenuOpen}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="absolute top-full left-0 z-10 mt-1 min-w-[160px] overflow-hidden rounded-md border border-border-checkbox-off bg-bg-950 py-1 shadow-tooltip"
                onpointerdown={(event) => event.stopPropagation()}
            >
                {#each Array(pageCount) as _, index (index)}
                    <button
                        type="button"
                        class={[
                            "flex w-full px-3 py-1.5 text-left text-body-14-tight transition-colors duration-150",
                            index === activeIndex
                                ? "bg-bg-850 text-text-100"
                                : "text-text-100 hover:bg-bg-850",
                        ]}
                        onclick={() => selectPage(index)}
                    >
                        Page {index + 1}
                    </button>
                {/each}
            </div>
        {/if}
    </div>
    <p class="text-body-16 text-text-200">
        Choose page dimensions, margins and more
    </p>
</div>

<!-- Paper -->
<section class="mt-12">
    {@render sectionHeader("Paper", "paper")}

    <div class="flex flex-col gap-[18px]">
        <div class="flex items-center justify-between gap-4">
            <span class="text-body-14 text-text-100">Preset</span>
            <DropdownMenu
                class="w-[211px]"
                bg={FIELD_BG}
                value={paper.preset}
                options={PAPER_PRESETS}
                onchange={(value: PaperPreset) =>
                    documentStore.setPaperPreset(value)}
            />
        </div>

        <div class="flex items-center justify-between gap-4">
            <span class="text-body-14 text-text-100">Dimensions</span>
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-1.5">
                    <span class="text-body-14 text-text-100">x:</span>
                    <Input
                        class="w-[151px]"
                        bg={FIELD_BG}
                        value={paper.size.width}
                        unit="pt"
                        decimals={2}
                        min={1}
                        max={5000}
                        step={1}
                        disabled={!isCustom}
                        onchange={(value) =>
                            documentStore.setDimension("width", value)}
                    />
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="text-body-14 text-text-100">y:</span>
                    <Input
                        class="w-[151px]"
                        bg={FIELD_BG}
                        value={paper.size.height}
                        unit="pt"
                        decimals={2}
                        min={1}
                        max={5000}
                        step={1}
                        disabled={!isCustom}
                        onchange={(value) =>
                            documentStore.setDimension("height", value)}
                    />
                </div>
            </div>
        </div>

        <div class="flex items-center justify-between gap-4">
            <span class="text-body-14 text-text-100">Landscape</span>
            <Switch bind:checked={paper.landscape} label="Landscape" />
        </div>
    </div>
</section>

<!-- Margin -->
<section class="mt-16">
    {@render sectionHeader("Margin", "margin")}

    <div class="flex gap-12">
        <div class="flex flex-1 items-start justify-start">
            <div
                class="relative w-full max-w-[300px] border border-bg-600 bg-white"
                style:aspect-ratio="{previewSize.width} / {previewSize.height}"
            >
                <div
                    class="absolute border border-dashed border-bg-600"
                    style:top="{marginPct.top}%"
                    style:bottom="{marginPct.bottom}%"
                    style:left="{marginPct.left}%"
                    style:right="{marginPct.right}%"
                ></div>
            </div>
        </div>

        <div class="flex w-[252px] flex-col gap-2.5">
            <div class="flex items-center justify-end gap-2">
                <span class="w-12 text-right text-body-14 text-text-100">X</span
                >
                <Input
                    class="w-[151px]"
                    bg={FIELD_BG}
                    bind:value={marginSrc.margins.x}
                    unit="pt"
                    emptyLabel="Auto"
                    decimals={0}
                    min={0}
                    max={2000}
                    step={1}
                />
            </div>
            <div class="flex items-center justify-end gap-2">
                <span class="w-12 text-right text-body-14 text-text-100">Y</span
                >
                <Input
                    class="w-[151px]"
                    bg={FIELD_BG}
                    bind:value={marginSrc.margins.y}
                    unit="pt"
                    emptyLabel="Auto"
                    decimals={0}
                    min={0}
                    max={2000}
                    step={1}
                />
            </div>

            <div class="mt-4 flex flex-col gap-2.5">
                <div class="flex items-center justify-end gap-2">
                    <span class="w-12 text-right text-body-14 text-text-100"
                        >Left</span
                    >
                    <Input
                        class="w-[151px]"
                        bg={FIELD_BG}
                        bind:value={marginSrc.margins.left}
                        unit="cm"
                        decimals={1}
                        min={0}
                        max={20}
                        step={0.1}
                    />
                </div>
                <div class="flex items-center justify-end gap-2">
                    <span class="w-12 text-right text-body-14 text-text-100"
                        >Right</span
                    >
                    <Input
                        class="w-[151px]"
                        bg={FIELD_BG}
                        bind:value={marginSrc.margins.right}
                        unit="cm"
                        decimals={1}
                        min={0}
                        max={20}
                        step={0.1}
                    />
                </div>
                <div class="flex items-center justify-end gap-2">
                    <span class="w-12 text-right text-body-14 text-text-100"
                        >Top</span
                    >
                    <Input
                        class="w-[151px]"
                        bg={FIELD_BG}
                        bind:value={marginSrc.margins.top}
                        unit="cm"
                        decimals={1}
                        min={0}
                        max={20}
                        step={0.1}
                    />
                </div>
                <div class="flex items-center justify-end gap-2">
                    <span class="w-12 text-right text-body-14 text-text-100"
                        >Bottom</span
                    >
                    <Input
                        class="w-[151px]"
                        bg={FIELD_BG}
                        bind:value={marginSrc.margins.bottom}
                        unit="cm"
                        decimals={1}
                        min={0}
                        max={20}
                        step={0.1}
                    />
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Color -->
<section class="mt-16">
    {@render sectionHeader("Color", "color")}

    <div class="flex flex-col gap-[18px]">
        <div class="flex items-center justify-between gap-4">
            <span class="text-body-14 text-text-100">Paper</span>
            <ColorSelect bind:value={colorSrc.fill} />
        </div>

        <div class="flex items-start justify-between gap-4">
            <div class="flex flex-col gap-0.5">
                <span class="text-body-14 text-text-100">Text</span>
                <span class="max-w-[360px] text-body-12 text-text-200">
                    This will be overwritten if an explicit color for some text
                    is set.
                </span>
            </div>
            <ColorSelect bind:value={model.typography.color} />
        </div>
    </div>
</section>
