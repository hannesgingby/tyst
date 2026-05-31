<script lang="ts">
    import Icon from "$lib/components/Icon.svelte";
    import Tooltip from "$lib/components/Tooltip.svelte";
    import HoverPopup from "$lib/components/ui/HoverPopup.svelte";
    import { documentStore } from "$lib/document/store.svelte";
    import { imageCache, pickAndLoadImage } from "$lib/system/imageCache.svelte";
    import AlignmentPopup from "./AlignmentPopup.svelte";
    import HeadingsPopup from "./HeadingsPopup.svelte";
    import ImagePopup from "./ImagePopup.svelte";
    import LinePopup from "./LinePopup.svelte";
    import ListPopup from "./ListPopup.svelte";
    import TypographyPopup from "./TypographyPopup.svelte";

    const activeBlock = $derived(documentStore.activeBlock);
    const headingsActive = $derived(activeBlock.heading != null);
    const listActive = $derived(activeBlock.list != null);
    const alignmentActive = $derived(
        activeBlock.alignment != null && activeBlock.alignment !== "left",
    );

    // Embed popups: the image popup and the line popup (which also handles
    // rectangles) stay "tied" open while their matching block is active.
    const imageTied = $derived(documentStore.tiedPopup === "image");
    const lineTied = $derived(
        documentStore.tiedPopup === "line" || documentStore.tiedPopup === "rect",
    );

    // Hover-to-open for the Line tool (matches Headings/List behaviour). When
    // a shape is active the popup is "tied" open regardless of hover.
    let lineHoverOpen = $state(false);

    // Click-outside-to-close. When the user clicks somewhere that's neither
    // the open popup nor the matching embed block in the document, dismiss
    // the tied popup. The store resets dismissal whenever the user re-clicks
    // the embed (which goes through `activateEmbed`).
    $effect(() => {
        // Reset dismissal whenever the active block id changes.
        documentStore.activeBlockId;
        documentStore.popupDismissed = null;
    });

    let imageWrapEl = $state<HTMLDivElement | null>(null);
    let lineWrapEl = $state<HTMLDivElement | null>(null);

    function isInsideActiveEmbed(target: EventTarget | null): boolean {
        if (!(target instanceof HTMLElement)) return false;
        const id = activeBlock.id;
        // The embed wrapper carries `.doc-embed` and `data-block-id={id}`.
        return target.closest(`.doc-embed[data-block-id="${id}"]`) != null;
    }

    function onDocumentPointerDown(event: PointerEvent): void {
        const target = event.target;
        if (imageTied && !documentStore.popupDismissed) {
            const inPopup = imageWrapEl != null && target instanceof Node && imageWrapEl.contains(target);
            if (!inPopup && !isInsideActiveEmbed(target)) {
                documentStore.popupDismissed = "image";
            }
        }
        if (lineTied && !documentStore.popupDismissed) {
            const inPopup = lineWrapEl != null && target instanceof Node && lineWrapEl.contains(target);
            if (!inPopup && !isInsideActiveEmbed(target)) {
                documentStore.popupDismissed = "line";
            }
        }
    }

    $effect(() => {
        if (!imageTied && !lineTied) return;
        document.addEventListener("pointerdown", onDocumentPointerDown, true);
        return () => document.removeEventListener("pointerdown", onDocumentPointerDown, true);
    });

    const imageOpen = $derived(imageTied && documentStore.popupDismissed !== "image");
    const lineOpen = $derived(
        (lineTied && documentStore.popupDismissed !== "line") || lineHoverOpen,
    );

    type PopupKind = "typography" | "headings" | "list" | "alignment";

    type IconTool = {
        kind: "icon";
        name: string;
        label: string;
        iconClass?: string;
        shortcut?: string;
    };

    type ExpandableTool = {
        kind: "expandable";
        name: string;
        label: string;
        iconClass?: string;
        shortcut?: string;
        popup?: PopupKind;
    };

    type DotTool = { kind: "dot" };

    type Tool = IconTool | ExpandableTool | DotTool;

    type ToolGroup = { class?: string; tools: Tool[] };

    const groups: ToolGroup[] = [
        {
            tools: [
                {
                    kind: "expandable",
                    name: "text",
                    label: "Typography",
                    popup: "typography",
                },
                {
                    kind: "expandable",
                    name: "headings",
                    label: "Headings",
                    iconClass: "h-6 w-12",
                    popup: "headings",
                },
            ],
        },
        {
            class: "gap-[9px]",
            tools: [
                { kind: "icon", name: "bold", label: "Bold", shortcut: "⌘B" },
                {
                    kind: "icon",
                    name: "italic",
                    label: "Italic",
                    shortcut: "⌘I",
                },
                {
                    kind: "icon",
                    name: "underline",
                    label: "Underline",
                    shortcut: "⌘U",
                },
                { kind: "dot" },
                {
                    kind: "icon",
                    name: "nav-arrow-right",
                    label: "More formatting",
                    iconClass: "size-4",
                },
            ],
        },
        {
            tools: [
                {
                    kind: "expandable",
                    name: "align-center",
                    label: "Alignment",
                    popup: "alignment",
                },
                {
                    kind: "expandable",
                    name: "list",
                    label: "List",
                    popup: "list",
                },
                {
                    kind: "icon",
                    name: "table",
                    label: "Table",
                    iconClass: "size-7.5",
                },
            ],
        },
        {
            tools: [
                // line + image rendered inline below (need bespoke wiring)
            ],
        },
        {
            tools: [
                {
                    kind: "icon",
                    name: "outline",
                    label: "Outline",
                    iconClass: "size-7",
                },
                {
                    kind: "icon",
                    name: "footnote",
                    label: "Footnote",
                    iconClass: "size-10",
                },
                {
                    kind: "icon",
                    name: "at-sign",
                    label: "Reference",
                    iconClass: "size-5",
                },
            ],
        },
        {
            tools: [
                {
                    kind: "icon",
                    name: "horizontal-spacing",
                    label: "Horizontal spacing",
                },
                {
                    kind: "icon",
                    name: "vertical-spacing",
                    label: "Vertical spacing",
                },
                {
                    kind: "icon",
                    name: "paragraph-break",
                    label: "Paragraph break",
                    iconClass: "size-7",
                },
                {
                    kind: "icon",
                    name: "page-break",
                    label: "Page break",
                    iconClass: "size-7.5",
                },
            ],
        },
        {
            tools: [
                {
                    kind: "icon",
                    name: "view-columns2",
                    label: "Columns",
                    iconClass: "size-5.5",
                },
                {
                    kind: "icon",
                    name: "view-grid",
                    label: "Grid",
                    iconClass: "size-5.5",
                },
                { kind: "icon", name: "padding", label: "Padding" },
                { kind: "icon", name: "block", label: "Block" },
            ],
        },
    ];

    async function handleImageClick(): Promise<void> {
        // If the image popup was dismissed for a still-active image block,
        // clicking the trigger should just re-open it without a file picker.
        if (activeBlock.image && imageTied && documentStore.popupDismissed === "image") {
            documentStore.popupDismissed = null;
            return;
        }
        // If an image is already active, picking a file replaces its bytes /
        // metadata in place. Otherwise, prompt first and only insert after the
        // user actually chooses a file (so we don't leave an empty placeholder
        // behind if they cancel).
        if (activeBlock.image) {
            const picked = await pickAndLoadImage(activeBlock.id);
            if (!picked) return;
            documentStore.updateImage(activeBlock.id, {
                fileName: picked.fileName,
                ext: picked.ext,
            });
            return;
        }
        // Reserve an id we can use as the cache key before the block exists.
        const reservedId = crypto.randomUUID();
        const picked = await pickAndLoadImage(reservedId);
        if (!picked) return;
        const blockId = documentStore.insertEmbed({
            text: "",
            alignment: "center",
            image: documentStore.defaultImageSettings(picked.fileName, picked.ext),
        });
        // Move the cached bytes from the reserved id onto the real block id.
        const cached = imageCache.get(reservedId);
        if (cached) {
            imageCache.set(blockId, cached);
            imageCache.delete(reservedId);
        }
    }

</script>

{#snippet toolIcon(
    name: string,
    label: string,
    size = "size-6",
    shortcut?: string,
    active = false,
)}
    <Tooltip {label} {shortcut} position="bottom">
        <button
            type="button"
            class={[
                "relative flex h-6 items-center justify-center rounded-md transition-opacity duration-150 [transition-timing-function:cubic-bezier(0.33,1,0.68,1)]",
                active ? "toolbar-tool-active" : "hover:opacity-50",
            ]}
        >
            <Icon {name} class="{size} {active ? 'text-current' : 'text-icon'}" />
        </button>
    </Tooltip>
{/snippet}

<!-- Embed-toolbar trigger: a plain button (no internal popup state) whose
     blue "tied" state is driven from documentStore. The popup itself is
     positioned above it and rendered conditionally based on the same state. -->
{#snippet embedTrigger(
    name: string,
    label: string,
    active: boolean,
    onclick: () => void,
    iconClass = "size-6",
    chevron = false,
)}
    <Tooltip {label} position="bottom" disabled={active}>
        <button
            type="button"
            class={[
                "tool-btn relative flex h-6 items-center justify-center gap-0.5 rounded-md transition-opacity duration-150 [transition-timing-function:cubic-bezier(0.33,1,0.68,1)]",
                active ? "toolbar-tool-active" : "hover:opacity-50",
            ]}
            aria-expanded={active}
            {onclick}
        >
            <Icon {name} class="{iconClass} {active ? 'text-current' : 'text-icon'}" />
            {#if chevron}
                <span class="chevron" class:active class:open={active}>
                    <Icon
                        name="nav-arrow-down"
                        class="size-3.5 {active ? 'text-current' : 'text-icon'}"
                    />
                </span>
            {/if}
        </button>
    </Tooltip>
{/snippet}

<div
    class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-6"
>
    <div
        class="shell pointer-events-auto flex h-[50px] max-w-[1023px] items-center gap-1.5 rounded-lg px-[5.5px] py-[5px]"
    >
        {#each groups as group, groupIndex (groupIndex)}
            <div
                class={[
                    "flex h-10 items-center justify-center gap-3 rounded-md bg-bg-950 px-2.5 py-2",
                    group.class,
                ]}
            >
                {#if groupIndex === 3}
                    <!-- Embeds group: line (hover-to-expand) + image (click-to-pick).
                         Both keep their popups tied open when their block kind is
                         active in the document; clicking outside dismisses. -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        bind:this={lineWrapEl}
                        class="relative flex items-center"
                        onmouseenter={() => (lineHoverOpen = true)}
                        onmouseleave={() => (lineHoverOpen = false)}
                    >
                        {@render embedTrigger("line", "Line", lineOpen, () => {
                            // Reopen if the popup was previously dismissed for a still-active shape.
                            if (lineTied && documentStore.popupDismissed === "line") {
                                documentStore.popupDismissed = null;
                            }
                        }, "size-6", true)}
                        {#if lineOpen}
                            <div
                                class="absolute bottom-full -left-8 z-[60] pb-2.5"
                                role="dialog"
                                aria-label="Line"
                            >
                                <LinePopup />
                            </div>
                        {/if}
                    </div>
                    <div bind:this={imageWrapEl} class="relative flex items-center">
                        {@render embedTrigger("image", "Image", imageOpen, handleImageClick)}
                        {#if imageOpen}
                            <div
                                class="absolute bottom-full -left-8 z-[60] pb-2.5"
                                role="dialog"
                                aria-label="Image"
                            >
                                <ImagePopup />
                            </div>
                        {/if}
                    </div>
                {:else}
                    {#each group.tools as tool, toolIndex (toolIndex)}
                        {#if tool.kind === "icon"}
                            {@render toolIcon(
                                tool.name,
                                tool.label,
                                tool.iconClass,
                                tool.shortcut,
                            )}
                        {:else if tool.kind === "expandable" && tool.popup === "typography"}
                            <HoverPopup
                                label={tool.label}
                                icon={tool.name}
                                iconClass={tool.iconClass}
                                shortcut={tool.shortcut}
                            >
                                {#snippet popup()}<TypographyPopup />{/snippet}
                            </HoverPopup>
                        {:else if tool.kind === "expandable" && tool.popup === "headings"}
                            <HoverPopup
                                label={tool.label}
                                icon={tool.name}
                                iconClass={tool.iconClass}
                                shortcut={tool.shortcut}
                                active={headingsActive}
                            >
                                {#snippet popup()}<HeadingsPopup />{/snippet}
                            </HoverPopup>
                        {:else if tool.kind === "expandable" && tool.popup === "list"}
                            <HoverPopup
                                label={tool.label}
                                icon={tool.name}
                                iconClass={tool.iconClass}
                                shortcut={tool.shortcut}
                                active={listActive}
                            >
                                {#snippet popup()}<ListPopup />{/snippet}
                            </HoverPopup>
                        {:else if tool.kind === "expandable" && tool.popup === "alignment"}
                            <HoverPopup
                                label={tool.label}
                                icon={tool.name}
                                iconClass={tool.iconClass}
                                shortcut={tool.shortcut}
                                active={alignmentActive}
                            >
                                {#snippet popup()}<AlignmentPopup />{/snippet}
                            </HoverPopup>
                        {:else if tool.kind === "expandable"}
                            <HoverPopup
                                label={tool.label}
                                icon={tool.name}
                                iconClass={tool.iconClass}
                                shortcut={tool.shortcut}
                            />
                        {:else}
                            <span
                                class="size-1 shrink-0 rounded-full bg-bg-600"
                                aria-hidden="true"
                            ></span>
                        {/if}
                    {/each}
                {/if}
            </div>
        {/each}
    </div>
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
