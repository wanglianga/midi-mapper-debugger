use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MidiEventType {
    NoteOn,
    NoteOff,
    ControlChange,
    ProgramChange,
    PitchBend,
    Aftertouch,
    ChannelPressure,
    SystemExclusive,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MidiEvent {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub device_id: String,
    pub device_name: String,
    pub event_type: MidiEventType,
    pub channel: u8,
    pub note: Option<u8>,
    pub velocity: Option<u8>,
    pub cc_number: Option<u8>,
    pub cc_value: Option<u8>,
    pub program_number: Option<u8>,
    pub pitch_bend_value: Option<i16>,
    pub raw_data: Vec<u8>,
    pub latency_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DeviceType {
    Keyboard,
    Controller,
    Pad,
    Synthesizer,
    AudioInterface,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MidiDevice {
    pub id: String,
    pub name: String,
    pub port: u32,
    pub device_type: DeviceType,
    pub is_input: bool,
    pub is_output: bool,
    pub is_connected: bool,
    pub is_active: bool,
    pub manufacturer: Option<String>,
    pub driver_name: Option<String>,
    pub last_seen: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MappingTarget {
    pub parameter_name: String,
    pub software: String,
    pub min_value: f32,
    pub max_value: f32,
    pub current_value: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MidiMapping {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub device_id: String,
    pub event_type: MidiEventType,
    pub channel: Option<u8>,
    pub note: Option<u8>,
    pub cc_number: Option<u8>,
    pub target: MappingTarget,
    pub is_enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MappingPreset {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub mappings: Vec<MidiMapping>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ConflictType {
    DuplicateControl,
    DuplicateTarget,
    FeedbackLoop,
    ChannelConflict,
    DeviceConflict,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ConflictResolution {
    Keep,
    Replace,
    Disable,
    SaveAsPreset,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceConflict {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub severity: ConflictSeverity,
    pub conflict_type: ConflictType,
    pub message: String,
    pub involved_devices: Vec<String>,
    pub involved_mappings: Vec<Uuid>,
    pub resolution_options: Vec<ConflictResolution>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ConflictSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppState {
    pub input_devices: Vec<MidiDevice>,
    pub output_devices: Vec<MidiDevice>,
    pub active_inputs: HashMap<String, bool>,
    pub active_outputs: HashMap<String, bool>,
    pub recent_events: Vec<MidiEvent>,
    pub mappings: Vec<MidiMapping>,
    pub current_preset: Option<MappingPreset>,
    pub presets: Vec<MappingPreset>,
    pub conflicts: Vec<DeviceConflict>,
    pub is_scanning: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub auto_scan: bool,
    pub scan_interval_secs: u64,
    pub max_events_logged: usize,
    pub default_preset_id: Option<Uuid>,
    pub theme: String,
    pub log_midi_events: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            auto_scan: true,
            scan_interval_secs: 2,
            max_events_logged: 1000,
            default_preset_id: None,
            theme: "dark".to_string(),
            log_midi_events: true,
        }
    }
}

#[derive(Debug, thiserror::Error, Serialize, Deserialize)]
pub enum MidiError {
    #[error("MIDI 设备未找到: {0}")]
    DeviceNotFound(String),
    #[error("MIDI 端口打开失败: {0}")]
    PortOpenFailed(String),
    #[error("MIDI 驱动错误: {0}")]
    DriverError(String),
    #[error("设备已断开连接: {0}")]
    DeviceDisconnected(String),
    #[error("设备未激活: {0}")]
    DeviceNotActive(String),
    #[error("映射冲突: {0}")]
    MappingConflict(String),
    #[error("文件操作失败: {0}")]
    FileError(String),
    #[error("序列化错误: {0}")]
    SerializationError(String),
    #[error("Tauri 错误: {0}")]
    TauriError(String),
    #[error("未知错误: {0}")]
    Unknown(String),
}

impl From<tauri::Error> for MidiError {
    fn from(err: tauri::Error) -> Self {
        MidiError::TauriError(err.to_string())
    }
}

impl From<midir::InitError> for MidiError {
    fn from(err: midir::InitError) -> Self {
        MidiError::DriverError(err.to_string())
    }
}

impl<T> From<midir::ConnectError<T>> for MidiError {
    fn from(err: midir::ConnectError<T>) -> Self {
        MidiError::DriverError(err.to_string())
    }
}

impl From<midir::PortInfoError> for MidiError {
    fn from(err: midir::PortInfoError) -> Self {
        MidiError::DriverError(err.to_string())
    }
}

impl From<midir::SendError> for MidiError {
    fn from(err: midir::SendError) -> Self {
        MidiError::DriverError(err.to_string())
    }
}

impl From<std::io::Error> for MidiError {
    fn from(err: std::io::Error) -> Self {
        MidiError::FileError(err.to_string())
    }
}

impl From<serde_json::Error> for MidiError {
    fn from(err: serde_json::Error) -> Self {
        MidiError::SerializationError(err.to_string())
    }
}
