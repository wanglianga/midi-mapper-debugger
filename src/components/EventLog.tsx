import React, { useEffect, useRef } from "react";
import {
  MidiEvent,
  formatTimestampWithMs,
  getEventTypeColor,
  getEventTypeBgColor,
  getEventTypeLabel,
  noteToName,
} from "../types";
import { clearEvents } from "../api";

interface EventLogProps {
  events: MidiEvent[];
  maxEvents?: number;
}

export const EventLog: React.FC<EventLogProps> = ({ events, maxEvents = 500 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
    }
  };

  const handleClear = async () => {
    await clearEvents();
  };

  const formatEventDetails = (event: MidiEvent): string => {
    switch (event.event_type) {
      case "note_on":
      case "note_off":
        return `Note ${event.note !== null ? noteToName(event.note) : "-"} (${event.note}) Vel ${event.velocity}`;
      case "control_change":
        return `CC ${event.cc_number} Value ${event.cc_value}`;
      case "program_change":
        return `Program ${event.program_number}`;
      case "pitch_bend":
        return `Bend ${event.pitch_bend_value}`;
      case "aftertouch":
        return `Aftertouch Note ${event.note} Pressure ${event.velocity}`;
      case "channel_pressure":
        return `Pressure ${event.velocity}`;
      case "system_exclusive":
        return `SysEx len=${event.raw_data.length}`;
      default:
        return `Raw: ${event.raw_data.map((b) => b.toString(16).padStart(2, "0")).join(" ")}`;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(console.error);
  };

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <h2 className="panel-title">
          MIDI 事件日志
          <span className="ml-2 text-xs text-gray-500">
            ({events.length}/{maxEvents})
          </span>
        </h2>
        <div className="flex gap-2">
          <button
            className="btn-ghost text-xs"
            onClick={() => autoScrollRef.current = !autoScrollRef.current}
            title={autoScrollRef.current ? "禁用自动滚动" : "启用自动滚动"}
          >
            {autoScrollRef.current ? "📜 自动" : "📜 暂停"}
          </button>
          <button className="btn-ghost text-xs" onClick={handleClear}>
            🗑️ 清空
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin font-mono text-xs"
      >
        {events.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-2">🎵</div>
            <div>等待 MIDI 事件...</div>
            <div className="text-xs mt-1">连接设备并按下按键或转动旋钮</div>
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {events.map((event, index) => (
              <div
                key={event.id}
                className={`flex items-center gap-2 px-2 py-1 rounded group hover:bg-midi-border/30 transition-colors ${getEventTypeBgColor(event.event_type)} animate-fade-in`}
                style={{ opacity: 1 - (index / events.length) * 0.3 }}
                onClick={() => copyToClipboard(JSON.stringify(event, null, 2))}
                title="点击复制详细信息"
              >
                <span className="text-gray-500 w-20 flex-shrink-0">
                  {formatTimestampWithMs(event.timestamp)}
                </span>
                <span className="text-gray-500 w-16 flex-shrink-0">
                  {event.device_name.length > 10
                    ? event.device_name.slice(0, 10) + "…"
                    : event.device_name.padEnd(10)}
                </span>
                <span className="text-gray-500 w-8 flex-shrink-0">
                  CH{String(event.channel).padStart(2, "0")}
                </span>
                <span className={`w-16 flex-shrink-0 ${getEventTypeColor(event.event_type)}`}>
                  {getEventTypeLabel(event.event_type)}
                </span>
                <span className="flex-1 truncate text-gray-300">
                  {formatEventDetails(event)}
                </span>
                {event.latency_ms !== null && event.latency_ms > 0 && (
                  <span className="text-gray-500 flex-shrink-0">
                    {event.latency_ms}ms
                  </span>
                )}
                <span className="text-gray-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  📋
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
