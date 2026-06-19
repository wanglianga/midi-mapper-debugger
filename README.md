# MIDI 设备映射调试工具

一款基于 Tauri 的跨平台桌面应用，专为音乐制作人、现场调音师和硬件玩家设计，用于调试 MIDI 键盘、控制器、打击垫和合成器。

## 功能特性

- **设备扫描**：自动检测本机所有 MIDI 输入输出设备
- **实时监控**：实时显示按键、旋钮、推子、力度、通道、CC 编号和延迟
- **连接状态**：实时监控设备连接状态，支持热插拔检测和自动恢复
- **映射管理**：建立实体控件到软件参数的映射表，支持学习模式
- **预设管理**：保存和加载映射预设，支持导出和导入 JSON 配置
- **可视化仪表**：钢琴键盘、CC 值仪表、弯音轮、通道压力可视化
- **事件日志**：详细记录所有 MIDI 事件，支持搜索和过滤
- **冲突检测**：自动检测映射冲突，分级提示警告
- **稳定可靠**：拔插设备、重命名端口或缺少驱动时不会崩溃

## 原始需求

> 请实现 MIDI 设备映射调试工具，Tauri 应用给音乐制作人、现场调音师和硬件玩家调试键盘、控制器、打击垫和合成器。工具扫描本机 MIDI 输入输出设备，实时显示按键、旋钮、推子、力度、通道、CC 编号、延迟和设备连接状态；用户建立映射表，把实体控件绑定到软件参数，保存预设、导出配置并在热插拔后恢复。界面需要事件日志、可视化仪表、冲突提示和本地文件管理，拔插设备、重命名端口或缺少驱动时不能让应用崩溃。
> 扩展实时事件监视：用户按键、转动旋钮、推动推子或踩踏板时，日志显示时间、通道、数值、设备名和延迟，面板同步高亮对应控件，方便调音师判断是硬件未发信号还是软件没接到。
> 扩展映射冲突处理：两个实体控件绑定同一参数、一个控件重复绑定多个参数或输入输出形成回环时，应用提示冲突来源，用户可选择保留、替换、禁用或另存为新预设。

## 技术栈

- **前端**：React 18 + TypeScript + Vite
- **样式**：Tailwind CSS 4
- **后端**：Rust + Tauri
- **MIDI**：midir (Rust MIDI 库)
- **异步**：Tokio 运行时
- **数据持久化**：本地 JSON 文件

## 启动方式

### 前置要求

- Node.js >= 20.x
- Rust >= 1.75.0
- 操作系统：Windows 10/11、macOS 10.15+、Linux

**Windows 额外要求：**
- WebView2 Runtime（Windows 11 已预装）
- Microsoft Visual C++ 2019 Build Tools

**macOS 额外要求：**
- Xcode Command Line Tools
- WebKit

**Linux 额外要求：**
```bash
sudo apt update && sudo apt install -y \
    libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libasound2-dev
```

### 启动步骤

#### 1. 安装依赖

```bash
npm install
```

#### 2. 生成图标

```bash
node scripts/generate-icons-simple.js
```

#### 3. 启动开发服务

```bash
npm run tauri dev
```

访问地址：应用将作为独立桌面窗口启动（开发模式下前端运行在 http://localhost:1420）

#### 4. 构建生产版本

```bash
npm run tauri build
```

构建完成后，安装包将位于 `src-tauri/target/release/bundle/` 目录。

### 开发模式单独启动前端

如果只需要开发前端 UI，可以单独启动 Vite 开发服务器：

```bash
npm run dev
```

访问地址：http://localhost:1420

## Docker 启动方式

### 前置要求

- Docker >= 20.10
- Docker Compose >= 2.0
- 宿主机需运行 X11 显示服务器（Linux）

### 重要说明

**⚠️ Docker 运行限制：**

由于 Tauri 是桌面应用，需要以下系统资源才能在 Docker 中正常运行：

1. **图形界面**：需要 X11 显示服务器转发
2. **MIDI 设备**：需要宿主机 MIDI 硬件设备映射
3. **音频设备**：需要 ALSA 音频设备访问
4. **权限**：需要特权模式访问硬件

**推荐使用方式：**
- ✅ 使用 Docker 作为构建环境验证编译
- ❌ 不推荐在 Docker 中直接运行 GUI 应用
- ✅ 推荐在宿主机直接运行开发版本

### Docker 构建验证

验证项目可以正常编译：

```bash
docker compose config
```

```bash
docker build -t midi-mapper-debugger .
```

### Docker 启动（仅限 Linux + X11）

如果您使用 Linux 并运行 X11，可以尝试以下方式启动：

```bash
xhost +local:docker
docker compose up --build
```

停止和清理：

```bash
docker compose down
```

**注意**：由于 MIDI 设备热插拔和 GUI 渲染的复杂性，Docker 启动可能无法访问所有 MIDI 设备功能。生产使用请直接在宿主机安装运行。

### 仅使用开发容器

如果只需要一个完整的 Rust + Node.js 开发环境，可以使用：

```bash
docker run -it --rm \
  -v $(pwd):/app \
  -w /app \
  --device /dev/snd \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  node:20-alpine3.18 \
  sh -c "apk add rust cargo && npm install && npm run build"
```

## 目录结构

```
.
├── src/                          # 前端源代码
│   ├── components/               # React 组件
│   │   ├── Header.tsx            # 顶部导航栏
│   │   ├── DeviceList.tsx        # 设备列表
│   │   ├── EventLog.tsx          # 事件日志
│   │   ├── Visualizer.tsx        # 可视化仪表
│   │   ├── MappingTable.tsx      # 映射表管理
│   │   ├── ConflictAlerts.tsx    # 冲突提示
│   │   └── PresetManager.tsx     # 预设管理
│   ├── types.ts                  # TypeScript 类型定义
│   ├── api.ts                    # API 调用层
│   ├── App.tsx                   # 主应用组件
│   ├── main.tsx                  # 入口文件
│   └── index.css                 # 全局样式
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── lib.rs                # 应用入口
│   │   ├── types.rs              # 数据类型定义
│   │   ├── midi_manager.rs       # MIDI 核心管理
│   │   ├── mapping_manager.rs    # 映射管理
│   │   ├── file_manager.rs       # 文件管理
│   │   ├── commands.rs           # IPC 命令
│   │   └── main.rs               # 二进制入口
│   ├── icons/                    # 应用图标
│   ├── Cargo.toml                # Rust 依赖
│   └── tauri.conf.json           # Tauri 配置
├── scripts/                      # 工具脚本
│   ├── generate-icons.js         # 图标生成脚本
│   └── generate-icons-simple.js  # 简化版图标生成
├── Dockerfile                    # Docker 构建配置
├── docker-compose.yml            # Docker Compose 配置
├── .dockerignore                 # Docker 忽略文件
├── package.json                  # Node.js 依赖
├── tailwind.config.js            # Tailwind 配置
├── tsconfig.json                 # TypeScript 配置
├── vite.config.ts                # Vite 配置
└── README.md                     # 本文件
```

## 数据存储位置

应用数据存储在系统标准目录：

- **Windows**：`%APPDATA%\midi-mapper-debugger\`
- **macOS**：`~/Library/Application Support/midi-mapper-debugger/`
- **Linux**：`~/.config/midi-mapper-debugger/`

存储内容：
- `config.json` - 应用配置
- `mappings.json` - 映射配置
- `presets.json` - 预设列表
- `events.log` - 事件日志

## 主要功能说明

### 设备扫描
应用启动时自动扫描 MIDI 设备，也可手动点击扫描按钮。支持自动扫描功能，定期检测设备变化。

### 学习模式
点击"学习模式"按钮后，操作 MIDI 设备上的控件，系统会自动捕获事件并填充映射表单。

### 映射冲突检测
系统自动检测以下冲突情况：
- 同一 MIDI 信号被多个映射使用
- 同一软件参数被绑定到多个控件
- 设备离线导致映射不可用

### 预设管理
- 保存当前映射为命名预设
- 快速切换不同场景的映射配置
- 导出单个预设或全部配置
- 从 JSON 文件导入预设

### 热插拔恢复
设备重新连接后，系统会自动：
1. 识别重新连接的设备
2. 恢复之前的映射配置
3. 标记未恢复的映射为待修复状态

## 注意事项

1. **驱动问题**：如果 MIDI 设备未显示，请确保已正确安装设备驱动
2. **权限问题**：Linux 下可能需要将用户加入 `audio` 组才能访问 MIDI 设备
3. **虚拟 MIDI 设备**：建议使用虚拟 MIDI 设备进行测试（如 loopMIDI、MIDI Yoke）
4. **性能考虑**：大量 MIDI 事件可能影响性能，可调整日志最大保存数量

## 已知限制

- Docker 容器中运行 GUI 应用需要额外的 X11 配置
- MIDI 设备热插拔在某些 Linux 发行版上可能需要 udev 规则
- Windows 上部分老旧 MIDI 设备可能需要第三方驱动

## 故障排除

### 设备未显示
1. 检查设备是否已连接并通电
2. 确认驱动程序已正确安装
3. 尝试重新扫描设备
4. 在其他 MIDI 软件中验证设备是否可用

### 应用崩溃
应用设计为在设备异常时不会崩溃。如果遇到崩溃，请：
1. 检查应用日志目录中的日志文件
2. 确认操作系统和驱动程序已更新
3. 提交 Issue 时附带日志文件

### 映射不生效
1. 检查设备是否处于连接状态
2. 确认 MIDI 通道和 CC 编号匹配
3. 检查是否存在映射冲突
4. 尝试删除并重新创建映射

## 开发

### 代码结构

- **Rust 后端**：负责 MIDI 硬件通信、数据持久化、业务逻辑
- **TypeScript 前端**：负责用户界面、数据可视化、交互逻辑
- **IPC 通信**：前后端通过 Tauri 的 invoke/listen 机制通信

### 错误处理

应用采用多层错误防护：
1. Rust 层使用 `std::panic::catch_unwind` 捕获恐慌
2. MIDI 操作使用 `Result` 类型进行错误处理
3. 前端使用 try-catch 处理异步调用失败
4. 设备断开时优雅降级，不抛出未处理异常

---

**项目完成状态**：代码开发完成，Docker 配置已提供，README 文档已编写。由于 Tauri 桌面应用的特性，建议在宿主机直接运行以获得最佳 MIDI 硬件支持。
