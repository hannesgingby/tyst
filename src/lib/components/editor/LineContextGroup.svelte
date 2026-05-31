<script lang="ts" module>
	import type { SelectableItem } from "./SelectableList.svelte";

	export const SHAPE_TYPES: SelectableItem[] = [
		{ label: "Line", hint: "line" },
		{ label: "Rectangle", hint: "rect" },
	];
</script>

<script lang="ts">
	import { tick } from "svelte";
	import type { StrokeCapOption, StrokeDashOption, StrokeJoinOption } from "./ShapeStrokeSection.svelte";
	import ContextGroup from "./ContextGroup.svelte";
	import LineSettingsMenu from "./LineSettingsMenu.svelte";
	import RectangleSettingsMenu from "./RectangleSettingsMenu.svelte";
	import SelectableList from "./SelectableList.svelte";

	interface Props {
		onselect?: (shapeIndex: number) => void;
	}

	let { onselect }: Props = $props();

	let activeIndex = $state(0);
	let rowEls = $state<HTMLElement[]>([]);
	let rectanglePanelEl = $state<HTMLElement | null>(null);
	let linePanelEl = $state<HTMLElement | null>(null);
	/** Keep the taller rectangle panel visible while the clip shrinks to line height. */
	let holdRectangle = $state(false);
	let prevActiveIndex = 0;

	// Line settings (Typst defaults: start 0pt/0pt, length 100%, angle 0deg, stroke 1pt + black)
	let lineStartX = $state(0);
	let lineStartY = $state(0);
	let lineLength = $state(100);
	let lineLengthUnit = $state("%");
	let lineAngle = $state(0);
	let lineStrokeColor = $state("#000000");
	let lineStrokeThickness = $state(1);
	let lineStrokeCap = $state<StrokeCapOption>("Butt");
	let lineStrokeJoin = $state<StrokeJoinOption>("Miter");
	let lineStrokeDash = $state<StrokeDashOption>("Solid");
	let lineSpacingAbove = $state(1.2);
	let lineSpacingBelow = $state(0.35);
	let lineSpacingLinked = $state(true);

	// Rectangle settings (Typst defaults: width/height auto, fill none, inset 5pt, stroke auto)
	let rectWidth = $state<number | null>(null);
	let rectHeight = $state<number | null>(null);
	let rectFillEnabled = $state(false);
	let rectFillColor = $state("#000000");
	let rectRadius = $state(0);
	let rectInset = $state(5);
	let rectStrokeColor = $state("#000000");
	let rectStrokeThickness = $state(1);
	let rectStrokeCap = $state<StrokeCapOption>("Butt");
	let rectStrokeJoin = $state<StrokeJoinOption>("Miter");
	let rectStrokeDash = $state<StrokeDashOption>("Solid");
	let rectSpacingAbove = $state(1.2);
	let rectSpacingBelow = $state(0.35);
	let rectSpacingLinked = $state(true);

	const isRectangle = $derived(activeIndex === 1);
	const showRectangle = $derived(isRectangle || holdRectangle);
	const activeRowEl = $derived(rowEls[activeIndex] ?? null);
	const menuEl = $derived(
		holdRectangle ? linePanelEl : isRectangle ? rectanglePanelEl : linePanelEl,
	);

	$effect(() => {
		if (prevActiveIndex === 1 && activeIndex === 0) {
			holdRectangle = true;
			// If both panels are the same height, no height transition fires and hold would stick.
			void tick().then(() => {
				if (activeIndex !== 0 || !holdRectangle) return;
				const lineH = linePanelEl?.offsetHeight ?? 0;
				const rectH = rectanglePanelEl?.offsetHeight ?? 0;
				if (lineH >= rectH - 1) holdRectangle = false;
			});
		}
		if (activeIndex === 1) {
			holdRectangle = false;
		}
		prevActiveIndex = activeIndex;
	});

	function finishHeightTransition(): void {
		holdRectangle = false;
	}

	function handleSelect(index: number): void {
		onselect?.(index);
	}
</script>

<ContextGroup {activeRowEl} {menuEl} onClipHeightTransitionEnd={finishHeightTransition}>
	{#snippet list()}
		<SelectableList
			items={SHAPE_TYPES}
			bind:activeIndex
			width={280}
			ariaLabel="Shape type"
			shell={false}
			onrows={(rows) => (rowEls = rows)}
			onselect={handleSelect}
		/>
	{/snippet}
	{#snippet menu()}
		<div class="relative w-full">
			<div
				bind:this={rectanglePanelEl}
				class={[!showRectangle && "pointer-events-none invisible absolute inset-x-0 top-0"]}
				aria-hidden={!showRectangle}
			>
				<RectangleSettingsMenu
					bind:width={rectWidth}
					bind:height={rectHeight}
					bind:fillEnabled={rectFillEnabled}
					bind:fillColor={rectFillColor}
					bind:radius={rectRadius}
					bind:inset={rectInset}
					bind:strokeColor={rectStrokeColor}
					bind:strokeThickness={rectStrokeThickness}
					bind:strokeCap={rectStrokeCap}
					bind:strokeJoin={rectStrokeJoin}
					bind:strokeDash={rectStrokeDash}
					bind:spacingAbove={rectSpacingAbove}
					bind:spacingBelow={rectSpacingBelow}
					bind:spacingLinked={rectSpacingLinked}
				/>
			</div>
			<div
				bind:this={linePanelEl}
				class={[showRectangle && "pointer-events-none invisible absolute inset-x-0 top-0"]}
				aria-hidden={showRectangle}
			>
				<LineSettingsMenu
					bind:startX={lineStartX}
					bind:startY={lineStartY}
					bind:length={lineLength}
					bind:lengthUnit={lineLengthUnit}
					bind:angle={lineAngle}
					bind:strokeColor={lineStrokeColor}
					bind:strokeThickness={lineStrokeThickness}
					bind:strokeCap={lineStrokeCap}
					bind:strokeJoin={lineStrokeJoin}
					bind:strokeDash={lineStrokeDash}
					bind:spacingAbove={lineSpacingAbove}
					bind:spacingBelow={lineSpacingBelow}
					bind:spacingLinked={lineSpacingLinked}
				/>
			</div>
		</div>
	{/snippet}
</ContextGroup>
