<script lang="ts">
	import Icon from "$lib/components/Icon.svelte";
	import Tooltip from "$lib/components/Tooltip.svelte";

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
	};

	type DotTool = { kind: "dot" };

	type Tool = IconTool | ExpandableTool | DotTool;

	type ToolGroup = { class?: string; tools: Tool[] };

	const groups: ToolGroup[] = [
		{
			tools: [
				{ kind: "expandable", name: "text", label: "Typography" },
				{ kind: "expandable", name: "headings", label: "Headings", iconClass: "h-6 w-12" },
			],
		},
		{
			class: "gap-[9px]",
			tools: [
				{ kind: "icon", name: "bold", label: "Bold", shortcut: "⌘B" },
				{ kind: "icon", name: "italic", label: "Italic", shortcut: "⌘I" },
				{ kind: "icon", name: "underline", label: "Underline", shortcut: "⌘U" },
				{ kind: "dot" },
				{ kind: "icon", name: "nav-arrow-right", label: "More formatting", iconClass: "size-4" },
			],
		},
		{
			tools: [
				{ kind: "expandable", name: "align-center", label: "Alignment" },
				{ kind: "expandable", name: "list", label: "List" },
				{ kind: "icon", name: "table", label: "Table", iconClass: "size-7.5" },
			],
		},
		{
			tools: [
				{ kind: "icon", name: "outline", label: "Outline", iconClass: "size-7" },
				{ kind: "icon", name: "footnote", label: "Footnote", iconClass: "size-10" },
				{ kind: "icon", name: "at-sign", label: "Reference", iconClass: "size-5" },
			],
		},
		{
			tools: [
				{ kind: "icon", name: "horizontal-spacing", label: "Horizontal spacing" },
				{ kind: "icon", name: "vertical-spacing", label: "Vertical spacing" },
				{ kind: "icon", name: "paragraph-break", label: "Paragraph break", iconClass: "size-7" },
				{ kind: "icon", name: "page-break", label: "Page break", iconClass: "size-7.5" },
			],
		},
		{
			tools: [
				{ kind: "icon", name: "view-columns2", label: "Columns", iconClass: "size-5.5" },
				{ kind: "icon", name: "view-grid", label: "Grid", iconClass: "size-5.5" },
				{ kind: "icon", name: "padding", label: "Padding" },
				{ kind: "icon", name: "block", label: "Block" },
			],
		},
	];
</script>

{#snippet toolIcon(name: string, label: string, iconClass = "size-6", shortcut?: string)}
	<Tooltip {label} {shortcut} position="bottom">
		<button type="button" class="group flex items-center justify-center">
			<Icon
				{name}
				class="{iconClass} text-icon transition-colors duration-150 ease-out group-hover:text-text-200"
			/>
		</button>
	</Tooltip>
{/snippet}

{#snippet toolExpandable(
	name: string,
	label: string,
	iconClass = "size-6",
	shortcut?: string,
)}
	<Tooltip {label} {shortcut} position="bottom">
		<button type="button" class="group/control flex items-center gap-0.5">
			<Icon
				{name}
				class="{iconClass} text-icon transition-colors duration-150 ease-out group-hover/control:text-text-200"
			/>
			<Icon
				name="nav-arrow-down"
				class="size-3.5 text-icon transition-colors duration-150 ease-out group-hover/control:text-text-200 transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] group-hover/control:rotate-180"
			/>
		</button>
	</Tooltip>
{/snippet}

<div class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-6">
	<div
		class="toolbar-shell pointer-events-auto flex h-[50px] max-w-[1023px] items-center gap-1.5 rounded-lg bg-bg-800 px-[5.5px] py-[5px] shadow-toolbar"
	>
		{#each groups as group}
			<div
				class={[
					"flex h-10 items-center justify-center gap-3 rounded-md bg-bg-950 px-2.5 py-2",
					group.class,
				]}
			>
				{#each group.tools as tool}
					{#if tool.kind === "icon"}
						{@render toolIcon(tool.name, tool.label, tool.iconClass, tool.shortcut)}
					{:else if tool.kind === "expandable"}
						{@render toolExpandable(tool.name, tool.label, tool.iconClass, tool.shortcut)}
					{:else}
						<span class="size-1 shrink-0 rounded-full bg-bg-600" aria-hidden="true"></span>
					{/if}
				{/each}
			</div>
		{/each}
	</div>
</div>
