#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{
  fs,
  path::{Path, PathBuf},
  process::Command,
  sync::Mutex,
};
use tauri::{
  AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, Position, Size, WebviewWindow,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

const WINDOW_WIDTH: u32 = 720;
const MIN_HEIGHT: f64 = 72.0;
const MAX_HEIGHT: f64 = 900.0;
const WINDOW_MARGIN: i32 = 44;
const DEFAULT_HOTKEY: &str = "CommandOrControl+Shift+Space";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CustomCommand {
  trigger: String,
  command: String,
  mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
  theme: String,
  hotkey: String,
  shell_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShellOption {
  label: String,
  path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommandActionResult {
  ok: bool,
  message: String,
  commands: Vec<CustomCommand>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppStatePayload {
  settings: AppSettings,
  commands: Vec<CustomCommand>,
  shells: Vec<ShellOption>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingsPatch {
  theme: Option<String>,
  hotkey: Option<String>,
  shell_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum SubmitResult {
  Empty,
  Meta { ok: bool, message: String },
  Exec {
    ok: bool,
    output: Option<String>,
    error: Option<String>,
  },
  Pty {
    ok: bool,
    output: Option<String>,
    error: Option<String>,
  },
}

struct Store {
  settings: Mutex<AppSettings>,
  commands: Mutex<Vec<CustomCommand>>,
}

fn app_data_dir() -> PathBuf {
  let mut base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
  base.push("quick-command");
  base
}

fn settings_file() -> PathBuf {
  let mut p = app_data_dir();
  p.push("settings.json");
  p
}

fn commands_file() -> PathBuf {
  let mut p = app_data_dir();
  p.push("commands.json");
  p
}

fn default_shell() -> String {
  if cfg!(target_os = "windows") {
    std::env::var("COMSPEC").unwrap_or_else(|_| "C:\\Windows\\System32\\cmd.exe".to_string())
  } else {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
  }
}

fn default_settings() -> AppSettings {
  AppSettings {
    theme: "dark".to_string(),
    hotkey: DEFAULT_HOTKEY.to_string(),
    shell_path: default_shell(),
  }
}

fn is_valid_theme(theme: &str) -> bool {
  matches!(theme, "system" | "light" | "dark" | "dim")
}

fn default_commands() -> Vec<CustomCommand> {
  vec![
    CustomCommand {
      trigger: "home".to_string(),
      command: if cfg!(target_os = "windows") {
        "cd $HOME".to_string()
      } else {
        "cd ~".to_string()
      },
      mode: "pty".to_string(),
    },
    CustomCommand {
      trigger: "dir".to_string(),
      command: if cfg!(target_os = "windows") {
        "dir".to_string()
      } else {
        "ls".to_string()
      },
      mode: "pty".to_string(),
    },
  ]
}

fn read_json_file<T: for<'de> Deserialize<'de>>(path: &Path) -> Option<T> {
  let raw = fs::read_to_string(path).ok()?;
  serde_json::from_str(&raw).ok()
}

fn write_json_file<T: Serialize>(path: &Path, data: &T) -> Result<(), String> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  let text = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
  fs::write(path, text).map_err(|e| e.to_string())
}

fn load_settings() -> AppSettings {
  let path = settings_file();
  let defaults = default_settings();
  read_json_file::<AppSettings>(&path).unwrap_or(defaults)
}

fn load_commands() -> Vec<CustomCommand> {
  let path = commands_file();
  read_json_file::<Vec<CustomCommand>>(&path).unwrap_or_else(default_commands)
}

fn detect_shells() -> Vec<ShellOption> {
  let mut shells = Vec::new();
  if cfg!(target_os = "windows") {
    shells.push(ShellOption {
      label: "PowerShell".to_string(),
      path: "powershell.exe".to_string(),
    });
    shells.push(ShellOption {
      label: "PowerShell 7".to_string(),
      path: "pwsh.exe".to_string(),
    });
    shells.push(ShellOption {
      label: "Command Prompt".to_string(),
      path: "cmd.exe".to_string(),
    });
    shells.push(ShellOption {
      label: "Git Bash".to_string(),
      path: "bash.exe".to_string(),
    });
  } else {
    shells.push(ShellOption {
      label: "zsh".to_string(),
      path: "zsh".to_string(),
    });
    shells.push(ShellOption {
      label: "bash".to_string(),
      path: "bash".to_string(),
    });
    shells.push(ShellOption {
      label: "sh".to_string(),
      path: "sh".to_string(),
    });
  }
  shells
}

fn clamp_logical_height(logical_height: f64, monitor_logical_height: f64) -> f64 {
  let cap = (monitor_logical_height * 0.85).min(MAX_HEIGHT);
  logical_height.clamp(MIN_HEIGHT, cap)
}

/// Resize and position the window. `logical_height` must be in CSS/logical pixels
/// (same coordinate system as `window.innerHeight` in the webview).
fn position_window(window: &WebviewWindow, logical_height: f64) -> Result<(), String> {
  let scale = window.scale_factor().map_err(|e| e.to_string())?;
  let monitor = window
    .current_monitor()
    .map_err(|e| e.to_string())?
    .or_else(|| window.primary_monitor().ok().flatten())
    .ok_or_else(|| "No monitor available".to_string())?;

  let monitor_physical = monitor.size();
  let monitor_logical_h = monitor_physical.height as f64 / scale;
  let window_h = clamp_logical_height(logical_height, monitor_logical_h);
  let physical_h = window_h * scale;
  let physical_w = WINDOW_WIDTH as f64 * scale;
  let pos = monitor.position();
  let x = (pos.x as f64 + (monitor_physical.width as f64 - physical_w) / 2.0).round() as i32;

  let anchored_y = if window.is_visible().unwrap_or(false) {
    if let (Ok(outer_pos), Ok(outer_size)) = (window.outer_position(), window.outer_size()) {
      let bottom = outer_pos.y + outer_size.height as i32;
      Some(bottom - physical_h.round() as i32)
    } else {
      None
    }
  } else {
    None
  };

  window
    .set_size(Size::Logical(LogicalSize::new(
      WINDOW_WIDTH as f64,
      window_h,
    )))
    .map_err(|e| e.to_string())?;

  let y = anchored_y.unwrap_or_else(|| {
    (pos.y as f64 + monitor_physical.height as f64 - physical_h - WINDOW_MARGIN as f64).round()
      as i32
  });

  window
    .set_position(Position::Physical(PhysicalPosition::new(x, y)))
    .map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
fn toggle_bar(app: AppHandle) -> Result<(), String> {
  toggle_window(&app)
}

fn toggle_window(app: &AppHandle) -> Result<(), String> {
  let Some(window) = app.get_webview_window("main") else {
    return Ok(());
  };

  if window.is_visible().map_err(|e| e.to_string())? {
    window.hide().map_err(|e| e.to_string())?;
    return Ok(());
  }

  let scale = window.scale_factor().unwrap_or(1.0);
  let current_logical = window
    .outer_size()
    .map(|s| s.height as f64 / scale)
    .unwrap_or(MIN_HEIGHT);
  let _ = position_window(&window, current_logical.max(MIN_HEIGHT));
  window.show().map_err(|e| e.to_string())?;
  window.set_focus().map_err(|e| e.to_string())?;
  let _ = window.emit("window-shown", true);
  Ok(())
}

fn register_hotkey(app: &AppHandle, hotkey: &str) -> Result<(), String> {
  app
    .global_shortcut()
    .unregister_all()
    .map_err(|e| e.to_string())?;
  app
    .global_shortcut()
    .register(hotkey)
    .map_err(|e| e.to_string())
}

fn run_shell(shell_path: &str, line: &str) -> Result<String, String> {
  let lower = shell_path.to_lowercase();
  let output = if cfg!(target_os = "windows") {
    if lower.contains("powershell") || lower.contains("pwsh") {
      Command::new(shell_path)
        .args(["-NoLogo", "-NoProfile", "-Command", line])
        .output()
    } else if lower.contains("cmd") {
      Command::new(shell_path).args(["/C", line]).output()
    } else {
      Command::new(shell_path).arg(line).output()
    }
  } else {
    Command::new(shell_path).args(["-lc", line]).output()
  }
  .map_err(|e| e.to_string())?;

  let stdout = String::from_utf8_lossy(&output.stdout).to_string();
  let stderr = String::from_utf8_lossy(&output.stderr).to_string();
  let joined = format!("{}{}", stdout, stderr).trim().to_string();
  if output.status.success() {
    Ok(joined)
  } else if joined.is_empty() {
    Err(format!("Command exited with status {}", output.status))
  } else {
    Err(joined)
  }
}

fn validate_trigger(trigger: &str) -> Result<(), String> {
  if trigger.trim().is_empty() {
    return Err("Trigger cannot be empty.".to_string());
  }
  if !trigger
    .chars()
    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
  {
    return Err("Trigger may only contain letters, numbers, hyphens, and underscores.".to_string());
  }
  if trigger.eq_ignore_ascii_case("cmd") {
    return Err("Trigger \"cmd\" is reserved.".to_string());
  }
  Ok(())
}

#[tauri::command]
fn get_state(store: tauri::State<Store>) -> Result<AppStatePayload, String> {
  let settings = store.settings.lock().map_err(|e| e.to_string())?.clone();
  let commands = store.commands.lock().map_err(|e| e.to_string())?.clone();
  Ok(AppStatePayload {
    settings,
    commands,
    shells: detect_shells(),
  })
}

#[tauri::command]
fn set_settings(
  app: AppHandle,
  store: tauri::State<Store>,
  patch: SettingsPatch,
) -> Result<AppSettings, String> {
  let mut settings = store.settings.lock().map_err(|e| e.to_string())?;
  if let Some(theme) = patch.theme {
    if is_valid_theme(&theme) {
      settings.theme = theme;
    }
  }
  if let Some(shell_path) = patch.shell_path {
    settings.shell_path = shell_path;
  }
  if let Some(hotkey) = patch.hotkey {
    register_hotkey(&app, &hotkey)?;
    settings.hotkey = hotkey;
  }
  write_json_file(&settings_file(), &*settings)?;
  Ok(settings.clone())
}

fn add_command_inner(
  store: &Store,
  trigger: String,
  command: String,
  mode: String,
) -> Result<CommandActionResult, String> {
  validate_trigger(&trigger)?;
  if mode != "exec" && mode != "pty" {
    return Err("Mode must be \"exec\" or \"pty\".".to_string());
  }
  if command.trim().is_empty() {
    return Err("Command cannot be empty.".to_string());
  }

  let mut commands = store.commands.lock().map_err(|e| e.to_string())?;
  let key = trigger.to_lowercase();
  let mut verb = "Added";
  if let Some(existing) = commands
    .iter_mut()
    .find(|entry| entry.trigger.to_lowercase() == key)
  {
    existing.command = command.trim().to_string();
    existing.mode = mode;
    existing.trigger = trigger.trim().to_string();
    verb = "Updated";
  } else {
    commands.push(CustomCommand {
      trigger: trigger.trim().to_string(),
      command: command.trim().to_string(),
      mode,
    });
  }
  write_json_file(&commands_file(), &*commands)?;
  Ok(CommandActionResult {
    ok: true,
    message: format!("{} shortcut \"{}\".", verb, trigger.trim()),
    commands: commands.clone(),
  })
}

fn remove_command_inner(store: &Store, trigger: String) -> Result<CommandActionResult, String> {
  let mut commands = store.commands.lock().map_err(|e| e.to_string())?;
  let key = trigger.to_lowercase();
  let before = commands.len();
  commands.retain(|entry| entry.trigger.to_lowercase() != key);
  if before == commands.len() {
    return Ok(CommandActionResult {
      ok: false,
      message: format!("No shortcut named \"{}\".", trigger),
      commands: commands.clone(),
    });
  }
  write_json_file(&commands_file(), &*commands)?;
  Ok(CommandActionResult {
    ok: true,
    message: format!("Removed shortcut \"{}\".", trigger),
    commands: commands.clone(),
  })
}

#[tauri::command]
fn add_command(
  store: tauri::State<Store>,
  trigger: String,
  command: String,
  mode: String,
) -> Result<CommandActionResult, String> {
  add_command_inner(&store, trigger, command, mode)
}

#[tauri::command]
fn remove_command(store: tauri::State<Store>, trigger: String) -> Result<CommandActionResult, String> {
  remove_command_inner(&store, trigger)
}

fn cmd_meta_output(commands: &[CustomCommand]) -> String {
  if commands.is_empty() {
    return "No custom shortcuts defined.".to_string();
  }
  commands
    .iter()
    .map(|entry| format!("  {} ({}) -> {}", entry.trigger, entry.mode, entry.command))
    .collect::<Vec<_>>()
    .join("\n")
}

#[tauri::command]
fn submit_line(app: AppHandle, store: tauri::State<Store>, line: String) -> Result<SubmitResult, String> {
  let trimmed = line.trim();
  if trimmed.is_empty() {
    return Ok(SubmitResult::Empty);
  }

  let tokens: Vec<&str> = trimmed.split_whitespace().collect();
  if !tokens.is_empty() && tokens[0].eq_ignore_ascii_case("cmd") {
    if tokens.len() == 1 || tokens.get(1).is_some_and(|item| item.eq_ignore_ascii_case("help")) {
      return Ok(SubmitResult::Meta {
        ok: true,
        message: "cmd add <trigger> <exec|pty> <command>\ncmd remove <trigger>\ncmd list\ncmd help"
          .to_string(),
      });
    }
    if tokens.get(1).is_some_and(|item| item.eq_ignore_ascii_case("list")) {
      let commands = store.commands.lock().map_err(|e| e.to_string())?;
      return Ok(SubmitResult::Meta {
        ok: true,
        message: format!("Shortcuts:\n{}", cmd_meta_output(&commands)),
      });
    }
    if tokens.get(1).is_some_and(|item| item.eq_ignore_ascii_case("add")) {
      let trigger = tokens.get(2).copied().unwrap_or("");
      let mode = tokens.get(3).copied().unwrap_or("");
      let command = tokens.get(4..).map(|s| s.join(" ")).unwrap_or_default();
      if trigger.is_empty() || mode.is_empty() || command.is_empty() {
        return Ok(SubmitResult::Meta {
          ok: false,
          message: "Usage: cmd add <trigger> <exec|pty> <command>".to_string(),
        });
      }
      let result = add_command_inner(&store, trigger.to_string(), command, mode.to_string())?;
      return Ok(SubmitResult::Meta {
        ok: result.ok,
        message: result.message,
      });
    }
    if tokens.get(1).is_some_and(|item| {
      item.eq_ignore_ascii_case("remove")
        || item.eq_ignore_ascii_case("rm")
        || item.eq_ignore_ascii_case("delete")
    }) {
      let trigger = tokens.get(2).copied().unwrap_or("");
      if trigger.is_empty() {
        return Ok(SubmitResult::Meta {
          ok: false,
          message: "Usage: cmd remove <trigger>".to_string(),
        });
      }
      let result = remove_command_inner(&store, trigger.to_string())?;
      return Ok(SubmitResult::Meta {
        ok: result.ok,
        message: result.message,
      });
    }
    return Ok(SubmitResult::Meta {
      ok: false,
      message: format!(
        "Unknown cmd subcommand \"{}\". Type cmd help.",
        tokens.get(1).unwrap_or(&"")
      ),
    });
  }

  let settings = store.settings.lock().map_err(|e| e.to_string())?.clone();
  let commands = store.commands.lock().map_err(|e| e.to_string())?.clone();
  let custom = commands
    .iter()
    .find(|entry| entry.trigger.eq_ignore_ascii_case(trimmed));

  let (mode, command_to_run) = if let Some(entry) = custom {
    (entry.mode.clone(), entry.command.clone())
  } else {
    ("pty".to_string(), trimmed.to_string())
  };

  match run_shell(&settings.shell_path, &command_to_run) {
    Ok(out) => {
      if mode == "exec" {
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.hide();
        }
        Ok(SubmitResult::Exec {
          ok: true,
          output: if out.is_empty() { None } else { Some(out) },
          error: None,
        })
      } else {
        Ok(SubmitResult::Pty {
          ok: true,
          output: if out.is_empty() { None } else { Some(out) },
          error: None,
        })
      }
    }
    Err(err) => {
      if mode == "exec" {
        Ok(SubmitResult::Exec {
          ok: false,
          output: None,
          error: Some(err),
        })
      } else {
        Ok(SubmitResult::Pty {
          ok: false,
          output: None,
          error: Some(err),
        })
      }
    }
  }
}

#[tauri::command]
fn hide_window(app: AppHandle) -> Result<(), String> {
  if let Some(window) = app.get_webview_window("main") {
    window.hide().map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[tauri::command]
fn resize_window(app: AppHandle, height: f64) -> Result<(), String> {
  if let Some(window) = app.get_webview_window("main") {
    position_window(&window, height.max(MIN_HEIGHT))?;
  }
  Ok(())
}

fn main() {
  let settings = load_settings();
  let commands = load_commands();

  let _ = write_json_file(&settings_file(), &settings);
  let _ = write_json_file(&commands_file(), &commands);

  tauri::Builder::default()
    .plugin(
      tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
          if event.state == ShortcutState::Pressed {
            let _ = toggle_window(app);
          }
        })
        .build(),
    )
    .manage(Store {
      settings: Mutex::new(settings),
      commands: Mutex::new(commands),
    })
    .setup(|app| {
      let app_handle = app.handle().clone();
      let state = app.state::<Store>();
      let settings = state.settings.lock().map_err(|e| e.to_string())?.clone();
      if let Err(err) = register_hotkey(&app_handle, &settings.hotkey) {
        eprintln!("Global shortcut registration failed: {err}");
        let _ = app_handle.emit(
          "hotkey-error",
          format!(
            "Could not register {} ({err}). Close other Quick Command instances and restart.",
            settings.hotkey
          ),
        );
        // Still usable: show the bar so the app is not stuck hidden.
        let _ = toggle_window(&app_handle);
      }

      if let Some(window) = app_handle.get_webview_window("main") {
        let _ = position_window(&window, MIN_HEIGHT);
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_state,
      set_settings,
      add_command,
      remove_command,
      submit_line,
      hide_window,
      resize_window,
      toggle_bar
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
