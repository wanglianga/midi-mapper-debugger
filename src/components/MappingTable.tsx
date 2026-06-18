import React, { useState } from "react";
import {
  MidiMapping,
  MidiDevice,
  MidiEventType,
  noteToName,
  getEventTypeColor,
  getEventTypeLabel,
  formatTimestamp,
} from "../types";
import { addMapping, updateMapping, deleteMapping } from "../api";

interface MappingTableProps {
  mappings: MidiMapping[];
  devices: MidiDevice[];
  learningMode: boolean;
  learningEvent: {
    device_id: string;
    event_type: MidiEventType;
    channel: number;
    note: number | null;
    cc_number: number | null;
  } | null;
  onClearLearning: () => void;
  onMappingChange?: () => void;
}

export const MappingTable: React.FC<MappingTableProps> = ({
  mappings,
  devices,
  learningMode,
  learningEvent,
  onClearLearning,
  onMappingChange,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState<MidiMapping | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    device_id: "",
    event_type: "note_on" as MidiEventType,
    channel: null as number | null,
    note: null as number | null,
    cc_number: null as number | null,
    target_parameter: "",
    target_software: "",
    target_min: 0,
    target_max: 127,
  });

  const openModal = (mapping?: MidiMapping) => {
    if (mapping) {
      setEditingMapping(mapping);
      setFormData({
        name: mapping.name,
        description: mapping.description || "",
        device_id: mapping.device_id,
        event_type: mapping.event_type,
        channel: mapping.channel,
        note: mapping.note,
        cc_number: mapping.cc_number,
        target_parameter: mapping.target.parameter_name,
        target_software: mapping.target.software,
        target_min: mapping.target.min_value,
        target_max: mapping.target.max_value,
      });
    } else {
      setEditingMapping(null);
      if (learningEvent) {
        setFormData({
          ...formData,
          device_id: learningEvent.device_id,
          event_type: learningEvent.event_type,
          channel: learningEvent.channel,
          note: learningEvent.note,
          cc_number: learningEvent.cc_number,
        });
      }
    }
    setError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    onClearLearning();
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError("请输入映射名称");
      return;
    }
    if (!formData.device_id) {
      setError("请选择设备");
      return;
    }
    if (!formData.target_parameter.trim()) {
      setError("请输入目标参数名称");
      return;
    }

    try {
      const mappingData = {
        name: formData.name,
        description: formData.description || null,
        device_id: formData.device_id,
        event_type: formData.event_type,
        channel: formData.channel,
        note: formData.note,
        cc_number: formData.cc_number,
        target: {
          parameter_name: formData.target_parameter,
          software: formData.target_software || "通用",
          min_value: formData.target_min,
          max_value: formData.target_max,
          current_value: null,
        },
      };

      if (editingMapping) {
        await updateMapping({
          ...editingMapping,
          ...mappingData,
          target: mappingData.target,
        });
      } else {
        await addMapping(mappingData);
      }

      closeModal();
      onMappingChange?.();
    } catch (e) {
      setError(`保存失败: ${e}`);
      console.error("保存映射失败:", e);
    }
  };

  const handleDelete = async (mapping: MidiMapping) => {
    if (confirm(`确定要删除映射 "${mapping.name}" 吗？`)) {
      try {
        await deleteMapping(mapping.id);
        onMappingChange?.();
      } catch (e) {
        console.error("删除映射失败:", e);
      }
    }
  };

  const applyLearning = () => {
    if (learningEvent) {
      openModal();
    }
  };

  const getDeviceName = (deviceId: string) => {
    return devices.find((d) => d.id === deviceId)?.name || deviceId;
  };

  const formatMappingSource = (mapping: MidiMapping) => {
    const parts: string[] = [];
    parts.push(getEventTypeLabel(mapping.event_type));
    
    if (mapping.channel !== null) {
      parts.push(`CH${mapping.channel}`);
    }
    
    if (mapping.note !== null) {
      parts.push(`${noteToName(mapping.note)} (${mapping.note})`);
    }
    
    if (mapping.cc_number !== null) {
      parts.push(`CC${mapping.cc_number}`);
    }
    
    return parts.join(" · ");
  };

  const inputDevices = devices.filter((d) => d.is_input);

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <h2 className="panel-title">
          映射表
          <span className="ml-2 text-xs text-gray-500">({mappings.length})</span>
        </h2>
        <div className="flex gap-2">
          {learningMode && (
            <button
              className="btn-success text-xs animate-pulse"
              onClick={applyLearning}
              disabled={!learningEvent}
            >
              🎯 创建映射
            </button>
          )}
          <button className="btn-primary text-xs" onClick={() => openModal()}>
            ➕ 新建
          </button>
        </div>
      </div>

      {learningMode && learningEvent && (
        <div className="px-4 py-2 bg-green-500/20 border-b border-green-500/50 flex items-center justify-between">
          <div className="text-sm text-green-400">
            ✨ 已捕获 MIDI 信号: {formatMappingSource({ ...learningEvent, id: "", name: "", description: "", device_id: learningEvent.device_id, target: { parameter_name: "", software: "", min_value: 0, max_value: 0, current_value: null }, created_at: "", updated_at: "" })}
          </div>
          <button className="btn-ghost text-xs" onClick={onClearLearning}>
            清除
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto scrollbar-thin">
        {error && (
          <div className="p-2 bg-red-500/20 border border-red-500/50 text-xs text-red-400 m-2 rounded">
            {error}
          </div>
        )}

        {mappings.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-2">🔗</div>
            <div>暂无映射配置</div>
            <div className="text-xs mt-1">
              {learningMode
                ? "操作 MIDI 设备捕获信号，然后点击创建映射"
                : "点击新建或启用学习模式来创建映射"}
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-midi-dark/50 sticky top-0">
              <tr>
                <th className="table-header">名称</th>
                <th className="table-header">设备</th>
                <th className="table-header">信号源</th>
                <th className="table-header">目标参数</th>
                <th className="table-header">软件</th>
                <th className="table-header">范围</th>
                <th className="table-header">更新时间</th>
                <th className="table-header text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr key={mapping.id} className="table-row">
                  <td className="table-cell font-medium">{mapping.name}</td>
                  <td className="table-cell text-gray-400">{getDeviceName(mapping.device_id)}</td>
                  <td className={`table-cell ${getEventTypeColor(mapping.event_type)}`}>
                    {formatMappingSource(mapping)}
                  </td>
                  <td className="table-cell">{mapping.target.parameter_name}</td>
                  <td className="table-cell text-gray-400">{mapping.target.software}</td>
                  <td className="table-cell text-gray-400">
                    {mapping.target.min_value} - {mapping.target.max_value}
                  </td>
                  <td className="table-cell text-gray-500 text-xs">
                    {formatTimestamp(mapping.updated_at)}
                  </td>
                  <td className="table-cell text-right">
                    <button
                      className="btn-ghost text-xs mr-1"
                      onClick={() => openModal(mapping)}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-ghost text-xs text-red-400"
                      onClick={() => handleDelete(mapping)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="panel w-full max-w-lg mx-4 animate-fade-in">
            <div className="panel-header">
              <h3 className="panel-title">
                {editingMapping ? "编辑映射" : "新建映射"}
              </h3>
              <button className="btn-ghost text-xs" onClick={closeModal}>
                ✕
              </button>
            </div>
            <div className="panel-content space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
              <div>
                <label className="label">映射名称 *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如: 音量推子"
                />
              </div>

              <div>
                <label className="label">描述</label>
                <textarea
                  className="input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="可选描述"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">设备 *</label>
                  <select
                    className="select"
                    value={formData.device_id}
                    onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                  >
                    <option value="">选择设备</option>
                    {inputDevices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">事件类型 *</label>
                  <select
                    className="select"
                    value={formData.event_type}
                    onChange={(e) =>
                      setFormData({ ...formData, event_type: e.target.value as MidiEventType })
                    }
                  >
                    <option value="note_on">Note On</option>
                    <option value="note_off">Note Off</option>
                    <option value="control_change">Control Change</option>
                    <option value="program_change">Program Change</option>
                    <option value="pitch_bend">Pitch Bend</option>
                    <option value="aftertouch">Aftertouch</option>
                    <option value="channel_pressure">Channel Pressure</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">MIDI 通道</label>
                  <select
                    className="select"
                    value={formData.channel ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        channel: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                  >
                    <option value="">任意</option>
                    {Array.from({ length: 16 }, (_, i) => i).map((ch) => (
                      <option key={ch} value={ch}>
                        CH{ch}
                      </option>
                    ))}
                  </select>
                </div>

                {(formData.event_type === "note_on" ||
                  formData.event_type === "note_off" ||
                  formData.event_type === "aftertouch") && (
                  <div>
                    <label className="label">音符</label>
                    <input
                      type="number"
                      className="input"
                      min={0}
                      max={127}
                      value={formData.note ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          note: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      placeholder="0-127"
                    />
                  </div>
                )}

                {formData.event_type === "control_change" && (
                  <div>
                    <label className="label">CC 编号</label>
                    <input
                      type="number"
                      className="input"
                      min={0}
                      max={127}
                      value={formData.cc_number ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cc_number: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      placeholder="0-127"
                    />
                  </div>
                )}
              </div>

              <div className="border-t border-midi-border pt-4">
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">
                  目标设置
                </div>
                <div>
                  <label className="label">目标参数 *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.target_parameter}
                    onChange={(e) =>
                      setFormData({ ...formData, target_parameter: e.target.value })
                    }
                    placeholder="例如: Master Volume"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="label">软件</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.target_software}
                      onChange={(e) =>
                        setFormData({ ...formData, target_software: e.target.value })
                      }
                      placeholder="例如: Ableton Live"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="label">最小值</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.target_min}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          target_min: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">最大值</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.target_max}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          target_max: parseFloat(e.target.value) || 127,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-midi-border flex justify-end gap-2">
              <button className="btn-secondary" onClick={closeModal}>
                取消
              </button>
              <button className="btn-primary" onClick={handleSubmit}>
                {editingMapping ? "保存修改" : "创建映射"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
