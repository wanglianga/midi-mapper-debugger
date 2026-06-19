export type MidiEventType =
  | "note_on"
  | "note_off"
  | "control_change"
  | "program_change"
  | "pitch_bend"
  | "aftertouch"
  | "channel_pressure"
  | "system_exclusive"
  | "unknown";

export type DeviceType =
  | "keyboard"
  | "controller"
  | "pad"
  | "synthesizer"
  | "audio_interface"
  | "unknown";

export type ConflictSeverity = "info" | "warning" | "error" | "critical";

export interface MidiDevice {
  id: string;
  name: string;
  port: number;
  device_type: DeviceType;
  is_input: boolean;
  is_output: boolean;
  is_connected: boolean;
  is_active: boolean;
  manufacturer: string | null;
  driver_name: string | null;
  last_seen: string;
}

export interface MidiEvent {
  id: string;
  timestamp: string;
  device_id: string;
  device_name: string;
  event_type: MidiEventType;
  channel: number;
  note: number | null;
  velocity: number | null;
  cc_number: number | null;
  cc_value: number | null;
  program_number: number | null;
  pitch_bend_value: number | null;
  raw_data: number[];
  latency_ms: number | null;
}

export interface MappingTarget {
  parameter_name: string;
  software: string;
  min_value: number;
  max_value: number;
  current_value: number | null;
}

export interface MidiMapping {
  id: string;
  name: string;
  description: string | null;
  device_id: string;
  event_type: MidiEventType;
  channel: number | null;
  note: number | null;
  cc_number: number | null;
  target: MappingTarget;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface MappingPreset {
  id: string;
  name: string;
  description: string | null;
  mappings: MidiMapping[];
  created_at: string;
  updated_at: string;
}

export type ConflictType =
  | "duplicate_control"
  | "duplicate_target"
  | "feedback_loop"
  | "channel_conflict"
  | "device_conflict";

export type ConflictResolution = "keep" | "replace" | "disable" | "save_as_preset";

export interface HighlightedControl {
  device_id: string;
  event_type: MidiEventType;
  channel: number;
  note?: number | null;
  cc_number?: number | null;
  value?: number | null;
  timestamp: number;
}

export interface DeviceConflict {
  id: string;
  timestamp: string;
  severity: ConflictSeverity;
  conflict_type: ConflictType;
  message: string;
  involved_devices: string[];
  involved_mappings: string[];
  resolution_options: ConflictResolution[];
}

export interface AppConfig {
  auto_scan: boolean;
  scan_interval_secs: number;
  max_events_logged: number;
  default_preset_id: string | null;
  theme: string;
  log_midi_events: boolean;
}

export interface DataDirectories {
  config_dir: string;
  data_dir: string;
  presets_dir: string;
  logs_dir: string;
  exports_dir: string;
}

export interface MidiError {
  code: string;
  message: string;
}

export const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
];

export function noteToName(note: number): string {
  const octave = Math.floor(note / 12) - 1;
  const name = NOTE_NAMES[note % 12];
  return `${name}${octave}`;
}

export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatTimestampWithMs(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }) + `.${date.getMilliseconds().toString().padStart(3, "0")}`;
}

export function getEventTypeColor(type: MidiEventType): string {
  const colors: Record<MidiEventType, string> = {
    note_on: "text-green-400",
    note_off: "text-gray-400",
    control_change: "text-blue-400",
    program_change: "text-purple-400",
    pitch_bend: "text-yellow-400",
    aftertouch: "text-orange-400",
    channel_pressure: "text-pink-400",
    system_exclusive: "text-red-400",
    unknown: "text-gray-500",
  };
  return colors[type] || "text-gray-500";
}

export function getEventTypeBgColor(type: MidiEventType): string {
  const colors: Record<MidiEventType, string> = {
    note_on: "bg-green-500/20",
    note_off: "bg-gray-500/20",
    control_change: "bg-blue-500/20",
    program_change: "bg-purple-500/20",
    pitch_bend: "bg-yellow-500/20",
    aftertouch: "bg-orange-500/20",
    channel_pressure: "bg-pink-500/20",
    system_exclusive: "bg-red-500/20",
    unknown: "bg-gray-500/20",
  };
  return colors[type] || "bg-gray-500/20";
}

export function getEventTypeLabel(type: MidiEventType): string {
  const labels: Record<MidiEventType, string> = {
    note_on: "Note On",
    note_off: "Note Off",
    control_change: "CC",
    program_change: "Program",
    pitch_bend: "Pitch",
    aftertouch: "Aftertouch",
    channel_pressure: "Pressure",
    system_exclusive: "SysEx",
    unknown: "Unknown",
  };
  return labels[type] || "Unknown";
}

export function getDeviceTypeLabel(type: DeviceType): string {
  const labels: Record<DeviceType, string> = {
    keyboard: "键盘",
    controller: "控制器",
    pad: "打击垫",
    synthesizer: "合成器",
    audio_interface: "音频接口",
    unknown: "未知",
  };
  return labels[type] || "未知";
}

export function getDeviceTypeIcon(type: DeviceType): string {
  const icons: Record<DeviceType, string> = {
    keyboard: "🎹",
    controller: "🎛️",
    pad: "🥁",
    synthesizer: "🎵",
    audio_interface: "🔊",
    unknown: "❓",
  };
  return icons[type] || "❓";
}

export function getSeverityColor(severity: ConflictSeverity): string {
  const colors: Record<ConflictSeverity, string> = {
    info: "text-blue-400",
    warning: "text-yellow-400",
    error: "text-red-400",
    critical: "text-red-500",
  };
  return colors[severity] || "text-gray-400";
}

export function getSeverityBgColor(severity: ConflictSeverity): string {
  const colors: Record<ConflictSeverity, string> = {
    info: "bg-blue-500/20 border-blue-500/50",
    warning: "bg-yellow-500/20 border-yellow-500/50",
    error: "bg-red-500/20 border-red-500/50",
    critical: "bg-red-600/30 border-red-500",
  };
  return colors[severity] || "bg-gray-500/20 border-gray-500/50";
}
