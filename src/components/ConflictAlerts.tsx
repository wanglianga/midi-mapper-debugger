import React, { useState } from "react";
import {
  DeviceConflict,
  MidiMapping,
  getSeverityColor,
  getSeverityBgColor,
  formatTimestamp,
  ConflictType,
  ConflictResolution,
} from "../types";
import { clearConflicts, resolveConflict, savePreset } from "../api";

interface ConflictAlertsProps {
  conflicts: DeviceConflict[];
  mappings: MidiMapping[];
  onClear?: () => void;
  onResolve?: () => void;
}

export const ConflictAlerts: React.FC<ConflictAlertsProps> = ({
  conflicts,
  mappings,
  onClear,
  onResolve,
}) => {
  const [resolvingConflict, setResolvingConflict] = useState<string | null>(null);
  const [selectedMapping, setSelectedMapping] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [showPresetDialog, setShowPresetDialog] = useState(false);

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

  const getConflictTypeLabel = (type: ConflictType) => {
    const labels: Record<ConflictType, string> = {
      duplicate_control: "🎛️ 控件重复绑定",
      duplicate_target: "🎯 目标参数重复",
      feedback_loop: "🔄 输入输出回环",
      channel_conflict: "📡 通道冲突",
      device_conflict: "🔌 设备冲突",
    };
    return labels[type] || type;
  };

  const getResolutionLabel = (resolution: ConflictResolution) => {
    const labels: Record<ConflictResolution, string> = {
      keep: "✅ 保留两者",
      replace: "🔄 替换",
      disable: "⏸️ 禁用",
      save_as_preset: "💾 另存为预设",
    };
    return labels[resolution] || resolution;
  };

  const getMappingName = (mappingId: string) => {
    return mappings.find((m) => m.id === mappingId)?.name || mappingId;
  };

  const handleResolve = async (
    conflictId: string,
    resolution: ConflictResolution,
    targetMappingId?: string
  ) => {
    if (resolution === "save_as_preset") {
      setResolvingConflict(conflictId);
      setShowPresetDialog(true);
      return;
    }

    try {
      await resolveConflict(conflictId, resolution, targetMappingId);
      onResolve?.();
    } catch (e) {
      console.error("解决冲突失败:", e);
    } finally {
      setResolvingConflict(null);
      setSelectedMapping(null);
    }
  };

  const handleSaveAsPreset = async () => {
    if (!presetName.trim() || !resolvingConflict) return;

    try {
      await savePreset(presetName.trim(), "冲突解决时自动保存的预设");
      await resolveConflict(resolvingConflict, "save_as_preset");
      onResolve?.();
    } catch (e) {
      console.error("保存预设失败:", e);
    } finally {
      setShowPresetDialog(false);
      setPresetName("");
      setResolvingConflict(null);
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
          <div className="text-xs mt-1">
            系统会自动检测控件重复绑定、目标参数重复和输入输出回环
          </div>
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
            清除全部
          </button>
        </div>
      </div>
      <div className="panel-content space-y-3 max-h-80 overflow-y-auto scrollbar-thin">
        {conflicts.map((conflict) => (
          <div
            key={conflict.id}
            className={`p-3 rounded-lg border ${getSeverityBgColor(conflict.severity)} animate-slide-in`}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg">{getSeverityIcon(conflict.severity)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${getSeverityBgColor(conflict.severity)}`}>
                    {getConflictTypeLabel(conflict.conflict_type)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(conflict.timestamp)}
                  </span>
                </div>
                <div className={`font-medium ${getSeverityColor(conflict.severity)}`}>
                  {conflict.message}
                </div>
                
                {conflict.involved_mappings.length > 0 && (
                  <div className="mt-2 text-xs text-gray-400">
                    <span className="text-gray-500">涉及映射: </span>
                    {conflict.involved_mappings.map((id, idx) => (
                      <span key={id} className="inline-flex items-center">
                        <span className="px-1.5 py-0.5 bg-midi-border rounded text-gray-300">
                          {getMappingName(id)}
                        </span>
                        {idx < conflict.involved_mappings.length - 1 && (
                          <span className="mx-1 text-gray-600">↔️</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {resolvingConflict === conflict.id ? (
                  <div className="mt-3 space-y-2">
                    {conflict.involved_mappings.length > 1 && (
                      <div className="text-xs text-gray-400">
                        选择要保留的映射:
                        <div className="flex flex-wrap gap-2 mt-1">
                          {conflict.involved_mappings.map((id) => (
                            <button
                              key={id}
                              className={`px-2 py-1 rounded text-xs transition-colors ${
                                selectedMapping === id
                                  ? "bg-midi-accent text-white"
                                  : "bg-midi-border text-gray-300 hover:bg-midi-border/80"
                              }`}
                              onClick={() => setSelectedMapping(id)}
                            >
                              {getMappingName(id)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {conflict.resolution_options.map((option) => (
                        <button
                          key={option}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                            option === "replace" || option === "disable"
                              ? !selectedMapping
                                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                                : option === "replace"
                                ? "bg-blue-600 hover:bg-blue-500 text-white"
                                : "bg-yellow-600 hover:bg-yellow-500 text-white"
                              : option === "keep"
                              ? "bg-green-600 hover:bg-green-500 text-white"
                              : "bg-purple-600 hover:bg-purple-500 text-white"
                          }`}
                          disabled={
                            (option === "replace" || option === "disable") &&
                            !selectedMapping
                          }
                          onClick={() =>
                            handleResolve(
                              conflict.id,
                              option,
                              option === "replace" || option === "disable"
                                ? selectedMapping || undefined
                                : undefined
                            )
                          }
                        >
                          {getResolutionLabel(option)}
                        </button>
                      ))}
                      <button
                        className="px-3 py-1.5 rounded text-xs font-medium bg-gray-600 hover:bg-gray-500 text-white transition-colors"
                        onClick={() => {
                          setResolvingConflict(null);
                          setSelectedMapping(null);
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="px-2 py-1 rounded text-xs font-medium bg-midi-accent/20 text-midi-accent hover:bg-midi-accent/30 transition-colors"
                      onClick={() => {
                        setResolvingConflict(conflict.id);
                        setSelectedMapping(null);
                      }}
                    >
                      ⚙️ 解决冲突
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showPresetDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="panel w-full max-w-md mx-4 animate-fade-in">
            <div className="panel-header">
              <h3 className="panel-title">另存为新预设</h3>
              <button
                className="btn-ghost text-xs"
                onClick={() => {
                  setShowPresetDialog(false);
                  setPresetName("");
                  setResolvingConflict(null);
                }}
              >
                ✕
              </button>
            </div>
            <div className="panel-content space-y-4">
              <div>
                <label className="label">预设名称 *</label>
                <input
                  type="text"
                  className="input"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="例如: 演出配置 v2"
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-500">
                当前所有映射配置将被保存为新预设，然后解决此冲突。
              </p>
            </div>
            <div className="p-4 border-t border-midi-border flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowPresetDialog(false);
                  setPresetName("");
                  setResolvingConflict(null);
                }}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveAsPreset}
                disabled={!presetName.trim()}
              >
                保存并解决
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
