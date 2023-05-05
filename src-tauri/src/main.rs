#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::{utils::config::AppUrl, WindowUrl};

fn main() {

  // a build do tauri para windows nao permite conexoes http so http, para resolver isso foi utilizado a sulução encontrada aqui: https://github.com/tauri-apps/tauri/issues/3007; https://github.com/Lodestone-Team/lodestone/commit/4f3ea1d2c1088c6f7b84924b1b6e5ba5dad7514b

  let mut context = tauri::generate_context!();
  let mut builder = tauri::Builder::default();

  #[cfg(not(dev))]
  {
      let port = portpicker::pick_unused_port().expect("Failed to pick unused port");
      let url = format!("http://localhost:{}", port).parse().unwrap();
      let window_url = WindowUrl::External(url);
      // rewrite the config so the IPC is enabled on this URL
      context.config_mut().build.dist_dir = AppUrl::Url(window_url.clone());
      context.config_mut().build.dev_path = AppUrl::Url(window_url.clone());

      builder = builder.plugin(tauri_plugin_localhost::Builder::new(port).build());
    }

  builder
    .plugin(tauri_plugin_fs_extra::init())
    .run(context)
    .expect("error while running tauri application");
}