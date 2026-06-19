import React, { useEffect, useRef, useState } from "react";
import {
  MidiEvent,
  formatTimestampWithMs,
  getEventTypeColor,
  getEventTypeBgColor,
  getEventTypeLabel,
  noteToName,
  HighlightedControl,
} from "../types";
import { clearEvents } from "../api";

interface EventLogProps {
  events: MidiEvent[];
  maxEvents?: number;
  onControlHighlight?: (control: HighlightedControl) => void;
}

export const EventLog: React.FC<EventLogProps> = ({ events, maxEvents = 500, onControlHighlight }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const [filter, setFilter] = useState<string>("all");
  const [showDeviceFilter, setShowDeviceFilter] = useState<string>("all");
  const lastHighlightedRef = useRef<string>("");

  const uniqueDevices = Array.from(new Set(events.map((e) => e.device_name)));

  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  useEffect(() => {
    if (events.length > 0 && onControlHighlight) {
      const latestEvent = events[events.length - 1];
      const eventKey = `${latestEvent.device_id}-${latestEvent.event_type}-${latestEvent.channel}-${latestEvent.note ?? ""}-${latestEvent.cc_number ?? ""}`;
      
      if (eventKey !== lastHighlightedRef.current) {
        lastHighlightedRef.current = eventKey;
        onControlHighlight({
          device_id: latestEvent.device_id,
          event_type: latestEvent.event_type,
          channel: latestEvent.channel,
          note: latestEvent.note,
          cc_number: latestEvent.cc_number,
          value: latestEvent.cc_value ?? latestEvent.velocity ?? latestEvent.pitch_bend_value ?? null,
          timestamp: Date.now(),
        });
      }
    }
  }, [events, onControlHighlight]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
    }
  };

  const handleClear = async () => {
    await clearEvents();
  };

  const getEventValue = (event: MidiEvent): number | null => {
    switch (event.event_type) {
      case "note_on":
      case "note_off":
        return event.velocity;
      case "control_change":
        return event.cc_value;
      case "pitch_bend":
        return event.pitch_bend_value;
      case "aftertouch":
      case "channel_pressure":
        return event.velocity;
      case "program_change":
        return event.program_number;
      default:
        return null;
    }
  };

  const formatEventDetails = (event: MidiEvent): string => {
    switch (event.event_type) {
      case "note_on":
      case "note_off":
        return `Note ${event.note !== null ? noteToName(event.note) : "-"} (${event.note})`;
      case "control_change":
        return `CC ${event.cc_number}`;
      case "program_change":
        return `Program ${event.program_number}`;
      case "pitch_bend":
        return `Pitch Bend`;
      case "aftertouch":
        return `Aftertouch ${event.note !== null ? noteToName(event.note) : "-"}`;
      case "channel_pressure":
        return `Channel Pressure`;
      case "system_exclusive":
        return `SysEx len=${event.raw_data.length}`;
      default:
        return `Raw: ${event.raw_data.map((b) => b.toString(16).padStart(2, "0")).join(" ")}`;
    }
  };

  const formatValue = (event: MidiEvent): string => {
    const value = getEventValue(event);
    if (value === null) return "-";
    
    switch (event.event_type) {
      case "pitch_bend":
        return value > 0 ? `+${value}` : `${value}`;
      case "note_on":
      case "note_off":
        return `Vel: ${value}`;
      case "control_change":
        return `Val: ${value}`;
      default:
        return `${value}`;
    }
  };

  const getLatencyColor = (latency: number): string => {
    if (latency < 5) return "text-green-400";
    if (latency < 15) return "text-yellow-400";
    if (latency < 30) return "text-orange-400";
    return "text-red-400";
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(console.error);
  };

  const filteredEvents = events.filter((event) => {
    const typeMatch = filter === "all" || event.event_type === filter;
    const deviceMatch = showDeviceFilter === "all" || event.device_name === showDeviceFilter;
    return typeMatch && deviceMatch;
  });

  const eventTypes = [
    { value: "all", label: "全部" },
    { value: "note_on", label: "Note On" },
    { value: "control_change", label: "CC" },
    { value: "pitch_bend", label: "Pitch" },
    { value: "program_change", label: "Program" },
  ];

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <h2 className="panel-title">
          MIDI 事件日志
          <span className="ml-2 text-xs text-gray-500">
            ({filteredEvents.length}/{maxEvents})
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

      <div className="px-2 py-1 border-b border-midi-border bg-midi-dark/30 flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">类型:</span>
          <select
            className="bg-transparent text-xs text-gray-300 border border-midi-border rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-midi-accent"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {eventTypes.map((t) => (
              <option key={t.value} value={t.value} className="bg-midi-dark">
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {uniqueDevices.length > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">设备:</span>
            <select
              className="bg-transparent text-xs text-gray-300 border border-midi-border rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-midi-accent"
              value={showDeviceFilter}
              onChange={(e) => setShowDeviceFilter(e.target.value)}
            >
              <option value="all" className="bg-midi-dark">全部</option>
              {uniqueDevices.map((d) => (
                <option key={d} value={d} className="bg-midi-dark">
                  {d.length > 15 ? d.slice(0, 15) + "…" : d}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="px-2 py-1 border-b border-midi-border bg-midi-dark/20 grid grid-cols-12 gap-2 text-xs text-gray-500 font-mono">
        <div className="col-span-2">时间</div>
        <div className="col-span-2">设备</div>
        <div className="col-span-1">通道</div>
        <div className="col-span-2">类型</div>
        <div className="col-span-3">控件/参数</div>
        <div className="col-span-1 text-right">数值</div>
        <div className="col-span-1 text-right">延迟</div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin font-mono text-xs"
      >
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-2">🎵</div>
            <div>等待 MIDI 事件...</div>
            <div className="text-xs mt-1">连接设备并按下按键或转动旋钮</div>
            <div className="text-xs mt-2 text-gray-600">
              实时显示时间、通道、数值、设备名和延迟
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            {filteredEvents.map((event, index) => (
              <div
                key={event.id}
                className={`grid grid-cols-12 gap-2 px-2 py-1.5 items-center group hover:bg-midi-border/30 transition-colors ${getEventTypeBgColor(event.event_type)} animate-fade-in cursor-pointer`}
                style={{ opacity: 1 - (index / filteredEvents.length) * 0.3 }}
                onClick={() => copyToClipboard(JSON.stringify(event, null, 2))}
                title="点击复制详细信息"
              >
                <div className="col-span-2 text-gray-500 truncate">
                  {formatTimestampWithMs(event.timestamp)}
                </div>
                <div className="col-span-2 text-gray-400 truncate" title={event.device_name}>
                  {event.device_name}
                </div>
                <div className="col-span-1 text-gray-500">
                  CH{String(event.channel).padStart(2, "0")}
                </div>
                <div className={`col-span-2 truncate ${getEventTypeColor(event.event_type)}`}>
                  {getEventTypeLabel(event.event_type)}
                </div>
                <div className="col-span-3 text-gray-300 truncate">
                  {formatEventDetails(event)}
                </div>
                <div className="col-span-1 text-gray-200 text-right font-medium">
                  {formatValue(event)}
                </div>
                <div className={`col-span-1 text-right font-mono ${
                  event.latency_ms !== null ? getLatencyColor(event.latency_ms) : "text-gray-600"
                }`}>
                  {event.latency_ms !== null ? `${event.latency_ms}ms` : "-"}
                </div>
                <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-600">
                  📋
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {filteredEvents.length > 0 && (
        <div className="px-2 py-1 border-t border-midi-border bg-midi-dark/30 flex justify-between text-xs text-gray-500">
          <span>
            最新事件: {formatEventDetails(filteredEvents[filteredEvents.length - 1])}
          </span>
          <span className={getLatencyColor(filteredEvents[filteredEvents.length - 1].latency_ms ?? 0)}>
            {filteredEvents[filteredEvents.length - 1].latency_ms !== null
              ? `延迟: ${filteredEvents[filteredEvents.length - 1].latency_ms}ms`
              : ""}
          </span>
        </div>
      )}
    </div>
  );
};
