import React from "react";
import {
  DeviceConflict,
  getSeverityColor,
  getSeverityBgColor,
  formatTimestamp,
} from "../types";
import { clearConflicts } from "../api";

interface ConflictAlertsProps {
  conflicts: DeviceConflict[];
  onClear?: () => void;
}

export const ConflictAlerts: React.FC<ConflictAlertsProps> = ({
  conflicts,
  onClear,
}) => {
  const handleClear = async () => {
    await clearConflicts();
    onClear?.();
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return "🚨";
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      default:
        return "ℹ️";
    }
  };

  const criticalCount = conflicts.filter((c) => c.severity === "critical").length;
  const errorCount = conflicts.filter((c) => c.severity === "error").length;
  const warningCount = conflicts.filter((c) => c.severity === "warning").length;

  if (conflicts.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">冲突提示</h2>
          <span className="text-xs text-gray-500">({conflicts.length})</span>
        </div>
        <div className="panel-content text-center py-6 text-gray-500">
          <div className="text-2xl mb-2">✅</div>
          <div>暂无冲突</div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">
          冲突提示
          <span className="ml-2 text-xs text-gray-500">({conflicts.length})</span>
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex gap-2 text-xs">
            {criticalCount > 0 && (
              <span className="text-red-500">🚨 {criticalCount}</span>
            )}
            {errorCount > 0 && (
              <span className="text-red-400">❌ {errorCount}</span>
            )}
            {warningCount > 0 && (
              <span className="text-yellow-400">⚠️ {warningCount}</span>
            )}
          </div>
          <button className="btn-ghost text-xs" onClick={handleClear}>
            清除
          </button>
        </div>
      </div>
      <div className="panel-content space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
        {conflicts.map((conflict) => (
          <div
            key={conflict.id}
            className={`p-3 rounded-lg border ${getSeverityBgColor(conflict.severity)} animate-slide-in`}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg">{getSeverityIcon(conflict.severity)}</span>
              <div className="flex-1 min-w-0">
                <div className={`font-medium ${getSeverityColor(conflict.severity)}`}>
                  {conflict.message}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                  <span>{formatTimestamp(conflict.timestamp)}</span>
                  {conflict.involved_devices.length > 0 && (
                    <span>
                      设备: {conflict.involved_devices.join(", ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
