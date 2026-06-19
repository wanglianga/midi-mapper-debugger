import { useState, useEffect, useCallback, useRef } from "react";
import {
  MidiDevice,
  MidiEvent,
  MidiMapping,
  MappingPreset,
  DeviceConflict,
  AppConfig,
  MidiEventType,
  HighlightedControl,
} from "./types";
import {
  scanDevices,
  getMappings,
  getPresets,
  getCurrentPreset,
  getRecentEvents,
  getConflicts,
  getConfig,
  updateConfig,
  startLearningMode,
  stopLearningMode,
  setupEventListeners,
} from "./api";
import { Header } from "./components/Header";
import { DeviceList } from "./components/DeviceList";
import { EventLog } from "./components/EventLog";
import { Visualizer } from "./components/Visualizer";
import { MappingTable } from "./components/MappingTable";
import { ConflictAlerts } from "./components/ConflictAlerts";
import { PresetManager } from "./components/PresetManager";

function App() {
  const [inputDevices, setInputDevices] = useState<MidiDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<MidiDevice[]>([]);
  const [events, setEvents] = useState<MidiEvent[]>([]);
  const [mappings, setMappings] = useState<MidiMapping[]>([]);
  const [presets, setPresets] = useState<MappingPreset[]>([]);
  const [currentPreset, setCurrentPreset] = useState<MappingPreset | null>(null);
  const [conflicts, setConflicts] = useState<DeviceConflict[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [learningMode, setLearningMode] = useState(false);
  const [learningEvent, setLearningEvent] = useState<{
    device_id: string;
    event_type: MidiEventType;
    channel: number;
    note: number | null;
    cc_number: number | null;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"visualizer" | "mappings">("visualizer");
  const [highlightedControl, setHighlightedControl] = useState<HighlightedControl | null>(null);

  const eventTimestamps = useRef<number[]>([]);
  const initialized = useRef(false);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadInitialData = useCallback(async () => {
    try {
      const [mappingsData, presetsData, currentPresetData, eventsData, conflictsData, configData] =
        await Promise.all([
          getMappings(),
          getPresets(),
          getCurrentPreset(),
          getRecentEvents(100),
          getConflicts(),
          getConfig(),
        ]);

      setMappings(mappingsData);
      setPresets(presetsData);
      setCurrentPreset(currentPresetData);
      setEvents(eventsData);
      setConflicts(conflictsData);
      setConfig(configData);
    } catch (e) {
      console.error("加载初始数据失败:", e);
    }
  }, []);

  const handleScan = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);
    try {
      const [inputs, outputs] = await scanDevices();
      setInputDevices(inputs);
      setOutputDevices(outputs);
    } catch (e) {
      console.error("扫描设备失败:", e);
    } finally {
      setIsScanning(false);
    }
  }, [isScanning]);

  const toggleLearningMode = useCallback(async () => {
    if (learningMode) {
      await stopLearningMode();
      setLearningMode(false);
      setLearningEvent(null);
    } else {
      await startLearningMode();
      setLearningMode(true);
    }
  }, [learningMode]);

  const toggleAutoScan = useCallback(async () => {
    if (!config) return;
    const newConfig = { ...config, auto_scan: !config.auto_scan };
    try {
      const updated = await updateConfig(newConfig);
      setConfig(updated);
    } catch (e) {
      console.error("更新配置失败:", e);
    }
  }, [config]);

  const refreshMappings = useCallback(async () => {
    try {
      const [mappingsData, presetsData, currentPresetData, conflictsData] = await Promise.all([
        getMappings(),
        getPresets(),
        getCurrentPreset(),
        getConflicts(),
      ]);
      setMappings(mappingsData);
      setPresets(presetsData);
      setCurrentPreset(currentPresetData);
      setConflicts(conflictsData);
    } catch (e) {
      console.error("刷新映射数据失败:", e);
    }
  }, []);

  const refreshConflicts = useCallback(async () => {
    try {
      const conflictsData = await getConflicts();
      setConflicts(conflictsData);
    } catch (e) {
      console.error("刷新冲突数据失败:", e);
    }
  }, []);

  const clearLearningEvent = useCallback(() => {
    setLearningEvent(null);
  }, []);

  const calculateEventRate = useCallback(() => {
    const now = Date.now();
    const recent = eventTimestamps.current.filter((t) => now - t < 1000);
    eventTimestamps.current = recent;
    return recent.length;
  }, []);

  const handleControlHighlight = useCallback((control: HighlightedControl) => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    
    setHighlightedControl(control);
    
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedControl(null);
    }, 1000);
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      loadInitialData();
      handleScan();

      const setupListeners = async () => {
        const cleanup = await setupEventListeners({
          onMidiEvent: (event) => {
            setEvents((prev) => [...prev.slice(-499), event]);
            eventTimestamps.current.push(Date.now());

            if (learningMode) {
              if (
                event.event_type === "note_on" ||
                event.event_type === "control_change" ||
                event.event_type === "program_change" ||
                event.event_type === "pitch_bend"
              ) {
                setLearningEvent({
                  device_id: event.device_id,
                  event_type: event.event_type,
                  channel: event.channel,
                  note: event.note,
                  cc_number: event.cc_number,
                });
              }
            }
          },
          onDevicesScanned: ([inputs, outputs]) => {
            setInputDevices(inputs);
            setOutputDevices(outputs);
          },
          onMappingAdded: () => refreshMappings(),
          onMappingUpdated: () => refreshMappings(),
          onMappingDeleted: () => refreshMappings(),
          onPresetSaved: () => refreshMappings(),
          onPresetUpdated: () => refreshMappings(),
          onPresetLoaded: () => refreshMappings(),
          onPresetDeleted: () => refreshMappings(),
          onPresetImported: () => refreshMappings(),
          onConflictsUpdated: (newConflicts) => {
            setConflicts(newConflicts);
          },
          onMappingsUpdated: (newMappings) => {
            setMappings(newMappings);
            refreshMappings();
          },
        });

        return cleanup;
      };

      setupListeners();
    }

    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [loadInitialData, handleScan, refreshMappings, learningMode]);

  useEffect(() => {
    const interval = setInterval(() => {
      calculateEventRate();
    }, 1000);
    return () => clearInterval(interval);
  }, [calculateEventRate]);

  const allDevices = [...inputDevices, ...outputDevices];
  const activeDeviceIds = allDevices.filter((d) => d.is_active).map((d) => d.id);

  const deviceStats = {
    inputs: inputDevices.filter((d) => d.is_connected).length,
    outputs: outputDevices.filter((d) => d.is_connected).length,
    active: activeDeviceIds.length,
  };

  const eventStats = {
    total: events.length,
    rate: calculateEventRate(),
  };

  const mappingDataForVisualizer = mappings.map((m) => ({
    id: m.id,
    name: m.name,
    cc_number: m.cc_number,
    note: m.note,
  }));

  return (
    <div className="h-screen flex flex-col bg-midi-dark">
      <Header
        learningMode={learningMode}
        onToggleLearning={toggleLearningMode}
        isScanning={isScanning}
        onScan={handleScan}
        config={config}
        onToggleAutoScan={toggleAutoScan}
        deviceStats={deviceStats}
        eventStats={eventStats}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 flex-shrink-0 border-r border-midi-border">
          <DeviceList
            inputDevices={inputDevices}
            outputDevices={outputDevices}
            onDeviceStateChange={handleScan}
            isScanning={isScanning}
            onScan={handleScan}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex border-b border-midi-border bg-midi-panel/50">
            <button
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "visualizer"
                  ? "text-midi-accent border-b-2 border-midi-accent"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              onClick={() => setActiveTab("visualizer")}
            >
              📊 可视化仪表
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "mappings"
                  ? "text-midi-accent border-b-2 border-midi-accent"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              onClick={() => setActiveTab("mappings")}
            >
              🔗 映射表 ({mappings.filter(m => m.is_enabled).length}/{mappings.length})
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === "visualizer" ? (
              <div className="h-full flex flex-col">
                <div className="flex-1 grid grid-cols-2 gap-4 p-4 overflow-hidden">
                  <Visualizer
                    events={events}
                    devices={allDevices.filter((d) => d.is_connected).map((d) => d.id)}
                    highlightedControl={highlightedControl}
                    mappings={mappingDataForVisualizer}
                  />
                  <EventLog
                    events={events}
                    maxEvents={config?.max_events_logged || 500}
                    onControlHighlight={handleControlHighlight}
                  />
                </div>
                <div className="px-4 pb-4">
                  <ConflictAlerts
                    conflicts={conflicts}
                    mappings={mappings}
                    onClear={refreshConflicts}
                    onResolve={refreshMappings}
                  />
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col p-4 gap-4 overflow-hidden">
                <div className="flex-1 min-h-0">
                  <MappingTable
                    mappings={mappings}
                    devices={allDevices}
                    learningMode={learningMode}
                    learningEvent={learningEvent}
                    onClearLearning={clearLearningEvent}
                    onMappingChange={refreshMappings}
                  />
                </div>
                <div className="flex-shrink-0">
                  <PresetManager
                    presets={presets}
                    currentPreset={currentPreset}
                    mappingsCount={mappings.length}
                    onPresetChange={refreshMappings}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
