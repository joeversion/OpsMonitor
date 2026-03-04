# OpsMonitor Service Monitoring System — User Manual

> **Version**: 2.1.0
> **Updated**: 2026-03-04
> **Scope**: OpsMonitor Service Monitoring System (Frontend port: 5173, Backend port: 3000)

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

### 1.4 Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Vue 3 · TypeScript · Element Plus · ECharts · Pinia · Axios |
| **Backend** | Node.js · Express · TypeScript · JWT · node-cron |
| **Database** | SQLite (embedded, no separate deployment needed) |
| **Remote Communication** | ssh2 (SSH connection pool) |
| **Containerization** | Docker + Docker Compose |

---

## Chapter 2: Deployment & Installation

### 2.1 Requirements

| Component | Minimum Version | Notes |
|-----------|----------------|-------|
| Node.js | 18.0+ | Required for local development |
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

### 2.4 Environment Variables

**No configuration files are required for any deployment mode.** All defaults are built into the project and work out of the box.

Only create a `.env` file in the `backend/` directory when you need to override defaults:

```env
NODE_ENV=development
PORT=3000
DB_PATH=./data/monitor.db
JWT_SECRET=your-secret-key-here
```

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Runtime mode |
| `PORT` | `3000` | Backend listen port |
| `DB_PATH` | `/app/data/monitor.db` | SQLite database file path |
| `JWT_SECRET` | `opsmonitor-secret-key-change-in-production` | JWT signing key — **must be changed in production** |

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

Use the **project selector at the top of the left navigation menu** to switch between viewing specific project data. After selecting a project, all dashboard statistics automatically filter to show data within that project's scope.

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

> Before deleting a host, ensure there are no active monitoring services on it — otherwise, related service checks will fail.

---

## Chapter 8: Service Management

**Page Path**: `/services`

Services are the smallest monitoring unit in OpsMonitor. Each service corresponds to a specific health check target.

![Service List](images/ch05-services-list.png)

### 8.1 Service Concepts

| Concept | Description |
|---------|-------------|
| **Service** | A health check item, linked to a specific check task on a particular host |
| **Check Type** | Defines how to check: TCP connectivity, HTTP response, file existence, etc. |
| **Risk Level** | Marks the service's importance: Low / Medium / High / Critical |
| **Schedule** | Defines check frequency and time range |

### 8.2 Add a Service Using the Wizard

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

### 8.3 Health Check Type Configuration

**TCP Check**:
- Configuration fields: **Port** (required)
- Description: Verifies whether the specified port on the target host is open and accepting connections

**HTTP Check**:
- Configuration fields: **Port**, **Path** (e.g., `/health`), **Expected Status Code** (e.g., `200`), **Timeout**
- Description: Sends an HTTP GET request and verifies the response status code

**HTTPS Check**:
- Configuration fields: Same as HTTP, with additional SSL certificate verification
- Description: Checks via HTTPS protocol, also validates SSL/TLS certificate validity

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

### 8.4 Alert Threshold Configuration

| Field | Range | Description |
|-------|-------|-------------|
| **Warning Threshold** | 1-30 | Service status changes to WARNING after this many consecutive check failures |
| **Error Threshold** | 1-50 | Service status changes to DOWN after this many consecutive check failures |
| **Alert Trigger Threshold** | 1-10 | Alert notifications are sent only after this many consecutive failures, preventing false alarms from network fluctuations |

> Example: Warning = 2, Error = 5, Alert Trigger = 3 → 2 consecutive failures trigger warning, 5 consecutive failures mark as DOWN, 3 consecutive failures send alert notification

### 8.5 Dependency Configuration

When creating or editing a service, you can add inter-service dependencies in the **Dependencies** section:
1. Click **Add Dependency**
2. Search and select the depended-upon service
3. Set the **dependency type** (customizable in system settings) and **risk level**
4. Dependencies will be reflected in the [Dependency Topology Graph](#chapter-10-dependency-topology-graph)

### 8.6 Edit a Service

Click the **Edit** button in the service list to open the full service edit form:

![Service Edit Form](images/ch05-service-edit-form.png)

The edit form provides more comprehensive configuration options than the add wizard, including:
- Complete check parameter configuration
- Schedule configuration (see [Chapter 9](#chapter-9-schedule-configuration))
- Custom alert content:
  - **Service Impact Description**: Describe the impact when the service fails
  - **Custom Alert Template**: Custom alert message template supporting variables: `{service_name}`, `{host}`, `{port}`, `{risk_level}`, `{down_time}`, `{impact_description}`

### 8.7 Batch Operations

On the service list page, selecting multiple services reveals a batch operation toolbar at the top:

| Operation | Description |
|-----------|-------------|
| **Batch Edit** | Batch modify check interval, alert thresholds, risk level, and other settings |
| **Delete** | Batch delete selected services |
| **Clear** | Clear current selection |

### 8.8 Import / Export Service Configuration

The service list page provides configuration import/export functionality:

- **Export**: Export all service configurations as a JSON file for backup or environment migration
- **Import**: Batch import service configurations from a JSON file

### 8.9 Manually Trigger a Health Check

In the service list, click the **run button (▶)** on a service row to immediately trigger a health check without waiting for the next scheduled cycle. Results update in real-time on the page.

### 8.10 Service Status Reference

| Status | Color | Meaning |
|--------|-------|---------|
| **UP** | 🟢 Green | Service is healthy, latest check succeeded |
| **WARNING** | 🟠 Orange | Consecutive failures reached the Warning threshold |
| **DOWN** | 🔴 Red | Consecutive failures reached the Error threshold |
| **UNKNOWN** | Gray | No check has been executed yet, or monitoring is disabled |

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

---

## Chapter 10: Dependency Topology Graph

**Page Path**: `/graph`

The dependency topology graph visualizes all services within a project and their interdependencies, supporting real-time impact analysis.

> ⚠️ You must first **select a project** via the left menu to load that project's topology graph.

![Dependency Topology Graph](images/ch06-dependency-graph.png)

### 10.1 Basic Operations

| Operation | Method |
|-----------|--------|
| **Drag Nodes** | Click and drag a node to rearrange the layout |
| **Zoom Canvas** | Scroll wheel to zoom, or use control buttons |
| **Pan Canvas** | Click and drag on blank area |
| **View Service Details** | Click a node to display service status and check info in the right panel |
| **Reset Layout** | Click the Reset Layout button to restore automatic layout |

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
- Credential expiration reminders (within 30 days) for timely operations team action

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
| **Warning** | Consecutive failures ≥ Warning Threshold | Service entered WARNING state notification |
| **Fault** | Consecutive failures ≥ Error Threshold | Service entered DOWN state notification |
| **Recovery** | Service recovered from fault to UP | Recovery notification |

> The service-level **Alerts** toggle must be enabled for that service's alert notifications to be sent.

### 11.4 Alert History

The **Alert History** card at the bottom of the page displays all historical alerts with the following fields:

| Field | Description |
|-------|-------------|
| Time | Time the alert occurred |
| Service | Name of the service that triggered the alert |
| Type | Alert type (warning / error / recovery) |
| Message | Detailed alert content |
| Notified | Whether the notification was successfully sent |

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

1. Click the **Add** button in the top-right corner
2. Fill in the configuration information:
   - **Name** (required): Display name, e.g., `aws-prod-access-key`
   - **Type** (required): Select configuration type (AccessKey / Password / SSL Certificate)
   - **Validity Period**: Validity period in days (default 60 days)
   - **Expiry Date** (required): Expiration date
   - **Reminder Rules**: Check reminders for 7 days / 3 days / 1 day before expiration
   - **Affected Services**: Associate affected services (selectable by project group)
   - **Notes** (optional): Additional notes
3. Click Save

### 12.3 Expiration Status Reference

The system automatically calculates and displays status based on remaining validity:

| Status | Color | Trigger Condition |
|--------|-------|-------------------|
| **Normal** | 🟢 Green | More than 30 days until expiration |
| **Warning** | 🟠 Orange | ≤ 30 days until expiration |
| **Critical** | 🔴 Red | ≤ 7 days until expiration |
| **Expired** | Gray | Past the expiration date |

The four statistics cards at the top of the page summarize counts for each status (Normal / Warning / Critical / Expired) for quick global assessment.

### 12.4 Manually Trigger Expiry Check

Click the **Check Expiry Now** button in the top-right corner. The system will immediately perform an expiry check on all security configurations and send reminders for those about to expire through the configured notification channels.

### 12.5 Other Page Operations

| Operation | Description |
|-----------|-------------|
| **Type Filter** | Filter the list by configuration type (AccessKey / FTP Password / SSL Certificate) |
| **Status Filter** | Filter the list by expiry status (Normal / Warning / Critical / Expired) |
| **Search** | Search by name keyword |
| **Extend** | Quickly extend the validity period: enter the number of extension days in the **Confirm Extension** dialog |
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
   - **API Key** (optional): If the Grafana dashboard requires authentication, enter the API Key
3. Click **Test Connection** to verify connectivity
4. After successful connection, select the Dashboard to embed from the dropdown menu
5. Fill in additional information:
   - **Dashboard Name**: Display name in OpsMonitor
   - **Project**: Associated project
   - **Panel ID** (optional): Specify to embed a specific panel instead of the entire dashboard
6. **Embed Options**:
   - Theme (Light / Dark)
   - Auto-refresh interval
   - Whether to hide the top navigation bar

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
| **System Timezone** | System timezone, affects backend log timestamps and UI time display. Supports common timezones including UTC, Asia/Shanghai, etc. |
| **Date Format** | Date/time display format, default `YYYY-MM-DD HH:mm:ss` |

After changing the timezone, the page displays the current real-time clock in the selected timezone for confirmation.

### 14.2 Service Default Configuration

Global defaults used when creating new services, which can be overridden by service-level settings:

| Setting | Description |
|---------|-------------|
| **Default Check Interval** | Default check interval (seconds), used for new services in fixed interval mode |
| **Default Warning Threshold** | Default warning threshold (consecutive failures, range 1-30) |
| **Default Error Threshold** | Default error threshold (consecutive failures, range 1-50) |

### 14.3 Data Management

| Setting | Description |
|---------|-------------|
| **Log Retention Days** | Number of days to retain backend logs; expired logs are automatically cleaned up |
| **Data Retention Days** | Number of days to retain health check records in the database; expired data is automatically cleaned up to save storage |
| **Export Config** | Export all service configurations as a JSON file (for backup or environment migration) |
| **Import Config** | Batch import service configurations from a JSON file |

### 14.4 Dependency Type Management

The system comes with several preset dependency types (e.g., "Strong Dependency", "Weak Dependency"). Administrators can also **create custom dependency types**:

1. View the existing dependency types list, including properties like name, label, icon, and line style
2. Click **Add Custom Type** to create a new dependency type with custom name, icon, and color
3. **System built-in types** (System) cannot be deleted; custom types can be edited and deleted

### 14.5 Notification Configuration (Global)

Global notification configuration sets system-level Email SMTP and Teams Webhook settings, sharing the same notification channel configuration as the [Alert Configuration page](#chapter-11-alert-configuration).

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
4. Permission changes take effect **immediately** —the user will use the new permissions on their next operation

### 15.4 Reset Password

1. Find the target user in the user list
2. Click the key icon button in the **Actions** column
3. Enter the new password and confirmation password in the **Reset Password** dialog
4. Click **Reset Password** to complete

### 15.5 Delete a User

Click the **Delete** button at the end of the user row and confirm in the confirmation dialog.

> ⚠️ **Restrictions**:
> - Administrators cannot delete their own account
> - Deletion is irreversible — all historical data associated with the account will be removed

---

## Chapter 16: Health Check Type Reference

### 16.1 Local Check Types

The following check types are initiated directly from the monitoring server without going through SSH:

| Check Type | Compatible Hosts | Key Parameters | Description |
|------------|-----------------|----------------|-------------|
| **TCP** | Local / SSH | Host, Port | Verifies whether the port is open and accepting connections |
| **HTTP** | Local / SSH | Host, Port, Path, Expected Status Code, Timeout | Sends an HTTP GET request to verify the response |
| **HTTPS** | Local / SSH | Same as HTTP, with SSL verification | Supports TLS/SSL certificate validity check |
| **Script** | Local / SSH | Script Type, Script Content, Expected Exit Code | Executes a custom script locally on the monitoring server |
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
   - Max Age: `3600` (seconds)

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

**Goal**: In a microservice architecture, quickly identify affected upstream services when a service fails

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
2. Pre-create the required projects and hosts in the target environment before importing
3. Check the browser console or backend logs for specific error messages

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

## Appendix A: API Endpoint Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login, returns JWT Token |
| POST | `/api/auth/register` | User registration |
| GET | `/api/auth/me` | Get current logged-in user info |
| GET/POST/PUT/DELETE | `/api/users` | User management (Admin only) |
| GET/POST/PUT/DELETE | `/api/projects` | Project management |
| GET/POST/PUT/DELETE | `/api/hosts` | Host management |
| POST | `/api/hosts/:id/test-connection` | Test host SSH connection |
| GET/POST/PUT/DELETE | `/api/services` | Service management |
| GET | `/api/services/export` | Export all service configurations (JSON) |
| POST | `/api/services/import` | Import service configurations |
| PUT | `/api/services/:id/schedule` | Update service schedule configuration |
| GET | `/api/checks/latest` | Get latest health check records |
| POST | `/api/checks/:id/run` | Manually trigger a health check |
| GET | `/api/checks/:id/history` | Get check history records |
| GET | `/api/checks/stats/summary` | Get check statistics summary |
| GET/POST/PUT/DELETE | `/api/dependencies` | Dependency management |
| GET/POST/PUT/DELETE | `/api/dependency-types` | Dependency type management |
| GET | `/api/alerts` | Get alert history records |
| GET/PUT | `/api/config/notifications` | Notification channel configuration |
| POST | `/api/config/notifications/test` | Send test notification |
| GET/POST/PUT/DELETE | `/api/security-configs` | Security configuration management |
| POST | `/api/security-configs/check-expiry` | Manually trigger expiry check |
| GET/POST/PUT/DELETE | `/api/grafana-dashboards` | Grafana dashboard management |
| GET | `/api/system-settings` | Get all system settings |
| GET/PUT | `/api/system-settings/:key` | Get or update a specific system setting |
| GET | `/api/ssh/pool-stats` | SSH connection pool status |
| GET | `/api/schedule/templates` | Get schedule template list |

---

## Appendix B: Keyboard Shortcuts

| Shortcut | Function |
|----------|----------|
| `ESC` | Close current popup or dialog |
| `Ctrl + R` | Refresh current page data |

---

**Document Version**: 2.1.0
**Updated**: 2026-03-04
**Maintained by**: OpsMonitor Team
