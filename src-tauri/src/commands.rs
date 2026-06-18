use crate::types::*;
use crate::midi_manager::MidiManager;
use crate::mapping_manager::MappingManager;
use crate::file_manager::FileManager;
use std::sync::Arc;
use tauri::{State, Window};
use uuid::Uuid;
use tokio::sync::Mutex;

pub struct AppState {
    pub midi_manager: Arc<MidiManager>,
    pub mapping_manager: Arc<MappingManager>,
    pub file_manager: Arc<Mutex<FileManager>>,
    pub app_config: Arc<Mutex<AppConfig>>,
    pub recent_events: Arc<Mutex<Vec<MidiEvent>>>,
}

#[tauri::command]
pub async fn scan_devices(
    state: State<'_, AppState>,
) -> Result<(Vec<MidiDevice>, Vec<MidiDevice>), MidiError> {
    let inputs = state.midi_manager.scan_input_devices()?;
    let outputs = state.midi_manager.scan_output_devices()?;
    Ok((inputs, outputs))
}

#[tauri::command]
pub async fn get_known_devices(
    state: State<'_, AppState>,
) -> Result<Vec<MidiDevice>, MidiError> {
    Ok(state.midi_manager.get_all_known_devices())
}

#[tauri::command]
pub async fn connect_input(
    device_id: String,
    state: State<'_, AppState>,
    window: Window,
) -> Result<(), MidiError> {
    state.midi_manager.connect_input(&device_id)?;
    window.emit("device_connected", device_id)?;
    Ok(())
}

#[tauri::command]
pub async fn disconnect_input(
    device_id: String,
    state: State<'_, AppState>,
    window: Window,
) -> Result<(), MidiError> {
    state.midi_manager.disconnect_input(&device_id)?;
    window.emit("device_disconnected", device_id)?;
    Ok(())
}

#[tauri::command]
pub async fn connect_output(
    device_id: String,
    state: State<'_, AppState>,
    window: Window,
) -> Result<(), MidiError> {
    state.midi_manager.connect_output(&device_id)?;
    window.emit("output_connected", device_id)?;
    Ok(())
}

#[tauri::command]
pub async fn disconnect_output(
    device_id: String,
    state: State<'_, AppState>,
    window: Window,
) -> Result<(), MidiError> {
    state.midi_manager.disconnect_output(&device_id)?;
    window.emit("output_disconnected", device_id)?;
    Ok(())
}

#[tauri::command]
pub async fn send_midi_message(
    device_id: String,
    message: Vec<u8>,
    state: State<'_, AppState>,
) -> Result<(), MidiError> {
    state.midi_manager.send_midi_message(&device_id, &message)?;
    Ok(())
}

#[tauri::command]
pub async fn get_recent_events(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<MidiEvent>, MidiError> {
    let events = state.recent_events.lock().await;
    let limit = limit.unwrap_or(100);
    Ok(events.iter().rev().take(limit).cloned().collect())
}

#[tauri::command]
pub async fn clear_events(
    state: State<'_, AppState>,
) -> Result<(), MidiError> {
    state.recent_events.lock().await.clear();
    Ok(())
}

#[tauri::command]
pub async fn add_mapping(
    mapping: MidiMapping,
    state: State<'_, AppState>,
    window: Window,
) -> Result<MidiMapping, MidiError> {
    let result = state.mapping_manager.add_mapping(mapping)?;
    window.emit("mapping_added", result.clone())?;
    
    let fm = state.file_manager.lock().await;
    fm.save_mappings(&state.mapping_manager.get_mappings())?;
    
    Ok(result)
}

#[tauri::command]
pub async fn update_mapping(
    mapping: MidiMapping,
    state: State<'_, AppState>,
    window: Window,
) -> Result<MidiMapping, MidiError> {
    let result = state.mapping_manager.update_mapping(mapping)?;
    window.emit("mapping_updated", result.clone())?;
    
    let fm = state.file_manager.lock().await;
    fm.save_mappings(&state.mapping_manager.get_mappings())?;
    
    Ok(result)
}

#[tauri::command]
pub async fn delete_mapping(
    mapping_id: Uuid,
    state: State<'_, AppState>,
    window: Window,
) -> Result<(), MidiError> {
    state.mapping_manager.delete_mapping(mapping_id)?;
    window.emit("mapping_deleted", mapping_id)?;
    
    let fm = state.file_manager.lock().await;
    fm.save_mappings(&state.mapping_manager.get_mappings())?;
    
    Ok(())
}

#[tauri::command]
pub async fn get_mappings(
    state: State<'_, AppState>,
) -> Result<Vec<MidiMapping>, MidiError> {
    Ok(state.mapping_manager.get_mappings())
}

#[tauri::command]
pub async fn get_mappings_by_device(
    device_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<MidiMapping>, MidiError> {
    Ok(state.mapping_manager.get_mappings_by_device(&device_id))
}

#[tauri::command]
pub async fn get_conflicts(
    state: State<'_, AppState>,
) -> Result<Vec<DeviceConflict>, MidiError> {
    Ok(state.mapping_manager.get_conflicts())
}

#[tauri::command]
pub async fn clear_conflicts(
    state: State<'_, AppState>,
) -> Result<(), MidiError> {
    state.mapping_manager.clear_conflicts();
    Ok(())
}

#[tauri::command]
pub async fn save_preset(
    name: String,
    description: Option<String>,
    state: State<'_, AppState>,
    window: Window,
) -> Result<MappingPreset, MidiError> {
    let preset = state.mapping_manager.save_preset(name, description)?;
    
    let fm = state.file_manager.lock().await;
    fm.save_preset_to_file(&preset)?;
    
    window.emit("preset_saved", preset.clone())?;
    Ok(preset)
}

#[tauri::command]
pub async fn update_preset(
    preset: MappingPreset,
    state: State<'_, AppState>,
    window: Window,
) -> Result<MappingPreset, MidiError> {
    let result = state.mapping_manager.update_preset(preset)?;
    
    let fm = state.file_manager.lock().await;
    fm.save_preset_to_file(&result)?;
    
    window.emit("preset_updated", result.clone())?;
    Ok(result)
}

#[tauri::command]
pub async fn load_preset(
    preset_id: Uuid,
    state: State<'_, AppState>,
    window: Window,
) -> Result<MappingPreset, MidiError> {
    let preset = state.mapping_manager.load_preset(preset_id)?;
    
    let fm = state.file_manager.lock().await;
    fm.save_mappings(&state.mapping_manager.get_mappings())?;
    
    window.emit("preset_loaded", preset.clone())?;
    Ok(preset)
}

#[tauri::command]
pub async fn delete_preset(
    preset_id: Uuid,
    state: State<'_, AppState>,
    window: Window,
) -> Result<(), MidiError> {
    state.mapping_manager.delete_preset(preset_id)?;
    
    let fm = state.file_manager.lock().await;
    fm.delete_preset_file(preset_id)?;
    
    window.emit("preset_deleted", preset_id)?;
    Ok(())
}

#[tauri::command]
pub async fn get_presets(
    state: State<'_, AppState>,
) -> Result<Vec<MappingPreset>, MidiError> {
    Ok(state.mapping_manager.get_presets())
}

#[tauri::command]
pub async fn get_current_preset(
    state: State<'_, AppState>,
) -> Result<Option<MappingPreset>, MidiError> {
    Ok(state.mapping_manager.get_current_preset())
}

#[tauri::command]
pub async fn export_preset(
    preset_id: Uuid,
    state: State<'_, AppState>,
) -> Result<String, MidiError> {
    state.mapping_manager.export_preset(preset_id)
}

#[tauri::command]
pub async fn import_preset_from_file(
    file_path: String,
    state: State<'_, AppState>,
    window: Window,
) -> Result<MappingPreset, MidiError> {
    let fm = state.file_manager.lock().await;
    let preset = fm.import_preset(std::path::Path::new(&file_path))?;
    
    let mut presets = state.mapping_manager.presets.lock();
    presets.push(preset.clone());
    drop(presets);
    
    window.emit("preset_imported", preset.clone())?;
    Ok(preset)
}

#[tauri::command]
pub async fn get_config(
    state: State<'_, AppState>,
) -> Result<AppConfig, MidiError> {
    let guard = state.app_config.lock().await;
    Ok((*guard).clone())
}

#[tauri::command]
pub async fn update_config(
    config: AppConfig,
    state: State<'_, AppState>,
) -> Result<AppConfig, MidiError> {
    let mut guard = state.app_config.lock().await;
    *guard = config.clone();
    
    let fm = state.file_manager.lock().await;
    fm.save_config(&config)?;
    
    Ok(config)
}

#[tauri::command]
pub async fn export_all_config(
    state: State<'_, AppState>,
) -> Result<String, MidiError> {
    let fm = state.file_manager.lock().await;
    let config_guard = state.app_config.lock().await;
    let config = (*config_guard).clone();
    let mappings = state.mapping_manager.get_mappings();
    let presets = state.mapping_manager.get_presets();
    
    fm.export_all_config(&mappings, &presets, &config)
}

#[tauri::command]
pub async fn get_data_directories(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, MidiError> {
    let fm = state.file_manager.lock().await;
    Ok(serde_json::json!({
        "config_dir": fm.get_config_dir().to_string_lossy().to_string(),
        "data_dir": fm.get_data_dir().to_string_lossy().to_string(),
        "presets_dir": fm.get_presets_dir().to_string_lossy().to_string(),
        "logs_dir": fm.get_logs_dir().to_string_lossy().to_string(),
        "exports_dir": fm.get_exports_dir().to_string_lossy().to_string(),
    }))
}

#[tauri::command]
pub async fn get_mapping_stats(
    state: State<'_, AppState>,
) -> Result<std::collections::HashMap<String, usize>, MidiError> {
    Ok(state.mapping_manager.get_mapping_stats())
}

#[tauri::command]
pub async fn start_learning_mode(
    _state: State<'_, AppState>,
    window: Window,
) -> Result<(), MidiError> {
    window.emit("learning_mode_started", ())?;
    Ok(())
}

#[tauri::command]
pub async fn stop_learning_mode(
    _state: State<'_, AppState>,
    window: Window,
) -> Result<(), MidiError> {
    window.emit("learning_mode_stopped", ())?;
    Ok(())
}

#[tauri::command]
pub async fn test_device_connection(
    device_id: String,
    state: State<'_, AppState>,
) -> Result<bool, MidiError> {
    let device = state.midi_manager.get_known_device(&device_id)
        .ok_or_else(|| MidiError::DeviceNotFound(device_id.clone()))?;
    
    Ok(device.is_connected && device.is_active)
}
