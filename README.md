<div align="center">

**[中文](#服务监控系统) | [English](#opsmonitor)**

</div>

---

# 服务监控系统

> 🤖 **AI 驱动开发** - 本项目完全由 AI 辅助设计与实现

面向团队和中小型项目的服务监控系统，采用现代化架构设计，提供全方位的服务健康监控、依赖关系管理和智能告警能力。支持本地和远程（SSH）双模式部署，适用于多项目的生产环境运维场景。

## 核心功能

- 🏗️ **三层架构管理**: 项目 → 主机 → 服务的层级化管理
- 🔍 **多种健康检查**: TCP、HTTP/HTTPS、脚本执行、文件监控（支持本地和SSH远程检查）
- 📊 **可视化依赖图**: 交互式服务拓扑图，支持影响分析和依赖追踪
- 🔔 **智能告警通知**: 支持邮件（SMTP）和 Teams Webhook，可配置告警规则和阈值
- 📈 **Grafana 集成**: 无缝嵌入外部监控仪表板
- 🔐 **安全管理**: AccessKey、SSL 证书、密码过期监控与提醒
- 🌐 **跨项目依赖**: 追踪和管理多个项目之间的复杂依赖关系
- 🔄 **动态调度**: 灵活的定时任务配置
- 🌍 **多语言支持**: 中英文界面一键切换，告警通知语言同步

## 🤖 AI 开发说明

本项目是一个完全由人工智能主导开发的现代化监控系统：

**AI 模型**：
- 🤖 **Claude Sonnet 4.5** - 主力开发模型，用于代码生成、重构和优化
- 🧠 **Claude Opus 4.5** - 高级架构设计和复杂问题解决

**开发方式**：
- ✨ 架构设计由 AI 提供专业建议和最佳实践
- 💻 前后端代码完全由 AI 生成和优化
- 🎨 UI/UX 设计遵循现代化设计理念
- 🔧 代码重构和性能优化由 AI 持续改进
- 📚 文档由 AI 自动生成和维护

**技术亮点**：
- 遵循 RESTful API 设计规范
- TypeScript 全栈类型安全
- 响应式前端架构
- 高效的连接池管理（SSH 连接复用）
- 完善的错误处理和日志记录

**特别感谢**：
- 🙏 [codervisor/lean-spec](https://github.com/codervisor/lean-spec) — 轻量灵活的规格驱动开发（SDD）框架，为本项目的 AI 驱动开发流程提供了重要参考

## 目录结构

```
OpsMonitor/
├── backend/                    # Node.js + Express API 服务器
│   ├── src/                   # 源代码
│   │   ├── routes/          # API 路由 (15 个模块)
│   │   │   ├── auth.ts               # 身份认证
│   │   │   ├── projects.ts           # 项目管理
│   │   │   ├── hosts.ts              # 主机管理
│   │   │   ├── services.ts           # 服务管理
│   │   │   ├── checks.ts             # 健康检查记录
│   │   │   ├── dependencies.ts       # 依赖关系管理
│   │   │   ├── dependency-types.ts   # 依赖类型管理
│   │   │   ├── alerts.ts             # 告警配置
│   │   │   ├── security-configs.ts   # 安全配置 (SSH/AccessKey/SSL)
│   │   │   ├── grafana-dashboards.ts # Grafana 仪表板管理
│   │   │   ├── schedule.ts           # 调度配置
│   │   │   ├── system-settings.ts    # 系统设置
│   │   │   ├── users.ts              # 用户管理
│   │   │   ├── config.ts             # 通用配置接口
│   │   │   └── ssh-pool.ts           # SSH 连接池管理
│   │   ├── services/        # 业务逻辑 (10 个服务)
│   │   │   ├── health-checker.ts     # 健康检查服务
│   │   │   ├── ssh-service.ts        # SSH 连接服务
│   │   │   ├── ssh-checker.ts        # SSH 检查服务
│   │   │   ├── ssh-connection-pool.ts # SSH 连接池
│   │   │   ├── scheduler.ts          # 定时任务调度器
│   │   │   ├── dynamic-scheduler.ts  # 动态调度器
│   │   │   ├── check-event-bus.ts    # 检查结果事件总线 (SSE)
│   │   │   ├── alert-service.ts      # 告警服务
│   │   │   ├── notification-service.ts # 通知服务 (Email/Teams)
│   │   │   └── auth-service.ts       # 认证服务
│   │   ├── db/              # 数据库
│   │   │   ├── database.ts           # 数据库配置和迁移
│   │   │   └── schema.sql            # 数据库表结构
│   │   ├── middleware/      # 中间件
│   │   │   ├── auth.ts               # JWT 认证中间件
│   │   │   └── validation.ts         # 请求验证中间件
│   │   ├── utils/           # 工具函数
│   │   │   ├── logger.ts             # 日志工具
│   │   │   ├── notification-i18n.ts  # 通知多语言支持
│   │   │   └── schedule-validator.ts # 调度验证工具
│   │   ├── types/           # TypeScript 类型定义
│   │   └── app.ts           # Express 应用入口
│   ├── scripts/               # 运维脚本 (3 个)
│   │   ├── check-data-consistency.js
│   │   ├── add-data-consistency-triggers.js
│   │   └── add-host-sync-trigger.js
│   ├── Dockerfile             # 生产环境 Docker 镜像
│   ├── package.json
│   └── tsconfig.json
├── frontend/                   # Vue 3 + TypeScript 单页应用
│   ├── src/                   # 源代码
│   │   ├── views/           # 页面组件 (13 个)
│   │   │   ├── LoginView.vue         # 登录页面
│   │   │   ├── HomeView.vue          # 首页仪表板
│   │   │   ├── ProjectsView.vue      # 项目管理
│   │   │   ├── HostsView.vue         # 主机管理
│   │   │   ├── ServiceListView.vue   # 服务列表
│   │   │   ├── DependencyGraphView.vue # 依赖关系图
│   │   │   ├── CrossProjectDepsView.vue # 跨项目依赖
│   │   │   ├── AlertConfigView.vue   # 告警配置
│   │   │   ├── SecurityConfigView.vue # 安全配置
│   │   │   ├── GrafanaDashboardsView.vue # Grafana 仪表板
│   │   │   ├── ConnectionsView.vue   # SSH 连接管理
│   │   │   ├── SettingsView.vue      # 系统设置
│   │   │   └── UserManagementView.vue # 用户管理
│   │   ├── components/      # 可复用组件 (14 个)
│   │   │   ├── AddServiceWizard.vue  # 添加服务向导
│   │   │   ├── LangSwitch.vue        # 语言切换组件
│   │   │   ├── ProjectSelector.vue   # 项目选择器
│   │   │   ├── StatusBadge.vue       # 服务状态徽章
│   │   │   ├── ResponseChart.vue     # 响应时间图表
│   │   │   ├── InteractiveGraphCanvas.vue # 交互式依赖图画布
│   │   │   ├── LayeredGraphCanvas.vue # 分层依赖图画布
│   │   │   ├── ScheduleConfigPanel.vue # 调度配置面板
│   │   │   ├── ScheduleTemplateSelector.vue # 调度模板选择器
│   │   │   ├── TimeRangeEditor.vue   # 时间范围编辑器
│   │   │   ├── WeekdaySelector.vue   # 星期选择器
│   │   │   ├── IconSelector.vue      # 图标选择器
│   │   │   ├── ServiceIcon.vue       # 服务图标
│   │   │   └── HelloWorld.vue        # 示例组件
│   │   ├── api/             # API 调用封装
│   │   ├── i18n/            # 国际化 (中英文)
│   │   ├── router/          # Vue Router 路由配置
│   │   ├── types/           # TypeScript 类型定义
│   │   ├── utils/           # 工具函数
│   │   ├── assets/          # 静态资源
│   │   ├── App.vue          # Vue 根组件
│   │   ├── main.ts          # 应用入口
│   │   └── style.css        # 全局样式
│   ├── public/                # 公共资源
│   ├── Dockerfile             # Nginx 生产环境镜像
│   ├── nginx.conf             # Nginx 配置
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── docs/                      # 项目文档
│   ├── USER_MANUAL_CN.md
│   └── USER_MANUAL_EN.md
├── docker-compose.yml
├── dev.sh / dev.ps1           # 开发启动脚本
├── stop.sh / stop.ps1         # 停止脚本
└── check-processes.sh / .ps1  # 进程检查脚本
```

## 快速开始

### 环境要求

- Node.js 18+
- Docker 20.10+ & Docker Compose v2.0+（用于生产部署）

### 开发环境

**方式一：使用快速启动脚本（推荐）**

```bash
# Linux/Mac
./dev.sh

# Windows
.\dev.ps1
```

**方式二：手动启动**

```bash
# 后端（端口 3000）
cd backend
npm install
npm run dev

# 前端（端口 5173）
cd frontend
npm install
npm run dev
```

### 生产部署

```bash
docker compose up -d
```

此命令将自动构建前后端并启动所有服务：
- 前端服务：端口 `5173`
- 后端服务：端口 `3000`
- 数据库持久化卷：`/opt/OpsMonitor/backend/data`

> **注意：** 无需手动执行 `npm run build`，Docker 会自动处理整个构建流程。

**默认管理员账号**：

| 字段 | 值 |
|------|----|
| 用户名 | `admin` |
| 密码 | `admin123` |

## 配置说明

**所有部署方式均无需创建任何配置文件**，项目已内置全部默认值，开箱即用。

仅当需要修改默认配置时，可选在 `backend/` 目录创建 `.env` 文件：

```env
NODE_ENV=development
PORT=3000
DB_PATH=./data/monitor.db
JWT_SECRET=your-secret-key-here   # 默认已内置，生产环境建议替换
```

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NODE_ENV` | `production` | 运行模式 |
| `PORT` | `3000` | 后端监听端口 |
| `DB_PATH` | `/app/data/monitor.db` | 数据库文件路径 |
| `JWT_SECRET` | `opsmonitor-secret-key-change-in-production` | JWT 签名密钥，生产环境建议替换 |

**数据库**: SQLite 嵌入式数据库，无需安装额外服务。

## API 接口

> 以下为主要 API 端点速查，完整 CRUD 接口请参考用户手册。

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/login` | 用户认证 |
| `POST` | `/api/auth/register` | 用户注册 |
| `GET` | `/api/auth/me` | 获取当前用户信息 |
| `GET` | `/api/users` | 获取用户列表 |
| `GET` | `/api/projects` | 获取项目列表 |
| `GET` | `/api/projects/:id/graph` | 获取项目依赖图数据 |
| `GET` | `/api/hosts` | 获取主机列表 |
| `POST` | `/api/hosts/:id/test` | 测试主机连接 |
| `GET` | `/api/services` | 获取服务列表 |
| `GET` | `/api/services/export` | 导出服务配置 |
| `POST` | `/api/services/import` | 导入服务配置 |
| `PUT` | `/api/services/:id/schedule` | 更新服务调度配置 |
| `GET` | `/api/checks/latest` | 获取最新健康检查记录 |
| `GET` | `/api/checks/events` | SSE 实时检查结果推送 |
| `POST` | `/api/checks/:id/run` | 手动触发健康检查 |
| `GET` | `/api/checks/stats/summary` | 获取健康状态统计摘要 |
| `GET` | `/api/dependencies` | 获取依赖关系 |
| `GET` | `/api/dependencies/cross-project` | 获取跨项目依赖 |
| `GET` | `/api/dependency-types` | 获取依赖类型 |
| `GET` | `/api/alerts` | 获取告警配置 |
| `GET` | `/api/alerts/unacknowledged/count` | 获取未确认告警数量 |
| `GET` | `/api/security-configs` | 获取安全配置 |
| `GET` | `/api/security-configs/check/expiring` | 获取即将过期的安全配置 |
| `GET` | `/api/grafana-dashboards` | 获取 Grafana 仪表板 |
| `GET` | `/api/system-settings` | 获取系统设置 |
| `GET` | `/api/config/general` | 获取通用配置 |
| `GET` | `/api/config/notifications` | 获取通知配置 |
| `PUT` | `/api/config/notification-lang` | 设置通知语言偏好 |
| `POST` | `/api/config/notifications/test` | 发送测试通知 |
| `GET` | `/api/schedule/templates` | 获取调度模板 |
| `GET` | `/api/ssh/pool-stats` | SSH 连接池状态 |

完整文档请参考 [用户手册（中文）](docs/USER_MANUAL_CN.md) | [User Manual (English)](docs/USER_MANUAL_EN.md)。

## 技术栈

**前端:** Vue 3 + TypeScript · Element Plus · ECharts & G6 · Pinia · Axios · vue-i18n

**后端:** Node.js + Express · SQLite · JWT · node-cron · ssh2

## 开源协议

MIT

---

# OpsMonitor

> 🤖 **AI-Powered Development** - This project is fully designed and implemented with AI assistance

A service monitoring system designed for teams and small-to-medium projects, built with modern architecture, providing comprehensive service health monitoring, dependency management, and intelligent alerting capabilities. Supports both local and remote (SSH) deployment modes for multi-project production environments.

## Features

- 🏗️ **Three-Tier Architecture**: Project → Host → Service hierarchical management
- 🔍 **Multiple Health Checks**: TCP, HTTP/HTTPS, Script Execution, File Monitoring (local and SSH remote)
- 📊 **Visual Dependency Graph**: Interactive service topology with impact analysis and dependency tracking
- 🔔 **Smart Alert Notifications**: Email (SMTP) and Teams webhook with configurable rules and thresholds
- 📈 **Grafana Integration**: Seamlessly embed external monitoring dashboards
- 🔐 **Security Management**: Monitor AccessKey, SSL certificates, password expiration
- 🌐 **Cross-Project Dependencies**: Track and manage complex dependencies across multiple projects
- 🔄 **Dynamic Scheduling**: Flexible scheduled task configuration
- 🌍 **Multi-Language Support**: One-click Chinese/English UI switching with notification language sync

## 🤖 AI Development Notes

This project is a modern monitoring system primarily led and developed by AI:

**AI Models**:
- 🤖 **Claude Sonnet 4.5** - Primary model for code generation, refactoring, and optimization
- 🧠 **Claude Opus 4.5** - Advanced architecture design and complex problem solving

**Development Approach**:
- ✨ Architecture design with AI-provided professional advice and best practices
- 💻 Full-stack code completely generated and optimized by AI
- 🎨 UI/UX design following modern design principles
- 🔧 Continuous refactoring and performance optimization by AI
- 📚 Documentation automatically generated and maintained by AI

**Technical Highlights**:
- RESTful API design standards
- Full-stack TypeScript type safety
- Responsive frontend architecture
- Efficient SSH connection pool management
- Comprehensive error handling and logging

**Special Thanks**:
- 🙏 [codervisor/lean-spec](https://github.com/codervisor/lean-spec) — Lightweight, flexible Spec-Driven Development (SDD) framework that provided valuable reference for this project's AI-powered development workflow

## Directory Structure

```
OpsMonitor/
├── backend/                    # Node.js + Express API server
│   ├── src/                   # Source code
│   │   ├── routes/          # API routes (15 modules)
│   │   │   ├── auth.ts               # Authentication
│   │   │   ├── projects.ts           # Project management
│   │   │   ├── hosts.ts              # Host management
│   │   │   ├── services.ts           # Service management
│   │   │   ├── checks.ts             # Health check records
│   │   │   ├── dependencies.ts       # Dependency management
│   │   │   ├── dependency-types.ts   # Dependency type management
│   │   │   ├── alerts.ts             # Alert configuration
│   │   │   ├── security-configs.ts   # Security config (SSH/AccessKey/SSL)
│   │   │   ├── grafana-dashboards.ts # Grafana dashboard management
│   │   │   ├── schedule.ts           # Schedule configuration
│   │   │   ├── system-settings.ts    # System settings
│   │   │   ├── users.ts              # User management
│   │   │   ├── config.ts             # General config API
│   │   │   └── ssh-pool.ts           # SSH connection pool management
│   │   ├── services/        # Business logic (10 services)
│   │   │   ├── health-checker.ts     # Health check service
│   │   │   ├── ssh-service.ts        # SSH connection service
│   │   │   ├── ssh-checker.ts        # SSH check service
│   │   │   ├── ssh-connection-pool.ts # SSH connection pool
│   │   │   ├── scheduler.ts          # Scheduled task scheduler
│   │   │   ├── dynamic-scheduler.ts  # Dynamic scheduler
│   │   │   ├── check-event-bus.ts    # Check result event bus (SSE)
│   │   │   ├── alert-service.ts      # Alert service
│   │   │   ├── notification-service.ts # Notification service (Email/Teams)
│   │   │   └── auth-service.ts       # Auth service
│   │   ├── db/              # Database
│   │   │   ├── database.ts           # Database config & migrations
│   │   │   └── schema.sql            # Database schema
│   │   ├── middleware/      # Middleware
│   │   │   ├── auth.ts               # JWT auth middleware
│   │   │   └── validation.ts         # Request validation middleware
│   │   ├── utils/           # Utilities
│   │   │   ├── logger.ts             # Logging utility
│   │   │   ├── notification-i18n.ts  # Notification i18n support
│   │   │   └── schedule-validator.ts # Schedule validation utility
│   │   ├── types/           # TypeScript type definitions
│   │   └── app.ts           # Express app entry point
│   ├── scripts/               # Maintenance scripts (3)
│   │   ├── check-data-consistency.js
│   │   ├── add-data-consistency-triggers.js
│   │   └── add-host-sync-trigger.js
│   ├── Dockerfile             # Production Docker image
│   ├── package.json
│   └── tsconfig.json
├── frontend/                   # Vue 3 + TypeScript SPA
│   ├── src/                   # Source code
│   │   ├── views/           # Page components (13)
│   │   │   ├── LoginView.vue         # Login page
│   │   │   ├── HomeView.vue          # Home dashboard
│   │   │   ├── ProjectsView.vue      # Project management
│   │   │   ├── HostsView.vue         # Host management
│   │   │   ├── ServiceListView.vue   # Service list
│   │   │   ├── DependencyGraphView.vue # Dependency graph
│   │   │   ├── CrossProjectDepsView.vue # Cross-project dependencies
│   │   │   ├── AlertConfigView.vue   # Alert configuration
│   │   │   ├── SecurityConfigView.vue # Security configuration
│   │   │   ├── GrafanaDashboardsView.vue # Grafana dashboards
│   │   │   ├── ConnectionsView.vue   # SSH connection management
│   │   │   ├── SettingsView.vue      # System settings
│   │   │   └── UserManagementView.vue # User management
│   │   ├── components/      # Reusable components (14)
│   │   │   ├── AddServiceWizard.vue  # Add service wizard
│   │   │   ├── LangSwitch.vue        # Language switch component
│   │   │   ├── ProjectSelector.vue   # Project selector
│   │   │   ├── StatusBadge.vue       # Service status badge
│   │   │   ├── ResponseChart.vue     # Response time chart
│   │   │   ├── InteractiveGraphCanvas.vue # Interactive dependency graph canvas
│   │   │   ├── LayeredGraphCanvas.vue # Layered dependency graph canvas
│   │   │   ├── ScheduleConfigPanel.vue # Schedule config panel
│   │   │   ├── ScheduleTemplateSelector.vue # Schedule template selector
│   │   │   ├── TimeRangeEditor.vue   # Time range editor
│   │   │   ├── WeekdaySelector.vue   # Weekday selector
│   │   │   ├── IconSelector.vue      # Icon selector
│   │   │   ├── ServiceIcon.vue       # Service icon
│   │   │   └── HelloWorld.vue        # Example component
│   │   ├── api/             # API call wrappers
│   │   ├── i18n/            # Internationalization (zh-CN / en-US)
│   │   ├── router/          # Vue Router configuration
│   │   ├── types/           # TypeScript type definitions
│   │   ├── utils/           # Utilities
│   │   ├── assets/          # Static assets
│   │   ├── App.vue          # Vue root component
│   │   ├── main.ts          # App entry point
│   │   └── style.css        # Global styles
│   ├── public/                # Public assets
│   ├── Dockerfile             # Nginx production image
│   ├── nginx.conf             # Nginx configuration
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── docs/                      # Documentation
│   ├── USER_MANUAL_CN.md
│   └── USER_MANUAL_EN.md
├── docker-compose.yml
├── dev.sh / dev.ps1           # Dev start scripts
├── stop.sh / stop.ps1         # Stop scripts
└── check-processes.sh / .ps1  # Process check scripts
```

## Quick Start

### Prerequisites

- Node.js 18+
- Docker 20.10+ & Docker Compose v2.0+ (for production)

### Development

**Option 1: Quick Start Scripts (Recommended)**

```bash
# Linux/Mac
./dev.sh

# Windows
.\dev.ps1
```

**Option 2: Manual Start**

```bash
# Backend (Port 3000)
cd backend
npm install
npm run dev

# Frontend (Port 5173)
cd frontend
npm install
npm run dev
```

### Production Deployment

```bash
docker compose up -d
```

This will automatically build and start all services:
- Frontend: port `5173`
- Backend: port `3000`
- Persistent DB volume: `/opt/OpsMonitor/backend/data`

> **Note:** No manual `npm run build` required — Docker handles the entire build process.

**Default admin credentials**:

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |

## Configuration

**No configuration files are required for any deployment mode.** All defaults are built into the project and work out of the box.

Only create a `.env` file in `backend/` if you need to override the defaults:

```env
NODE_ENV=development
PORT=3000
DB_PATH=./data/monitor.db
JWT_SECRET=your-secret-key-here   # Built-in default exists; recommended to override for production
```

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Runtime mode |
| `PORT` | `3000` | Backend listen port |
| `DB_PATH` | `/app/data/monitor.db` | Database file path |
| `JWT_SECRET` | `opsmonitor-secret-key-change-in-production` | JWT signing key, recommended to override in production |

**Database**: SQLite embedded database — no separate database server needed.

## API Endpoints

> Key API endpoints listed below. See the user manual for full CRUD details.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | User authentication |
| `POST` | `/api/auth/register` | User registration |
| `GET` | `/api/auth/me` | Get current user info |
| `GET` | `/api/users` | List all users |
| `GET` | `/api/projects` | List all projects |
| `GET` | `/api/projects/:id/graph` | Get project dependency graph data |
| `GET` | `/api/hosts` | List all hosts |
| `POST` | `/api/hosts/:id/test` | Test host connection |
| `GET` | `/api/services` | List all services |
| `GET` | `/api/services/export` | Export service configurations |
| `POST` | `/api/services/import` | Import service configurations |
| `PUT` | `/api/services/:id/schedule` | Update service schedule |
| `GET` | `/api/checks/latest` | Get latest health check records |
| `GET` | `/api/checks/events` | SSE real-time check result stream |
| `POST` | `/api/checks/:id/run` | Trigger health check manually |
| `GET` | `/api/checks/stats/summary` | Get health stats summary |
| `GET` | `/api/dependencies` | Get service dependencies |
| `GET` | `/api/dependencies/cross-project` | Get cross-project dependencies |
| `GET` | `/api/dependency-types` | Get dependency types |
| `GET` | `/api/alerts` | Get alert configurations |
| `GET` | `/api/alerts/unacknowledged/count` | Get unacknowledged alert count |
| `GET` | `/api/security-configs` | Get security configurations |
| `GET` | `/api/security-configs/check/expiring` | Get expiring security configs |
| `GET` | `/api/grafana-dashboards` | Get Grafana dashboards |
| `GET` | `/api/system-settings` | Get system settings |
| `GET` | `/api/config/general` | Get general configuration |
| `GET` | `/api/config/notifications` | Get notification configurations |
| `PUT` | `/api/config/notification-lang` | Set notification language preference |
| `POST` | `/api/config/notifications/test` | Send test notification |
| `GET` | `/api/schedule/templates` | Get schedule templates |
| `GET` | `/api/ssh/pool-stats` | SSH connection pool status |

Full documentation: [User Manual (English)](docs/USER_MANUAL_EN.md) | [用户手册（中文）](docs/USER_MANUAL_CN.md).

## Tech Stack

**Frontend:** Vue 3 + TypeScript · Element Plus · ECharts & G6 · Pinia · Axios · vue-i18n

**Backend:** Node.js + Express · SQLite · JWT · node-cron · ssh2

## License

MIT
