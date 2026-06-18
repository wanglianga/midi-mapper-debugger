pub mod types;
pub mod midi_manager;
pub mod mapping_manager;
pub mod file_manager;
pub mod commands;

use commands::AppState;
use crate::types::*;
use crate::midi_manager::MidiManager;
use crate::mapping_manager::MappingManager;
use crate::file_manager::FileManager;

use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use tauri::{Manager, Window};
use env_logger::Env;

fn handle_midi_event(
    event: MidiEvent,
    window: &Window,
    recent_events: Arc<Mutex<Vec<MidiEvent>>>,
    mapping_manager: Arc<MappingManager>,
    file_manager: Arc<Mutex<FileManager>>,
    config: Arc<Mutex<AppConfig>>,
) {
    let window_clone = window.clone();
    let recent_events_clone = recent_events.clone();
    let mapping_manager_clone = mapping_manager.clone();
    let file_manager_clone = file_manager.clone();
    let config_clone = config.clone();

    tauri::async_runtime::spawn(async move {
        let cfg = config_clone.lock().await;
        
        if cfg.log_midi_events {
            let fm = file_manager_clone.lock().await;
            if let Err(e) = fm.log_midi_event(&event) {
                log::warn!("记录 MIDI 事件失败: {}", e);
            }
        }

        {
            let mut events = recent_events_clone.lock().await;
            events.push(event.clone());
            
            while events.len() > cfg.max_events_logged {
                events.remove(0);
            }
        }

        if let Some(mapping) = mapping_manager_clone.find_mapping_for_event(&event) {
            let _ = window_clone.emit("mapping_triggered", (event.clone(), mapping));
        }

        let _ = window_clone.emit("midi_event", event);
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(Env::default().default_filter_or("info")).init();
    log::info!("MIDI Mapper Debugger 启动中...");

    let (event_sender, mut event_receiver) = mpsc::channel::<MidiEvent>(1000);
    
    let midi_manager = MidiManager::new(event_sender);
    let mapping_manager = MappingManager::new();
    let recent_events = Arc::new(Mutex::new(Vec::new()));
    let app_config = Arc::new(Mutex::new(AppConfig::default()));

    let file_manager_result = FileManager::new("midi-mapper-debugger");
    let file_manager = Arc::new(Mutex::new(match file_manager_result {
        Ok(fm) => fm,
        Err(e) => {
            log::error!("初始化文件管理器失败: {}", e);
            return;
        }
    }));

    let fm_clone = file_manager.clone();
    let mm_clone = mapping_manager.clone();
    let config_clone = app_config.clone();
    
    tauri::async_runtime::spawn(async move {
        let fm = fm_clone.lock().await;
        
        if let Ok(config) = fm.load_config() {
            *config_clone.lock().await = config;
        }
        
        if let Ok(mappings) = fm.load_mappings() {
            *mm_clone.mappings.lock() = mappings;
            mm_clone.recheck_all_conflicts();
        }
        
        if let Ok(presets) = fm.load_all_presets() {
            *mm_clone.presets.lock() = presets;
        }
    });

    let midi_manager_clone = midi_manager.clone();
    let mm_for_event = mapping_manager.clone();
    let fm_for_event = file_manager.clone();
    let config_for_event = app_config.clone();
    let recent_events_clone = recent_events.clone();

    tauri::Builder::default()
        .manage(AppState {
            midi_manager: midi_manager.clone(),
            mapping_manager: mapping_manager.clone(),
            file_manager: file_manager.clone(),
            app_config: app_config.clone(),
            recent_events: recent_events.clone(),
        })
        .setup(move |app| {
            let main_window = app.get_window("main").unwrap();
            let window_for_events = main_window.clone();
            
            tauri::async_runtime::spawn(async move {
                while let Some(event) = event_receiver.recv().await {
                    handle_midi_event(
                        event,
                        &window_for_events,
                        recent_events_clone.clone(),
                        mm_for_event.clone(),
                        fm_for_event.clone(),
                        config_for_event.clone(),
                    );
                }
            });

            let window_for_scan = main_window.clone();
            let midi_for_scan = midi_manager_clone.clone();
            let config_for_scan = app_config.clone();
            
            tauri::async_runtime::spawn(async move {
                loop {
                    let cfg = config_for_scan.lock().await;
                    if !cfg.auto_scan {
                        drop(cfg);
                        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                        continue;
                    }
                    
                    let interval = cfg.scan_interval_secs;
                    drop(cfg);
                    
                    let midi_for_scan = midi_for_scan.clone();
                    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(move || {
                        (
                            midi_for_scan.scan_input_devices(),
                            midi_for_scan.scan_output_devices(),
                        )
                    })) {
                        Ok((Ok(inputs), Ok(outputs))) => {
                            let _ = window_for_scan.emit("devices_scanned", (inputs, outputs));
                        }
                        Ok((Err(e), _)) | Ok((_, Err(e))) => {
                            log::warn!("扫描设备失败: {}", e);
                        }
                        Err(_) => {
                            log::error!("扫描设备时发生 panic，已安全捕获");
                        }
                    }
                    
                    tokio::time::sleep(tokio::time::Duration::from_secs(interval)).await;
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_devices,
            commands::get_known_devices,
            commands::connect_input,
            commands::disconnect_input,
            commands::connect_output,
            commands::disconnect_output,
            commands::send_midi_message,
            commands::get_recent_events,
            commands::clear_events,
            commands::add_mapping,
            commands::update_mapping,
            commands::delete_mapping,
            commands::get_mappings,
            commands::get_mappings_by_device,
            commands::get_conflicts,
            commands::clear_conflicts,
            commands::save_preset,
            commands::update_preset,
            commands::load_preset,
            commands::delete_preset,
            commands::get_presets,
            commands::get_current_preset,
            commands::export_preset,
            commands::import_preset_from_file,
            commands::get_config,
            commands::update_config,
            commands::export_all_config,
            commands::get_data_directories,
            commands::get_mapping_stats,
            commands::start_learning_mode,
            commands::stop_learning_mode,
            commands::test_device_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    midi_manager.disconnect_all();
    log::info!("MIDI Mapper Debugger 已退出");
}
