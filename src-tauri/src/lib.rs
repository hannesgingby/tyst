use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::process::Command;

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

/// Enumerate the font families installed on the system, sorted alphabetically.
#[tauri::command]
fn list_system_fonts() -> Vec<String> {
    let mut db = fontdb::Database::new();
    db.load_system_fonts();
    db.faces()
        .filter_map(|face| face.families.first().map(|(name, _)| name.clone()))
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

/// Write a UTF-8 text file (used to save `.typ` documents).
#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

/// Read a file and return its bytes base64-encoded (used for embedding images
/// in the editor preview without exposing arbitrary file paths to the webview).
#[tauri::command]
fn read_file_base64(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(B64.encode(bytes))
}

/// Decode a base64 payload and write it to `path`. Used to save embedded image
/// bytes alongside the .typ file so the document is portable.
#[tauri::command]
fn write_bytes_file(path: String, data_base64: String) -> Result<(), String> {
    let bytes = B64.decode(data_base64).map_err(|e| e.to_string())?;
    if let Some(parent) = Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, bytes).map_err(|e| e.to_string())
}

/// Create a directory (and any missing parents). No-op if it already exists.
#[tauri::command]
fn ensure_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())
}

/// Locate the Typst CLI, checking PATH and common install locations.
fn find_typst() -> Option<PathBuf> {
    let candidates = [
        "typst",
        "/opt/homebrew/bin/typst",
        "/usr/local/bin/typst",
        "/usr/bin/typst",
    ];
    for candidate in candidates {
        if Command::new(candidate).arg("--version").output().is_ok() {
            return Some(PathBuf::from(candidate));
        }
    }
    None
}

/// Compile Typst source to a PDF at `out_path` using the Typst CLI.
///
/// The temp .typ source is written next to `out_path` (not in the system temp
/// dir) so that `#image("foo_files/…")` references resolve against the same
/// image folder we wrote alongside the PDF destination.
#[tauri::command]
fn export_pdf(typ_source: String, out_path: String) -> Result<(), String> {
    let typst_bin =
        find_typst().ok_or("Typst CLI not found. Install it (e.g. `brew install typst`).")?;

    let out = Path::new(&out_path);
    let tmp_dir = out.parent().unwrap_or_else(|| Path::new("."));
    let tmp = tmp_dir.join(format!(".tyst-export-{}.typ", std::process::id()));
    std::fs::write(&tmp, typ_source).map_err(|e| e.to_string())?;

    let output = Command::new(typst_bin)
        .arg("compile")
        .arg(&tmp)
        .arg(&out_path)
        .output()
        .map_err(|e| e.to_string());

    let _ = std::fs::remove_file(&tmp);

    let output = output?;
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let save = MenuItemBuilder::with_id("save", "Save")
                .accelerator("CmdOrCtrl+S")
                .build(app)?;
            let export = MenuItemBuilder::with_id("export-pdf", "Export as PDF…")
                .accelerator("CmdOrCtrl+Shift+E")
                .build(app)?;

            let app_menu = SubmenuBuilder::new(app, "tyst")
                .about(None)
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;
            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&save)
                .item(&export)
                .separator()
                .close_window()
                .build()?;
            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&app_menu, &file_menu, &edit_menu])
                .build()?;
            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "save" => {
                let _ = app.emit("menu://save", ());
            }
            "export-pdf" => {
                let _ = app.emit("menu://export-pdf", ());
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            list_system_fonts,
            write_text_file,
            write_bytes_file,
            read_file_base64,
            ensure_dir,
            export_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
