<script lang="ts">
    import { onMount } from "svelte";
    import Document from "./Document.svelte";
    import DocumentSettings from "./DocumentSettings.svelte";
    import Toolbar from "./Toolbar.svelte";
    import Topbar from "./Topbar.svelte";
    import { fontStore } from "$lib/system/fonts.svelte";
    import { exportPdf, saveTypFile } from "$lib/system/files";
    import { isTauri } from "$lib/system/tauri";
    import { documentStore } from "$lib/document/store.svelte";
    import { zoomStore } from "$lib/document/zoom.svelte";
    import type { SectionId } from "./DocumentSettings.svelte";

    let settingsOpen = $state(false);
    let settingsSection = $state<SectionId | undefined>(undefined);
    let scaledPageWidthPx = $state(0);

    // Zoom badge visibility
    let badgeVisible = $state(false);
    let badgeTimeout: ReturnType<typeof setTimeout> | null = null;

    function showBadge() {
        badgeVisible = true;
        if (badgeTimeout) clearTimeout(badgeTimeout);
        badgeTimeout = setTimeout(() => {
            badgeVisible = false;
            badgeTimeout = null;
        }, 2000);
    }

    function handleZoomStep(direction: "up" | "down") {
        if (direction === "up") zoomStore.stepUp();
        else zoomStore.stepDown();
        showBadge();
    }

    function handleZoomReset() {
        zoomStore.reset();
        badgeVisible = false;
        if (badgeTimeout) {
            clearTimeout(badgeTimeout);
            badgeTimeout = null;
        }
    }

    $effect(() => {
        const nav = documentStore.settingsNav;
        if (!nav) return;
        documentStore.settingsNav = null;
        settingsSection = nav as SectionId;
        settingsOpen = true;
    });

    onMount(() => {
        fontStore.ensureLoaded();

        function onKeydown(e: KeyboardEvent) {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod) return;
            if (e.key === "=" || e.key === "+") {
                e.preventDefault();
                handleZoomStep("up");
            } else if (e.key === "-") {
                e.preventDefault();
                handleZoomStep("down");
            }
        }

        function onWheel(e: WheelEvent) {
            const mod = e.ctrlKey || e.metaKey;
            if (!mod) return;
            e.preventDefault();
            // deltaMode 0 = pixels (trackpad pinch), 1 = lines (mouse scroll)
            const sensitivity = e.deltaMode === 0 ? 0.002 : 0.05;
            zoomStore.set(zoomStore.value - e.deltaY * sensitivity);
            showBadge();
        }

        window.addEventListener("keydown", onKeydown);
        window.addEventListener("wheel", onWheel, { passive: false });

        if (!isTauri()) return () => {
            window.removeEventListener("keydown", onKeydown);
            window.removeEventListener("wheel", onWheel);
        };

        // Bridge native File-menu actions (emitted from Rust) to the frontend.
        const unlisteners: Array<() => void> = [];
        (async () => {
            const { listen } = await import("@tauri-apps/api/event");
            unlisteners.push(await listen("menu://save", () => saveTypFile()));
            unlisteners.push(await listen("menu://export-pdf", () => exportPdf()));
        })();

        return () => {
            window.removeEventListener("keydown", onKeydown);
            window.removeEventListener("wheel", onWheel);
            unlisteners.forEach((off) => off());
        };
    });
</script>

<div class="fixed inset-0 flex flex-col overflow-hidden bg-bg-900">
    <main
        class="flex min-h-0 flex-1 flex-col items-center overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 pb-28"
    >
        <div
            class="flex w-full max-w-[1240px] flex-col"
            style="padding-top: clamp(2rem, 9vh, 5.625rem);"
        >
            <Topbar
                {scaledPageWidthPx}
                onMore={() => {
                    settingsSection = "page";
                    settingsOpen = true;
                }}
            />
            <Document bind:scaledPageWidthPx />
        </div>
    </main>
    <Toolbar />
    <DocumentSettings bind:open={settingsOpen} bind:section={settingsSection} />

    <!-- Zoom badge -->
    <button
        type="button"
        class="zoom-badge"
        class:visible={badgeVisible}
        onclick={handleZoomReset}
        aria-label="Reset zoom to 90%"
    >
        zoom: {zoomStore.percent}%
    </button>
</div>

<style>
    .zoom-badge {
        position: fixed;
        top: 24px;
        right: 32px;
        padding: 3px 10px;
        font-size: 14px;
        letter-spacing: -0.005em;
        border-radius: 6px;
        background: #d9ebf9;
        color: #3d9eee;
        border: none;
        cursor: pointer;
        opacity: 0;
        pointer-events: none;
        transition: opacity 150ms ease-out;
        line-height: 1.35;
        z-index: 100;
    }

    .zoom-badge.visible {
        opacity: 1;
        pointer-events: auto;
    }
</style>
