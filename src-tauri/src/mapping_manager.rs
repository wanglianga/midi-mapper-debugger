use crate::types::*;
use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;
use chrono::Utc;

pub struct MappingManager {
    pub mappings: Mutex<Vec<MidiMapping>>,
    pub presets: Mutex<Vec<MappingPreset>>,
    pub current_preset: Mutex<Option<MappingPreset>>,
    pub conflicts: Mutex<Vec<DeviceConflict>>,
}

impl MappingManager {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            mappings: Mutex::new(Vec::new()),
            presets: Mutex::new(Vec::new()),
            current_preset: Mutex::new(None),
            conflicts: Mutex::new(Vec::new()),
        })
    }

    pub fn add_mapping(&self, mapping: MidiMapping) -> Result<MidiMapping, MidiError> {
        let conflicts = self.detect_conflicts(&mapping);
        
        if !conflicts.is_empty() {
            for conflict in &conflicts {
                if conflict.severity == ConflictSeverity::Error 
                || conflict.severity == ConflictSeverity::Critical {
                    return Err(MidiError::MappingConflict(conflict.message.clone()));
                }
            }
        }

        let mut mappings = self.mappings.lock();
        mappings.push(mapping.clone());
        self.add_conflicts(conflicts);
        Ok(mapping)
    }

    pub fn update_mapping(&self, mapping: MidiMapping) -> Result<MidiMapping, MidiError> {
        let mut mappings = self.mappings.lock();
        if let Some(index) = mappings.iter().position(|m| m.id == mapping.id) {
            let mut updated = mapping.clone();
            updated.updated_at = Utc::now();
            
            let conflicts = self.detect_conflicts(&updated);
            for conflict in &conflicts {
                if conflict.severity == ConflictSeverity::Error 
                || conflict.severity == ConflictSeverity::Critical {
                    return Err(MidiError::MappingConflict(conflict.message.clone()));
                }
            }
            
            mappings[index] = updated.clone();
            self.add_conflicts(conflicts);
            Ok(updated)
        } else {
            Err(MidiError::DeviceNotFound(format!("映射 {} 不存在", mapping.id)))
        }
    }

    pub fn delete_mapping(&self, mapping_id: Uuid) -> Result<(), MidiError> {
        let mut mappings = self.mappings.lock();
        if mappings.iter().position(|m| m.id == mapping_id).is_some() {
            mappings.retain(|m| m.id != mapping_id);
            self.recheck_all_conflicts();
            Ok(())
        } else {
            Err(MidiError::DeviceNotFound(format!("映射 {} 不存在", mapping_id)))
        }
    }

    pub fn get_mappings(&self) -> Vec<MidiMapping> {
        self.mappings.lock().clone()
    }

    pub fn get_mapping(&self, mapping_id: Uuid) -> Option<MidiMapping> {
        self.mappings.lock().iter().find(|m| m.id == mapping_id).cloned()
    }

    pub fn find_mapping_for_event(&self, event: &MidiEvent) -> Option<MidiMapping> {
        let mappings = self.mappings.lock();
        mappings.iter().find(|m| {
            if m.device_id != event.device_id {
                return false;
            }
            if m.event_type != event.event_type {
                return false;
            }
            if let Some(channel) = m.channel {
                if channel != event.channel {
                    return false;
                }
            }
            if let Some(note) = m.note {
                if event.note.map(|en| en != note).unwrap_or(false) {
                    return false;
                }
            }
            if let Some(cc_number) = m.cc_number {
                if event.cc_number.map(|ec| ec != cc_number).unwrap_or(false) {
                    return false;
                }
            }
            true
        }).cloned()
    }

    pub fn detect_conflicts(&self, new_mapping: &MidiMapping) -> Vec<DeviceConflict> {
        let mut conflicts = Vec::new();
        let mappings = self.mappings.lock();

        for existing in mappings.iter() {
            if existing.id == new_mapping.id {
                continue;
            }

            let mut is_conflict = existing.device_id == new_mapping.device_id
                && existing.event_type == new_mapping.event_type;

            if is_conflict {
                if let (Some(ch1), Some(ch2)) = (existing.channel, new_mapping.channel) {
                    is_conflict = ch1 == ch2;
                }
            }

            if is_conflict && matches!(new_mapping.event_type, MidiEventType::NoteOn | MidiEventType::NoteOff) {
                if let (Some(n1), Some(n2)) = (existing.note, new_mapping.note) {
                    is_conflict = n1 == n2;
                }
            }

            if is_conflict && matches!(new_mapping.event_type, MidiEventType::ControlChange) {
                if let (Some(c1), Some(c2)) = (existing.cc_number, new_mapping.cc_number) {
                    is_conflict = c1 == c2;
                }
            }

            if is_conflict {
                let (severity, message) = if existing.target.software == new_mapping.target.software
                    && existing.target.parameter_name == new_mapping.target.parameter_name {
                    (ConflictSeverity::Warning, 
                     format!("相同目标参数已被映射: {} -> {}", 
                             existing.name, existing.target.parameter_name))
                } else {
                    (ConflictSeverity::Error,
                     format!("MIDI 信号冲突: {} 与 {} 监听相同的输入信号",
                             existing.name, new_mapping.name))
                };

                conflicts.push(DeviceConflict {
                    id: Uuid::new_v4(),
                    timestamp: Utc::now(),
                    severity,
                    message,
                    involved_devices: vec![new_mapping.device_id.clone()],
                    involved_mappings: vec![existing.id, new_mapping.id],
                });
            }
        }

        conflicts
    }

    pub fn recheck_all_conflicts(&self) {
        let mut all_conflicts = Vec::new();
        let mappings = self.mappings.lock();
        
        for i in 0..mappings.len() {
            for j in (i + 1)..mappings.len() {
                let m1 = &mappings[i];
                let m2 = &mappings[j];

                let mut is_conflict = m1.device_id == m2.device_id
                    && m1.event_type == m2.event_type;

                if is_conflict {
                    if let (Some(ch1), Some(ch2)) = (m1.channel, m2.channel) {
                        is_conflict = ch1 == ch2;
                    }
                }

                if is_conflict && matches!(m1.event_type, MidiEventType::NoteOn | MidiEventType::NoteOff) {
                    if let (Some(n1), Some(n2)) = (m1.note, m2.note) {
                        is_conflict = n1 == n2;
                    }
                }

                if is_conflict && matches!(m1.event_type, MidiEventType::ControlChange) {
                    if let (Some(c1), Some(c2)) = (m1.cc_number, m2.cc_number) {
                        is_conflict = c1 == c2;
                    }
                }

                if is_conflict {
                    let (severity, message) = if m1.target.software == m2.target.software
                        && m1.target.parameter_name == m2.target.parameter_name {
                        (ConflictSeverity::Warning, 
                         format!("相同目标参数已被映射: {} -> {}", 
                                 m1.name, m1.target.parameter_name))
                    } else {
                        (ConflictSeverity::Error,
                         format!("MIDI 信号冲突: {} 与 {} 监听相同的输入信号",
                                 m1.name, m2.name))
                    };

                    all_conflicts.push(DeviceConflict {
                        id: Uuid::new_v4(),
                        timestamp: Utc::now(),
                        severity,
                        message,
                        involved_devices: vec![m1.device_id.clone()],
                        involved_mappings: vec![m1.id, m2.id],
                    });
                }
            }
        }

        *self.conflicts.lock() = all_conflicts;
    }

    fn add_conflicts(&self, conflicts: Vec<DeviceConflict>) {
        let mut existing = self.conflicts.lock();
        existing.extend(conflicts);
    }

    pub fn get_conflicts(&self) -> Vec<DeviceConflict> {
        self.conflicts.lock().clone()
    }

    pub fn clear_conflicts(&self) {
        self.conflicts.lock().clear();
    }

    pub fn save_preset(&self, name: String, description: Option<String>) -> Result<MappingPreset, MidiError> {
        let mappings = self.mappings.lock().clone();
        let preset = MappingPreset {
            id: Uuid::new_v4(),
            name,
            description,
            mappings,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let mut presets = self.presets.lock();
        presets.push(preset.clone());
        Ok(preset)
    }

    pub fn update_preset(&self, preset: MappingPreset) -> Result<MappingPreset, MidiError> {
        let mut presets = self.presets.lock();
        if let Some(index) = presets.iter().position(|p| p.id == preset.id) {
            let mut updated = preset.clone();
            updated.updated_at = Utc::now();
            presets[index] = updated.clone();
            Ok(updated)
        } else {
            Err(MidiError::DeviceNotFound(format!("预设 {} 不存在", preset.id)))
        }
    }

    pub fn load_preset(&self, preset_id: Uuid) -> Result<MappingPreset, MidiError> {
        let presets = self.presets.lock();
        let preset = presets.iter()
            .find(|p| p.id == preset_id)
            .cloned()
            .ok_or_else(|| MidiError::DeviceNotFound(format!("预设 {} 不存在", preset_id)))?;

        *self.mappings.lock() = preset.mappings.clone();
        *self.current_preset.lock() = Some(preset.clone());
        self.recheck_all_conflicts();
        Ok(preset)
    }

    pub fn delete_preset(&self, preset_id: Uuid) -> Result<(), MidiError> {
        let mut presets = self.presets.lock();
        if presets.iter().position(|p| p.id == preset_id).is_some() {
            presets.retain(|p| p.id != preset_id);
            Ok(())
        } else {
            Err(MidiError::DeviceNotFound(format!("预设 {} 不存在", preset_id)))
        }
    }

    pub fn get_presets(&self) -> Vec<MappingPreset> {
        self.presets.lock().clone()
    }

    pub fn get_current_preset(&self) -> Option<MappingPreset> {
        self.current_preset.lock().clone()
    }

    pub fn export_preset(&self, preset_id: Uuid) -> Result<String, MidiError> {
        let presets = self.presets.lock();
        let preset = presets.iter()
            .find(|p| p.id == preset_id)
            .ok_or_else(|| MidiError::DeviceNotFound(format!("预设 {} 不存在", preset_id)))?;
        
        serde_json::to_string_pretty(preset)
            .map_err(MidiError::from)
    }

    pub fn import_preset(&self, json: &str) -> Result<MappingPreset, MidiError> {
        let preset: MappingPreset = serde_json::from_str(json)?;
        let mut presets = self.presets.lock();
        presets.push(preset.clone());
        Ok(preset)
    }

    pub fn get_mappings_by_device(&self, device_id: &str) -> Vec<MidiMapping> {
        self.mappings.lock()
            .iter()
            .filter(|m| m.device_id == device_id)
            .cloned()
            .collect()
    }

    pub fn get_mapping_stats(&self) -> HashMap<String, usize> {
        let mut stats = HashMap::new();
        let mappings = self.mappings.lock();
        
        for mapping in mappings.iter() {
            *stats.entry(mapping.device_id.clone()).or_insert(0) += 1;
            *stats.entry(format!("type_{:?}", mapping.event_type)).or_insert(0) += 1;
        }
        
        stats.insert("total".to_string(), mappings.len());
        stats
    }
}
