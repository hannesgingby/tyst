use std::collections::BTreeSet;
use std::path::PathBuf;
use std::process::Command;

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

/// Enumerate the font families installed on the system, sorted alphabetically.
#[tauri::command]
fn list_system_fonts() -> Vec<String> {
    let mut db = fontdb::Database::new();
    db.load_system_fonts();

    let mut families: BTreeSet<String> = BTreeSet::new();
    for face in db.faces() {
        if let Some((name, _)) = face.families.first() {
            families.insert(name.clone());
        }
    }
    families.into_iter().collect()
}

/// Write a UTF-8 text file (used to save `.typ` documents).
#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
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
#[tauri::command]
fn export_pdf(typ_source: String, out_path: String) -> Result<(), String> {
    let mut tmp = std::env::temp_dir();
    tmp.push(format!("tyst-export-{}.typ", std::process::id()));
    std::fs::write(&tmp, typ_source).map_err(|e| e.to_string())?;

    let typst_bin =
        find_typst().ok_or("Typst CLI not found. Install it (e.g. `brew install typst`).")?;

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
            export_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
