import React from "react";
import { AppConfig } from "../types";

interface HeaderProps {
  learningMode: boolean;
  onToggleLearning: () => void;
  isScanning: boolean;
  onScan: () => void;
  config: AppConfig | null;
  onToggleAutoScan: () => void;
  deviceStats: {
    inputs: number;
    outputs: number;
    active: number;
  };
  eventStats: {
    total: number;
    rate: number;
  };
}

export const Header: React.FC<HeaderProps> = ({
  learningMode,
  onToggleLearning,
  isScanning,
  onScan,
  config,
  onToggleAutoScan,
  deviceStats,
  eventStats,
}) => {
  return (
    <header className="bg-midi-panel border-b border-midi-border px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎹</span>
            <div>
              <h1 className="text-xl font-bold text-gray-100">MIDI Mapper Debugger</h1>
              <div className="text-xs text-gray-500">MIDI 设备映射调试工具</div>
            </div>
          </div>

          <div className="h-8 w-px bg-midi-border mx-2" />

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <span className="status-online" title="输入设备" />
              <span>{deviceStats.inputs} 输入</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <span className="status-online" title="输出设备" />
              <span>{deviceStats.outputs} 输出</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <span
                className={deviceStats.active > 0 ? "status-active" : "status-offline"}
                title="活跃连接"
              />
              <span>{deviceStats.active} 活跃</span>
            </div>
            <div className="text-gray-500">|</div>
            <div className="text-gray-400">
              事件: <span className="text-gray-200">{eventStats.total}</span>
            </div>
            {eventStats.rate > 0 && (
              <div className="text-gray-400">
                速率: <span className="text-green-400">{eventStats.rate.toFixed(1)}/s</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {learningMode && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/50 rounded-full animate-pulse">
              <span className="status-active" />
              <span className="text-xs text-green-400 font-medium">
                学习模式
              </span>
            </div>
          )}

          <button
            className={`text-xs font-medium transition-all ${
              learningMode
                ? "btn-danger"
                : "btn-success"
            }`}
            onClick={onToggleLearning}
          >
            {learningMode ? "⏹ 停止学习" : "🎯 学习模式"}
          </button>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={config?.auto_scan ?? true}
                onChange={onToggleAutoScan}
                className="rounded bg-midi-dark border-midi-border text-midi-accent focus:ring-midi-accent"
              />
              自动扫描
            </label>
          </div>

          <button
            className="btn-secondary text-xs"
            onClick={onScan}
            disabled={isScanning}
          >
            {isScanning ? (
              <span className="flex items-center gap-1">
                <span className="animate-spin">⟳</span> 扫描中
              </span>
            ) : (
              "🔄 扫描设备"
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
