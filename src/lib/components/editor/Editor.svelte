<script lang="ts">
    import { onMount } from "svelte";
    import Document from "./Document.svelte";
    import DocumentSettings from "./DocumentSettings.svelte";
    import Toolbar from "./Toolbar.svelte";
    import Topbar from "./Topbar.svelte";
    import { fontStore } from "$lib/system/fonts.svelte";
    import { exportPdf, saveTypFile } from "$lib/system/files";
    import { isTauri } from "$lib/system/tauri";

    let settingsOpen = $state(false);

    onMount(() => {
        fontStore.ensureLoaded();

        if (!isTauri()) return;

        // Bridge native File-menu actions (emitted from Rust) to the frontend.
        const unlisteners: Array<() => void> = [];
        (async () => {
            const { listen } = await import("@tauri-apps/api/event");
            unlisteners.push(await listen("menu://save", () => saveTypFile()));
            unlisteners.push(await listen("menu://export-pdf", () => exportPdf()));
        })();

        return () => unlisteners.forEach((off) => off());
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
            <Topbar onMore={() => (settingsOpen = true)} />
            <Document />
        </div>
    </main>
    <Toolbar />
    <DocumentSettings bind:open={settingsOpen} />
</div>
