import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";
import {
  MidiDevice,
  MidiEvent,
  MidiMapping,
  MappingPreset,
  DeviceConflict,
  AppConfig,
  DataDirectories,
} from "./types";

export async function scanDevices(): Promise<[MidiDevice[], MidiDevice[]]> {
  return invoke<[MidiDevice[], MidiDevice[]]>("scan_devices");
}

export async function getKnownDevices(): Promise<MidiDevice[]> {
  return invoke<MidiDevice[]>("get_known_devices");
}

export async function connectInput(deviceId: string): Promise<void> {
  return invoke("connect_input", { deviceId });
}

export async function disconnectInput(deviceId: string): Promise<void> {
  return invoke("disconnect_input", { deviceId });
}

export async function connectOutput(deviceId: string): Promise<void> {
  return invoke("connect_output", { deviceId });
}

export async function disconnectOutput(deviceId: string): Promise<void> {
  return invoke("disconnect_output", { deviceId });
}

export async function sendMidiMessage(deviceId: string, message: number[]): Promise<void> {
  return invoke("send_midi_message", { deviceId, message });
}

export async function getRecentEvents(limit?: number): Promise<MidiEvent[]> {
  return invoke<MidiEvent[]>("get_recent_events", { limit });
}

export async function clearEvents(): Promise<void> {
  return invoke("clear_events");
}

export async function addMapping(mapping: Omit<MidiMapping, "id" | "created_at" | "updated_at">): Promise<MidiMapping> {
  return invoke<MidiMapping>("add_mapping", { mapping });
}

export async function updateMapping(mapping: MidiMapping): Promise<MidiMapping> {
  return invoke<MidiMapping>("update_mapping", { mapping });
}

export async function deleteMapping(mappingId: string): Promise<void> {
  return invoke("delete_mapping", { mappingId });
}

export async function getMappings(): Promise<MidiMapping[]> {
  return invoke<MidiMapping[]>("get_mappings");
}

export async function getMappingsByDevice(deviceId: string): Promise<MidiMapping[]> {
  return invoke<MidiMapping[]>("get_mappings_by_device", { deviceId });
}

export async function getConflicts(): Promise<DeviceConflict[]> {
  return invoke<DeviceConflict[]>("get_conflicts");
}

export async function clearConflicts(): Promise<void> {
  return invoke("clear_conflicts");
}

export async function savePreset(name: string, description?: string): Promise<MappingPreset> {
  return invoke<MappingPreset>("save_preset", { name, description });
}

export async function updatePreset(preset: MappingPreset): Promise<MappingPreset> {
  return invoke<MappingPreset>("update_preset", { preset });
}

export async function loadPreset(presetId: string): Promise<MappingPreset> {
  return invoke<MappingPreset>("load_preset", { presetId });
}

export async function deletePreset(presetId: string): Promise<void> {
  return invoke("delete_preset", { presetId });
}

export async function getPresets(): Promise<MappingPreset[]> {
  return invoke<MappingPreset[]>("get_presets");
}

export async function getCurrentPreset(): Promise<MappingPreset | null> {
  return invoke<MappingPreset | null>("get_current_preset");
}

export async function exportPreset(presetId: string): Promise<string> {
  return invoke<string>("export_preset", { presetId });
}

export async function importPresetFromFile(filePath: string): Promise<MappingPreset> {
  return invoke<MappingPreset>("import_preset_from_file", { filePath });
}

export async function getConfig(): Promise<AppConfig> {
  return invoke<AppConfig>("get_config");
}

export async function updateConfig(config: Partial<AppConfig> & AppConfig): Promise<AppConfig> {
  return invoke<AppConfig>("update_config", { config });
}

export async function exportAllConfig(): Promise<string> {
  return invoke<string>("export_all_config");
}

export async function getDataDirectories(): Promise<DataDirectories> {
  return invoke<DataDirectories>("get_data_directories");
}

export async function getMappingStats(): Promise<Record<string, number>> {
  return invoke<Record<string, number>>("get_mapping_stats");
}

export async function startLearningMode(): Promise<void> {
  return invoke("start_learning_mode");
}

export async function stopLearningMode(): Promise<void> {
  return invoke("stop_learning_mode");
}

export async function testDeviceConnection(deviceId: string): Promise<boolean> {
  return invoke<boolean>("test_device_connection", { deviceId });
}

export async function setMappingEnabled(mappingId: string, enabled: boolean): Promise<MidiMapping> {
  return invoke<MidiMapping>("set_mapping_enabled", { mappingId, enabled });
}

export async function resolveConflict(
  conflictId: string,
  resolution: string,
  targetMappingId?: string
): Promise<void> {
  return invoke("resolve_conflict", { conflictId, resolution, targetMappingId });
}

export async function checkConflicts(mapping: MidiMapping): Promise<DeviceConflict[]> {
  return invoke<DeviceConflict[]>("check_conflicts", { mapping });
}

export interface EventHandlers {
  onMidiEvent?: (event: MidiEvent) => void;
  onDeviceConnected?: (deviceId: string) => void;
  onDeviceDisconnected?: (deviceId: string) => void;
  onOutputConnected?: (deviceId: string) => void;
  onOutputDisconnected?: (deviceId: string) => void;
  onDevicesScanned?: (devices: [MidiDevice[], MidiDevice[]]) => void;
  onMappingAdded?: (mapping: MidiMapping) => void;
  onMappingUpdated?: (mapping: MidiMapping) => void;
  onMappingDeleted?: (mappingId: string) => void;
  onMappingTriggered?: (data: [MidiEvent, MidiMapping]) => void;
  onPresetSaved?: (preset: MappingPreset) => void;
  onPresetUpdated?: (preset: MappingPreset) => void;
  onPresetLoaded?: (preset: MappingPreset) => void;
  onPresetDeleted?: (presetId: string) => void;
  onPresetImported?: (preset: MappingPreset) => void;
  onLearningModeStarted?: () => void;
  onLearningModeStopped?: () => void;
  onConflictsUpdated?: (conflicts: DeviceConflict[]) => void;
  onMappingsUpdated?: (mappings: MidiMapping[]) => void;
}

export async function setupEventListeners(handlers: EventHandlers): Promise<() => void> {
  const unlisteners: (() => void)[] = [];

  if (handlers.onMidiEvent) {
    unlisteners.push(await listen<MidiEvent>("midi_event", (e) => handlers.onMidiEvent!(e.payload)));
  }

  if (handlers.onDeviceConnected) {
    unlisteners.push(await listen<string>("device_connected", (e) => handlers.onDeviceConnected!(e.payload)));
  }

  if (handlers.onDeviceDisconnected) {
    unlisteners.push(await listen<string>("device_disconnected", (e) => handlers.onDeviceDisconnected!(e.payload)));
  }

  if (handlers.onOutputConnected) {
    unlisteners.push(await listen<string>("output_connected", (e) => handlers.onOutputConnected!(e.payload)));
  }

  if (handlers.onOutputDisconnected) {
    unlisteners.push(await listen<string>("output_disconnected", (e) => handlers.onOutputDisconnected!(e.payload)));
  }

  if (handlers.onDevicesScanned) {
    unlisteners.push(await listen<[MidiDevice[], MidiDevice[]]>("devices_scanned", (e) => handlers.onDevicesScanned!(e.payload)));
  }

  if (handlers.onMappingAdded) {
    unlisteners.push(await listen<MidiMapping>("mapping_added", (e) => handlers.onMappingAdded!(e.payload)));
  }

  if (handlers.onMappingUpdated) {
    unlisteners.push(await listen<MidiMapping>("mapping_updated", (e) => handlers.onMappingUpdated!(e.payload)));
  }

  if (handlers.onMappingDeleted) {
    unlisteners.push(await listen<string>("mapping_deleted", (e) => handlers.onMappingDeleted!(e.payload)));
  }

  if (handlers.onMappingTriggered) {
    unlisteners.push(await listen<[MidiEvent, MidiMapping]>("mapping_triggered", (e) => handlers.onMappingTriggered!(e.payload)));
  }

  if (handlers.onPresetSaved) {
    unlisteners.push(await listen<MappingPreset>("preset_saved", (e) => handlers.onPresetSaved!(e.payload)));
  }

  if (handlers.onPresetUpdated) {
    unlisteners.push(await listen<MappingPreset>("preset_updated", (e) => handlers.onPresetUpdated!(e.payload)));
  }

  if (handlers.onPresetLoaded) {
    unlisteners.push(await listen<MappingPreset>("preset_loaded", (e) => handlers.onPresetLoaded!(e.payload)));
  }

  if (handlers.onPresetDeleted) {
    unlisteners.push(await listen<string>("preset_deleted", (e) => handlers.onPresetDeleted!(e.payload)));
  }

  if (handlers.onPresetImported) {
    unlisteners.push(await listen<MappingPreset>("preset_imported", (e) => handlers.onPresetImported!(e.payload)));
  }

  if (handlers.onLearningModeStarted) {
    unlisteners.push(await listen<void>("learning_mode_started", () => handlers.onLearningModeStarted!()));
  }

  if (handlers.onLearningModeStopped) {
    unlisteners.push(await listen<void>("learning_mode_stopped", () => handlers.onLearningModeStopped!()));
  }

  if (handlers.onConflictsUpdated) {
    unlisteners.push(await listen<DeviceConflict[]>("conflicts_updated", (e) => handlers.onConflictsUpdated!(e.payload)));
  }

  if (handlers.onMappingsUpdated) {
    unlisteners.push(await listen<MidiMapping[]>("mappings_updated", (e) => handlers.onMappingsUpdated!(e.payload)));
  }

  return () => {
    unlisteners.forEach((u) => u());
  };
}
