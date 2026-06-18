use crate::types::*;
use midir::{MidiInput, MidiOutput, MidiInputConnection, MidiOutputConnection, MidiInputPort, MidiOutputPort};
use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;
use chrono::Utc;

pub struct MidiManager {
    pub input_connections: Mutex<HashMap<String, MidiInputConnection<()>>>,
    pub output_connections: Mutex<HashMap<String, MidiOutputConnection>>,
    pub event_sender: mpsc::Sender<MidiEvent>,
    pub known_devices: Mutex<HashMap<String, MidiDevice>>,
    pub input_ports: Mutex<HashMap<String, MidiInputPort>>,
    pub output_ports: Mutex<HashMap<String, MidiOutputPort>>,
    pub last_event_time: Arc<Mutex<HashMap<String, chrono::DateTime<Utc>>>>,
}

impl MidiManager {
    pub fn new(event_sender: mpsc::Sender<MidiEvent>) -> Arc<Self> {
        Arc::new(Self {
            input_connections: Mutex::new(HashMap::new()),
            output_connections: Mutex::new(HashMap::new()),
            event_sender,
            known_devices: Mutex::new(HashMap::new()),
            input_ports: Mutex::new(HashMap::new()),
            output_ports: Mutex::new(HashMap::new()),
            last_event_time: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub fn scan_input_devices(&self) -> Result<Vec<MidiDevice>, MidiError> {
        let midi_in = MidiInput::new("midi-mapper-input")?;
        let mut devices = Vec::new();
        let ports = midi_in.ports();
        
        for port in ports {
            match midi_in.port_name(&port) {
                Ok(name) => {
                    let device_id = format!("input_{}", name);
                    let device_type = detect_device_type(&name);
                    
                    let mut known = self.known_devices.lock();
                    let existing = known.get(&device_id).cloned();
                    
                    let device = MidiDevice {
                        id: device_id.clone(),
                        name: name.clone(),
                        port: 0,
                        device_type,
                        is_input: true,
                        is_output: false,
                        is_connected: true,
                        is_active: existing.as_ref().map(|d| d.is_active).unwrap_or(false),
                        manufacturer: extract_manufacturer(&name),
                        driver_name: None,
                        last_seen: Utc::now(),
                    };
                    
                    known.insert(device_id.clone(), device.clone());
                    self.input_ports.lock().insert(device_id, port);
                    devices.push(device);
                }
                Err(e) => {
                    log::warn!("无法读取输入端口名称: {}", e);
                }
            }
        }
        
        self.mark_disconnected_devices(&devices, true);
        Ok(devices)
    }

    pub fn scan_output_devices(&self) -> Result<Vec<MidiDevice>, MidiError> {
        let midi_out = MidiOutput::new("midi-mapper-output")?;
        let mut devices = Vec::new();
        let ports = midi_out.ports();
        
        for port in ports {
            match midi_out.port_name(&port) {
                Ok(name) => {
                    let device_id = format!("output_{}", name);
                    let device_type = detect_device_type(&name);
                    
                    let mut known = self.known_devices.lock();
                    let existing = known.get(&device_id).cloned();
                    
                    let device = MidiDevice {
                        id: device_id.clone(),
                        name: name.clone(),
                        port: 0,
                        device_type,
                        is_input: false,
                        is_output: true,
                        is_connected: true,
                        is_active: existing.as_ref().map(|d| d.is_active).unwrap_or(false),
                        manufacturer: extract_manufacturer(&name),
                        driver_name: None,
                        last_seen: Utc::now(),
                    };
                    
                    known.insert(device_id.clone(), device.clone());
                    self.output_ports.lock().insert(device_id, port);
                    devices.push(device);
                }
                Err(e) => {
                    log::warn!("无法读取输出端口名称: {}", e);
                }
            }
        }
        
        self.mark_disconnected_devices(&devices, false);
        Ok(devices)
    }

    fn mark_disconnected_devices(&self, current_devices: &[MidiDevice], is_input: bool) {
        let mut known = self.known_devices.lock();
        let current_ids: Vec<&String> = current_devices.iter().map(|d| &d.id).collect();
        
        for (id, device) in known.iter_mut() {
            if device.is_input == is_input && !current_ids.contains(&id) {
                device.is_connected = false;
            }
        }
    }

    pub fn get_all_known_devices(&self) -> Vec<MidiDevice> {
        self.known_devices.lock().values().cloned().collect()
    }

    pub fn connect_input(&self, device_id: &str) -> Result<(), MidiError> {
        let known = self.known_devices.lock();
        let device = known.get(device_id)
            .ok_or_else(|| MidiError::DeviceNotFound(device_id.to_string()))?;
        
        if !device.is_connected {
            return Err(MidiError::DeviceDisconnected(device_id.to_string()));
        }

        let port = self.input_ports.lock().get(device_id).cloned()
            .ok_or_else(|| MidiError::DeviceNotFound(device_id.to_string()))?;

        let midi_in = MidiInput::new("midi-mapper-input")?;
        let device_id_clone = device_id.to_string();
        let device_name = device.name.clone();
        let sender = self.event_sender.clone();
        let last_event_time = Arc::clone(&self.last_event_time);

        let callback = move |timestamp: u64, data: &[u8], _: &mut ()| {
            let now = Utc::now();
            let last_time = last_event_time.lock().get(&device_id_clone).copied();
            let latency_ms = last_time.map(|t| (now - t).num_milliseconds() as u64);
            
            last_event_time.lock().insert(device_id_clone.clone(), now);
            
            if let Some(event) = parse_midi_message(
                timestamp,
                data,
                &device_id_clone,
                &device_name,
                latency_ms,
            ) {
                let sender_clone = sender.clone();
                tokio::spawn(async move {
                    let _ = sender_clone.send(event).await;
                });
            }
        };

        let connect_result = midi_in.connect(&port, &device.name, callback, ());
        let conn = match connect_result {
            Ok(c) => c,
            Err(e) => return Err(MidiError::PortOpenFailed(format!("{}: {}", device.name, e))),
        };

        self.input_connections.lock().insert(device_id.to_string(), conn);
        
        let mut known = self.known_devices.lock();
        if let Some(d) = known.get_mut(device_id) {
            d.is_active = true;
        }
        
        Ok(())
    }

    pub fn disconnect_input(&self, device_id: &str) -> Result<(), MidiError> {
        if let Some(conn) = self.input_connections.lock().remove(device_id) {
            conn.close();
        }
        
        let mut known = self.known_devices.lock();
        if let Some(d) = known.get_mut(device_id) {
            d.is_active = false;
        }
        
        Ok(())
    }

    pub fn connect_output(&self, device_id: &str) -> Result<(), MidiError> {
        let known = self.known_devices.lock();
        let device = known.get(device_id)
            .ok_or_else(|| MidiError::DeviceNotFound(device_id.to_string()))?;
        
        if !device.is_connected {
            return Err(MidiError::DeviceDisconnected(device_id.to_string()));
        }

        let port = self.output_ports.lock().get(device_id).cloned()
            .ok_or_else(|| MidiError::DeviceNotFound(device_id.to_string()))?;

        let midi_out = MidiOutput::new("midi-mapper-output")?;

        let connect_result = midi_out.connect(&port, &device.name);
        let conn = match connect_result {
            Ok(c) => c,
            Err(e) => return Err(MidiError::PortOpenFailed(format!("{}: {}", device.name, e))),
        };

        self.output_connections.lock().insert(device_id.to_string(), conn);
        
        let mut known = self.known_devices.lock();
        if let Some(d) = known.get_mut(device_id) {
            d.is_active = true;
        }
        
        Ok(())
    }

    pub fn disconnect_output(&self, device_id: &str) -> Result<(), MidiError> {
        if let Some(conn) = self.output_connections.lock().remove(device_id) {
            conn.close();
        }
        
        let mut known = self.known_devices.lock();
        if let Some(d) = known.get_mut(device_id) {
            d.is_active = false;
        }
        
        Ok(())
    }

    pub fn send_midi_message(&self, device_id: &str, message: &[u8]) -> Result<(), MidiError> {
        let mut connections = self.output_connections.lock();
        let conn = connections.get_mut(device_id)
            .ok_or_else(|| MidiError::DeviceNotActive(device_id.to_string()))?;
        
        match conn.send(message) {
            Ok(_) => Ok(()),
            Err(e) => Err(MidiError::DriverError(format!("发送失败: {}", e))),
        }
    }

    pub fn get_active_input_devices(&self) -> Vec<String> {
        self.input_connections.lock().keys().cloned().collect()
    }

    pub fn get_active_output_devices(&self) -> Vec<String> {
        self.output_connections.lock().keys().cloned().collect()
    }

    pub fn get_known_device(&self, device_id: &str) -> Option<MidiDevice> {
        self.known_devices.lock().get(device_id).cloned()
    }

    pub fn disconnect_all(&self) {
        let mut input_conns = self.input_connections.lock();
        for (_, conn) in input_conns.drain() {
            conn.close();
        }
        
        let mut output_conns = self.output_connections.lock();
        for (_, conn) in output_conns.drain() {
            conn.close();
        }
        
        let mut known = self.known_devices.lock();
        for (_, device) in known.iter_mut() {
            device.is_active = false;
        }
    }
}

pub fn parse_midi_message(
    _timestamp: u64,
    data: &[u8],
    device_id: &str,
    device_name: &str,
    latency_ms: Option<u64>,
) -> Option<MidiEvent> {
    if data.is_empty() {
        return None;
    }

    let status_byte = data[0];
    let event_type = status_byte >> 4;
    let channel = status_byte & 0x0F;

    let event_type_enum = match event_type {
        0x8 => MidiEventType::NoteOff,
        0x9 => {
            if data.len() >= 3 && data[2] == 0 {
                MidiEventType::NoteOff
            } else {
                MidiEventType::NoteOn
            }
        }
        0xA => MidiEventType::Aftertouch,
        0xB => MidiEventType::ControlChange,
        0xC => MidiEventType::ProgramChange,
        0xD => MidiEventType::ChannelPressure,
        0xE => MidiEventType::PitchBend,
        0xF => match channel {
            0x0 => MidiEventType::SystemExclusive,
            _ => MidiEventType::Unknown,
        },
        _ => MidiEventType::Unknown,
    };

    let (note, velocity, cc_number, cc_value, program_number, pitch_bend_value) = match event_type_enum {
        MidiEventType::NoteOn | MidiEventType::NoteOff | MidiEventType::Aftertouch => {
            if data.len() >= 3 {
                (Some(data[1]), Some(data[2]), None, None, None, None)
            } else {
                (None, None, None, None, None, None)
            }
        }
        MidiEventType::ControlChange => {
            if data.len() >= 3 {
                (None, None, Some(data[1]), Some(data[2]), None, None)
            } else {
                (None, None, None, None, None, None)
            }
        }
        MidiEventType::ProgramChange => {
            if data.len() >= 2 {
                (None, None, None, None, Some(data[1]), None)
            } else {
                (None, None, None, None, None, None)
            }
        }
        MidiEventType::ChannelPressure => {
            if data.len() >= 2 {
                (Some(data[1]), None, None, None, None, None)
            } else {
                (None, None, None, None, None, None)
            }
        }
        MidiEventType::PitchBend => {
            if data.len() >= 3 {
                let value = ((data[2] as u16) << 7) | (data[1] as u16);
                let signed = (value as i32 - 8192) as i16;
                (None, None, None, None, None, Some(signed))
            } else {
                (None, None, None, None, None, None)
            }
        }
        _ => (None, None, None, None, None, None),
    };

    Some(MidiEvent {
        id: Uuid::new_v4(),
        timestamp: Utc::now(),
        device_id: device_id.to_string(),
        device_name: device_name.to_string(),
        event_type: event_type_enum,
        channel,
        note,
        velocity,
        cc_number,
        cc_value,
        program_number,
        pitch_bend_value,
        raw_data: data.to_vec(),
        latency_ms,
    })
}

fn detect_device_type(name: &str) -> DeviceType {
    let name_lower = name.to_lowercase();
    if name_lower.contains("keyboard") || name_lower.contains("piano") {
        DeviceType::Keyboard
    } else if name_lower.contains("synth") {
        DeviceType::Synthesizer
    } else if name_lower.contains("pad") || name_lower.contains("drum") || name_lower.contains("打击") {
        DeviceType::Pad
    } else if name_lower.contains("control") || name_lower.contains("fader") || name_lower.contains("knob") {
        DeviceType::Controller
    } else if name_lower.contains("interface") || name_lower.contains("接口") || name_lower.contains("audio") {
        DeviceType::AudioInterface
    } else {
        DeviceType::Unknown
    }
}

fn extract_manufacturer(name: &str) -> Option<String> {
    let manufacturers = ["Roland", "Yamaha", "Korg", "Novation", "Akai", "Native Instruments", "M-Audio", "Behringer", "Focusrite", "Steinberg", "Ableton", "Arturia", "Moog", "Dave Smith", "Sequential"];
    for m in manufacturers {
        if name.contains(m) {
            return Some(m.to_string());
        }
    }
    None
}
