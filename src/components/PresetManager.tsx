import React, { useState } from "react";
import { MappingPreset, formatTimestamp } from "../types";
import {
  savePreset,
  loadPreset,
  deletePreset,
  exportPreset,
  importPresetFromFile,
  exportAllConfig,
  getDataDirectories,
} from "../api";
import { open, save } from "@tauri-apps/api/dialog";
import { writeTextFile } from "@tauri-apps/api/fs";

interface PresetManagerProps {
  presets: MappingPreset[];
  currentPreset: MappingPreset | null;
  mappingsCount: number;
  onPresetChange?: () => void;
}

export const PresetManager: React.FC<PresetManagerProps> = ({
  presets,
  currentPreset,
  mappingsCount,
  onPresetChange,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetDescription, setPresetDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [directories, setDirectories] = useState<any>(null);

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      setError("请输入预设名称");
      return;
    }

    try {
      await savePreset(presetName, presetDescription || undefined);
      setShowSaveModal(false);
      setPresetName("");
      setPresetDescription("");
      onPresetChange?.();
    } catch (e) {
      setError(`保存失败: ${e}`);
      console.error("保存预设失败:", e);
    }
  };

  const handleLoadPreset = async (preset: MappingPreset) => {
    if (confirm(`确定要加载预设 "${preset.name}" 吗？当前映射将被替换。`)) {
      try {
        await loadPreset(preset.id);
        onPresetChange?.();
      } catch (e) {
        console.error("加载预设失败:", e);
      }
    }
  };

  const handleDeletePreset = async (preset: MappingPreset) => {
    if (confirm(`确定要删除预设 "${preset.name}" 吗？此操作不可撤销。`)) {
      try {
        await deletePreset(preset.id);
        onPresetChange?.();
      } catch (e) {
        console.error("删除预设失败:", e);
      }
    }
  };

  const handleExportPreset = async (preset: MappingPreset) => {
    try {
      const json = await exportPreset(preset.id);
      const filePath = await save({
        defaultPath: `${preset.name}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (filePath) {
        await writeTextFile(filePath as string, json);
      }
    } catch (e) {
      console.error("导出预设失败:", e);
    }
  };

  const handleImportPreset = async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (filePath) {
        await importPresetFromFile(filePath as string);
        onPresetChange?.();
      }
    } catch (e) {
      console.error("导入预设失败:", e);
    }
  };

  const handleExportAll = async () => {
    try {
      const path = await exportAllConfig();
      alert(`配置已导出到: ${path}`);
    } catch (e) {
      console.error("导出配置失败:", e);
    }
  };

  const handleShowDirectories = async () => {
    try {
      const dirs = await getDataDirectories();
      setDirectories(dirs);
      setShowModal(true);
    } catch (e) {
      console.error("获取目录失败:", e);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">
          预设管理
          <span className="ml-2 text-xs text-gray-500">({presets.length})</span>
        </h2>
        <div className="flex gap-2">
          <button
            className="btn-ghost text-xs"
            onClick={handleShowDirectories}
            title="查看数据目录"
          >
            📁
          </button>
          <button
            className="btn-ghost text-xs"
            onClick={handleImportPreset}
            title="导入预设"
          >
            📥 导入
          </button>
          <button
            className="btn-ghost text-xs"
            onClick={handleExportAll}
            title="导出全部配置"
          >
            📤 全部导出
          </button>
          <button
            className="btn-primary text-xs"
            onClick={() => {
              setShowSaveModal(true);
              setError(null);
            }}
            disabled={mappingsCount === 0}
          >
            💾 保存预设
          </button>
        </div>
      </div>

      <div className="panel-content">
        {currentPreset && (
          <div className="mb-4 p-3 bg-midi-accent/20 border border-midi-accent/50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-midi-accent">🎯</span>
              <div>
                <div className="text-sm font-medium text-midi-accent">
                  当前预设: {currentPreset.name}
                </div>
                <div className="text-xs text-gray-400">
                  {currentPreset.mappings.length} 个映射
                </div>
              </div>
            </div>
          </div>
        )}

        {presets.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-3xl mb-2">📦</div>
            <div>暂无预设</div>
            <div className="text-xs mt-1">
              {mappingsCount > 0
                ? "点击保存预设来保存当前映射配置"
                : "请先创建映射配置"}
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className={`p-3 rounded-lg border transition-colors ${
                  currentPreset?.id === preset.id
                    ? "bg-midi-accent/10 border-midi-accent/50"
                    : "bg-midi-dark/50 border-midi-border hover:border-midi-border/80"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {currentPreset?.id === preset.id && (
                        <span className="text-midi-accent text-xs">●</span>
                      )}
                      <span className="font-medium text-gray-100 truncate">
                        {preset.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({preset.mappings.length} 个映射)
                      </span>
                    </div>
                    {preset.description && (
                      <div className="text-xs text-gray-500 mt-1 truncate">
                        {preset.description}
                      </div>
                    )}
                    <div className="text-xs text-gray-600 mt-1">
                      更新于 {formatTimestamp(preset.updated_at)}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {currentPreset?.id !== preset.id && (
                      <button
                        className="btn-ghost text-xs px-2 py-1"
                        onClick={() => handleLoadPreset(preset)}
                        title="加载预设"
                      >
                        📂
                      </button>
                    )}
                    <button
                      className="btn-ghost text-xs px-2 py-1"
                      onClick={() => handleExportPreset(preset)}
                      title="导出预设"
                    >
                      📤
                    </button>
                    <button
                      className="btn-ghost text-xs px-2 py-1 text-red-400"
                      onClick={() => handleDeletePreset(preset)}
                      title="删除预设"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="panel w-full max-w-md mx-4 animate-fade-in">
            <div className="panel-header">
              <h3 className="panel-title">保存预设</h3>
              <button
                className="btn-ghost text-xs"
                onClick={() => setShowSaveModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="panel-content space-y-4">
              {error && (
                <div className="p-2 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-400">
                  {error}
                </div>
              )}
              <div>
                <label className="label">预设名称 *</label>
                <input
                  type="text"
                  className="input"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="例如: 现场演出配置"
                />
              </div>
              <div>
                <label className="label">描述</label>
                <textarea
                  className="input"
                  value={presetDescription}
                  onChange={(e) => setPresetDescription(e.target.value)}
                  placeholder="可选描述信息"
                  rows={3}
                />
              </div>
              <div className="text-xs text-gray-500">
                将保存当前 {mappingsCount} 个映射配置
              </div>
            </div>
            <div className="p-4 border-t border-midi-border flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() => setShowSaveModal(false)}
              >
                取消
              </button>
              <button className="btn-primary" onClick={handleSavePreset}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && directories && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="panel w-full max-w-lg mx-4 animate-fade-in">
            <div className="panel-header">
              <h3 className="panel-title">数据目录</h3>
              <button
                className="btn-ghost text-xs"
                onClick={() => {
                  setShowModal(false);
                  setDirectories(null);
                }}
              >
                ✕
              </button>
            </div>
            <div className="panel-content space-y-3">
              {Object.entries(directories).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-gray-400 text-xs w-24 flex-shrink-0 pt-1">
                    {key}:
                  </span>
                  <code className="flex-1 text-xs bg-midi-dark p-2 rounded overflow-x-auto">
                    {value as string}
                  </code>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-midi-border flex justify-end">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowModal(false);
                  setDirectories(null);
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
