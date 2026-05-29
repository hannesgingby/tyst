<script lang="ts">
    import Icon from "$lib/components/Icon.svelte";
    import Tooltip from "$lib/components/Tooltip.svelte";
    import TypographyPopup from "./TypographyPopup.svelte";

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
        popup?: "typography";
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
                },
                { kind: "expandable", name: "list", label: "List" },
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

    let typographyOpen = $state(false);

    const iconClass = "text-icon";
    const hoverClass =
        "tool-btn transition-opacity duration-150 [transition-timing-function:cubic-bezier(0.33,1,0.68,1)] hover:opacity-50";
</script>

{#snippet toolIcon(
    name: string,
    label: string,
    size = "size-6",
    shortcut?: string,
)}
    <Tooltip {label} {shortcut} position="bottom">
        <button
            type="button"
            class="flex h-6 items-center justify-center {hoverClass}"
        >
            <Icon {name} class="{size} {iconClass}" />
        </button>
    </Tooltip>
{/snippet}

{#snippet expandableContent(name: string, size: string, open: boolean)}
    <Icon {name} class="{size} {iconClass}" />
    <span class="chevron text-icon" class:open>
        <Icon name="nav-arrow-down" class="size-3.5" />
    </span>
{/snippet}

{#snippet toolExpandable(
    name: string,
    label: string,
    size = "size-6",
    shortcut?: string,
)}
    <Tooltip {label} {shortcut} position="bottom">
        <button
            type="button"
            class="flex h-6 items-center gap-0.5 {hoverClass}"
        >
            {@render expandableContent(name, size, false)}
        </button>
    </Tooltip>
{/snippet}

{#snippet typographyControl(name: string, label: string, size = "size-6")}
    <!-- Popup lives inside this wrapper so the 10px gap (the popup's bottom padding)
	     stays inside the hover region. Leaving the wrapper closes it immediately. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="relative flex items-center"
        onmouseenter={() => (typographyOpen = true)}
        onmouseleave={() => (typographyOpen = false)}
    >
        <Tooltip {label} position="bottom" disabled={typographyOpen}>
            <button
                type="button"
                class="flex h-6 items-center gap-0.5 {hoverClass}"
                aria-expanded={typographyOpen}
            >
                {@render expandableContent(name, size, typographyOpen)}
            </button>
        </Tooltip>

        {#if typographyOpen}
            <div
                class="absolute bottom-full -left-8 pb-2.5"
                role="dialog"
                aria-label="Typography settings"
            >
                <TypographyPopup />
            </div>
        {/if}
    </div>
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
                {#each group.tools as tool, toolIndex (toolIndex)}
                    {#if tool.kind === "icon"}
                        {@render toolIcon(
                            tool.name,
                            tool.label,
                            tool.iconClass,
                            tool.shortcut,
                        )}
                    {:else if tool.kind === "expandable" && tool.popup === "typography"}
                        {@render typographyControl(
                            tool.name,
                            tool.label,
                            tool.iconClass,
                        )}
                    {:else if tool.kind === "expandable"}
                        {@render toolExpandable(
                            tool.name,
                            tool.label,
                            tool.iconClass,
                            tool.shortcut,
                        )}
                    {:else}
                        <span
                            class="size-1 shrink-0 rounded-full bg-bg-600"
                            aria-hidden="true"
                        ></span>
                    {/if}
                {/each}
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
