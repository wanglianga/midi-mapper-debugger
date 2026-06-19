import React, { useState, useEffect, useRef } from "react";
import { 
  MidiEvent, 
  noteToName, 
  getEventTypeColor, 
  HighlightedControl,
  formatTimestampWithMs,
} from "../types";

interface VisualizerProps {
  events: MidiEvent[];
  devices: string[];
  highlightedControl?: HighlightedControl | null;
  mappings: { id: string; name: string; cc_number: number | null; note: number | null }[];
}

interface NoteState {
  velocity: number;
  timestamp: number;
  highlighted?: boolean;
}

interface CCState {
  value: number;
  timestamp: number;
  highlighted?: boolean;
}

interface KnobState {
  ccNumber: number;
  value: number;
  timestamp: number;
  highlighted?: boolean;
  mappingName?: string;
}

interface FaderState {
  ccNumber: number;
  value: number;
  timestamp: number;
  highlighted?: boolean;
  mappingName?: string;
}

export const Visualizer: React.FC<VisualizerProps> = ({ events, devices, highlightedControl, mappings }) => {
  const [activeNotes, setActiveNotes] = useState<Map<number, NoteState>>(new Map());
  const [ccValues, setCcValues] = useState<Map<number, CCState>>(new Map());
  const [pitchBend, setPitchBend] = useState<number>(0);
  const [channelPressure, setChannelPressure] = useState<number>(0);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<MidiEvent | null>(null);
  const [knobs, setKnobs] = useState<Map<number, KnobState>>(new Map());
  const [faders, setFaders] = useState<Map<number, FaderState>>(new Map());
  const [signalStatus, setSignalStatus] = useState<{ [key: string]: { lastSeen: number; count: number } }>({});
  const timeoutRefs = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (events.length === 0) return;

    const latestEvent = events[events.length - 1];
    if (selectedDevice && latestEvent.device_id !== selectedDevice) {
      return;
    }

    setLastEvent(latestEvent);

    const deviceKey = latestEvent.device_id;
    setSignalStatus((prev) => ({
      ...prev,
      [deviceKey]: {
        lastSeen: Date.now(),
        count: (prev[deviceKey]?.count || 0) + 1,
      },
    }));

    switch (latestEvent.event_type) {
      case "note_on":
        if (latestEvent.note !== null && latestEvent.velocity !== null) {
          const note = latestEvent.note;
          const velocity = latestEvent.velocity;

          if (velocity > 0) {
            setActiveNotes((prev) => {
              const next = new Map(prev);
              next.set(note, { 
                velocity, 
                timestamp: Date.now(),
                highlighted: highlightedControl?.note === note && highlightedControl?.event_type === "note_on",
              });
              return next;
            });

            const existingTimeout = timeoutRefs.current.get(note);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
            }
          } else {
            setActiveNotes((prev) => {
              const next = new Map(prev);
              next.delete(note);
              return next;
            });
          }
        }
        break;

      case "note_off":
        if (latestEvent.note !== null) {
          const note = latestEvent.note;
          setActiveNotes((prev) => {
            const next = new Map(prev);
            next.delete(note);
            return next;
          });

          const timeout = timeoutRefs.current.get(note);
          if (timeout) {
            clearTimeout(timeout);
            timeoutRefs.current.delete(note);
          }
        }
        break;

      case "control_change":
        if (latestEvent.cc_number !== null && latestEvent.cc_value !== null) {
          const ccNum = latestEvent.cc_number;
          const ccVal = latestEvent.cc_value;
          
          setCcValues((prev) => {
            const next = new Map(prev);
            next.set(ccNum, {
              value: ccVal,
              timestamp: Date.now(),
              highlighted: highlightedControl?.cc_number === ccNum && highlightedControl?.event_type === "control_change",
            });
            return next;
          });

          const mapping = mappings.find((m) => m.cc_number === ccNum);
          const isFader = ccNum >= 70 && ccNum <= 79;
          
          if (isFader) {
            setFaders((prev) => {
              const next = new Map(prev);
              next.set(ccNum, {
                ccNumber: ccNum,
                value: ccVal,
                timestamp: Date.now(),
                highlighted: highlightedControl?.cc_number === ccNum,
                mappingName: mapping?.name,
              });
              return next;
            });
          } else {
            setKnobs((prev) => {
              const next = new Map(prev);
              next.set(ccNum, {
                ccNumber: ccNum,
                value: ccVal,
                timestamp: Date.now(),
                highlighted: highlightedControl?.cc_number === ccNum,
                mappingName: mapping?.name,
              });
              return next;
            });
          }
        }
        break;

      case "pitch_bend":
        if (latestEvent.pitch_bend_value !== null) {
          setPitchBend(latestEvent.pitch_bend_value);
        }
        break;

      case "channel_pressure":
        if (latestEvent.velocity !== null) {
          setChannelPressure(latestEvent.velocity);
        }
        break;
    }
  }, [events, selectedDevice, highlightedControl, mappings]);

  useEffect(() => {
    if (highlightedControl) {
      if (highlightedControl.event_type === "note_on" && highlightedControl.note !== null) {
        setActiveNotes((prev) => {
          const next = new Map(prev);
          const existing = next.get(highlightedControl.note!);
          if (existing) {
            next.set(highlightedControl.note!, { ...existing, highlighted: true });
          }
          return next;
        });
      }
      if (highlightedControl.event_type === "control_change" && highlightedControl.cc_number !== null) {
        setCcValues((prev) => {
          const next = new Map(prev);
          const existing = next.get(highlightedControl.cc_number!);
          if (existing) {
            next.set(highlightedControl.cc_number!, { ...existing, highlighted: true });
          }
          return next;
        });
        setKnobs((prev) => {
          const next = new Map(prev);
          const existing = next.get(highlightedControl.cc_number!);
          if (existing) {
            next.set(highlightedControl.cc_number!, { ...existing, highlighted: true });
          }
          return next;
        });
        setFaders((prev) => {
          const next = new Map(prev);
          const existing = next.get(highlightedControl.cc_number!);
          if (existing) {
            next.set(highlightedControl.cc_number!, { ...existing, highlighted: true });
          }
          return next;
        });
      }

      const timeout = setTimeout(() => {
        setActiveNotes((prev) => {
          const next = new Map(prev);
          next.forEach((value, key) => {
            if (value.highlighted) {
              next.set(key, { ...value, highlighted: false });
            }
          });
          return next;
        });
        setCcValues((prev) => {
          const next = new Map(prev);
          next.forEach((value, key) => {
            if (value.highlighted) {
              next.set(key, { ...value, highlighted: false });
            }
          });
          return next;
        });
        setKnobs((prev) => {
          const next = new Map(prev);
          next.forEach((value, key) => {
            if (value.highlighted) {
              next.set(key, { ...value, highlighted: false });
            }
          });
          return next;
        });
        setFaders((prev) => {
          const next = new Map(prev);
          next.forEach((value, key) => {
            if (value.highlighted) {
              next.set(key, { ...value, highlighted: false });
            }
          });
          return next;
        });
      }, 500);

      return () => clearTimeout(timeout);
    }
  }, [highlightedControl]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (pitchBend !== 0) {
        setPitchBend(0);
      }
      if (channelPressure !== 0) {
        setChannelPressure(0);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [pitchBend, channelPressure]);

  const pianoKeys = Array.from({ length: 61 }, (_, i) => i + 36);

  const isBlackKey = (note: number) => {
    const pitchClass = note % 12;
    return [1, 3, 6, 8, 10].includes(pitchClass);
  };

  const getNoteLeftPosition = (note: number) => {
    const startNote = 36;
    const whiteKeysBefore = Array.from({ length: note - startNote }, (_, i) => i + startNote).filter(
      (n) => !isBlackKey(n)
    ).length;
    return whiteKeysBefore * 18;
  };

  const sortedCcNumbers = Array.from(ccValues.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-16);

  const sortedKnobs = Array.from(knobs.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-8);

  const sortedFaders = Array.from(faders.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-8);

  const getDeviceSignalStatus = (deviceId: string) => {
    const status = signalStatus[deviceId];
    if (!status) return { color: "text-gray-500", label: "无信号" };
    const timeSince = Date.now() - status.lastSeen;
    if (timeSince < 1000) return { color: "text-green-400 animate-pulse", label: "信号正常" };
    if (timeSince < 5000) return { color: "text-yellow-400", label: "最近活跃" };
    return { color: "text-gray-500", label: "待机" };
  };

  const getHighlightClass = (highlighted?: boolean) => {
    return highlighted 
      ? "ring-2 ring-midi-accent ring-offset-2 ring-offset-midi-dark shadow-lg shadow-midi-accent/30 scale-105" 
      : "";
  };

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <h2 className="panel-title">可视化仪表</h2>
        <div className="flex items-center gap-3">
          {lastEvent && (
            <div className="flex items-center gap-2 text-xs">
              <span className={`status-dot ${getDeviceSignalStatus(lastEvent.device_id).color.replace("animate-pulse", "")}`} />
              <span className={getDeviceSignalStatus(lastEvent.device_id).color}>
                {getDeviceSignalStatus(lastEvent.device_id).label}
              </span>
            </div>
          )}
          {devices.length > 1 && (
            <select
              className="select text-xs py-1 w-48"
              value={selectedDevice || ""}
              onChange={(e) => setSelectedDevice(e.target.value || null)}
            >
              <option value="">所有设备</option>
              {devices.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="panel-content flex-1 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
        {lastEvent && (
          <div className={`flex items-center gap-4 p-3 bg-midi-dark rounded-lg border transition-all duration-200 ${
            highlightedControl ? "border-midi-accent shadow-lg shadow-midi-accent/20" : "border-midi-border"
          }`}>
            <div className="text-3xl">
              {lastEvent.event_type === "note_on" || lastEvent.event_type === "note_off" ? "🎹" :
               lastEvent.event_type === "control_change" ? "🎛️" :
               lastEvent.event_type === "pitch_bend" ? "🎚️" :
               lastEvent.event_type === "channel_pressure" ? "🎹" : "🎵"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>{lastEvent.device_name}</span>
                <span>·</span>
                <span>CH{String(lastEvent.channel).padStart(2, "0")}</span>
                <span>·</span>
                <span className="text-gray-500">{formatTimestampWithMs(lastEvent.timestamp)}</span>
              </div>
              <div className={`text-lg font-bold ${getEventTypeColor(lastEvent.event_type)}`}>
                {lastEvent.event_type === "note_on" || lastEvent.event_type === "note_off"
                  ? `${lastEvent.event_type === "note_on" ? "按键" : "释放"} ${lastEvent.note !== null ? noteToName(lastEvent.note) : ""}`
                  : lastEvent.event_type === "control_change"
                  ? `旋钮/推子 CC ${lastEvent.cc_number} = ${lastEvent.cc_value}`
                  : lastEvent.event_type === "pitch_bend"
                  ? `弯音轮: ${lastEvent.pitch_bend_value}`
                  : lastEvent.event_type === "program_change"
                  ? `程序切换: ${lastEvent.program_number}`
                  : lastEvent.event_type === "channel_pressure"
                  ? `通道压力: ${lastEvent.velocity}`
                  : "其他事件"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {lastEvent.latency_ms !== null && (
                  <span className={lastEvent.latency_ms < 10 ? "text-green-400" : lastEvent.latency_ms < 30 ? "text-yellow-400" : "text-red-400"}>
                    延迟: {lastEvent.latency_ms}ms
                  </span>
                )}
                {highlightedControl && (
                  <span className="ml-3 text-midi-accent">
                    ✨ 控件已高亮
                  </span>
                )}
              </div>
            </div>
            {lastEvent.velocity !== null && (
              <div className="text-right">
                <div className="text-xs text-gray-500">力度</div>
                <div className="text-2xl font-bold text-midi-accent">{lastEvent.velocity}</div>
              </div>
            )}
            {lastEvent.cc_value !== null && (
              <div className="text-right">
                <div className="text-xs text-gray-500">数值</div>
                <div className="text-2xl font-bold text-blue-400">{lastEvent.cc_value}</div>
              </div>
            )}
          </div>
        )}

        {!lastEvent && (
          <div className="flex items-center justify-center p-6 bg-midi-dark rounded-lg border border-midi-border border-dashed">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-2">🎵</div>
              <div>操作 MIDI 设备以显示实时数据</div>
              <div className="text-xs mt-1">按键、转动旋钮、推动推子或踩踏板</div>
              <div className="text-xs mt-2 text-gray-600">
                面板会同步高亮对应控件，帮助判断是硬件未发信号还是软件没接到
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-400">钢琴键盘 (C2-C7)</div>
            <div className="text-xs text-gray-500">
              {activeNotes.size} 个音符活跃
            </div>
          </div>
          <div className="relative h-32 bg-midi-dark rounded-lg p-2 overflow-x-auto scrollbar-thin">
            <div className="relative" style={{ width: `${pianoKeys.filter((n) => !isBlackKey(n)).length * 18}px`, height: "100%" }}>
              {pianoKeys.filter((n) => !isBlackKey(n)).map((note) => {
                const state = activeNotes.get(note);
                const isActive = !!state;
                const velocity = state?.velocity || 0;
                return (
                  <div
                    key={note}
                    className={`absolute bottom-0 piano-key-white h-full transition-all duration-100 ${isActive ? "active" : ""} ${getHighlightClass(state?.highlighted)}`}
                    style={{
                      left: `${getNoteLeftPosition(note)}px`,
                      width: "16px",
                      opacity: isActive ? 0.5 + (velocity / 255) * 0.5 : 1,
                    }}
                    title={`${noteToName(note)} (${note})${state ? ` 力度: ${state.velocity}` : ""}`}
                  />
                );
              })}
              {pianoKeys.filter((n) => isBlackKey(n)).map((note) => {
                const state = activeNotes.get(note);
                const isActive = !!state;
                const velocity = state?.velocity || 0;
                return (
                  <div
                    key={note}
                    className={`absolute bottom-0 piano-key-black z-10 transition-all duration-100 ${isActive ? "active" : ""} ${getHighlightClass(state?.highlighted)}`}
                    style={{
                      left: `${getNoteLeftPosition(note) - 6}px`,
                      width: "12px",
                      height: "60%",
                      opacity: isActive ? 0.5 + (velocity / 255) * 0.5 : 1,
                    }}
                    title={`${noteToName(note)} (${note})${state ? ` 力度: ${state.velocity}` : ""}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {sortedKnobs.length > 0 && (
          <div>
            <div className="text-xs text-gray-400 mb-2">旋钮控件</div>
            <div className="bg-midi-dark rounded-lg p-3">
              <div className="flex flex-wrap gap-4 justify-center">
                {sortedKnobs.map(([ccNum, state]) => (
                  <div key={ccNum} className={`flex flex-col items-center transition-all duration-200 ${getHighlightClass(state.highlighted)} rounded-lg p-2`}>
                    <div className="relative w-12 h-12">
                      <div className="absolute inset-0 rounded-full bg-midi-border border-2 border-midi-border" />
                      <div
                        className="absolute inset-1 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 shadow-inner"
                        style={{
                          transform: `rotate(${-135 + (state.value / 127) * 270}deg)`,
                        }}
                      >
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-3 bg-midi-accent rounded-full" />
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">CC {ccNum}</div>
                    <div className="text-sm font-mono text-gray-300">{state.value}</div>
                    {state.mappingName && (
                      <div className="text-xs text-midi-accent truncate max-w-[60px]" title={state.mappingName}>
                        {state.mappingName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {sortedFaders.length > 0 && (
          <div>
            <div className="text-xs text-gray-400 mb-2">推子控件</div>
            <div className="bg-midi-dark rounded-lg p-3">
              <div className="flex flex-wrap gap-4 justify-center items-end">
                {sortedFaders.map(([ccNum, state]) => (
                  <div key={ccNum} className={`flex flex-col items-center transition-all duration-200 ${getHighlightClass(state.highlighted)} rounded-lg p-2`}>
                    <div className="relative w-8 h-32 bg-midi-border rounded-full overflow-hidden">
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-100"
                        style={{ height: `${(state.value / 127) * 100}%` }}
                      />
                      <div
                        className="absolute left-1 right-1 h-4 bg-gray-300 rounded-md shadow-md transition-all duration-100"
                        style={{ bottom: `calc(${(state.value / 127) * 100}% - 8px)` }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-2">CC {ccNum}</div>
                    <div className="text-sm font-mono text-gray-300">{state.value}</div>
                    {state.mappingName && (
                      <div className="text-xs text-midi-accent truncate max-w-[60px]" title={state.mappingName}>
                        {state.mappingName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-400 mb-2">CC 值仪表</div>
            <div className="bg-midi-dark rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
              {sortedCcNumbers.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-4">
                  暂无 CC 数据
                </div>
              ) : (
                sortedCcNumbers.map(([ccNum, state]) => (
                  <div key={ccNum} className={`flex items-center gap-2 transition-all duration-200 ${state.highlighted ? "bg-midi-accent/10 rounded px-1 -mx-1" : ""}`}>
                    <span className={`text-xs w-12 ${state.highlighted ? "text-midi-accent font-bold" : "text-gray-400"}`}>
                      CC {ccNum}
                    </span>
                    <div className="flex-1 h-3 bg-midi-border rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-100 ${state.highlighted ? "bg-midi-accent" : "bg-blue-500"}`}
                        style={{ width: `${(state.value / 127) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs w-8 text-right font-mono ${state.highlighted ? "text-midi-accent font-bold" : "text-gray-300"}`}>
                      {state.value}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-400 mb-2">弯音轮</div>
              <div className={`bg-midi-dark rounded-lg p-3 transition-all duration-200 ${highlightedControl?.event_type === "pitch_bend" ? "ring-2 ring-midi-accent" : ""}`}>
                <div className="relative h-8 bg-midi-border rounded">
                  <div className="absolute inset-y-0 left-1/2 w-0.5 bg-gray-600" />
                  <div
                    className="absolute inset-y-1 bg-yellow-500 rounded transition-all duration-100"
                    style={{
                      left: `${50 + (pitchBend / 8192) * 48}%`,
                      width: "4px",
                    }}
                  />
                </div>
                <div className="text-center text-xs text-gray-500 mt-1">
                  {pitchBend > 0 ? "+" : ""}{pitchBend}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-400 mb-2">通道压力 / 踏板</div>
              <div className={`bg-midi-dark rounded-lg p-3 transition-all duration-200 ${highlightedControl?.event_type === "channel_pressure" ? "ring-2 ring-midi-accent" : ""}`}>
                <div className="h-8 bg-midi-border rounded overflow-hidden">
                  <div
                    className="h-full bg-pink-500 transition-all duration-100"
                    style={{ width: `${(channelPressure / 127) * 100}%` }}
                  />
                </div>
                <div className="text-center text-xs text-gray-500 mt-1">
                  {channelPressure}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-400 mb-2">活跃音符</div>
              <div className="bg-midi-dark rounded-lg p-3">
                <div className="flex flex-wrap gap-1 min-h-[32px]">
                  {Array.from(activeNotes.entries()).map(([note, state]) => (
                    <span
                      key={note}
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-mono transition-all duration-200 ${
                        state.highlighted 
                          ? "bg-midi-accent/30 text-midi-accent ring-1 ring-midi-accent" 
                          : "bg-green-500/20 text-green-400"
                      }`}
                      style={{ opacity: 0.5 + (state.velocity / 255) * 0.5 }}
                    >
                      {noteToName(note)}
                      <span className="text-gray-500 ml-1">({state.velocity})</span>
                    </span>
                  ))}
                  {activeNotes.size === 0 && (
                    <span className="text-gray-500 text-sm">无</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-midi-dark/50 rounded-lg p-3 border border-midi-border">
          <div className="text-xs text-gray-400 mb-2">信号诊断</div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">接收事件数</span>
              <span className="text-gray-300 font-mono">{events.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">活跃设备</span>
              <span className="text-gray-300 font-mono">{Object.keys(signalStatus).length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">活跃 CC</span>
              <span className="text-blue-400 font-mono">{ccValues.size}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">活跃音符</span>
              <span className="text-green-400 font-mono">{activeNotes.size}</span>
            </div>
          </div>
          {lastEvent && (
            <div className="mt-2 pt-2 border-t border-midi-border text-xs text-gray-500">
              <span className="text-gray-400">提示：</span>
              {lastEvent.latency_ms !== null && lastEvent.latency_ms > 30 ? (
                <span className="text-red-400">延迟较高，检查 USB 连接或减少设备数量</span>
              ) : (
                <span className="text-green-400">信号正常，延迟在可接受范围内</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
