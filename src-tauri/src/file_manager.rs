use crate::types::*;
use std::path::{Path, PathBuf};
use std::fs;
use tauri::api::path::{config_dir, data_dir};
use uuid::Uuid;
use serde_json;
use chrono::Utc;

pub struct FileManager {
    config_dir: PathBuf,
    data_dir: PathBuf,
}

impl FileManager {
    pub fn new(app_name: &str) -> Result<Self, MidiError> {
        let base_config_dir = config_dir()
            .unwrap_or_else(|| PathBuf::from("."));
        
        let base_data_dir = data_dir()
            .unwrap_or_else(|| PathBuf::from("."));
        
        let manager = Self {
            config_dir: base_config_dir.join(app_name),
            data_dir: base_data_dir.join(app_name),
        };
        
        manager.ensure_directories()?;
        Ok(manager)
    }

    fn ensure_directories(&self) -> Result<(), MidiError> {
        fs::create_dir_all(&self.config_dir)?;
        fs::create_dir_all(&self.data_dir)?;
        fs::create_dir_all(self.presets_dir())?;
        fs::create_dir_all(self.logs_dir())?;
        fs::create_dir_all(self.exports_dir())?;
        Ok(())
    }

    fn presets_dir(&self) -> PathBuf {
        self.data_dir.join("presets")
    }

    fn logs_dir(&self) -> PathBuf {
        self.data_dir.join("logs")
    }

    fn exports_dir(&self) -> PathBuf {
        self.data_dir.join("exports")
    }

    fn config_file(&self) -> PathBuf {
        self.config_dir.join("config.json")
    }

    fn mappings_file(&self) -> PathBuf {
        self.data_dir.join("mappings.json")
    }

    pub fn save_config(&self, config: &AppConfig) -> Result<(), MidiError> {
        let json = serde_json::to_string_pretty(config)?;
        fs::write(self.config_file(), json)?;
        Ok(())
    }

    pub fn load_config(&self) -> Result<AppConfig, MidiError> {
        let path = self.config_file();
        if path.exists() {
            let json = fs::read_to_string(path)?;
            let config: AppConfig = serde_json::from_str(&json)?;
            Ok(config)
        } else {
            let config = AppConfig::default();
            self.save_config(&config)?;
            Ok(config)
        }
    }

    pub fn save_mappings(&self, mappings: &[MidiMapping]) -> Result<(), MidiError> {
        let json = serde_json::to_string_pretty(mappings)?;
        fs::write(self.mappings_file(), json)?;
        Ok(())
    }

    pub fn load_mappings(&self) -> Result<Vec<MidiMapping>, MidiError> {
        let path = self.mappings_file();
        if path.exists() {
            let json = fs::read_to_string(path)?;
            let mappings: Vec<MidiMapping> = serde_json::from_str(&json)?;
            Ok(mappings)
        } else {
            Ok(Vec::new())
        }
    }

    pub fn save_preset_to_file(&self, preset: &MappingPreset) -> Result<PathBuf, MidiError> {
        let filename = format!("{}_{}.json", 
            sanitize_filename(&preset.name), 
            preset.id);
        let path = self.presets_dir().join(filename);
        let json = serde_json::to_string_pretty(preset)?;
        fs::write(&path, json)?;
        Ok(path)
    }

    pub fn load_preset_from_file(&self, preset_id: Uuid) -> Result<MappingPreset, MidiError> {
        let presets = self.list_preset_files()?;
        let path = presets.iter()
            .find(|p| p.to_string_lossy().contains(&preset_id.to_string()))
            .cloned()
            .ok_or_else(|| MidiError::FileError(format!("预设文件 {} 不存在", preset_id)))?;
        
        let json = fs::read_to_string(path)?;
        let preset: MappingPreset = serde_json::from_str(&json)?;
        Ok(preset)
    }

    pub fn list_preset_files(&self) -> Result<Vec<PathBuf>, MidiError> {
        let mut files = Vec::new();
        let dir = self.presets_dir();
        
        if dir.exists() {
            for entry in fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.extension().map(|e| e == "json").unwrap_or(false) {
                    files.push(path);
                }
            }
        }
        
        Ok(files)
    }

    pub fn load_all_presets(&self) -> Result<Vec<MappingPreset>, MidiError> {
        let mut presets = Vec::new();
        let files = self.list_preset_files()?;
        
        for path in files {
            match fs::read_to_string(&path) {
                Ok(json) => {
                    match serde_json::from_str::<MappingPreset>(&json) {
                        Ok(preset) => presets.push(preset),
                        Err(e) => log::warn!("解析预设文件失败 {:?}: {}", path, e),
                    }
                }
                Err(e) => log::warn!("读取预设文件失败 {:?}: {}", path, e),
            }
        }
        
        Ok(presets)
    }

    pub fn delete_preset_file(&self, preset_id: Uuid) -> Result<(), MidiError> {
        let presets = self.list_preset_files()?;
        let path = presets.iter()
            .find(|p| p.to_string_lossy().contains(&preset_id.to_string()))
            .cloned()
            .ok_or_else(|| MidiError::FileError(format!("预设文件 {} 不存在", preset_id)))?;
        
        fs::remove_file(path)?;
        Ok(())
    }

    pub fn export_preset(&self, preset: &MappingPreset, export_path: &Path) -> Result<(), MidiError> {
        let json = serde_json::to_string_pretty(preset)?;
        fs::write(export_path, json)?;
        Ok(())
    }

    pub fn import_preset(&self, import_path: &Path) -> Result<MappingPreset, MidiError> {
        let json = fs::read_to_string(import_path)?;
        let preset: MappingPreset = serde_json::from_str(&json)?;
        
        let saved_path = self.save_preset_to_file(&preset)?;
        log::info!("导入预设已保存到: {:?}", saved_path);
        
        Ok(preset)
    }

    pub fn export_mappings_to_json(&self, mappings: &[MidiMapping], export_path: &Path) -> Result<(), MidiError> {
        let json = serde_json::to_string_pretty(mappings)?;
        fs::write(export_path, json)?;
        Ok(())
    }

    pub fn export_all_config(&self, mappings: &[MidiMapping], presets: &[MappingPreset], config: &AppConfig) -> Result<String, MidiError> {
        let export = serde_json::json!({
            "version": "1.0.0",
            "exported_at": Utc::now().to_rfc3339(),
            "config": config,
            "mappings": mappings,
            "presets": presets,
        });
        
        let filename = format!("midi_mapper_export_{}.json", 
            Utc::now().format("%Y%m%d_%H%M%S"));
        let path = self.exports_dir().join(filename);
        
        let json = serde_json::to_string_pretty(&export)?;
        fs::write(&path, json)?;
        
        Ok(path.to_string_lossy().to_string())
    }

    pub fn log_midi_event(&self, event: &MidiEvent) -> Result<(), MidiError> {
        let filename = format!("midi_events_{}.log", 
            Utc::now().format("%Y%m%d"));
        let path = self.logs_dir().join(filename);
        
        let log_entry = format!(
            "[{}] {} | {} | CH{:02} | {:?} | {}\n",
            event.timestamp.format("%H:%M:%S%.3f"),
            event.device_name,
            event.id,
            event.channel,
            event.event_type,
            format_event_details(event),
        );
        
        fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)?
            .write_all(log_entry.as_bytes())?;
        
        Ok(())
    }

    pub fn get_config_dir(&self) -> &Path {
        &self.config_dir
    }

    pub fn get_data_dir(&self) -> &Path {
        &self.data_dir
    }

    pub fn get_presets_dir(&self) -> PathBuf {
        self.presets_dir()
    }

    pub fn get_logs_dir(&self) -> PathBuf {
        self.logs_dir()
    }

    pub fn get_exports_dir(&self) -> PathBuf {
        self.exports_dir()
    }
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}

fn format_event_details(event: &MidiEvent) -> String {
    match event.event_type {
        MidiEventType::NoteOn | MidiEventType::NoteOff => {
            format!("Note {:03} Velocity {:03}", 
                event.note.unwrap_or(0), 
                event.velocity.unwrap_or(0))
        }
        MidiEventType::ControlChange => {
            format!("CC {:03} Value {:03}", 
                event.cc_number.unwrap_or(0), 
                event.cc_value.unwrap_or(0))
        }
        MidiEventType::ProgramChange => {
            format!("Program {:03}", event.program_number.unwrap_or(0))
        }
        MidiEventType::PitchBend => {
            format!("PitchBend {:+06}", event.pitch_bend_value.unwrap_or(0))
        }
        MidiEventType::Aftertouch => {
            format!("Aftertouch Note {:03} Pressure {:03}",
                event.note.unwrap_or(0),
                event.velocity.unwrap_or(0))
        }
        MidiEventType::ChannelPressure => {
            format!("ChannelPressure {:03}", event.velocity.unwrap_or(0))
        }
        MidiEventType::SystemExclusive => {
            format!("SysEx len={}", event.raw_data.len())
        }
        MidiEventType::Unknown => {
            format!("Unknown raw={:02X?}", event.raw_data)
        }
    }
}

use std::io::Write;
