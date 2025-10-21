#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri::Manager;

fn main() {
  tauri::Builder::default()
    // registra el plugin system-info
    .plugin(tauri_plugin_system_info::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
