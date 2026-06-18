import { useState } from "react";
import {
  MidiDevice,
  getDeviceTypeLabel,
  getDeviceTypeIcon,
  formatTimestamp,
} from "../types";
import {
  connectInput,
  disconnectInput,
  connectOutput,
  disconnectOutput,
} from "../api";

interface DeviceListProps {
  inputDevices: MidiDevice[];
  outputDevices: MidiDevice[];
  onDeviceStateChange?: () => void;
  isScanning: boolean;
  onScan: () => void;
}

export const DeviceList: React.FC<DeviceListProps> = ({
  inputDevices,
  outputDevices,
  onDeviceStateChange,
  isScanning,
  onScan,
}) => {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnectInput = async (device: MidiDevice) => {
    if (device.is_active) {
      return;
    }
    setConnecting(device.id);
    setError(null);
    try {
      if (device.is_active) {
        await disconnectInput(device.id);
      } else {
        await connectInput(device.id);
      }
      onDeviceStateChange?.();
    } catch (e) {
      setError(`连接失败: ${e}`);
      console.error("连接设备失败:", e);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnectInput = async (device: MidiDevice) => {
    setConnecting(device.id);
    setError(null);
    try {
      await disconnectInput(device.id);
      onDeviceStateChange?.();
    } catch (e) {
      setError(`断开失败: ${e}`);
      console.error("断开设备失败:", e);
    } finally {
      setConnecting(null);
    }
  };

  const handleConnectOutput = async (device: MidiDevice) => {
    setConnecting(device.id);
    setError(null);
    try {
      if (device.is_active) {
        await disconnectOutput(device.id);
      } else {
        await connectOutput(device.id);
      }
      onDeviceStateChange?.();
    } catch (e) {
      setError(`连接失败: ${e}`);
      console.error("连接设备失败:", e);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnectOutput = async (device: MidiDevice) => {
    setConnecting(device.id);
    setError(null);
    try {
      await disconnectOutput(device.id);
      onDeviceStateChange?.();
    } catch (e) {
      setError(`断开失败: ${e}`);
      console.error("断开设备失败:", e);
    } finally {
      setConnecting(null);
    }
  };

  const DeviceCard: React.FC<{
    device: MidiDevice;
    onConnect: () => void;
    onDisconnect: () => void;
  }> = ({ device, onConnect, onDisconnect }) => (
    <div
      className={`p-3 rounded-lg border transition-all ${
        device.is_connected
          ? "bg-midi-dark/50 border-midi-border"
          : "bg-midi-dark/20 border-midi-border/50 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">{getDeviceTypeIcon(device.device_type)}</span>
          <div className="min-w-0">
            <div className="font-medium text-gray-100 truncate" title={device.name}>
              {device.name}
            </div>
            <div className="text-xs text-gray-500">
              {getDeviceTypeLabel(device.device_type)} · Port {device.port}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {device.is_connected ? (
            <span className="status-online" title="已连接" />
          ) : (
            <span className="status-offline" title="已断开" />
          )}
          {device.is_active && (
            <span className="status-active" title="活跃中" />
          )}
        </div>
      </div>

      {device.manufacturer && (
        <div className="mt-2 text-xs text-gray-500">
          厂商: {device.manufacturer}
        </div>
      )}

      <div className="mt-2 text-xs text-gray-600">
        最后出现: {formatTimestamp(device.last_seen)}
      </div>

      <div className="mt-3 flex gap-2">
        {device.is_connected && (
          device.is_active ? (
            <button
              className="btn-danger text-xs flex-1"
              onClick={onDisconnect}
              disabled={connecting === device.id}
            >
              {connecting === device.id ? "处理中..." : "断开"}
            </button>
          ) : (
            <button
              className="btn-success text-xs flex-1"
              onClick={onConnect}
              disabled={connecting === device.id}
            >
              {connecting === device.id ? "连接中..." : "连接"}
            </button>
          )
        )}
      </div>

      {!device.is_connected && (
        <div className="mt-2 text-xs text-red-400">
          ⚠️ 设备已断开，请检查连接
        </div>
      )}
    </div>
  );

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <h2 className="panel-title">MIDI 设备</h2>
        <button
          className="btn-ghost text-xs"
          onClick={onScan}
          disabled={isScanning}
        >
          {isScanning ? (
            <span className="flex items-center gap-1">
              <span className="animate-spin">⟳</span> 扫描中
            </span>
          ) : (
            "🔄 扫描"
          )}
        </button>
      </div>

      <div className="panel-content flex-1 overflow-y-auto scrollbar-thin space-y-4">
        {error && (
          <div className="p-2 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-400">
            {error}
          </div>
        )}

        <div>
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
            <span className="status-online" />
            输入设备 ({inputDevices.length})
          </div>
          <div className="space-y-2">
            {inputDevices.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                未检测到输入设备
              </div>
            ) : (
              inputDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onConnect={() => handleConnectInput(device)}
                  onDisconnect={() => handleDisconnectInput(device)}
                />
              ))
            )}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
            <span className="status-online" />
            输出设备 ({outputDevices.length})
          </div>
          <div className="space-y-2">
            {outputDevices.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                未检测到输出设备
              </div>
            ) : (
              outputDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onConnect={() => handleConnectOutput(device)}
                  onDisconnect={() => handleDisconnectOutput(device)}
                />
              ))
            )}
          </div>
        </div>

        {inputDevices.length === 0 && outputDevices.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🎹</div>
            <div>请连接 MIDI 设备并点击扫描</div>
          </div>
        )}
      </div>
    </div>
  );
};
