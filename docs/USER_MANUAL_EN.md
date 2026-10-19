# OpsMonitor Service Monitoring System — User Manual

> **Version**: 2.2.0
> **Updated**: 2026-10-19
> **Scope**: OpsMonitor Service Monitoring System (Frontend port: 5173, Backend port: 3000)

> Revised against the current source code. Features marked as limited or coming soon are not complete. Existing screenshots are for orientation; follow the text for newly documented operations.

---

## Table of Contents

1. [Chapter 1: System Overview](#chapter-1-system-overview)
2. [Chapter 2: Deployment & Installation](#chapter-2-deployment--installation)
3. [Chapter 3: Quick Start Guide](#chapter-3-quick-start-guide)
4. [Chapter 4: User Authentication](#chapter-4-user-authentication)
5. [Chapter 5: Overview Dashboard](#chapter-5-overview-dashboard)
6. [Chapter 6: Project Management](#chapter-6-project-management)
7. [Chapter 7: Host Management](#chapter-7-host-management)
8. [Chapter 8: Service Management](#chapter-8-service-management)
9. [Chapter 9: Schedule Configuration](#chapter-9-schedule-configuration)
10. [Chapter 10: Dependency Topology Graph](#chapter-10-dependency-topology-graph)
11. [Chapter 11: Alert Configuration](#chapter-11-alert-configuration)
12. [Chapter 12: Security Configuration](#chapter-12-security-configuration)
13. [Chapter 13: Grafana Integration](#chapter-13-grafana-integration)
14. [Chapter 14: System Settings (Admin Only)](#chapter-14-system-settings-admin-only)
15. [Chapter 15: User Management (Admin Only)](#chapter-15-user-management-admin-only)
16. [Chapter 16: Health Check Type Reference](#chapter-16-health-check-type-reference)
17. [Chapter 17: Typical Use Cases](#chapter-17-typical-use-cases)
18. [Chapter 18: FAQ & Troubleshooting](#chapter-18-faq--troubleshooting)
- [Appendix A: API Endpoint Quick Reference](#appendix-a-api-endpoint-quick-reference)
- [Appendix B: Keyboard Shortcuts](#appendix-b-keyboard-shortcuts)

---

## Chapter 1: System Overview

### 1.1 Introduction

OpsMonitor is a full-stack service monitoring system designed for teams and small-to-medium projects. Built with a modern architecture, it provides comprehensive service health monitoring, dependency visualization, and intelligent alerting capabilities. The system supports both local and remote (SSH) deployment modes, making it suitable for multi-project production operations.

**Core Feature Highlights**:

| Feature | Description |
|---------|-------------|
| 🏗️ **Three-Tier Architecture** | Hierarchical organization: Project → Host → Service |
| 🔍 **Multiple Health Checks** | TCP, HTTP/HTTPS, Custom Scripts, File Monitoring (local & SSH remote) |
| 📊 **Dependency Visualization** | Interactive service topology graph with impact analysis & dependency tracking |
| 🔔 **Smart Alert Notifications** | Email (SMTP) and Teams Webhook support with customizable alert rules & thresholds |
| 📈 **Grafana Integration** | Embed external Grafana dashboards for unified display |
| 🔐 **Security Management** | Expiration monitoring & reminders for AccessKeys, SSL certificates, and passwords |
| 🔄 **Dynamic Scheduling** | Flexible scheduled check configuration with time range restrictions |
| 🌍 **Multi-Language Support** | One-click Chinese/English UI switching with automatic notification language sync |

### 1.2 System Architecture

OpsMonitor uses a frontend-backend separation architecture with an embedded database for out-of-the-box operation:

```
┌─────────────────────────────────────────────────────────────────┐
│                       OpsMonitor                                │
├──────────────────────────────┬──────────────────────────────────┤
│   Frontend (Vue 3 + Element  │   Backend (Node.js + Express)   │
│   Plus)  Port: 5173          │      Port: 3000                  │
├──────────────────────────────┴──────────────────────────────────┤
│                     SQLite Embedded Database                     │
└─────────────────────────────────────────────────────────────────┘
```

**Three-Tier Management Architecture**:

```
Project
  └── Host          ← Configure SSH or Local connection
        └── Service ← Configure health check type and schedule
```

- **Project**: Logical grouping by business or environment, e.g., "Production", "Development"
- **Host**: Actual server or target machine with connection configuration
- **Service**: Specific monitoring item, each service corresponds to one health check

### 1.3 User Roles & Permissions

The system provides two user roles:

| Role | Identifier | Permission Scope |
|------|-----------|-----------------|
| **Administrator** | Admin | Full access: CRUD for projects/hosts/services, alert & security configuration, user management, system settings |
| **Viewer** | Viewer | Read-only access: View monitoring data, dashboards; can manually trigger health checks but cannot modify any configuration |

> Newly registered accounts default to the **Viewer** role. An administrator must manually upgrade them to Admin.

> **Current security limitation**: Some write endpoints do not enforce administrator authorization. Hidden or disabled UI buttons are not a complete API security boundary. Restrict production network access; do not rely on the Viewer role alone to protect configuration.

### 1.4 Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Vue 3 · TypeScript · Element Plus · ECharts · Pinia · Axios · vue-i18n |
| **Backend** | Node.js · Express · TypeScript · JWT · node-cron |
| **Database** | SQLite (embedded, no separate deployment needed) |
| **Remote Communication** | ssh2 (SSH connection pool) |
| **Containerization** | Docker + Docker Compose |

---

## Chapter 2: Deployment & Installation

### 2.1 Requirements

| Component | Minimum Version | Notes |
|-----------|----------------|-------|
| Node.js | 20.19+ (20.x) or 22.12+ | Required by Vite 7; use a supported Node.js 22.12+ release |
| npm | Bundled with Node.js | Package manager |
| Docker | 20.10+ | For production deployment |
| Docker Compose | v2.0+ | For production deployment |
| OS | Windows / Linux / macOS | All supported |

### 2.2 Local Development Setup

**Option 1: Quick Start Scripts (Recommended)**

```powershell
# Windows (PowerShell)
cd OpsMonitor
.\dev.ps1
```

```bash
# Linux / macOS
cd OpsMonitor
./dev.sh
```

**Option 2: Manual Startup**

```bash
# Terminal 1: Start backend (port 3000)
cd OpsMonitor/backend
npm install
npm run dev

# Terminal 2: Start frontend (port 5173)
cd OpsMonitor/frontend
npm install
npm run dev
```

### 2.3 Production Docker Deployment

```bash
cd OpsMonitor
docker compose up -d
```

Docker will automatically build and start both frontend and backend — **no need to run `npm run build` manually**.

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5173 | Nginx static serving + API proxy |
| Backend | 3000 | Express API service |
| Database | — | SQLite file, persisted to `/opt/OpsMonitor/backend/data` |

Application logs are written to `/app/data/logs` in the container and persisted through the same data volume to `/opt/OpsMonitor/backend/data/logs` on the host. Ensure the backend user can write to the directory and monitor disk space: date-based retention is not a total disk-capacity limit.

> The current Compose file uses `network_mode: host`: services listen directly on the host ports above. Confirm that your Docker environment supports and enables host networking; Windows/macOS behavior should not be assumed identical to Linux.

### 2.4 Environment Variables

Local startup reads process environment variables. The current entry point does not automatically load `backend/.env`; creating that file alone has no effect. For example, set variables in the same PowerShell terminal used to start the backend:

```powershell
$env:NODE_ENV = 'development'
$env:PORT = '3000'
$env:DB_PATH = './data/monitor.db'
$env:JWT_SECRET = '<replace-with-an-independently-generated-strong-random-secret>'
npm run dev
```

| Variable | Local Default | Docker Compose Value / Notes |
|----------|---------------|------------------------------|
| `NODE_ENV` | Unset; startup logs fall back to `development` | `production` |
| `PORT` | `3000` | `3000`, backend listen port |
| `DB_PATH` | `monitor.db` in the backend directory | `/app/data/monitor.db`; custom relative paths resolve from the process working directory |
| `LOG_DIR` | `logs` under the backend directory | `/app/data/logs`, shared storage for frontend and backend application logs; custom relative paths resolve from the process working directory |
| `JWT_SECRET` | `opsmonitor-secret-key-change-in-production` | JWT signing key — **must be changed in production** |

For Docker, explicitly add `JWT_SECRET` to the backend `environment` in `docker-compose.yml`, for example `JWT_SECRET=${JWT_SECRET:?Set JWT_SECRET}`, provide the value through the host environment or Compose `.env`, and recreate the container. The current Compose file does not pass this variable through: setting it on the host or creating `backend/.env` alone is insufficient. Never commit real secrets. Rotating the key invalidates existing login tokens.

### 2.5 Access URLs

| URL | Description |
|-----|-------------|
| `http://localhost:5173` | Frontend user interface |
| `http://localhost:3000/health` | Backend health check endpoint |
| `http://localhost:3000/api` | Backend API prefix (append specific paths) |

---

## Chapter 3: Quick Start Guide

### 3.1 Complete Workflow

```
Log in (default account: admin / admin123)
    ↓
Create a project (logical grouping for services)
    ↓
Add hosts (configure SSH or Local connection)
    ↓
Add services (select check type, associate host, configure schedule)
    ↓
Enable monitoring (ensure the Monitoring toggle is ON)
    ↓
View dashboard (overview of all service health statuses)
    ↓
Configure alerts (set up Email / Teams notification channels)
    ↓
View dependency graph (analyze service topology & impact scope)
```

### 3.2 Five-Minute Quick Start

**Step 1** — Log in with the default account `admin` / `admin123`

![Login Page](images/ch01-login-page.png)

**Step 2** — Click **INFRASTRUCTURE → Projects** in the left navigation bar, then click **New Project** to create your first project

![Project List](images/ch03-projects-list.png)

**Step 3** — Navigate to the **Hosts** page and click **Add Host** to add a target server

![Host Management](images/ch04-hosts-card-view.png)

**Step 4** — Navigate to the **Services** page and click **Add Service** to add a monitoring service

![Service List](images/ch05-services-list.png)

**Step 5** — Return to the home page (Dashboard) to view the service health overview

![Overview Dashboard](images/ch02-dashboard-overview.png)

---

## Chapter 4: User Authentication

### 4.1 Login

Visiting the system home page (`http://localhost:5173`) will automatically redirect to the login page.

![Login Page](images/ch01-login-page.png)

**Default admin credentials**:

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |

> ⚠️ **Security Notice**: Change the default password immediately after first login!

Enter your credentials and click **Sign In** to log in:

![Login Form Filled](images/ch01-login-filled.png)

### 4.2 Register a New Account

Click the **Create Account** link at the bottom of the login page to access the registration page. Fill in username, email, and password, then submit.

> Note: Newly registered users default to the **Viewer** role with read-only permissions. An administrator must manually upgrade their role in [Chapter 15: User Management](#chapter-15-user-management-admin-only).

### 4.3 SSO Login (Coming Soon)

Two SSO (Single Sign-On) options are shown at the bottom of the login page, currently under development:

| Method | Status |
|--------|--------|
| **LDAP Login** | Coming Soon |
| **OAuth 2.0** | Coming Soon |

### 4.4 Change Password & Profile

After logging in, click the **user avatar/username in the top-right corner** to access the dropdown menu where you can:
- Edit profile (username, email)
- Change password
- Logout

### 4.5 Logout

Click the user menu in the top-right corner → **Logout** to safely sign out. The system will clear local tokens and redirect to the login page.

### 4.6 Language Switching

The system supports **Chinese (Simplified)** and **English** interface languages, switchable at any time.

**How to switch**:

1. Click the language switch button in the top-right corner of the page (displays “中文” or “EN”)
2. Select the target language from the dropdown menu
3. The interface will immediately switch to the selected language

**Language preference rules**:

| Scenario | Behavior |
|----------|----------|
| First visit | Automatically detects browser language; Chinese browsers default to Chinese, others default to English |
| After manual switch | Language preference is saved to local storage and automatically applied on next visit |
| Alert notifications | Language preference syncs to the backend; Email and Teams alert notifications will be sent in the same language |

> Notification language is a global backend setting, not a per-user preference. Changing language in another browser can overwrite it.

---

## Chapter 5: Overview Dashboard

**Page Path**: `/` (System home page)

The overview dashboard is the system's global monitoring entry point, displaying real-time health status of all services in aggregate.

![Overview Dashboard](images/ch02-dashboard-overview.png)

### 5.1 Statistics Cards

Four statistics cards are displayed at the top of the page:

| Card | Description |
|------|-------------|
| **Total Services** | Total number of services in the current project (or all projects) |
| **Healthy** | Number of services with UP status |
| **Warning** | Number of services with WARNING status |
| **Down** | Number of services with DOWN/UNKNOWN status |

Each card includes a progress bar below it for visual representation of status proportions.

### 5.2 Charts

Below the statistics cards are two chart panels and a system overview area:

| Chart | Description |
|-------|-------------|
| **Status Distribution Pie Chart** | Shows the proportion of services in each status: UP / WARNING / DOWN / UNKNOWN |
| **Project Services Bar Chart** | Displays service counts grouped by project |
| **System Overview** | Quick statistics for projects, hosts, dependencies, Grafana dashboards, security configs, and issues |

### 5.3 Auto Refresh & Manual Refresh

Refresh controls are available in the top-right corner of the page:

| Control | Description |
|---------|-------------|
| **Auto / Manual Toggle** | Enable/disable auto-refresh |
| **Interval Dropdown** | Choose from 15s / 30s / 1min / 5min |
| **Countdown Progress Bar** | Shows time remaining until the next refresh |
| **Refresh Button** | Trigger an immediate manual refresh |

### 5.4 Filter by Project

Use the **project selector at the top of the left navigation menu** to switch projects. Service statistics are filtered by project; System Overview appears only in the All Projects global view.

---

## Chapter 6: Project Management

**Page Path**: `/projects`

**Navigation**: Left sidebar **INFRASTRUCTURE** group → **Projects**

Projects are logical groupings of services, used to organize and isolate monitoring services for different businesses or environments.

![Project List](images/ch03-projects-list.png)

### 6.1 Create a Project

There are three ways to create a new project:

**Option 1: Via the Projects page header button (Recommended)**

1. Click **INFRASTRUCTURE → Projects** in the left navigation bar to open the project list page
2. Click the **New Project** button in the top-right corner
3. Fill in the dialog:

![New Project Dialog](images/ch03-projects-add-dialog.png)

   - **Project Name** (required): e.g., "Production", "Testing"
   - **Description** (optional): Detailed project description
   - **Color Theme**: Choose a display color for the project card
4. Click **Create Project** to save

**Option 2: Via the add card in the project list**

The last card in the project list is an **Add New Project** card. Clicking it opens the same creation dialog as Option 1.

**Option 3: Via the sidebar Current Project dropdown**

1. Click the **Current Project** dropdown selector at the top of the left navigation menu
2. Click **New Project** in the dropdown menu

![Project Selector Dropdown](images/ch03-project-selector-dropdown.png)

3. Fill in the project information and click **Create Project** to save

### 6.2 Edit a Project

1. Hover over a project card and click the **"..."** menu in the top-right corner
2. Select **Edit**
3. Modify the project information and save

### 6.3 Delete a Project

1. Click the **"..."** menu in the top-right corner of a project card
2. Select **Delete**
3. Confirm deletion in the confirmation dialog

> ⚠️ Deleting a project **does not** delete the associated hosts and services — they become unassigned.

### 6.4 Project Switching & Data Filtering

- Click any project card to set it as the current context
- After switching, dashboards, service lists, and other pages automatically filter to display data for that project
- The **Current Project** dropdown selector at the top of the left sidebar also allows quick switching

**Current Project Dropdown Options**:

| Option | Description |
|--------|-------------|
| **All Projects** | Switch to global view, showing all project data |
| Individual project names | Switch to that project's context; colored dots on the right indicate health status (🟢 Healthy / 🟡 Warning / 🔴 Fault) |
| **New Project** | Navigate to the Projects page and open the creation dialog |
| **Manage Projects** | Navigate to the Projects page for project management |

---

## Chapter 7: Host Management

**Page Path**: `/hosts`

Hosts are the physical/virtual targets for monitoring. OpsMonitor supports two connection modes:
- **SSH Mode**: For remote servers, executing check commands via SSH
- **Local Mode**: For locally reachable targets, performing checks via direct TCP/HTTP access

![Host Card View](images/ch04-hosts-card-view.png)

### 7.1 View Modes

| Mode | Description |
|------|-------------|
| **Card View** | Displays hosts as cards, showing connection status and service health statistics at a glance |
| **Table View** | Displays hosts in a table format, convenient for comparing information across multiple hosts |

Click the view toggle icon in the top-right corner of the page to switch between modes.

### 7.2 Add a Host

Click the **Add Host** button to open the add host dialog:

![Add Host Dialog](images/ch04-hosts-add-dialog.png)

**Basic Information**:

| Field | Required | Description |
|-------|----------|-------------|
| Host Name | ✅ | Display name for the host, e.g., `prod-web-01` |
| IP / Hostname | ✅ | IP address or domain name of the server |
| Project | — | Associated project (optional) |

**Connection Type**:

Choose **SSH** or **Local**:

- **Local**: Supports basic network reachability checks (TCP / HTTP / HTTPS)
- **SSH**: Supports remote command execution, file checks, and other advanced features

**SSH Configuration** (shown when SSH is selected):

| Field | Description |
|-------|-------------|
| SSH Port | SSH port, default 22 |
| Username | SSH login username |
| Auth Type | Authentication method: Password or Private Key |
| Password / Private Key | Corresponding authentication credentials |
| Proxy Host | Jump host hostname (optional, for bastion/jump host scenarios) |

**Advanced Parameters** (collapsible):

| Field | Default | Description |
|-------|---------|-------------|
| Max Retries | 3 | Number of retry attempts after connection failure (1-10) |
| Retry Delay | 1s | Delay between retries (1-10 seconds) |
| Connection Timeout | 10s | SSH handshake timeout (5-60 seconds) |
| Command Timeout | 30s | Remote command execution timeout (10-300 seconds) |

**Monitoring Parameters**:

| Field | Default | Description |
|-------|---------|-------------|
| Host Check Interval | — | Host connectivity check interval (60-3600 seconds). SSH mode checks via SSH connection; Local mode checks via Ping |

The default host check interval is **300 seconds**. Host cards and the table provide a monitoring toggle for scheduled host connectivity checks. It does not turn off associated services' independent schedules; pause each service separately when required.

**Other Fields**:

| Field | Description |
|-------|-------------|
| Description | Host description (optional) |
| Tags | Tags for host classification and filtering |

### 7.3 Proxy Host (Jump Host) Configuration

When the target server is not directly accessible and requires a jump host:

1. Enter the jump host hostname in the **Proxy Host** field (the jump host must already be added as a host in the system)
2. The system will connect to the target server through an SSH tunnel via the jump host

### 7.4 Connection Test

The add/edit host dialog provides a **Connection Test** feature:
- **SSH Mode**: Click the **🔌 Test SSH Connection** button — the system will attempt to establish an SSH connection and return the result
- **Local Mode**: Click the **📡 Test Ping** button — the system will execute a ping test

> Connection tests typically take 5-15 seconds. Please be patient.

### 7.5 Host Status Reference

| Status Label | Color | Meaning |
|-------------|-------|---------|
| CONN OK | 🟢 Green | Last connection test succeeded |
| CONN FAIL | 🔴 Red | Last connection test failed |
| SVC OK | 🟢 Green | All services on this host are healthy |
| SVC WARN | 🟠 Orange | Some services on this host are in warning state |
| SVC ERROR | 🔴 Red | Some services on this host are in fault state |
| SVC — | Gray | No services configured on this host yet |

### 7.6 Edit & Delete Hosts

- **Edit**: Click the **Edit** button on the host card, or click the edit icon in table view
- **Delete**: Click the **Delete** button and confirm

> Normal deletion is blocked whenever services are associated with the host, regardless of whether they are running. Resolve associations first. The backend API also supports `reassign_to=<host_id>` (move services), `orphan=true` (remove associations), or `force=true` (delete the host and its services); the current UI does not offer these choices. Forced deletion can cause irreversible data loss.

When editing host IP, SSH, or connection details, review the associated-service synchronization warning and verify affected targets and connection settings after saving.

---

## Chapter 8: Service Management

**Page Path**: `/services`

Services are the smallest monitoring unit in OpsMonitor. Each service corresponds to a specific health check target.

![Service List](images/ch05-services-list.png)

### 8.1 Service List Columns

The service list table shows the following columns:

| Column | Description |
|--------|-------------|
| **Status** | Current health status badge: 🟢 UP / 🟡 WARNING / 🔴 DOWN / ⚪ UNKNOWN |
| **Name** | Service display name and host:port |
| **Project** | Associated project tag |
| **Response** | Latest response time (ms) with progress bar indicator |
| **Last Check** | Timestamp of the most recent health check |
| **Check Interval** | ⏱ How often this service is checked, in seconds (e.g. `⏱ 30s`). Reflects the service's individual schedule setting. |
| **Thresholds & Trigger** | Three inline indicators showing per-service thresholds: **W** = Warning threshold (failures), **E** = Error/Down threshold (failures), **T** = Alert Trigger threshold (failures) |
| **Monitoring** | Toggle to enable/disable monitoring for the service |
| **Alerts** | Toggle to enable/disable alert notifications |
| **Type** | Health check type tag: TCP / HTTP / HTTPS / SCRIPT / FILE, etc. |
| **Actions** | Run check ▶, Copy, Edit, Delete buttons |

### 8.2 Service Concepts

| Concept | Description |
|---------|-------------|
| **Service** | A health check item, linked to a specific check task on a particular host |
| **Check Type** | Defines how to check: TCP connectivity, HTTP response, file existence, etc. |
| **Risk Level** | Marks the service's importance: Low / Medium / High / Critical |
| **Schedule** | Defines check frequency and time range |

### 8.3 Add a Service Using the Wizard

Click the **Add Service** button to launch the add service wizard (multi-step guided configuration):

**Step 1 — Basic Information**

![Add Service Wizard - Step 1](images/ch05-add-service-wizard-step1.png)

| Field | Required | Description |
|-------|----------|-------------|
| Service Name | ✅ | Display name for the service, e.g., `api-gateway-https` |
| Project | — | Associated project |
| Monitoring | — | Enable monitoring (toggle, default ON) |
| Alerts | — | Enable alert notifications (toggle) |
| Risk Level | — | Risk level: Low / Medium / High / Critical |

**Step 2 — Host & Check Configuration**

![Add Service Wizard - Step 2](images/ch05-add-service-wizard-step2.png)

- Select an existing host from the dropdown, or click **+ New Host** to create one directly in the wizard
- After selecting a check type, the page dynamically displays the corresponding configuration fields

### 8.4 Health Check Type Configuration

**TCP Check**:
- Configuration fields: **Port** (required)
- Description: Verifies whether the specified port on the target host is open and accepting connections

**HTTP Check**:
- Configuration fields: **Port**, **Path** (e.g., `/health`), **Expected Status Code** (e.g., `200`), **Timeout**
- Description: Sends an HTTP GET request and verifies the response status code

**HTTPS Check**:
- Configuration fields: Same as HTTP
- Description: Checks the HTTPS response status and can retrieve certificate expiry information. Certificate trust verification is currently disabled, so a successful check does not prove that a certificate is trusted or unexpired. Use SSL Certificate in Security Configuration for independent expiry monitoring

**Script Check**:

| Field | Description |
|-------|-------------|
| Script Type | Script language: bash / python / powershell / nodejs |
| Script Content | Script content (multi-line editor) |
| Expected Exit Code | Expected exit code, default `0` (success) |

Example — Check disk usage:

```bash
#!/bin/bash
USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
[ "$USAGE" -lt 90 ] && exit 0 || exit 1
```

**File Monitor**:

| Field | Description |
|-------|-------------|
| Mode | **Single File** or **Folder + Pattern** |
| File Path | Full path for single file mode |
| Directory Path | Directory path for folder mode |
| Filename Pattern | Filename matching pattern, supports glob (e.g., `*.log`) and regex (e.g., `app-.*\.log`) |

> 💡 **Advanced Options**: After creating a service, use **Edit Service** to configure complete file check parameters:
> - **Check Type**: `exists` / `size` / `modified` / `content`
> - **Max Age**: Maximum allowed file age (supports minutes/hours/days)
> - **Content Pattern**: Regex pattern for content matching
> - **Min Size**: Minimum file size (KB)
> - **Freshness Window**: File freshness window (days)
> - **Use Latest Matched File**: Automatically select the most recent matching file in folder mode

**Database Checks (Coming Soon)**:

The wizard's check type selector also displays upcoming database check types, currently marked as Coming Soon:

| Type | Description |
|------|-------------|
| 🐬 MySQL Check | MySQL database connectivity check |
| 🐘 PostgreSQL Check | PostgreSQL database connectivity check |
| 📮 Redis Check | Redis cache service check |
| 🍃 MongoDB Check | MongoDB database connectivity check |

### 8.5 Alert Threshold Configuration

| Field | Range | Description |
|-------|-------|-------------|
| **Warning Threshold** | 1-30 | Service status changes to WARNING after this many consecutive check failures |
| **Error Threshold** | 1-50 | Service status changes to DOWN after this many consecutive check failures |
| **Alert Trigger Threshold** | 1-10 | Alert notifications are sent only after this many consecutive failures, preventing false alarms from network fluctuations |

> Example: Warning = 2, Error = 5, Alert Trigger = 3 → 2 consecutive failures trigger warning, 5 consecutive failures mark as DOWN, 3 consecutive failures send alert notification

#### Alert Threshold Rules

**Role of each field**:

| Field | Role | Default |
|-------|------|---------|
| Warning Threshold | Consecutive failures reaching this count → display status changes to WARNING | 3 |
| Error Threshold | Consecutive failures reaching this count → display status changes to DOWN | 5 |
| Alert Trigger | Consecutive failures reaching this count → send notification | 3 |

**Constraints**:

```
Warning Threshold ≤ Error Threshold (required, otherwise cannot be saved)
Alert Trigger is recommended to be set between Warning and Error
```

**Notification trigger logic**:

| Notification Type | Trigger Condition |
|------------------|-------------------|
| ✉️ WARNING notification | count = Alert Trigger, and current status is WARNING |
| ✉️ DOWN notification | count = Alert Trigger and current status is DOWN **or** count = Error Threshold (escalation supplement from WARNING to DOWN) |
| ✉️ RECOVERY notification | Service recovers (status changes to UP), and an alert was previously sent |

> Continuing failures do not repeat the first alert; an already-alerted WARNING can still generate one DOWN escalation notification.

**Fixed-interval time estimates** (assuming failure begins immediately after the previous check and ignoring execution time):

```
Expected first WARNING = Alert Trigger x Check Interval (effective status must be WARNING)
Expected DOWN escalation = Error Threshold x Check Interval (a prior alert is required)
Expected RECOVERY wait = approximately 0-1 x Check Interval after recovery (prior alert required)
```

**Typical configuration examples** (Check Interval = 30s):

*Config A: Warning=1, Error=2, Alert Trigger=1 (fast detection)*

| Elapsed Time | count | Display Status | Notification |
|-------------|-------|----------------|--------------|
| T+30s | 1 | 🟡 WARNING | ✉️ WARNING notification (= 1×30s) |
| T+60s | 2 | 🔴 DOWN | ✉️ DOWN notification (= 2×30s) |
| Recovery+30s | — | 🟢 UP | ✉️ RECOVERY notification |

*Config B (system default): Warning=3, Error=5, Alert Trigger=3*

| Elapsed Time | count | Display Status | Notification |
|-------------|-------|----------------|--------------|
| T+30s ~ T+60s | 1-2 | 🟢 UP (suppressed) | Silent |
| T+90s | 3 | 🟡 WARNING | ✉️ WARNING notification (= 3×30s) |
| T+120s | 4 | 🟡 WARNING | Silent |
| T+150s | 5 | 🔴 DOWN | ✉️ DOWN notification (= 5×30s) |
| Recovery+30s | — | 🟢 UP | ✉️ RECOVERY notification |

> When Alert Trigger = Error Threshold, the WARNING notification is skipped and a single DOWN notification is sent directly; the displayed status can still pass through WARNING.

> Timelines estimate fixed-interval, continuously failing checks that complete normally; scheduling and execution time affect actual delivery. A first alert sent directly as DOWN depends on Alert Trigger. Use `Warning <= Alert Trigger <= Error`. If Alert Trigger is below Warning, the effective status at the first trigger is still suppressed to UP, so the expected alert may never be generated. With Alerts disabled, the current implementation also bypasses failure-count suppression and uses raw check status directly.

### 8.6 Dependency Configuration

When creating or editing a service, you can add inter-service dependencies in the **Dependencies** section:
1. Click **Add Dependency**
2. Search and select the depended-upon service
3. Set the **dependency type** (customizable in system settings) and **risk level**
4. Dependencies will be reflected in the [Dependency Topology Graph](#chapter-10-dependency-topology-graph)

### 8.7 Edit a Service

Click the **Edit** button in the service list to open the full service edit form:

![Service Edit Form](images/ch05-service-edit-form.png)

The edit form provides more comprehensive configuration options than the add wizard, including:
- Complete check parameter configuration
- Schedule configuration (see [Chapter 9](#chapter-9-schedule-configuration))
- Custom alert content:
  - **Service Impact Description**: Describe the impact when the service fails
  - **Custom Alert Template**: Custom alert message template supporting variables: `{service_name}`, `{host}`, `{port}`, `{risk_level}`, `{down_time}`, `{impact_description}`

### 8.8 Batch Operations

On the service list page, selecting multiple services reveals a batch operation toolbar at the top:

| Operation | Description |
|-----------|-------------|
| **Batch Edit** | Batch modify check interval, alert thresholds, risk level, and other settings |
| **Delete** | Batch delete selected services |
| **Clear** | Clear current selection |

### 8.9 Import / Export Service Configuration

The service list page provides configuration import/export functionality:

- **Export**: Export all service records as JSON, regardless of the current project filter; separate projects, hosts, security configurations, users, and history are not included
- **Import**: Import a JSON array of service records; matching IDs are treated as updates

> **Current limitation**: The import implementation has a SQL parameter-count mismatch and does not fully restore project/host associations, schedules, or script/file settings. Do not use it as a reliable migration or complete backup/restore mechanism. Back up SQLite at the actual `DB_PATH` and verify recovery before important operations. Use a consistent SQLite backup method for a running database, or stop the backend before backing it up.

### 8.10 Manually Trigger a Health Check

In the service list, click the **run button (▶)** on a service row to immediately trigger a health check without waiting for the next scheduled cycle. Results update in real-time on the page.

### 8.11 Service Status Reference

| Status | Color | Meaning |
|--------|-------|---------|
| **UP** | 🟢 Green | Service is healthy, latest check succeeded |
| **WARNING** | 🟠 Orange | Consecutive failures reached the Warning threshold |
| **DOWN** | 🔴 Red | Consecutive failures reached the Error threshold |
| **UNKNOWN** | Gray | No check has been executed yet, or monitoring is disabled |

### 8.12 Service Details & History

Click a **service name** in the list to open its details drawer. The topology graph also provides a details entry point:

| Tab | Contents |
|-----|----------|
| **Overview** | Target, project, host, check method, risk, latest result and error; expand output when available |
| **History** | Latest 20 or 50 checks, including status, duration and errors; expand output when available and permitted |
| **Dependencies** | Services depended on and dependent services, with type, risk and description |
| **Configuration** | Monitoring/alert switches, schedule, thresholds, failure count and check settings |

The header can show service paused, host paused, or stale-data indicators. For fixed-interval services, data is stale when the latest record is older than `max(2 x check interval, 60 seconds)`; this is not itself a failed check. Administrators can run a check or open editing from the footer. Viewers can inspect details but do not receive run/edit buttons in this drawer.

---

## Chapter 9: Schedule Configuration

Each service supports independent check scheduling, which can override the system-wide default interval.

### 9.1 Two Scheduling Modes

#### Fixed Interval

The simplest scheduling mode — executes a check at a fixed interval:

| Setting | Description |
|---------|-------------|
| Interval Duration | Quick options available: 30s / 1min / 5min / 10min / 30min / 1h |
| Unit Switching | Switch input between Seconds, Minutes, and Hours |

Example: Set to 300 seconds → checks every 5 minutes.

#### Time Rules

Add multiple time rules to use different check intervals during different time periods:

| Setting | Description |
|---------|-------------|
| **Weekdays** | Select which days of the week the rule is active (multiple selection allowed) |
| **Time Range** | Set start and end time per day (e.g., 09:00 - 18:00) |
| **Check Interval** | Check frequency within this time period (seconds) |

**Typical Scenarios**:

| Time Period | Days | Interval | Purpose |
|-------------|------|----------|---------|
| 09:00 - 18:00 | Mon-Fri | 60s | High-frequency checks during business hours |
| 18:00 - 09:00 | Mon-Fri | 600s | Low-frequency checks at night to reduce noise |
| All day | Sat, Sun | 1800s | Low-frequency weekend on-call checks |

> 💡 When the time rule list is empty, the system automatically falls back to fixed interval mode.

### 9.2 Execution Preview

At the bottom of the schedule configuration panel, the **Execution Preview** feature shows scheduling effects in real-time:

| Information | Description |
|-------------|-------------|
| **Current Time** | Current system time |
| **Current Range** | Name of the currently matched time rule |
| **Current Interval** | Currently active check interval |
| **Next Run** | Estimated next check execution time |

The preview area also includes an **Execution Plan (Next 24 Hours)** timeline that visually displays the check plan and intervals for each time period over the next 24 hours.

### 9.3 Configuration Entry Points

| Entry Point | Description |
|-------------|-------------|
| Service Edit Form → Schedule Configuration Panel | Configure scheduling for a single service independently |
| System Settings → Default Check Interval | Set the default fixed interval for new services |

### 9.4 Default Interval & Rule Limits

- In Time Rules mode, **Default Interval** applies when no enabled rule matches. Monitoring does not automatically stop outside the configured ranges.
- Rules support names, enable/disable switches and weekdays. Fixed/default intervals allow 10-86400 seconds; intervals within a rule allow 10-3600 seconds.
- Execution Preview helps inspect matched rules and upcoming plans; it does not guarantee exact execution times. The preview API currently formats time using Asia/Shanghai rather than following the system timezone everywhere.

---

## Chapter 10: Dependency Topology Graph

**Page Path**: `/graph`

The dependency topology graph visualizes all services within a project and their interdependencies, supporting real-time impact analysis.

> ⚠️ You must first **select a project** via the left menu to load that project's topology graph.

![Dependency Topology Graph](images/ch06-dependency-graph.png)

### 10.1 Basic Operations

| Operation | Method |
|-----------|--------|
| **Drag Nodes** | Administrators enter Customize Layout, then drag nodes |
| **Zoom Canvas** | Scroll wheel to zoom, or use control buttons |
| **Pan Canvas** | Click and drag on blank area |
| **View Service Details** | Use the node's service details entry point to open the details drawer |
| **Save Layout** | Administrators adjust nodes in Customize Layout mode and click Save Layout |

Administrators should enter **Customize Layout**, make adjustments, click **Save Layout**, then exit customization. Box selection, multiple selection and group movement are supported. Dragging alone should not be treated as a persisted change. Viewers cannot edit layouts or dependencies. The interactive canvas also supports adding, editing and deleting dependency links.

### 10.2 Node & Edge Meanings

**Node Colors** (represent service health status):

| Color | Status |
|-------|--------|
| 🟢 Green | UP (Healthy) |
| 🟠 Orange | WARNING |
| 🔴 Red | DOWN (Fault) |
| Gray | UNKNOWN |

**Edge Colors** (represent dependency chain status):

| Color | Meaning |
|-------|---------|
| Blue/Gray | Normal dependency |
| Red/Orange | A faulty service exists in the dependency chain |

Arrow direction indicates dependency: A → B means A depends on B (B is upstream of A).

### 10.3 Impact Analysis

When the **Impact Analysis** toggle at the top of the page is enabled and there are services in DOWN/WARNING status, the system will:

1. Highlight faulty service nodes
2. Trace all **downstream services that depend on the faulty service**
3. Display in the right panel:
   - Faulty service details
   - List of affected services
   - Impact statistics categorized by risk level (Critical / High / Medium / Low)

### 10.4 Security Panel

The **Security Panel** on the right side of the topology graph displays:
- Security configuration status associated with the project
- Configuration status and an expiring filter, using the 7/3-day thresholds in Chapter 12
- Failure information for unverified SSL certificates, rather than treating an unknown expiry as expired

Long security configuration notes scroll independently within the notes area and support keyboard focus. Scrolling a note is separate from scrolling the security panel list.

### 10.5 Status of Other Navigation Entries

- **Connections (`/connections`)**: Currently edits sample data held only in frontend memory, with no backend persistence API for connection entities. Reloading or re-entering the page discards changes. Configure actual SSH connections in host settings.
- **Cross-Project Dependencies (`/cross-deps`)**: The standalone page has a Coming Soon overlay and is not a supported production configuration workflow. Cross-project associations in project topology do not imply that this standalone page is complete.

---

## Chapter 11: Alert Configuration

**Page Path**: `/alerts`

The alert configuration page is used to set up notification channels (Email / Teams) and view historical alert records.

![Alert Configuration Page](images/ch07-alerts-config.png)

### 11.1 Email Notification (SMTP)

Fill in the following information in the **Email (SMTP)** configuration card:

| Setting | Example | Description |
|---------|---------|-------------|
| SMTP Host | `smtp.office365.com` | SMTP server address |
| SMTP Port | `587` | SMTP port (TLS typically 587, SSL typically 465) |
| Username | `monitor@company.com` | SMTP login username |
| Password | `********` | SMTP login password |
| From Address | `monitor@company.com` | Sender email address |
| To Address | `ops-team@company.com` | Recipient email address (separate multiple with commas) |

After configuration, click the **Test Email** button to send a test email and verify the settings.

### 11.2 Teams Webhook Notification

Fill in the **Microsoft Teams** configuration card:

| Setting | Description |
|---------|-------------|
| Webhook URL | The URL obtained after creating an Incoming Webhook in a Teams channel |

After configuration, click the **Test Teams** button to send a test notification.

> **Steps to get a Teams Webhook URL**:
> 1. Open the target channel in Teams
> 2. Click "..." next to the channel name → Manage channel → Connectors
> 3. Find "Incoming Webhook", configure it, and copy the generated URL

### 11.3 Alert Trigger Logic

| Event | Trigger Condition | Notification Content |
|-------|-------------------|---------------------|
| **First warning/fault** | Failure count exactly reaches Alert Trigger, with effective status WARNING/DOWN | Notification for that status |
| **Fault escalation** | An alert was already generated, count reaches Error Threshold, and effective status is DOWN | Additional WARNING-to-DOWN notification |
| **Recovery** | Raw check returns UP and an alert was previously generated | Recovery notification and failure-count reset |

> The service-level **Alerts** toggle must be enabled for that service's alert notifications to be sent.

Repeated notifications are suppressed during a continuing failure; see Section 8.5 for thresholds and edge cases. SMTP/Teams editing and test buttons are available to administrators. Save changed settings before sending a test notification.

### 11.4 Alert History

The **Alert History** card at the bottom of the page displays all historical alerts with the following fields:

| Field | Description |
|-------|-------------|
| Time | Time the alert occurred |
| Service | Name of the service that triggered the alert |
| Type | Alert type (warning / down / recovery / expiry); expiry identifies security configuration reminders |
| Message | Detailed alert content |
| Notified | Whether the notification was successfully sent |

### 11.5 Header Notification Center

Click the header bell to view recent alerts; its badge shows the unacknowledged count. Opening the list automatically acknowledges existing alerts, and an acknowledgement action is also available. Acknowledgement means read, not recovered or successfully delivered. Read status is currently global, not maintained separately for each user.

---

## Chapter 12: Security Configuration

**Page Path**: `/security`

The security configuration module centrally manages expiration dates for various credentials and certificates, providing proactive warnings before expiration.

![Security Configuration Page](images/ch08-security-config.png)

### 12.1 Supported Configuration Types

| Type | Description |
|------|-------------|
| **AccessKey** | API access keys (e.g., cloud service AK/SK) |
| **Password** | Various password credentials, with user-defined descriptions (e.g., database passwords, FTP passwords) |
| **SSL Certificate** | SSL/TLS certificates |

### 12.2 Add a Security Configuration

As an administrator, click **Add**, select a type, and fill in the corresponding fields.

**AccessKey / Password**: Enter a name and choose an expiry mode:
- **Explicit expiry date**: Select the expiration date directly.
- **Reset date + validity period**: Select a reset date and enter 1-365 days (default 60); the expiry date is calculated automatically.

**SSL Certificate**: Enter a domain such as `example.com`. The backend retrieves the name and expiry date from the domain's **443** port; these fields are not entered manually. Only domain names are accepted, not IP addresses, `localhost`, full URLs or ports. Saving immediately reads the certificate; a failed read displays an error and does not save the attempted change.

Both types support reminder rules (7/3/1 days), affected services and notes. Ensure that the backend network can resolve and reach the domain. SSL operations require administrator access.

### 12.3 Expiration Status Reference

The system automatically calculates and displays status based on remaining validity:

| Status | Color | Trigger Condition |
|--------|-------|-------------------|
| **Normal** | 🟢 Green | Days remaining > 7 |
| **Warning** | 🟠 Orange | 3 < days remaining ≤ 7 |
| **Critical** | 🔴 Red | 0 < days remaining ≤ 3 |
| **Expired** | Gray | Days remaining ≤ 0 |
| **Unverified** | Follow the UI indicator | TLS inspection detected; the origin certificate expiry cannot be verified |

The four statistics cards at the top of the page summarize counts for each status (Normal / Warning / Critical / Expired) for quick global assessment.

Days remaining are rounded up from the time difference. SSL rows also show the last check time and failure reason. When a TLS inspection product such as Zscaler is detected, unknown expiry is not counted as expired; bypass TLS inspection for that domain and retry. Other network errors retain the previous expiry date, so inspect the failure message before relying on that value.

### 12.4 Manually Trigger Expiry Check

Administrators can click **Check Expiry Now** to check all security configurations and retrieve SSL certificates again. Checks also run at backend startup and every hour thereafter.

The largest selected reminder day defines the reminder window: selecting 7/3/1 days allows at most one reminder per day when days remaining are <=7, rather than sending only on days 7, 3 and 1. Expired items can still trigger daily reminders. Manual checks respect the same daily deduplication, so clicking does not guarantee a notification. Recovery to Normal can generate a recovery notification; unverified SSL certificates skip expiry alerts.

### 12.5 Other Page Operations

| Operation | Description |
|-----------|-------------|
| **Type Filter** | Filter the list by configuration type (AccessKey / FTP Password / SSL Certificate) |
| **Status Filter** | Filter using the expiry states offered by the UI; inspect row messages for unverified SSL certificates |
| **Search** | Search by name keyword |
| **Extend** | Non-SSL items only: set a future expiry date directly, or calculate it from a reset date plus 1-365 days |
| **Edit** | Modify configuration details |
| **Delete** | Delete the configuration record |

---

## Chapter 13: Grafana Integration

**Page Path**: `/grafana`

Grafana integration allows embedding external Grafana dashboards into the OpsMonitor interface for a unified monitoring view.

![Grafana Dashboards Page](images/ch09-grafana-dashboards.png)

### 13.1 Add a Grafana Dashboard

1. Click the **Add Dashboard** button
2. Fill in Grafana connection information:
   - **Grafana URL**: Grafana server address, e.g., `http://grafana.company.com:3000`
   - **API Key** (optional): Used by the backend to query Grafana dashboards and panels
3. Click **Test Connection** to verify connectivity
4. After successful connection, select a Dashboard from the dropdown; if no list is available, enter its Dashboard UID manually
5. Fill in additional information:
   - **Dashboard Name**: Display name in OpsMonitor
   - **Projects**: Associate multiple projects
   - **Service** (optional): Associate a service
   - **Panel ID** (optional): Specify to embed a specific panel instead of the entire dashboard
6. **Embed Options**:
   - Theme (Light / Dark)
   - Auto-refresh interval
   - Whether to hide the top navigation bar
   - Time range, display order and enabled state

> The API Key does not automatically establish a browser login session for the iframe. Grafana must allow embedding and provide appropriate anonymous access or browser authentication. Check HTTPS mixed-content and cross-site cookie restrictions as well. A successful connection test does not guarantee that embedding will work.

### 13.2 View Grafana Dashboards

Each record in the Grafana list provides the following actions:

| Button | Description |
|--------|-------------|
| **View** | Display in an iframe popup within the current page |
| **Open Original** | Open the original Grafana page in a new tab |
| **Edit** | Modify the embed configuration |
| **Delete** | Remove the integration configuration |

---

## Chapter 14: System Settings (Admin Only)

**Page Path**: `/settings`

The system settings page configures global parameters. **Only administrators can modify settings**; Viewer role users can only view the current configuration.

![System Settings Page](images/ch10-settings.png)

### 14.1 System Timezone & Date Format

| Setting | Description |
|---------|-------------|
| **System Timezone** | Used by the shared logger and this page's time preview; supports UTC, Asia/Shanghai, etc. Not all pages or notifications follow it |
| **Date Format** | Saves a format preference, default `YYYY-MM-DD HH:mm:ss`; not currently applied consistently across pages |

After changing the timezone, the page displays the current real-time clock in the selected timezone for confirmation.

Application log file rotation and JSON `timestamp` values use UTC regardless of this setting. Log timestamps embedded in backend message text can still use the system timezone.

### 14.2 Service Default Configuration

Global defaults used when creating new services, which can be overridden by service-level settings:

| Setting | Description |
|---------|-------------|
| **Default Check Interval** | Default check interval (seconds), used for new services in fixed interval mode |
| **Default Warning Threshold** | Default warning threshold (consecutive failures, range 1-30) |
| **Default Error Threshold** | Default error threshold (consecutive failures, range 1-50) |
| **Default Alert Trigger** | Default alert trigger threshold (consecutive failures, range 1-10). Notifications are only sent after this many consecutive failures, preventing false alarms from transient network issues |

### 14.3 Data Management

| Setting | Description |
|---------|-------------|
| **Application Log Retention** | Shared retention for frontend-reported and backend application logs; default 30 days, integer range 1-365, editable by administrators only |
| **Data Retention Days** | Check-record retention: cleanup runs at backend startup and every 24 hours, not at a fixed 02:00 daily |
| **Export Config** | Exports service records as JSON, not a complete system backup |
| **Import Config** | Service-record import entry point; see Section 8.9 for current limitations and backup advice |

**Application log files and cleanup**:

- `LOG_DIR` contains separate `backend-YYYY-MM-DD.log` and `frontend-YYYY-MM-DD.log` files, with one JSON record per line. Files rotate by UTC date and split at approximately 20 MB; split files follow the same retention policy.
- Cleanup runs at backend startup and every hour thereafter. Saving Application Log Retention also immediately applies cleanup using the new value.
- Retention counts UTC dates including today. A value of 1 retains only the current UTC date, not a rolling 24-hour window.
- **Reducing retention can immediately and irreversibly delete old logs**. Back up files before saving if they must be preserved.
- This setting cleans only the application logs above and their split files. It does not clear the browser console, Docker/Nginx logs, or the separate `health-check-debug.log`; manage those independently.

**Frontend collection and limitations**:

- Captures `console.warn`, `console.error`, Vue errors, browser unhandled errors/Promise rejections and resource-load errors; ordinary `console.log` and `console.info` are not collected.
- The browser queues reports only when it holds a login token; the backend still validates the account and token. Errors before login or during authentication failures are not guaranteed to appear in frontend log files.
- The frontend attempts to send every 5 seconds, up to 5 entries per batch. Its queue holds at most 20 entries and messages are truncated to 2000 characters. It also attempts to send when leaving the page, but network failures, rate limits and page closure can lose records; failed batches are not guaranteed to be retried.
- Reports are best-effort diagnostic data, not a complete audit trail. File logging attempts to redact some common sensitive fields but cannot identify every secret. Do not deliberately log passwords, keys or sensitive personal information.
- There is currently no in-app log search or download page. Read files through authorized filesystem access. See Chapter 18, Q9 for missing-log troubleshooting.

### 14.4 Dependency Type Management

The system comes with several preset dependency types (e.g., "Strong Dependency", "Weak Dependency"). Administrators can also **create custom dependency types**:

1. View the existing dependency types list, including properties like name, label, icon, and line style
2. Click **Add Custom Type** to create a new dependency type with custom name, icon, and color
3. **System built-in types** (System) cannot be deleted; custom types can be edited and deleted

### 14.5 Notification Configuration Entry Point

System Settings has no SMTP/Teams configuration section. Configure and test global notification channels on the [Alert Configuration page](#chapter-11-alert-configuration).

---

## Chapter 15: User Management (Admin Only)

**Page Path**: `/users`

The user management page allows administrators to view and manage all accounts in the system. **Only users with the Admin role can access this page.**

![User Management Page](images/ch11-users.png)

### 15.1 User List

Three statistics cards are displayed at the top of the page: **Total Users**, **Administrators**, and **Viewers**.

Supports keyword search and filtering by **Role** (Admin / Viewer) and **Status** (Active / Inactive).

The table displays all registered users with the following information:

| Field | Description |
|-------|-------------|
| No. | Row number |
| Username | Username |
| Email | Email address |
| Role | Role (Admin / Viewer) |
| Status | Account status (Active / Inactive) |
| Last Login | Last login time |
| Actions | Action buttons |

### 15.2 Add a User

Click the **Add User** button in the top-right corner. Fill in username, email, password, and role in the dialog, then create.

### 15.3 Modify User Role & Status

1. Find the target user in the user list
2. Click the edit button in the **Actions** column
3. Modify the role (Admin / Viewer) or status (Active / Inactive) in the edit dialog
4. After a role change, ask the user to sign out and back in to refresh the token and UI role. Existing tokens retain the role assigned when issued and last up to 24 hours. Disabling or deleting an account rejects its next request to an authenticated endpoint; this does not protect endpoints that lack authentication

> The last administrator cannot be demoted to Viewer. Create and verify another administrator first.

### 15.4 Reset Password

1. Find the target user in the user list
2. Click the key icon button in the **Actions** column
3. Enter the new password and confirmation password in the **Reset Password** dialog
4. Click **Reset Password** to complete

### 15.5 Delete a User

Click the **Delete** button at the end of the user row and confirm in the confirmation dialog.

> ⚠️ **Restrictions**:
> - Administrators cannot delete their own account
> - The last administrator cannot be deleted
> - Deletion is irreversible but removes only the user account, not monitoring history or service records

---

## Chapter 16: Health Check Type Reference

### 16.1 Local Check Types

Execution location depends on host connection mode, as shown below. Network and script checks use SSH for SSH-configured hosts; file/log checks require SSH.

| Check Type | Compatible Hosts | Key Parameters | Description |
|------------|-----------------|----------------|-------------|
| **TCP** | Local / SSH | Host, Port | Verifies whether the port is open and accepting connections |
| **HTTP** | Local / SSH | Host, Port, Path, Expected Status Code, Timeout | Sends an HTTP GET request to verify the response |
| **HTTPS** | Local / SSH | Same as HTTP | HTTPS response check; certificate trust is not validated. See Chapter 12 for expiry monitoring |
| **Script** | Local / SSH | Script Type, Script Content, Expected Exit Code | Executes on the monitoring server for Local hosts, or on the remote target for SSH hosts |
| **File Monitor** | Requires SSH | Mode, Path, Check Type, Max Age, etc. | Performs file checks on the target host via SSH |
| **Log Monitor** | Requires SSH | Mode, Path, Content Match Pattern | Monitors log file content changes via SSH |

### 16.2 SSH Remote Check Types

The following check types are executed on the target host after connecting via SSH (host must have SSH configured):

| Check Type | Key Parameters | Description |
|------------|----------------|-------------|
| **file-exists** | File path | Checks whether a specified file exists on the target host |
| **file-age** | File path, Max age (seconds) | Checks file modification time to ensure freshness |
| **command** | Command content, Expected output pattern | Executes an arbitrary command on the target host, verifying exit code or output |

### 16.3 Hybrid Mode Checks

For HTTP/HTTPS and TCP checks, two access modes are supported:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Direct Access** | Monitoring server connects directly to the target | Target service is directly reachable from the monitoring network |
| **SSH Proxy** | Connects to the host via SSH and performs the check from the host's internal network | Target service is behind a firewall and only reachable from the host itself |

---

## Chapter 17: Typical Use Cases

### Scenario 1: Monitor a Web Application (HTTPS Check)

**Goal**: Verify that a production web service is responding normally

**Configuration Steps**:
1. Create a project named "Production-Web"
2. Add a host (IP: `10.0.1.10`, Connection Type: Local)
3. Add a service:
   - Check Type: **HTTPS**
   - Port: `443`
   - Path: `/health`
   - Expected Status Code: `200`
   - Warning Threshold: `2`, Error Threshold: `5`

---

### Scenario 2: Monitor a Database Service (TCP Check)

**Goal**: Verify that the database port is open and the service is alive

**Configuration Steps**:
1. Add a host (database server, can be Local or SSH mode)
2. Add a service:
   - Check Type: **TCP**
   - Port: `3306` (MySQL) or `5432` (PostgreSQL) or `1433` (MSSQL)

---

### Scenario 3: Monitor Scheduled Job Output (File Age Check)

**Goal**: Ensure the hourly data processing job produces output files (files not older than 1 hour)

**Configuration Steps**:
1. Add a host (task server, SSH connection)
2. Add a service:
   - Check Type: **File Monitor**
   - Mode: Single File
   - File Path: `/var/data/job-output/result.csv`
   - Check Type (Advanced): `modified`
   - Max Age: `60` with **Minutes** selected (or `1` **Hour**)

If the file hasn't been updated for more than 1 hour, the service status will change to WARNING/DOWN.

---

### Scenario 4: Monitor Disk Usage (Script Check)

**Goal**: Verify that server disk usage is below 90%

**Configuration Steps**:
1. Add a host (target server, SSH connection)
2. Add a service:
   - Check Type: **Script**
   - Script Type: `bash`
   - Expected Exit Code: `0`
   - Script content:

```bash
#!/bin/bash
USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$USAGE" -lt 90 ]; then
  echo "Disk usage: ${USAGE}% - OK"
  exit 0
else
  echo "Disk usage: ${USAGE}% - CRITICAL"
  exit 1
fi
```

---

### Scenario 5: Cross-Environment Service Dependency Impact Analysis

**Goal**: In a microservice architecture, quickly identify dependent downstream services when a service fails

**Configuration Steps**:
1. Configure inter-service dependencies in each service's edit page under the **Dependencies** section
2. Navigate to the **Dependency Topology Graph** (`/graph`) and enable **Impact Analysis**
3. When a service enters DOWN status, the system automatically highlights and lists all affected downstream services

---

## Chapter 18: FAQ & Troubleshooting

### Q1: Unable to log in

**Possible Causes**:
- Incorrect username or password
- Backend service is not running

**Solutions**:
1. Confirm you are using the correct credentials (default: `admin` / `admin123`)
2. Visit `http://localhost:3000/health` to verify the backend service is running
3. Check backend logs for specific errors

---

### Q2: Service status always shows UNKNOWN

**Possible Causes**:
- The service's **Monitoring** toggle is not enabled
- The next scheduled cycle has not yet arrived
- Backend health check service is malfunctioning

**Solutions**:
1. Open the service edit form and confirm the **Monitoring** toggle is ON (blue)
2. Click the manual execution button (▶) on the service row to trigger an immediate check
3. Verify the backend service is running properly

---

### Q3: SSH connection test fails

**Possible Causes**:
- Incorrect IP / port configuration
- Wrong username or password/private key
- Target server firewall blocking SSH access
- SSH service not running on the target host

**Solutions**:
1. Verify the host IP and SSH port (default 22)
2. Confirm the username and authentication credentials (password or private key) are correct
3. Check whether the server firewall allows port 22
4. Manually verify from the local command line: `ssh user@host -p port`

---

### Q4: Alert notifications not received

**Possible Causes**:
- Alert channel configuration error (SMTP / Webhook URL)
- The service's **Alerts** toggle is not enabled
- Emails are being filtered to the spam folder

**Solutions**:
1. Use **Test Email** / **Test Teams** on the [Alert Configuration page](#chapter-11-alert-configuration) to verify the configuration
2. Confirm the alerting service has its **Alerts** toggle enabled
3. Check the recipient's spam/junk folder

---

### Q5: Port already in use (startup failure)

**Error Message**: `EADDRINUSE: address already in use :::3000`

**Solutions**:

```powershell
# Windows — Find and kill the process using port 3000
netstat -ano | findstr :3000
taskkill /PID <PID_shown_above> /F
```

```bash
# Linux / macOS
lsof -i :3000
kill -9 <PID>
```

---

### Q6: Dependency graph loads slowly or fails to display

**Possible Causes**:
- No project selected (you must select a project from the left menu first)
- Too many services in a single project

**Solutions**:
1. Confirm a specific project is selected in the left menu
2. If service count exceeds 50+, consider splitting projects to reduce nodes per graph
3. Refresh the page and retry

---

### Q7: Service configuration import fails

**Possible Causes**:
- Incorrect JSON file format (not exported from this system)
- Imported services reference non-existent hosts or projects

**Solutions**:
1. Confirm the JSON file was exported using this system's **Export** feature in the standard format
2. The current importer has parameter-binding and field-restoration limitations; pre-creating projects and hosts does not guarantee success. See Section 8.9
3. Inspect backend logs for SQL/parameter-binding errors. Do not use import for production migration until the implementation has been fixed and verified

---

### Q8: Will having too many monitored services on one host cause SSH thread spikes on the target server?

The system has a built-in SSH connection pool to control connection counts, but actual connections depend on your configuration.

**Connection Pool Mechanism**:

1. **Hard limit of 3 connections per pool**: Connection pools are keyed by `host:port@username`. Each pool allows a maximum of 3 concurrent connections. Excess requests enter a priority queue and wait.
2. **Connection reuse**: After executing a check command, the SSH connection is immediately returned to the pool. The next queued request reuses it without re-establishing the handshake.
3. **Staggered scheduling**: Initial checks for SSH hosts are launched with 10-second intervals between them, avoiding connection storms at startup.
4. **Idle auto-reclaim**: Connections idle for more than 1 minute are automatically closed (cleaned every 30 seconds), preventing long-term resource consumption on the target server.

**Why might you see more than 3 connections?**

The connection pool isolation unit is the **credential combination** (`host:port@username`), not the physical server. The following scenarios create multiple independent connection pools on the same server:

| Scenario | Pool Count | Max Connections |
|----------|-----------|----------------|
| Same server, same username | 1 pool | 3 |
| Same server, 2 different usernames | 2 pools | 6 |
| Same server, 3 different usernames | 3 pools | 9 |
| N target hosts via the same jump host | N pools | N × 3 (on the jump host side) |

**Common multi-pool situations**:
- **Host heartbeat** uses credentials from the hosts table (e.g., `admin@server`), while **SSH service checks** use credentials from the security_configs table (e.g., `deploy@server`) — different usernames create two independent pools (up to 6 connections).
- When multiple hosts go through **the same jump host**, proxy connections accumulate on the jump host.

**Optimization Tips**:
- Use **a consistent SSH username** for the same server to minimize the number of connection pools.
- For many hosts behind a jump host, pay attention to the jump host's SSH max connection settings (`MaxSessions`, `MaxStartups`).

---

### Q9: Where are application logs, and why are frontend records missing?

1. Check the backend's effective `LOG_DIR`. The local default is `backend/logs`; the current Compose host directory is `/opt/OpsMonitor/backend/data/logs`. Look for `backend-*.log` or `frontend-*.log` and split files by UTC date.
2. If files are missing, check directory write permissions, free disk space and `Application log write failed` in the backend console. Application retention does not manage separate Docker/Nginx logs; see Section 14.3.
3. Frontend reporting covers warnings and errors only. Ordinary logs, errors before login, and content beyond queue/truncation limits are not fully recorded. Confirm login and inspect browser network requests for `POST /api/logs/frontend`.
4. `204` means the endpoint accepted the request, not that the log is durably stored; `400` means invalid format, `401` means invalid authentication, and `429` means the user rate limit was exceeded. Network failure or page exit can also lose records; use the browser console and backend logs together.
5. Older files may already have been removed by UTC-date retention. Back up remaining files before adjusting retention. Increasing retention cannot recover deleted logs.

---

## Appendix A: API Endpoint Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login, returns JWT Token |
| POST | `/api/auth/register` | User registration |
| GET | `/api/auth/me` | Get current logged-in user info |
| PUT | `/api/auth/profile` | Update profile |
| PUT | `/api/auth/password` | Change the current user's password |
| GET/POST/PUT/DELETE | `/api/users` | User management (Admin only) |
| GET/POST/PUT/DELETE | `/api/projects` | Project management |
| GET | `/api/projects/:id/graph` | Get project dependency graph data |
| GET/POST/PUT/DELETE | `/api/hosts` | Host management |
| POST | `/api/hosts/:id/test-connection` | Test host SSH connection |
| POST | `/api/hosts/test-all` | Batch test all host connections |
| GET/POST/PUT/DELETE | `/api/services` | Service management |
| GET | `/api/services/:id/details` | Service details, recent results, history and dependencies (login required) |
| PATCH | `/api/services/batch` | Batch update services |
| POST | `/api/services/layout` | Save service topology layouts |
| GET | `/api/services/export` | Export all service configurations (JSON) |
| POST | `/api/services/import` | Import service configurations |
| PUT | `/api/services/:id/schedule` | Update service schedule configuration |
| GET | `/api/checks/latest` | Get latest health check records |
| GET | `/api/checks/events` | SSE real-time check result stream |
| POST | `/api/checks/:id/run` | Manually trigger a health check |
| GET | `/api/checks/:id/history` | Get check history records |
| GET | `/api/checks/stats/summary` | Get check statistics summary |
| GET/POST/PUT/DELETE | `/api/dependencies` | Dependency management |
| GET | `/api/dependencies/cross-project` | Get cross-project dependencies |
| GET/POST/PUT/DELETE | `/api/dependency-types` | Dependency type management |
| GET | `/api/alerts` | Get alert history records |
| GET | `/api/alerts/unacknowledged/count` | Get unacknowledged alert count |
| POST | `/api/alerts/acknowledge` | Acknowledge alerts (global read status) |
| GET/PUT | `/api/config/notifications` | Notification channel configuration |
| PUT | `/api/config/notification-lang` | Set notification language preference |
| POST | `/api/config/notifications/test` | Send test notification |
| GET/POST/PUT/DELETE | `/api/security-configs` | Security configuration management |
| GET | `/api/security-configs/stats` | Security configuration state counts |
| POST | `/api/security-configs/:id/extend` | Renew a non-SSL configuration |
| POST | `/api/config/security-check/trigger` | Check security configurations and SSL certificates now (Admin only) |
| GET | `/api/security-configs/check/expiring` | Get expiring security configs |
| GET/POST/PUT/DELETE | `/api/grafana-dashboards` | Grafana dashboard management |
| GET | `/api/system-settings` | Get all system settings |
| GET/PUT | `/api/system-settings/:key` | Get or update a specific system setting |
| POST | `/api/logs/frontend` | Submit frontend diagnostic logs (login required, not a query endpoint); returns 204 on success |
| GET | `/api/ssh/pool-stats` | SSH connection pool status |
| GET | `/api/schedule/templates` | Get schedule template list |
| POST | `/api/schedule/preview` | Preview schedule execution times |
| POST | `/api/schedule/validate` | Validate schedule configuration |

> CRUD rows abbreviate resource endpoint families; update/delete usually require `/:id`. Role labels describe intended use. Authentication and authorization are not enforced on every endpoint, so this table is not a security guarantee.

`POST /api/logs/frontend` accepts `{ "entries": [{ "level": "error", "message": "example" }] }`. Batches contain 1-20 entries with `warn`/`error` levels and 1-4096 characters per message. The limit is 60 requests per minute per user ID; invalid format returns 400, invalid authentication 401, and rate limiting 429. The actual frontend uses smaller batch/message limits; see Section 14.3.

---

## Appendix B: Keyboard Shortcuts

| Shortcut | Function |
|----------|----------|
| `ESC` | Close a dismissible dialog; clear selection in topology customization mode |
| `Ctrl + R` | Browser full-page reload, not an application-only data refresh |
| `Shift + Drag` | Topology customization: box-select nodes |
| `Ctrl/Cmd + Click` | Topology customization: select multiple nodes |
| `Ctrl/Cmd + A` | Topology customization: select all nodes |

---