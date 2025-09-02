# Virtual Chemistry Lab

## 项目概述

Virtual Chemistry Lab 是一个基于 Web 的 3D 仿真化学实验室项目，旨在为学生和研究人员提供一个交互式、安全的虚拟实验环境。项目使用 **Vite**、**Vue.js 3** 和 **Three.js** 构建，集成了 3D 模型加载、实验信息展示和 AI 辅助实验指导功能。通过逼真的 3D 场景和智能聊天助手，用户可以模拟化学实验（如氯气制取），学习实验步骤、参数和安全规范。

### 核心功能
- **3D 实验场景**：加载和展示 3D 模型（如实验设备 `bob.glb` 和实验室环境 `lab.glb`），支持高保真渲染。
- **实验信息展示**：左侧面板显示实验参数（如温度、压力）和步骤，支持滚动查看。
- **AI 实验助手**：右侧聊天窗口提供实时指导，响应用户点击的实验步骤或提问，验证步骤顺序并以专业化学指导老师身份解答问题。
- **交互操作**：支持“开始实验”和“重置实验”按钮，步骤点击交互，消息实时传递至模拟 AI 服务端。
- **现代 UI 设计**：简约的左右分栏布局，配色清晰（白色主色，蓝色、绿色、红色、黄色辅助），提升用户体验。

## 技术栈
- **前端框架**：Vue.js 3（使用 `<script setup>` 语法）
- **构建工具**：Vite
- **3D 渲染**：Three.js（支持 GLB 模型加载）
- **UI 组件**：Element Plus（或 Ant Design Vue，具体实现中说明）
- **运行环境**：Windows 11，兼容现代浏览器（Chrome、Edge 等）

## 快速开始

### 前置条件
- **Node.js**：v16 或更高版本
- **操作系统**：Windows 11（其他平台可能兼容但未测试）
- **浏览器**：最新版本的 Chrome 或 Edge

### 安装步骤
1. **克隆仓库**：
   ```bash
   git clone https://github.com/loyeruio/Virtual-Chemistry-Lab.git
   cd Virtual-Chemistry-Lab
   ```

2. **安装依赖**：
   ```bash
   npm install
   ```
   核心依赖包括：
   - `vue`：Vue.js 3 框架
   - `three`：Three.js 3D 渲染库
   - `@three-ts/gltf-loader`：GLB 模型加载
   - `element-plus`：UI 组件库（或 `ant-design-vue`）
   - `axios`：模拟 API 请求

3. **放置模型文件**：
   - 将 `bob.glb` 和 `lab.glb` 文件放入 `public/models/` 目录。
   - 确保文件路径正确，未压缩的 `bob.glb` 和压缩的 `lab.glb` 均可正常加载。

4. **运行项目**：
   ```bash
   npm run dev
   ```
   - 打开浏览器，访问 `http://localhost:5173`（默认端口）。
   - 项目将展示 3D 实验场景和交互式实验辅助界面。

### 项目结构
```
Virtual-Chemistry-Lab/
├── public/
│   └── models/
│       ├── bob.glb              # 实验设备模型（未压缩）
│       └── lab.glb              # 实验室环境模型（已压缩）
├── src/
│   ├── components/
│   │   ├── LabScene.vue         # 3D 场景组件（模型加载与渲染）
│   │   └── ExperimentAssistant.vue  # 实验助手组件（交互与聊天）
│   ├── views/
│   │   └── Experiment.vue       # 实验主页面
│   ├── utils/
│   │   ├── threeHelper.js       # Three.js 辅助函数
│   │   └── aiService.js         # 模拟 AI 服务端逻辑
│   ├── App.vue                  # 应用入口
│   ├── main.js                  # 主入口脚本
│   └── assets/
│       └── style.css            # 全局样式
├── vite.config.js               # Vite 配置文件
├── package.json
└── README.md                    # 项目说明
```

## 使用说明
1. **3D 场景**：
   - 打开页面后，3D 实验场景将自动加载 `bob.glb` 和 `lab.glb` 模型。
   - 相机自动调整以确保模型完全可见。

2. **实验辅助界面**：
   - **左侧面板**：
     - **实验数据**：查看参数（如温度 25°C、压力 1 atm）。
     - **实验步骤**：点击步骤（如“收集纯净的氯气”），消息将以用户身份显示在聊天区域。
     - **提示框**：黄色提示框提醒正确操作顺序。
     - **操作按钮**：点击“开始实验”触发流程，“重置实验”清空状态。
   - **右侧面板**：
     - **AI 实验助手**：显示欢迎语和指导信息。
     - **聊天窗口**：支持用户输入问题或点击步骤，AI 响应：
       - **步骤响应**：验证步骤顺序，提示正确或错误。
       - **问题响应**：以专业化学实验指导老师身份解答。
     - **输入框**：输入问题后点击发送按钮，消息追加到聊天区域。

3. **交互流程**：
   - 点击实验步骤，消息形式为：“我选择了步骤：{步骤内容}”。
   - AI 检查步骤顺序，回复是否正确（如“很好，您选择了正确的步骤”）。
   - 输入一般性问题（如“为什么要用浓硫酸？”），AI 提供专业解答。
   - 聊天区域自动滚动到最新消息。

## 开发计划
### 已完成
- **模型加载**：加载并展示 3D 模型（`bob.glb` 和 `lab.glb`）。
- **实验界面**：实现左右分栏布局，展示实验数据、步骤和聊天窗口。
- **交互逻辑**：支持步骤点击、消息传递和 AI 回复（模拟服务端）。

### 待开发
- **实验进度跟踪**：记录用户实验进度，提供动态指导。
- **真实 AI 服务端**：集成外部 AI API（如 xAI 的 Grok API）。
- **响应式设计**：优化移动端适配。
- **交互增强**：支持 3D 模型的旋转、缩放等操作。

## 调试与注意事项
- **模型加载失败**：
  - 确保 `bob.glb` 和 `lab.glb` 位于 `public/models/`。
  - 检查控制台是否有 Three.js 错误，可能需要调整模型格式。
- **聊天消息溢出**：
  - 验证聊天区域滚动条是否正常工作。
  - 确保气泡最大宽度限制（80%）有效。
- **步骤顺序错误**：
  - 检查 `aiService.js` 中步骤历史逻辑，确认索引正确。
  - 若模拟服务端响应失败，查看 `axios` 请求日志。
- **浏览器兼容性**：
  - 测试环境为 Windows 11 的 Chrome/Edge，若其他浏览器出现问题，检查 Three.js 和 UI 框架兼容性。

## 贡献
欢迎提交 Issue 或 Pull Request，贡献代码或提出改进建议。请遵循以下步骤：
1. Fork 本仓库。
2. 创建新分支（`git checkout -b feature/your-feature`）。
3. 提交更改（`git commit -m "Add your feature"`）。
4. 推送分支（`git push origin feature/your-feature`）。
5. 创建 Pull Request。

## 许可证
本项目采用 MIT 许可证，详情见 [LICENSE](LICENSE) 文件。

## 联系
- GitHub: [loyeruio](https://github.com/loyeruio)
- 问题反馈：通过 GitHub Issues 提交

© 2025 loyeruio
