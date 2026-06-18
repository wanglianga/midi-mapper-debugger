import React, { useState, useEffect, useRef } from "react";
import { MidiEvent, noteToName, getEventTypeColor } from "../types";

interface VisualizerProps {
  events: MidiEvent[];
  devices: string[];
}

interface NoteState {
  velocity: number;
  timestamp: number;
}

interface CCState {
  value: number;
  timestamp: number;
}

export const Visualizer: React.FC<VisualizerProps> = ({ events, devices }) => {
  const [activeNotes, setActiveNotes] = useState<Map<number, NoteState>>(new Map());
  const [ccValues, setCcValues] = useState<Map<number, CCState>>(new Map());
  const [pitchBend, setPitchBend] = useState<number>(0);
  const [channelPressure, setChannelPressure] = useState<number>(0);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<MidiEvent | null>(null);
  const timeoutRefs = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (events.length === 0) return;

    const latestEvent = events[events.length - 1];
    if (selectedDevice && latestEvent.device_id !== selectedDevice) {
      return;
    }

    setLastEvent(latestEvent);

    switch (latestEvent.event_type) {
      case "note_on":
        if (latestEvent.note !== null && latestEvent.velocity !== null) {
          const note = latestEvent.note;
          const velocity = latestEvent.velocity;

          if (velocity > 0) {
            setActiveNotes((prev) => {
              const next = new Map(prev);
              next.set(note, { velocity, timestamp: Date.now() });
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
          setCcValues((prev) => {
            const next = new Map(prev);
            next.set(latestEvent.cc_number!, {
              value: latestEvent.cc_value!,
              timestamp: Date.now(),
            });
            return next;
          });
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
  }, [events, selectedDevice]);

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

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <h2 className="panel-title">可视化仪表</h2>
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

      <div className="panel-content flex-1 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
        {lastEvent && (
          <div className="flex items-center gap-4 p-3 bg-midi-dark rounded-lg border border-midi-border">
            <div className="text-3xl">🎹</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-400">
                {lastEvent.device_name} · CH{String(lastEvent.channel).padStart(2, "0")}
              </div>
              <div className={`text-lg font-bold ${getEventTypeColor(lastEvent.event_type)}`}>
                {lastEvent.event_type === "note_on" || lastEvent.event_type === "note_off"
                  ? `${lastEvent.event_type === "note_on" ? "按下" : "释放"} ${lastEvent.note !== null ? noteToName(lastEvent.note) : ""}`
                  : lastEvent.event_type === "control_change"
                  ? `CC ${lastEvent.cc_number} = ${lastEvent.cc_value}`
                  : lastEvent.event_type === "pitch_bend"
                  ? `弯音: ${lastEvent.pitch_bend_value}`
                  : lastEvent.event_type === "program_change"
                  ? `程序: ${lastEvent.program_number}`
                  : "其他事件"}
              </div>
            </div>
            {lastEvent.velocity !== null && (
              <div className="text-right">
                <div className="text-xs text-gray-500">力度</div>
                <div className="text-2xl font-bold text-midi-accent">{lastEvent.velocity}</div>
              </div>
            )}
          </div>
        )}

        <div>
          <div className="text-xs text-gray-400 mb-2">钢琴键盘 (C2-C7)</div>
          <div className="relative h-32 bg-midi-dark rounded-lg p-2 overflow-x-auto scrollbar-thin">
            <div className="relative" style={{ width: `${pianoKeys.filter((n) => !isBlackKey(n)).length * 18}px`, height: "100%" }}>
              {pianoKeys.filter((n) => !isBlackKey(n)).map((note) => {
                const isActive = activeNotes.has(note);
                const velocity = activeNotes.get(note)?.velocity || 0;
                return (
                  <div
                    key={note}
                    className={`absolute bottom-0 piano-key-white h-full ${isActive ? "active" : ""}`}
                    style={{
                      left: `${getNoteLeftPosition(note)}px`,
                      width: "16px",
                      opacity: isActive ? 0.5 + (velocity / 255) * 0.5 : 1,
                    }}
                    title={`${noteToName(note)} (${note})`}
                  />
                );
              })}
              {pianoKeys.filter((n) => isBlackKey(n)).map((note) => {
                const isActive = activeNotes.has(note);
                const velocity = activeNotes.get(note)?.velocity || 0;
                return (
                  <div
                    key={note}
                    className={`absolute bottom-0 piano-key-black z-10 ${isActive ? "active" : ""}`}
                    style={{
                      left: `${getNoteLeftPosition(note) - 6}px`,
                      width: "12px",
                      height: "60%",
                      opacity: isActive ? 0.5 + (velocity / 255) * 0.5 : 1,
                    }}
                    title={`${noteToName(note)} (${note})`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-400 mb-2">最近 CC 值</div>
            <div className="bg-midi-dark rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
              {sortedCcNumbers.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-4">
                  暂无 CC 数据
                </div>
              ) : (
                sortedCcNumbers.map(([ccNum, state]) => (
                  <div key={ccNum} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-12">CC {ccNum}</span>
                    <div className="flex-1 h-2 bg-midi-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-100"
                        style={{ width: `${(state.value / 127) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-300 w-8 text-right">{state.value}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-400 mb-2">弯音轮</div>
              <div className="bg-midi-dark rounded-lg p-3">
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
              <div className="text-xs text-gray-400 mb-2">通道压力</div>
              <div className="bg-midi-dark rounded-lg p-3">
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
                      className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 font-mono"
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
      </div>
    </div>
  );
};
