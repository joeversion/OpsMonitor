<template>
  <div class="service-list">
    <!-- Stats Cards -->
    <el-row v-if="!hideStats" :gutter="20" class="stats-row">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #ecf5ff; color: #409EFF;">
            <el-icon :size="24"><Monitor /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('services.totalServices') }}</div>
            <div class="stat-value">{{ services.length }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #f0f9eb; color: #67C23A;">
            <el-icon :size="24"><CircleCheckFilled /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('services.healthy') }}</div>
            <div class="stat-value" style="color: #67C23A">{{ services.filter(s => s.latestStatus === 'up').length }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #fdf6ec; color: #E6A23C;">
            <el-icon :size="24"><WarningFilled /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('services.warning') }}</div>
            <div class="stat-value" style="color: #E6A23C">{{ services.filter(s => s.latestStatus === 'warning').length }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #fef0f0; color: #F56C6C;">
            <el-icon :size="24"><CircleCloseFilled /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('services.downUnknown') }}</div>
            <div class="stat-value" style="color: #F56C6C">{{ services.filter(s => s.latestStatus === 'down' || s.latestStatus === 'unknown' || !s.latestStatus).length }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ $t('services.title') }}</span>
          <div class="actions">
            <el-button v-if="!hideActions" @click="handleExport">
              <el-icon><Download /></el-icon> {{ $t('services.btnExport') }}
            </el-button>
            <template v-if="isAdmin && !hideActions">
              <el-upload
                action=""
                :show-file-list="false"
                :before-upload="handleImport"
                accept=".json"
                style="display: inline-block; margin: 0 10px;"
              >
                <el-button>
                  <el-icon><Upload /></el-icon> {{ $t('services.btnImport') }}
                </el-button>
              </el-upload>
            </template>
            <el-button v-if="isAdmin" type="primary" @click="handleAdd">
              <el-icon><Plus /></el-icon> {{ $t('services.btnAdd') }}
            </el-button>
          </div>
        </div>
      </template>

      <!-- Batch Actions Toolbar -->
      <div v-if="selectedServices.length > 0" class="batch-actions-bar">
        <div class="batch-info">
          <el-icon class="batch-icon"><Select /></el-icon>
          <span class="batch-count">{{ selectedServices.length }}</span>
          <span class="batch-text">{{ $t('services.selectedCount', { n: selectedServices.length }) }}</span>
        </div>
        <div class="batch-buttons">
          <el-button size="small" type="primary" plain @click="handleBatchEdit">
            <el-icon><Edit /></el-icon>
            <span class="button-text">{{ $t('services.batchEdit') }}</span>
          </el-button>
          <el-button size="small" type="danger" plain @click="handleBatchDelete">
            <el-icon><Delete /></el-icon>
            <span class="button-text">{{ $t('services.batchDelete') }}</span>
          </el-button>
          <el-button size="small" @click="clearSelection">
            <el-icon><Close /></el-icon>
            <span class="button-text">{{ $t('services.clearSelect') }}</span>
          </el-button>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <el-input v-model="searchQuery" :placeholder="$t('services.searchPlaceholder')" :prefix-icon="Search" style="width: 300px;" clearable />
        <el-select v-if="!currentProjectId && !hideProjectFilter" v-model="filterProject" :placeholder="$t('services.colProject')" clearable style="width: 180px;">
          <el-option :label="$t('services.allProjects')" value="" />
          <el-option 
            v-for="project in projects" 
            :key="project.id" 
            :label="project.name" 
            :value="project.id" 
          />
        </el-select>
        <el-select v-model="filterStatus" :placeholder="$t('common.status')" clearable style="width: 150px;">
          <el-option :label="$t('services.allStatus')" value="" />
          <el-option :label="$t('services.statusNormal')" value="up" />
          <el-option :label="$t('services.statusWarning')" value="warning" />
          <el-option :label="$t('services.statusDown')" value="down" />
          <el-option :label="$t('services.statusUnknown')" value="unknown" />
        </el-select>
      </div>

      <el-table 
        :data="paginatedServices" 
        style="width: 100%" 
        v-loading="loading"
        @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" v-if="isAdmin" />
        <el-table-column :label="$t('services.colNo')" width="70" align="center">
          <template #default="{ $index }">
            <span class="no-column">{{ (currentPage - 1) * pageSize + $index + 1 }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('services.colStatus')" min-width="90">
          <template #header>
            <div class="sortable-header" @click="handleSort('status')">
              <span>{{ $t('services.colStatus') }}</span>
              <span class="sort-icon">
                <el-icon v-if="sortBy === 'status' && sortOrder === 'asc'"><CaretTop /></el-icon>
                <el-icon v-else-if="sortBy === 'status' && sortOrder === 'desc'"><CaretBottom /></el-icon>
                <el-icon v-else class="sort-icon-inactive"><DCaret /></el-icon>
              </span>
            </div>
          </template>
          <template #default="scope">
            <StatusBadge :status="scope.row.latestStatus || 'unknown'" />
          </template>
        </el-table-column>
        <el-table-column :label="$t('services.colName')" min-width="200">
          <template #header>
            <div class="sortable-header" @click="handleSort('name')">
              <span>{{ $t('services.colName') }}</span>
              <span class="sort-icon">
                <el-icon v-if="sortBy === 'name' && sortOrder === 'asc'"><CaretTop /></el-icon>
                <el-icon v-else-if="sortBy === 'name' && sortOrder === 'desc'"><CaretBottom /></el-icon>
                <el-icon v-else class="sort-icon-inactive"><DCaret /></el-icon>
              </span>
            </div>
          </template>
          <template #default="scope">
            <div style="font-weight: 500;">{{ scope.row.name }}</div>
            <div style="font-size: 12px; color: #909399;">
              {{ scope.row.host }}<template v-if="scope.row.port && !['script', 'file', 'log'].includes(scope.row.check_type)">:{{ scope.row.port }}</template>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="$t('services.colProject')" min-width="110" v-if="!currentProjectId">
          <template #header>
            <div class="sortable-header" @click="handleSort('project')">
              <span>{{ $t('services.colProject') }}</span>
              <span class="sort-icon">
                <el-icon v-if="sortBy === 'project' && sortOrder === 'asc'"><CaretTop /></el-icon>
                <el-icon v-else-if="sortBy === 'project' && sortOrder === 'desc'"><CaretBottom /></el-icon>
                <el-icon v-else class="sort-icon-inactive"><DCaret /></el-icon>
              </span>
            </div>
          </template>
          <template #default="scope">
            <el-tag size="small" type="warning" effect="plain" v-if="scope.row.project_name">
              {{ scope.row.project_name }}
            </el-tag>
            <span v-else style="color: #909399;">-</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('services.colResponse')" min-width="160">
          <template #default="scope">
            <template v-if="scope.row.latestCheck">
              <el-progress 
                :percentage="Math.min(scope.row.latestCheck.response_time / 10, 100)" 
                :status="getResponseStatus(scope.row.latestCheck.response_time)"
                :show-text="false"
                style="width: 50px; display: inline-block; margin-right: 8px;"
              />
              <span>{{ scope.row.latestCheck.response_time }}ms</span>
              <el-button 
                v-if="scope.row.latestCheck.output || scope.row.latestCheck.stdout || scope.row.latestCheck.stderr"
                link 
                type="primary" 
                size="small" 
                @click="viewCheckDetails(scope.row)"
                style="margin-left: 8px;">
                <el-icon><Document /></el-icon>
              </el-button>
            </template>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('services.colLastCheck')" min-width="110">
          <template #header>
            <div class="sortable-header" @click="handleSort('lastChecked')">
              <span>{{ $t('services.colLastCheck') }}</span>
              <span class="sort-icon">
                <el-icon v-if="sortBy === 'lastChecked' && sortOrder === 'asc'"><CaretTop /></el-icon>
                <el-icon v-else-if="sortBy === 'lastChecked' && sortOrder === 'desc'"><CaretBottom /></el-icon>
                <el-icon v-else class="sort-icon-inactive"><DCaret /></el-icon>
              </span>
            </div>
          </template>
          <template #default="scope">
            <span v-if="scope.row.latestCheck">
              {{ formatTime(scope.row.latestCheck.checked_at) }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('services.colMonitoring')" min-width="120" align="center">
          <template #header>
            <div class="sortable-header" @click="handleSort('monitoring')">
              <span>{{ $t('services.colMonitoring') }}</span>
              <span class="sort-icon">
                <el-icon v-if="sortBy === 'monitoring' && sortOrder === 'asc'"><CaretTop /></el-icon>
                <el-icon v-else-if="sortBy === 'monitoring' && sortOrder === 'desc'"><CaretBottom /></el-icon>
                <el-icon v-else class="sort-icon-inactive"><DCaret /></el-icon>
              </span>
            </div>
          </template>
          <template #default="scope">
            <el-switch
              v-model="scope.row.enabled"
              :active-value="1"
              :inactive-value="0"
              :disabled="!isAdmin"
              @change="handleToggleMonitoring(scope.row)"
            />
          </template>
        </el-table-column>
        <el-table-column :label="$t('services.colAlerts')" min-width="120" align="center">
          <template #header>
            <div class="sortable-header" @click="handleSort('alerts')">
              <span>{{ $t('services.colAlerts') }}</span>
              <span class="sort-icon">
                <el-icon v-if="sortBy === 'alerts' && sortOrder === 'asc'"><CaretTop /></el-icon>
                <el-icon v-else-if="sortBy === 'alerts' && sortOrder === 'desc'"><CaretBottom /></el-icon>
                <el-icon v-else class="sort-icon-inactive"><DCaret /></el-icon>
              </span>
            </div>
          </template>
          <template #default="scope">
            <el-switch
              v-model="scope.row.alert_enabled"
              :active-value="1"
              :inactive-value="0"
              :disabled="!isAdmin"
              @change="handleToggleAlerts(scope.row)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="check_type" :label="$t('services.colType')" min-width="50">
          <template #default="scope">
            <el-tag size="small" type="info">{{ scope.row.check_type.toUpperCase() }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('services.colActions')" min-width="230" align="right" v-if="isAdmin">
          <template #default="scope">
            <el-tooltip :content="$t('services.tooltipRunCheck')" placement="top" :show-after="300">
              <el-button
                size="small"
                type="primary"
                :plain="true"
                :loading="runningChecks.has(scope.row.id)"
                @click.stop="handleRunCheck(scope.row)"
                style="padding: 2px 7px; margin-right: 4px;"
              >
                <el-icon v-if="!runningChecks.has(scope.row.id)" style="margin-right:3px;"><VideoPlay /></el-icon>
                <span>{{ $t('services.btnRun') }}</span>
              </el-button>
            </el-tooltip>
            <el-button link type="success" size="small" @click="handleCopy(scope.row)">{{ $t('services.btnCopy') }}</el-button>
            <el-button link type="primary" size="small" @click="handleEdit(scope.row)">{{ $t('services.btnEdit') }}</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(scope.row)">{{ $t('services.btnDelete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 15, 20, 50]"
          :total="filteredServices.length"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
    </el-card>

    <el-dialog 
      v-model="dialogVisible" 
      :title="isEdit ? $t('wizard.titleEditing') : (isCopy ? $t('wizard.titleCopying') : $t('wizard.titleAdding'))" 
      width="750px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :destroy-on-close="false"
    >
      <el-form :model="form" label-width="140px" label-position="top">
        <!-- Enhanced Info Banner -->
        <div :class="['service-form-banner', isEdit ? 'edit-banner' : 'add-banner']">
          <div class="banner-icon">
            <el-icon :size="24">
              <component :is="isEdit ? 'Edit' : 'Plus'" />
            </el-icon>
          </div>
          <div class="banner-content">
            <div class="banner-title">
              {{ isEdit ? $t('wizard.titleEditing') : (isCopy ? $t('wizard.titleCopying') : $t('wizard.titleAdding')) }}
            </div>
            <div class="banner-description">
              <template v-if="isEdit">
                <span>{{ $t('wizard.descEditing') }}</span>
              </template>
              <template v-else>
                <span>📋 Configure service monitoring settings. </span>
                <span>{{ $t('services.sectionHostConfig') }} </span>
                <router-link to="/hosts" class="banner-link" target="_blank">
                  <el-icon><Monitor /></el-icon>
                  <span>{{ $t('hosts.title') }}</span>
                  <el-icon><Right /></el-icon>
                </router-link>
              </template>
            </div>
          </div>
        </div>

        <!-- Status & Control Section - Highlighted at Top -->
        <div class="status-controls-section">
          <div class="status-header">
            <el-icon><Setting /></el-icon>
            <span>{{ $t('services.sectionStatusControl') }}</span>
          </div>
          <div class="status-controls-grid">
            <!-- Service Monitoring -->
            <div class="control-card">
              <div class="control-card-header">
                <div class="control-label">
                  <el-icon style="font-size: 16px;"><Monitor /></el-icon>
                  <span>{{ $t('services.labelMonitoring') }}</span>
                </div>
                <el-switch v-model="form.enabled" :active-value="1" :inactive-value="0" size="large" />
              </div>
              <div class="control-description">
                {{ $t('services.descMonitoring') }}
              </div>
              <el-tag v-if="form.enabled" type="success" size="small" style="margin-top: 8px;">
                <el-icon><CircleCheck /></el-icon>
                <span style="margin-left: 4px;">{{ $t('services.tagActiveMonitoring') }}</span>
              </el-tag>
              <el-tag v-else type="info" size="small" style="margin-top: 8px;">
                <el-icon><CircleClose /></el-icon>
                <span style="margin-left: 4px;">{{ $t('services.tagMonitoringDisabled') }}</span>
              </el-tag>
            </div>

            <!-- Alert Enabled -->
            <div class="control-card">
              <div class="control-card-header">
                <div class="control-label">
                  <el-icon style="font-size: 16px;"><Bell /></el-icon>
                  <span>{{ $t('services.labelAlerts') }}</span>
                </div>
                <el-switch v-model="form.alert_enabled" :active-value="1" :inactive-value="0" size="large" />
              </div>
              <div class="control-description">
                {{ $t('services.descAlerts') }}
              </div>
              <el-tag v-if="form.alert_enabled" type="success" size="small" style="margin-top: 8px;">
                <el-icon><CircleCheck /></el-icon>
                <span style="margin-left: 4px;">{{ $t('services.tagAlertsEnabled') }}</span>
              </el-tag>
              <el-tag v-else type="info" size="small" style="margin-top: 8px;">
                <el-icon><BellSlash /></el-icon>
                <span style="margin-left: 4px;">{{ $t('services.tagAlertsDisabled') }}</span>
              </el-tag>
            </div>

            <!-- Risk Level -->
            <div class="control-card">
              <div class="control-card-header">
                <div class="control-label">
                  <el-icon style="font-size: 16px;"><Warning /></el-icon>
                  <span>{{ $t('services.labelRiskLevel') }}</span>
                </div>
              </div>
              <el-select v-model="form.risk_level" style="width: 100%; margin-top: 8px;" size="large">
                <el-option :label="$t('services.riskLow')" value="low" />
                <el-option :label="$t('services.riskMedium')" value="medium" />
                <el-option :label="$t('services.riskHigh')" value="high" />
                <el-option :label="$t('services.riskCritical')" value="critical" />
              </el-select>
              <el-tag
                :type="form.risk_level === 'critical' ? 'danger' : form.risk_level === 'high' ? 'warning' : form.risk_level === 'medium' ? 'primary' : 'success'"
                size="small"
                style="margin-top: 8px;">
                <el-icon><Warning /></el-icon>
                <span style="margin-left: 4px;">{{ form.risk_level === 'critical' ? $t('services.tagCriticalImpact') : form.risk_level === 'high' ? $t('services.tagHighImpact') : form.risk_level === 'medium' ? $t('services.tagMediumImpact') : $t('services.tagLowImpact') }}</span>
              </el-tag>
            </div>
          </div>
        </div>

        <!-- Basic Information Section -->
        <el-divider content-position="left">
          <el-icon><Document /></el-icon>
          <span style="margin-left: 8px;">{{ $t('services.sectionBasicInfo') }}</span>
        </el-divider>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="$t('services.labelServiceName')" required>
              <el-input v-model="form.name" :placeholder="$t('services.placeholderServiceName')" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('services.labelIcon')">
              <IconSelector v-model="form.icon" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="$t('services.labelProject')">
              <el-select v-model="form.project_id" :placeholder="$t('services.placeholderSelectProject')" clearable style="width: 100%;" @change="handleProjectChange">
                <el-option 
                  v-for="project in projects" 
                  :key="project.id" 
                  :label="project.name" 
                  :value="project.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <!-- Empty column for layout balance -->
          </el-col>
        </el-row>

        <!-- Host Configuration Section -->
        <el-divider content-position="left">
          <el-icon><Monitor /></el-icon>
          <span style="margin-left: 8px;">{{ $t('services.sectionHostConfig') }}</span>
        </el-divider>

        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item :label="$t('services.labelSelectHost')" :required="!isEdit">
              <el-select 
                v-model="selectedHostId" 
                :placeholder="$t('services.placeholderSelectHost')" 
                style="width: 100%;"
                @change="handleHostSelect"
                clearable>
                <el-option
                  v-for="host in filteredHosts"
                  :key="host.id"
                  :label="`🖥️ ${host.name} (${host.ip})`"
                  :value="host.id">
                  <span>🖥️ {{ host.name }}</span>
                  <span style="color: #8c939d; font-size: 12px; margin-left: 8px;">({{ host.ip }})</span>
                </el-option>
              </el-select>
              <div v-if="!isEdit && filteredHosts.length === 0" style="margin-top: 8px;">
                <el-alert type="info" :closable="false" show-icon>
                  <template #title>
                    <span>{{ $t('services.noHostsAvailable') }} </span>
                    <router-link to="/hosts" style="color: #409eff; font-weight: 500;">{{ $t('hosts.title') }} →</router-link>
                  </template>
                </el-alert>
              </div>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- Selected Host Preview -->
        <div v-if="selectedHostData" class="host-preview-card">
          <div class="host-preview-header">
            <div class="host-preview-name">
              <el-icon><Monitor /></el-icon>
              <span>{{ selectedHostData.name }}</span>
              <el-tag :type="getHostStatus(selectedHostData) === 'healthy' ? 'success' : 'danger'" size="small" style="margin-left: 8px;">
                {{ getHostStatus(selectedHostData) }}
              </el-tag>
            </div>
          </div>
          <div class="host-preview-meta">
            <div>📍 IP: {{ selectedHostData.ip }}</div>
            <div v-if="selectedHostData.ssh_host">🔗 SSH: {{ selectedHostData.ssh_host }}:{{ selectedHostData.ssh_port }}</div>
            <div v-if="selectedHostData.ssh_username">👤 User: {{ selectedHostData.ssh_username }}</div>
            <div v-if="selectedHostData.ssh_auth_type">🔑 Auth: {{ selectedHostData.ssh_auth_type }}</div>
          </div>
        </div>

        <!-- New Host Form - REMOVED: Use Hosts Management page instead -->
        <div v-if="false" class="new-host-form">
          <div class="new-host-header">
            <div class="new-host-title">
              <el-icon color="#1890ff"><CirclePlus /></el-icon>
              <span>New Host Details</span>
            </div>
            <el-button size="small" @click="cancelNewHost">Cancel & Select Existing</el-button>
          </div>
          
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="Host Name" required>
                <el-input v-model="newHostForm.name" placeholder="e.g. production-server-01" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="IP Address / Hostname" required>
                <el-input v-model="newHostForm.ip" placeholder="e.g. 192.168.1.100" @input="syncHostToService" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item label="Connection Type">
                <el-radio-group v-model="newHostForm.connection_type">
                  <el-radio value="ssh">SSH</el-radio>
                  <el-radio value="local">Local</el-radio>
                  <el-radio :value="null">None</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>

          <template v-if="newHostForm.connection_type === 'ssh'">
            <el-row :gutter="16">
              <el-col :span="16">
                <el-form-item label="SSH Host">
                  <el-input v-model="newHostForm.ssh_host" placeholder="Same as IP if empty" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="SSH Port">
                  <el-input-number v-model="newHostForm.ssh_port" :min="1" :max="65535" style="width: 100%;" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="SSH Username">
                  <el-input v-model="newHostForm.ssh_username" placeholder="e.g. admin" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="Auth Type">
                  <el-select v-model="newHostForm.ssh_auth_type" style="width: 100%;">
                    <el-option label="Password" value="password" />
                    <el-option label="Private Key" value="private_key" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="16" v-if="newHostForm.ssh_auth_type === 'password'">
              <el-col :span="24">
                <el-form-item label="SSH Password">
                  <el-input v-model="newHostForm.ssh_password" type="password" show-password placeholder="Enter SSH password" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="16" v-else>
              <el-col :span="24">
                <el-form-item label="Private Key">
                  <el-input v-model="newHostForm.ssh_private_key" type="textarea" :rows="3" placeholder="Paste private key content" />
                </el-form-item>
              </el-col>
            </el-row>
          </template>

          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item label="Description">
                <el-input v-model="newHostForm.description" placeholder="Optional description" />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- Health Check Configuration -->
        <el-divider content-position="left">
          <el-icon><Pointer /></el-icon>
          <span style="margin-left: 8px;">{{ $t('services.sectionHealthCheck') }}</span>
        </el-divider>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="$t('services.labelCheckType')" required>
              <el-select v-model="form.check_type" @change="handleCheckTypeChange" style="width: 100%;">
                <el-option-group :label="$t('services.groupNetwork')">
                  <el-option :label="$t('services.typeTcp')" value="tcp" />
                  <el-option :label="$t('services.typeHttp')" value="http" />
                  <el-option :label="$t('services.typeHttps')" value="https" />
                </el-option-group>
                <el-option-group :label="$t('services.groupSystem')">
                  <el-option :label="$t('services.typeScript')" value="script" />
                </el-option-group>
                <el-option-group :label="$t('services.groupDataChecks')" class="coming-soon-group" :disabled="true">
                  <el-option :label="$t('services.typeMysql')" value="mysql" class="coming-soon-option" disabled />
                  <el-option :label="$t('services.typePostgresql')" value="postgresql" class="coming-soon-option" disabled />
                  <el-option :label="$t('services.typeRedis')" value="redis" class="coming-soon-option" disabled />
                  <el-option :label="$t('services.typeMongodb')" value="mongodb" class="coming-soon-option" disabled />
                </el-option-group>
                <el-option-group :label="$t('services.groupFile')">
                  <el-option :label="$t('services.typeFile')" value="file" />
                  <el-option :label="$t('services.typeLog')" value="log" />
                </el-option-group>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="!['script', 'file', 'log'].includes(form.check_type as string)">
            <el-form-item :label="$t('services.labelPort')" required>
              <el-input-number v-model="form.port" :min="1" :max="65535" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        <!-- Check Interval moved to Schedule Configuration section below -->

        <!-- HTTP Configuration (show only when check_type is http or https) -->
        <el-divider v-if="(form.check_type as string) === 'http' || (form.check_type as string) === 'https'" content-position="left">{{ $t('services.sectionHttpConfig') }}</el-divider>
        <el-row v-if="(form.check_type as string) === 'http' || (form.check_type as string) === 'https'" :gutter="20">
          <el-col :span="6">
            <el-form-item :label="$t('services.labelProtocol')">
              <el-select v-model="httpConfig.protocol" style="width: 100%;">
                <el-option label="HTTP" value="http" />
                <el-option label="HTTPS" value="https" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="18">
            <el-form-item :label="$t('services.labelHealthPath')">
              <el-input v-model="httpConfig.path" :placeholder="$t('services.placeholderHealthPath')" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="$t('services.labelExpectedStatus')">
              <el-input-number v-model="httpConfig.expected_status" :min="100" :max="599" style="width: 100%;" controls-position="right" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('services.labelTimeout')">
              <el-input-number v-model="httpConfig.timeout" :min="1000" :max="30000" :step="1000" style="width: 100%;" controls-position="right" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- Script Check Configuration -->
        <template v-if="(form.check_type as string) === 'script'">
          <el-divider content-position="left">{{ $t('services.sectionScriptConfig') }}</el-divider>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item :label="$t('services.labelScriptType')" required>
                <el-select v-model="scriptCheckConfig.script_type" style="width: 100%;">
                  <el-option :label="$t('services.scriptBash')" value="bash" />
                  <el-option :label="$t('services.scriptPython')" value="python" />
                  <el-option :label="$t('services.scriptPowershell')" value="powershell" />
                  <el-option :label="$t('services.scriptNode')" value="nodejs" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="24">
              <el-form-item :label="$t('services.labelScriptContent')" required>
                <el-input 
                  v-model="scriptCheckConfig.script_content" 
                  type="textarea" 
                  :rows="8"
                  :placeholder="scriptPlaceholder"
                  style="font-family: 'Courier New', monospace;"
                />
                <div style="font-size: 12px; color: #909399; margin-top: 4px;">
                  {{ $t('services.hintScriptExitCode') }}
                </div>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item :label="$t('services.labelExpectedExitCode')">
                <el-input-number v-model="scriptCheckConfig.expected_exit_code" :min="0" :max="255" style="width: 100%;" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item :label="$t('services.labelScriptTimeout')">
                <el-input-number v-model="scriptCheckConfig.timeout" :min="1" :max="300" style="width: 100%;" />
              </el-form-item>
            </el-col>
          </el-row>
        </template>

        <!-- Database Check Configuration -->
        <template v-if="['mysql', 'postgresql', 'redis', 'mongodb'].includes(form.check_type as string)">
          <el-divider content-position="left">{{ $t('services.sectionDatabaseConfig') }}</el-divider>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item :label="$t('services.labelDatabaseName')">
                <el-input v-model="databaseCheckConfig.database_name" placeholder="e.g. myapp_db" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item :label="$t('services.labelDbUsername')">
                <el-input v-model="databaseCheckConfig.username" :placeholder="$t('services.placeholderDbUsername')" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('services.labelDbPassword')">
                <el-input v-model="databaseCheckConfig.password" type="password" :placeholder="$t('services.placeholderDbPassword')" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="24">
              <el-form-item label="Test Query (Optional)">
                <el-input v-model="databaseCheckConfig.test_query" placeholder="e.g. SELECT 1" />
                <div style="font-size: 12px; color: #909399; margin-top: 4px;">
                  {{ $t('services.hintTestQuery') }}
                </div>
              </el-form-item>
            </el-col>
          </el-row>
        </template>

        <!-- File / Log Check Configuration -->
        <template v-if="['file', 'log'].includes(form.check_type as string)">
          <el-divider content-position="left">{{ $t('services.sectionFileConfig') }}</el-divider>
          <el-row :gutter="20">
            <el-col :span="24">
              <el-form-item :label="$t('services.labelMonitorMode')" required>
                <el-radio-group v-model="fileCheckConfig.mode">
                  <el-radio-button label="single">{{ $t('services.modeSingleFile') }}</el-radio-button>
                  <el-radio-button label="folder">{{ $t('services.modeFolderPattern') }}</el-radio-button>
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20" v-if="fileCheckConfig.mode === 'single'">
            <el-col :span="24">
              <el-form-item :label="$t('services.labelFilePath')" required>
                <el-input v-model="fileCheckConfig.file_path" :placeholder="$t('services.placeholderFilePath')" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20" v-else>
            <el-col :span="12">
              <el-form-item :label="$t('services.labelDirPath')" required>
                <el-input v-model="fileCheckConfig.directory_path" placeholder="e.g. /var/log/myapp/$(date +%F) or /var/log/myapp/*" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('services.labelFilePattern')" required>
                <el-input 
                  v-model="fileCheckConfig.filename_pattern" 
                  placeholder="e.g. app-.*\\.log or *.log">
                  <template #append>
                    <el-tooltip 
                      placement="top"
                      raw-content>
                      <template #content>
                        <div style="max-width: 300px;">
                          <strong>{{ $t('services.tooltipPatternTitle') }}</strong><br/>
                          {{ $t('services.tooltipPatternDesc') }}<br/><br/>
                          <strong>{{ $t('services.tooltipPatternExamples') }}</strong><br/>
                          • *.log - All .log files<br/>
                          • backup-[0-9]{4}-[0-9]{2}-[0-9]{2}.* - Date files<br/>
                          • db-.*\\.sql\\.gz - DB backups<br/>
                          • app-.*T[0-9]{4}\\.log - Timestamp files
                        </div>
                      </template>
                      <el-icon><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </template>
                </el-input>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item :label="$t('services.labelFileCheckType')">
                <el-select v-model="fileCheckConfig.check_type" style="width: 100%;">
                  <el-option :label="$t('services.fileExists')" value="exists" />
                  <el-option :label="$t('services.fileSize')" value="size" />
                  <el-option :label="$t('services.fileModified')" value="modified" />
                  <el-option :label="$t('services.contentPattern')" value="content" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('services.labelUseLatest')">
                <el-switch v-model="fileCheckConfig.use_latest" :active-value="true" :inactive-value="false" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item :label="$t('services.labelFreshnessDays')">
                <el-input-number v-model="fileCheckConfig.freshness_days" :min="0" :max="30" style="width: 100%;" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('services.labelMaxAge')">
                <div style="display: flex; width: 100%;">
                  <el-input-number 
                    v-model="fileCheckConfig.max_age_value" 
                    :min="0" 
                    :max="fileCheckConfig.max_age_unit === 'minutes' ? 10080 : fileCheckConfig.max_age_unit === 'hours' ? 168 : 30" 
                    style="width: 150px;" 
                  />
                  <el-select v-model="fileCheckConfig.max_age_unit" style="width: calc(100% - 150px);">
                    <el-option :label="$t('services.unitMinutes')" value="minutes" />
                    <el-option :label="$t('services.unitHours')" value="hours" />
                    <el-option :label="$t('services.unitDays')" value="days" />
                  </el-select>
                </div>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item :label="$t('services.labelContentPattern')">
                <el-input v-model="fileCheckConfig.content_pattern" placeholder="ERROR|FATAL" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('services.labelMinSize')">
                <el-input-number v-model="fileCheckConfig.expected_size_delta" :min="0" :max="102400" style="width: 100%;" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item :label="$t('services.labelFileTimeout')">
                <el-input-number v-model="fileCheckConfig.timeout_seconds" :min="5" :max="300" style="width: 100%;" />
              </el-form-item>
            </el-col>
          </el-row>
        </template>

        <!-- Schedule Configuration -->
        <el-divider content-position="left">
          <el-icon><Clock /></el-icon>
          <span style="margin-left: 8px;">{{ $t('services.sectionSchedule') }}</span>
        </el-divider>
        <div style="margin: 16px 0;">
          <ScheduleConfigPanel v-model="scheduleConfig" />
        </div>

        <!-- Alert Thresholds -->
        <el-divider content-position="left">
          <el-icon><DataLine /></el-icon>
          <span style="margin-left: 8px;">{{ $t('services.sectionAlertThresholds') }}</span>
        </el-divider>
        <div class="threshold-cards">
          <!-- Warning Threshold Card -->
          <div class="threshold-card">
            <div class="threshold-card-header">
              <el-icon style="font-size: 20px; color: #fa8c16;"><Warning /></el-icon>
              <span style="font-weight: 600; margin-left: 8px;">{{ $t('services.labelWarnThreshold') }}</span>
            </div>
            <div class="threshold-value">
              <el-input-number v-model="form.warning_threshold" :min="1" :max="30" size="large" style="width: 120px;" />
              <span class="threshold-unit">{{ $t('services.unitConsecutiveFailures') }}</span>
            </div>
            <div class="threshold-hint">
              {{ $t('services.hintWarnThreshold') }}
            </div>
          </div>

          <!-- Error Threshold Card -->
          <div class="threshold-card">
            <div class="threshold-card-header">
              <el-icon style="font-size: 20px; color: #f5222d;"><CircleClose /></el-icon>
              <span style="font-weight: 600; margin-left: 8px;">{{ $t('services.labelErrorThreshold') }}</span>
            </div>
            <div class="threshold-value">
              <el-input-number v-model="form.error_threshold" :min="1" :max="50" size="large" style="width: 120px;" />
              <span class="threshold-unit">{{ $t('services.unitConsecutiveFailures') }}</span>
            </div>
            <div class="threshold-hint">
              {{ $t('services.hintErrorThreshold') }}
            </div>
          </div>

          <!-- Alert Trigger Threshold Card -->
          <div class="threshold-card">
            <div class="threshold-card-header">
              <el-icon style="font-size: 20px; color: #722ed1;"><Bell /></el-icon>
              <span style="font-weight: 600; margin-left: 8px;">{{ $t('services.labelAlertTrigger') }}</span>
            </div>
            <div class="threshold-value">
              <el-input-number v-model="form.failure_threshold" :min="1" :max="10" size="large" style="width: 120px;" />
              <span class="threshold-unit">{{ $t('services.unitConsecutiveFailures') }}</span>
            </div>
            <div class="threshold-hint">
              {{ $t('services.hintAlertTrigger') }}
            </div>
          </div>
        </div>

        <!-- Service Alert Customization -->
        <el-divider content-position="left">{{ $t('services.sectionAlertCustomize') }}</el-divider>
        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item :label="$t('services.labelImpactDesc')">
              <el-input
                v-model="form.impact_description"
                type="textarea"
                :rows="2"
                :placeholder="$t('services.placeholderImpactDesc')"
              />
              <div style="font-size: 12px; color: #909399; margin-top: 4px;">
                {{ $t('services.hintImpactDesc') }}
              </div>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item :label="$t('services.labelAlertTemplate')">
              <el-input
                v-model="form.custom_alert_template"
                :placeholder="$t('services.placeholderAlertTemplate')"
              />
              <div style="font-size: 12px; color: #909399; margin-top: 4px;">
                {{ $t('services.hintAlertVars') }}
              </div>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- Dependencies Configuration -->
        <el-divider content-position="left">{{ $t('services.dividerDeps') }}</el-divider>
        
        <!-- Existing Dependencies Table -->
        <div v-if="serviceDependencies.length > 0" class="dependencies-table">
          <el-table :data="serviceDependencies" size="small" style="margin-bottom: 15px;" row-key="target_service_id">
            <el-table-column type="expand">
              <template #default="scope">
                <div style="padding: 12px 20px; background: #fafafa;">
                  <el-form label-position="top" size="small">
                    <el-form-item :label="$t('services.labelImpactDesc')" style="margin-bottom: 12px;">
                      <el-input
                        :model-value="scope.row.impact_description"
                        type="textarea"
                        :rows="2"
                        :placeholder="$t('services.placeholderDepImpact')"
                        @input="(val) => { scope.row.impact_description = val; }"
                        @blur="updateDependencyInList(scope.$index, 'impact_description', scope.row.impact_description)"
                      />
                    </el-form-item>
                    <el-form-item :label="$t('services.labelAlertTemplate')" style="margin-bottom: 0;">
                      <el-input
                        :model-value="scope.row.custom_alert_template"
                        :placeholder="$t('services.placeholderDepAlertTemplate')"
                        @input="(val) => { scope.row.custom_alert_template = val; }"
                        @blur="updateDependencyInList(scope.$index, 'custom_alert_template', scope.row.custom_alert_template)"
                      />
                      <div style="font-size: 12px; color: #909399; margin-top: 4px;">
                        {{ $t('services.hintDepAlertVars') }}
                      </div>
                    </el-form-item>
                  </el-form>
                </div>
              </template>
            </el-table-column>
            <el-table-column :label="$t('services.colTargetService')" min-width="180">
              <template #default="scope">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <el-tag 
                    v-if="isCrossProjectDependency(scope.row.target_service_id)" 
                    size="small" 
                    type="warning"
                    effect="plain"
                    style="font-size: 10px;"
                  >X-Project</el-tag>
                  <span>{{ getServiceNameById(scope.row.target_service_id) }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column :label="$t('common.type')" width="120">
              <template #default="scope">
                <el-select 
                  v-model="scope.row.dependency_type" 
                  size="small"
                  @change="updateDependencyInList(scope.$index, 'dependency_type', scope.row.dependency_type)"
                >
                  <el-option 
                    v-for="type in dependencyTypes" 
                    :key="type.name" 
                    :label="`${type.icon} ${type.label}`" 
                    :value="type.name"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column :label="$t('services.colRisk')" width="100">
              <template #default="scope">
                <el-select 
                  v-model="scope.row.risk_level" 
                  size="small"
                  @change="updateDependencyInList(scope.$index, 'risk_level', scope.row.risk_level)"
                >
                  <el-option :label="$t('services.riskLowSimple')" value="low" />
                  <el-option :label="$t('services.riskMediumSimple')" value="medium" />
                  <el-option :label="$t('services.riskHighSimple')" value="high" />
                  <el-option :label="$t('services.riskCriticalSimple')" value="critical" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column :label="$t('services.colAlerts')" width="60">
              <template #default="scope">
                <el-tooltip :content="scope.row.impact_description || scope.row.custom_alert_template ? $t('services.hasCustomAlertConfig') : $t('services.noCustomAlertConfig')" placement="top">
                  <el-icon :style="{ color: (scope.row.impact_description || scope.row.custom_alert_template) ? '#67c23a' : '#c0c4cc' }">
                    <Bell v-if="scope.row.impact_description || scope.row.custom_alert_template" />
                    <Notification v-else />
                  </el-icon>
                </el-tooltip>
              </template>
            </el-table-column>
            <el-table-column width="60">
              <template #default="scope">
                <el-button link type="danger" size="small" @click="removeDependencyFromList(scope.$index)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        
        <!-- Add New Dependency -->
        <el-row :gutter="10">
          <el-col :span="10">
            <el-select 
              v-model="newDependency.target_service_id" 
              :placeholder="$t('services.placeholderSelectService')" 
              style="width: 100%;"
              filterable
            >
              <el-option-group
                v-for="group in groupedServicesForDep"
                :key="group.projectId || 'no-project'"
                :label="`📁 ${group.projectName} (${group.services.length})`"
              >
                <el-option 
                  v-for="service in group.services" 
                  :key="service.id" 
                  :label="formatServiceLabel(service)" 
                  :value="service.id"
                />
              </el-option-group>
            </el-select>
          </el-col>
          <el-col :span="6">
            <el-select v-model="newDependency.dependency_type" :placeholder="$t('services.placeholderDepType')" style="width: 100%;">
              <el-option 
                v-for="type in dependencyTypes" 
                :key="type.name" 
                :label="`${type.icon} ${type.label}`" 
                :value="type.name"
              />
            </el-select>
          </el-col>
          <el-col :span="5">
            <el-select v-model="newDependency.risk_level" :placeholder="$t('services.colRisk')" style="width: 100%;">
              <el-option :label="$t('services.riskLowSimple')" value="low" />
              <el-option :label="$t('services.riskMediumSimple')" value="medium" />
              <el-option :label="$t('services.riskHighSimple')" value="high" />
              <el-option :label="$t('services.riskCriticalSimple')" value="critical" />
            </el-select>
          </el-col>
          <el-col :span="3">
            <el-button type="primary" @click="addDependencyToList" :disabled="!newDependency.target_service_id">
              <el-icon><Plus /></el-icon>
            </el-button>
          </el-col>
        </el-row>
        
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
          <el-button type="primary" @click="handleSubmit">{{ isEdit ? $t('common.update') : $t('common.create') }}</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Batch Edit Dialog -->
    <el-dialog 
      v-model="batchEditDialogVisible" 
      :title="$t('services.batchEditTitle')" 
      width="600px">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 20px">
        <template #title>
          <span style="font-size: 13px;">{{ $t('services.batchEditInfo', { n: selectedServices.length }) }}</span>
        </template>
      </el-alert>

      <el-form :model="batchEditForm" label-width="160px">
        <el-form-item :label="$t('services.labelCheckInterval')">
          <el-alert
            type="warning"
            :closable="false"
            style="margin-bottom: 8px; font-size: 12px;">
            <span>{{ $t('services.batchIntervalNote') }}</span>
          </el-alert>
          <el-input-number 
            v-model="batchEditForm.check_interval" 
            :min="10" 
            :max="3600" 
            :placeholder="$t('services.placeholderKeepCurrent')"
            clearable
            style="width: 100%;" />
          <div class="form-tip">{{ $t('services.tipCheckInterval') }}</div>
        </el-form-item>

        <el-form-item :label="$t('services.labelWarnThreshold')">
          <el-input-number 
            v-model="batchEditForm.warning_threshold" 
            :min="1" 
            :max="30"
            :placeholder="$t('services.placeholderKeepCurrent')"
            clearable
            style="width: 100%;" />
          <div class="form-tip">{{ $t('services.tipWarnThreshold') }}</div>
        </el-form-item>

        <el-form-item :label="$t('services.labelErrorThreshold')">
          <el-input-number 
            v-model="batchEditForm.error_threshold" 
            :min="1" 
            :max="50"
            :placeholder="$t('services.placeholderKeepCurrent')"
            clearable
            style="width: 100%;" />
          <div class="form-tip">{{ $t('services.tipErrorThreshold') }}</div>
        </el-form-item>

        <el-form-item :label="$t('services.labelRiskLevel')">
          <el-select 
            v-model="batchEditForm.risk_level" 
            :placeholder="$t('services.placeholderKeepCurrent')"
            clearable
            style="width: 100%;">
            <el-option :label="$t('services.riskLowSimple')" value="low" />
            <el-option :label="$t('services.riskMediumSimple')" value="medium" />
            <el-option :label="$t('services.riskHighSimple')" value="high" />
            <el-option :label="$t('services.riskCriticalSimple')" value="critical" />
          </el-select>
        </el-form-item>

        <el-form-item :label="$t('services.labelServiceEnabled')">
          <el-select 
            v-model="batchEditForm.enabled" 
            :placeholder="$t('services.placeholderKeepCurrent')"
            clearable
            style="width: 100%;">
            <el-option :label="$t('common.enabled')" :value="true" />
            <el-option :label="$t('common.disabled')" :value="false" />
          </el-select>
        </el-form-item>

        <el-form-item :label="$t('services.labelAlertEnabled')">
          <el-select 
            v-model="batchEditForm.alert_enabled" 
            :placeholder="$t('services.placeholderKeepCurrent')"
            clearable
            style="width: 100%;">
            <el-option :label="$t('common.enabled')" :value="true" />
            <el-option :label="$t('common.disabled')" :value="false" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="batchEditDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitBatchEdit">{{ $t('services.btnUpdateN', { n: selectedServices.length }) }}</el-button>
      </template>
    </el-dialog>

    <!-- Check Details Dialog -->
    <el-dialog
      v-model="checkDetailsVisible"
      :title="$t('services.checkDetailsTitle')"
      width="600px"
    >
      <div v-if="currentCheckDetails">
        <el-descriptions :column="1" border>
          <el-descriptions-item :label="$t('common.status')">
            <StatusBadge :status="currentCheckDetails.status" />
          </el-descriptions-item>
          <el-descriptions-item :label="$t('services.colResponse')">{{ currentCheckDetails.response_time }}ms</el-descriptions-item>
          <el-descriptions-item :label="$t('services.colLastCheck')">{{ formatTime(currentCheckDetails.checked_at) }}</el-descriptions-item>
          <el-descriptions-item :label="$t('services.checkMessage')" v-if="currentCheckDetails.error_message">
            <span class="text-error">{{ currentCheckDetails.error_message }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="currentCheckDetails.output" style="margin-top: 20px;">
          <h4>{{ $t('services.checkOutput') }}</h4>
          <pre style="background: #f5f7fa; padding: 10px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap;">{{ currentCheckDetails.output }}</pre>
        </div>

        <div v-if="currentCheckDetails.stdout" style="margin-top: 20px;">
          <h4>{{ $t('services.checkStdout') }}</h4>
          <pre style="background: #f5f7fa; padding: 10px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap;">{{ currentCheckDetails.stdout }}</pre>
        </div>

        <div v-if="currentCheckDetails.stderr" style="margin-top: 20px;">
          <h4>{{ $t('services.checkStderr') }}</h4>
          <pre style="background: #fff0f0; padding: 10px; border-radius: 4px; overflow-x: auto; color: #f56c6c; white-space: pre-wrap;">{{ currentCheckDetails.stderr }}</pre>
        </div>
        
        <div v-if="currentCheckDetails.details" style="margin-top: 20px;">
           <h4>{{ $t('services.checkDetails') }}</h4>
           <pre style="background: #f5f7fa; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px;">{{ JSON.stringify(currentCheckDetails.details, null, 2) }}</pre>
        </div>
      </div>
    </el-dialog>

    <!-- Add Service Wizard -->
    <AddServiceWizard
      v-model="wizardDialogVisible"
      :is-edit="isEdit"
      :is-copy="isCopy"
      :edit-data="(isEdit || isCopy) ? services.find(s => s.id === currentId) : null"
      :projects="projects"
      :hosts="hosts"
      :all-services="allServices"
      :dependency-types="dependencyTypes"
      :default-settings="generalSettings"
      @submit="handleWizardSubmit"
      @cancel="wizardDialogVisible = false"
      @host-created="handleHostCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive, computed, inject, watch, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getServices, getAllServices, createService, updateService, deleteService } from '../api/services';
import { getProjects, type ProjectWithStats } from '../api/projects';
import { getLatestCheck, runCheck } from '../api/checks';
import { getDependencyTypes, type DependencyType } from '../api/dependency-types';
import { createDependency, deleteDependency, updateDependency, getServiceDependencies } from '../api/dependencies';
import type { Service, CreateServiceDto } from '../types/service';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Plus, Download, Upload, Delete, Bell, BellFilled as BellSlash, Notification, Monitor, CircleCheckFilled, WarningFilled, CircleCloseFilled, CirclePlus, Setting, CircleCheck, CircleClose, Warning, Document, Pointer, DataLine, Edit, Select, Close, CaretTop, CaretBottom, DCaret, QuestionFilled, Clock, Right, VideoPlay } from '@element-plus/icons-vue';
import StatusBadge from '../components/StatusBadge.vue';
import ScheduleConfigPanel from '../components/ScheduleConfigPanel.vue';
import AddServiceWizard from '../components/AddServiceWizard.vue';
import IconSelector from '../components/IconSelector.vue';
import axios from 'axios';
import api from '../api';
import authUtils from '../utils/auth';
import type { ScheduleConfig } from '../types/schedule';
import { getHosts } from '../api/hosts';
import * as hostsApi from '../api/hosts';
import type { Host, CreateHostDto } from '../types/host';
import { useI18n } from 'vue-i18n';

// Props
const props = withDefaults(defineProps<{
  filterHostId?: string | null;  // 当在 Host 详情页使用时，按 host_id 过滤
  hideStats?: boolean;           // 隐藏统计卡片
  hideProjectFilter?: boolean;   // 隐藏项目筛选器
  hideActions?: boolean;         // 隐藏批量操作按钮（导入/导出）
}>(), {
  filterHostId: null,
  hideStats: false,
  hideProjectFilter: false,
  hideActions: false
});

// Router
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

// Manual check loading state
const runningChecks = ref<Set<string>>(new Set());
let sseSource: EventSource | null = null;
let _notifyProjectsThrottle: ReturnType<typeof setTimeout> | null = null;
function throttledNotifyProjects() {
  if (_notifyProjectsThrottle) return;
  _notifyProjectsThrottle = setTimeout(() => {
    notifyProjectsUpdated?.();
    _notifyProjectsThrottle = null;
  }, 2000);
}

onUnmounted(() => {
  if (sseSource) {
    sseSource.close();
    sseSource = null;
  }
});

async function handleRunCheck(service: any) {
  if (runningChecks.value.has(service.id)) return;
  runningChecks.value = new Set([...runningChecks.value, service.id]);
  try {
    const result = await runCheck(service.id);
    const statusMap: Record<string, string> = { up: 'success', down: 'error', warning: 'warning' };
    const msgType = (statusMap[result.status] || 'info') as 'success' | 'error' | 'warning' | 'info';
    const statusLabel = t(`statusLabels.${result.status}`) || result.status.toUpperCase();
    ElMessage[msgType](`${service.name}: ${statusLabel}${ result.response_time ? ` (${result.response_time}ms)` : '' }`);
    // Refresh service list to show updated status
    await fetchServices();
  } catch (e: any) {
    ElMessage.error(t('services.msgCheckFailed', { error: e.response?.data?.error || e.message }));
  } finally {
    const next = new Set(runningChecks.value);
    next.delete(service.id);
    runningChecks.value = next;
  }
}

// Permission check
const isAdmin = computed(() => authUtils.isAdmin());

// Script placeholder based on script type
const scriptPlaceholder = computed(() => {
  const templates = {
    bash: '#!/bin/bash\n# Your monitoring script here\n# Exit 0 for success, non-zero for failure\necho "Checking service status..."\nexit 0',
    python: '#!/usr/bin/env python3\n# Your monitoring script here\n# Exit 0 for success, non-zero for failure\nimport sys\nprint("Checking service status...")\nsys.exit(0)',
    powershell: '# Your monitoring script here\n# Exit 0 for success, non-zero for failure\nWrite-Host "Checking service status..."\nexit 0',
    nodejs: '#!/usr/bin/env node\n// Your monitoring script here\n// Exit 0 for success, non-zero for failure\nconsole.log("Checking service status...");\nprocess.exit(0);'
  };
  return templates[scriptCheckConfig.script_type as keyof typeof templates] || templates.bash;
});

// Inject current project context
const currentProjectId = inject<Ref<number | null>>('currentProjectId');
const notifyProjectsUpdated = inject<() => void>('notifyProjectsUpdated');

// Dependency types
const dependencyTypes = ref<DependencyType[]>([]);

// Hosts for SSH configuration
const hosts = ref<Host[]>([]);
const isCreatingNewHost = ref(false);
const selectedHostId = ref<string>('');
const selectedHostData = ref<Host | null>(null);

// New Host Form
const newHostForm = reactive<CreateHostDto>({
  name: '',
  ip: '',
  project_id: '',
  connection_type: 'ssh',
  ssh_host: '',
  ssh_port: 22,
  ssh_username: '',
  ssh_auth_type: 'password',
  ssh_password: '',
  ssh_private_key: '',
  ssh_passphrase: '',
  ssh_proxy_host: '',
  ssh_proxy_port: 22,
  description: '',
  tags: []
});

// Service dependency management
interface ServiceDepItem {
  target_service_id: string;
  dependency_type: string;
  risk_level: string;
  description?: string;
  impact_description?: string;        // Impact description for alerts
  custom_alert_template?: string;     // Custom alert message template
  isNew?: boolean;      // Track if this is a new dependency
  isModified?: boolean; // Track if this dependency was modified
  id?: string;          // Existing dependency ID
}

const serviceDependencies = ref<ServiceDepItem[]>([]);
const newDependency = reactive({
  target_service_id: '',
  dependency_type: 'depends',
  risk_level: 'medium',
  impact_description: '',
  custom_alert_template: ''
});

interface ServiceWithStatus extends Service {
  latestStatus?: string;
  latestCheck?: any;
}

const services = ref<ServiceWithStatus[]>([]);
const allServices = ref<ServiceWithStatus[]>([]);  // All services for cross-project dependency selection
const projects = ref<ProjectWithStats[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const wizardDialogVisible = ref(false);
const isEdit = ref(false);
const isCopy = ref(false);
const currentId = ref<string | null>(null);

// General Settings
const generalSettings = ref({
  defaultInterval: 60,
  warningThreshold: 3,
  errorThreshold: 5,
  dataRetentionDays: 30
});

// Filters
const searchQuery = ref('');
const filterProject = ref('');
const filterStatus = ref('');

// Pagination
const currentPage = ref(1);
const pageSize = ref(15);

// Sorting
const sortBy = ref<string>(''); // 排序字段
const sortOrder = ref<'asc' | 'desc' | ''>(''); // 排序方向

// Batch operations
const selectedServices = ref<ServiceWithStatus[]>([]);
const batchEditDialogVisible = ref(false);
const batchEditForm = ref({
  check_interval: null as number | null,
  warning_threshold: null as number | null,
  error_threshold: null as number | null,
  risk_level: null as string | null,
  enabled: null as boolean | null,
  alert_enabled: null as boolean | null
});

// Check Details Dialog
const checkDetailsVisible = ref(false);
const currentCheckDetails = ref<any>(null);
const currentDetailsServiceId = ref<string | null>(null);

const viewCheckDetails = async (service: any) => {
    if (!service) return;
    const serviceId = service.id || service.service_id;
    if (!serviceId) {
        ElMessage.warning(t('services.noCheckRecords'));
        return;
    }
    currentDetailsServiceId.value = serviceId;
    // 先显示已有数据（即时响应），再从 API 拉取最新完整数据
    currentCheckDetails.value = service.latestCheck || null;
    checkDetailsVisible.value = true;
    try {
        const fresh = await getLatestCheck(serviceId);
        currentCheckDetails.value = fresh;
    } catch (_) {
        if (!currentCheckDetails.value) ElMessage.warning(t('services.noCheckRecords'));
    }
};

const form = reactive<CreateServiceDto>({
  name: '',
  project_id: undefined,
  host: '',
  port: 80,
  check_type: 'tcp',
  risk_level: 'high',
  check_interval: 60,
  warning_threshold: 3, // Will be updated from generalSettings
  error_threshold: 5, // Will be updated from generalSettings
  failure_threshold: 3, // Alert trigger threshold
  enabled: 1,
  alert_enabled: 1,
  dependencies: [],
  impact_description: '',
  custom_alert_template: '',
  icon: '',
});

// Check Interval display fields (UI only)
const checkIntervalValue = ref(60);
const checkIntervalUnit = ref<'seconds' | 'minutes' | 'hours'>('seconds');

const httpConfig = reactive({
  protocol: 'https',
  path: '',
  expected_status: 200,
  timeout: 5000,
});

const scriptCheckConfig = reactive({
  script_type: 'bash',
  script_content: '',
  expected_exit_code: 0,
  timeout: 30
});

const databaseCheckConfig = reactive({
  database_name: '',
  username: '',
  password: '',
  test_query: 'SELECT 1'
});

const fileCheckConfig = reactive({
  mode: 'single',
  file_path: '',
  directory_path: '',
  filename_pattern: '',
  use_latest: true,
  freshness_days: 0,
  max_age_value: 60,
  max_age_unit: 'minutes',
  check_type: 'exists',
  expected_size_delta: 0,
  content_pattern: '',
  timeout_seconds: 30
});

// Schedule configuration
const scheduleConfig = ref<ScheduleConfig>({
  type: 'fixed',
  defaultInterval: 60,
  timeRanges: []
});

// SSH configs for dropdown
const sshConfigs = ref<any[]>([]);

// Helper function to convert max_age_minutes to max_age_value + max_age_unit
const convertMaxAgeToDisplay = (maxAgeMinutes: number) => {
  if (maxAgeMinutes === 0) {
    return { max_age_value: 0, max_age_unit: 'minutes' };
  }
  // Convert to most readable unit
  if (maxAgeMinutes % 1440 === 0) {
    // Can be expressed in days
    return { max_age_value: maxAgeMinutes / 1440, max_age_unit: 'days' };
  } else if (maxAgeMinutes % 60 === 0) {
    // Can be expressed in hours
    return { max_age_value: maxAgeMinutes / 60, max_age_unit: 'hours' };
  } else {
    // Keep in minutes
    return { max_age_value: maxAgeMinutes, max_age_unit: 'minutes' };
  }
};

// Helper function to convert check_interval (seconds) to display format
const convertCheckIntervalToDisplay = (intervalSeconds: number) => {
  if (intervalSeconds === 0) {
    return { value: 10, unit: 'seconds' as const };
  }
  // Convert to most readable unit
  if (intervalSeconds % 3600 === 0) {
    // Can be expressed in hours
    return { value: intervalSeconds / 3600, unit: 'hours' as const };
  } else if (intervalSeconds % 60 === 0) {
    // Can be expressed in minutes
    return { value: intervalSeconds / 60, unit: 'minutes' as const };
  } else {
    // Keep in seconds
    return { value: intervalSeconds, unit: 'seconds' as const };
  }
};

const fetchSSHConfigs = async () => {
  try {
    const response = await axios.get('/api/security-configs');
    sshConfigs.value = response.data.filter((c: any) => c.type === 'ssh');
  } catch (error) {
    console.error('Failed to fetch SSH configs:', error);
  }
};

const handleCheckTypeChange = () => {
  // Update protocol and port when switching between HTTP and HTTPS
  if (form.check_type === 'http') {
    httpConfig.protocol = 'http';
    if (!form.port || form.port === 443) {
      form.port = 80;
    }
  } else if (form.check_type === 'https') {
    httpConfig.protocol = 'https';
    if (!form.port || form.port === 80) {
      form.port = 443;
    }
  }
  
  // Reset config objects for different check types
  if (form.check_type === 'script') {
    scriptCheckConfig.script_type = 'bash';
    scriptCheckConfig.script_content = '';
    scriptCheckConfig.expected_exit_code = 0;
    scriptCheckConfig.timeout = 30;
  } else if (['mysql', 'postgresql', 'redis', 'mongodb'].includes(form.check_type as string)) {
    databaseCheckConfig.database_name = '';
    databaseCheckConfig.username = '';
    databaseCheckConfig.password = '';
    databaseCheckConfig.test_query = 'SELECT 1';
  } else if (['file', 'log'].includes(form.check_type as string)) {
    fileCheckConfig.mode = 'single';
    fileCheckConfig.file_path = '';
    fileCheckConfig.directory_path = '';
    fileCheckConfig.filename_pattern = '';
    fileCheckConfig.use_latest = true;
    fileCheckConfig.freshness_days = 0;
    fileCheckConfig.max_age_value = 60;
    fileCheckConfig.max_age_unit = 'minutes';
    fileCheckConfig.check_type = 'exists';
    fileCheckConfig.expected_size_delta = 0;
    fileCheckConfig.content_pattern = '';
    fileCheckConfig.timeout_seconds = 30;
  }
};

const availableServices = computed(() => {
  return services.value.filter(s => s.id !== currentId.value);
});

// Available services for new dependency (exclude already added) - use allServices for cross-project support
const availableServicesForDep = computed(() => {
  const addedIds = serviceDependencies.value.map(d => d.target_service_id);
  return allServices.value.filter(s => s.id !== currentId.value && !addedIds.includes(s.id));
});

// Group available services by project for dependency selector
const groupedServicesForDep = computed(() => {
  const groups: { projectName: string; projectId: string | null; services: ServiceWithStatus[] }[] = [];
  const projectMap = new Map<string | null, ServiceWithStatus[]>();
  
  // Group services by project
  availableServicesForDep.value.forEach(service => {
    const projectId = service.project_id || null;
    if (!projectMap.has(projectId)) {
      projectMap.set(projectId, []);
    }
    projectMap.get(projectId)!.push(service);
  });
  
  // Convert to array with project names
  projectMap.forEach((serviceList, projectId) => {
    const project = projects.value.find(p => p.id === projectId);
    groups.push({
      projectName: project ? project.name : 'No Project',
      projectId,
      services: serviceList.sort((a, b) => a.name.localeCompare(b.name))
    });
  });
  
  // Sort groups: projects first (alphabetically), then "No Project"
  return groups.sort((a, b) => {
    if (a.projectId === null) return 1;
    if (b.projectId === null) return -1;
    return a.projectName.localeCompare(b.projectName);
  });
});

// Get service name by ID (search in allServices for cross-project support)
const getServiceNameById = (serviceId: string): string => {
  const service = allServices.value.find(s => s.id === serviceId);
  if (service) {
    const project = projects.value.find(p => p.id === service.project_id);
    const projectName = project ? project.name : '';
    const portInfo = service.port && !['script', 'file', 'log'].includes(service.check_type) ? `:${service.port}` : '';
    return projectName ? `[${projectName}] ${service.name} (${service.host}${portInfo})` : `${service.name} (${service.host}${portInfo})`;
  }
  return serviceId;
};

// Format service label for display (hides port for script/file/log types)
const formatServiceLabel = (service: Service): string => {
  const portInfo = service.port && !['script', 'file', 'log'].includes(service.check_type) ? `:${service.port}` : '';
  return `${service.name} (${service.host}${portInfo})`;
};

// Check if a dependency is cross-project
const isCrossProjectDependency = (targetServiceId: string): boolean => {
  const targetService = allServices.value.find(s => s.id === targetServiceId);
  const currentService = services.value.find(s => s.id === currentId.value);
  if (!targetService || !currentService) return false;
  return targetService.project_id !== currentService.project_id;
};

// Add dependency to list
const addDependencyToList = () => {
  if (!newDependency.target_service_id) return;
  
  serviceDependencies.value.push({
    target_service_id: newDependency.target_service_id,
    dependency_type: newDependency.dependency_type,
    risk_level: newDependency.risk_level,
    impact_description: newDependency.impact_description || undefined,
    custom_alert_template: newDependency.custom_alert_template || undefined,
    isNew: true
  });
  
  // Reset form
  newDependency.target_service_id = '';
  newDependency.dependency_type = 'depends';
  newDependency.risk_level = 'medium';
  newDependency.impact_description = '';
  newDependency.custom_alert_template = '';
};

// Remove dependency from list
const removeDependencyFromList = (index: number) => {
  serviceDependencies.value.splice(index, 1);
};

// Update dependency in list
const updateDependencyInList = (index: number, field: string, value: string) => {
  (serviceDependencies.value[index] as any)[field] = value;
  // Mark as modified if it's an existing dependency
  if (!serviceDependencies.value[index].isNew) {
    serviceDependencies.value[index].isModified = true;
  }
};

// Load dependency types
const fetchDependencyTypes = async () => {
  try {
    dependencyTypes.value = await getDependencyTypes();
  } catch (error) {
    console.error('Failed to load dependency types:', error);
  }
};

// Load service dependencies for editing
const loadServiceDependencies = async (serviceId: string) => {
  try {
    const deps = await getServiceDependencies(serviceId);
    serviceDependencies.value = deps.dependsOn.map((d: any) => ({
      id: d.id,
      target_service_id: d.target_service_id,
      dependency_type: d.dependency_type,
      risk_level: d.risk_level || 'medium',
      description: d.description,
      impact_description: d.impact_description,
      custom_alert_template: d.custom_alert_template,
      isNew: false
    }));
  } catch (error) {
    console.error('Failed to load service dependencies:', error);
    serviceDependencies.value = [];
  }
};

// 排序处理函数
const handleSort = (column: string) => {
  if (sortBy.value === column) {
    // 如果点击的是当前排序列，切换排序方向
    if (sortOrder.value === 'asc') {
      sortOrder.value = 'desc';
    } else if (sortOrder.value === 'desc') {
      // 取消排序
      sortBy.value = '';
      sortOrder.value = '';
    }
  } else {
    // 如果点击的是新列，设置为升序
    sortBy.value = column;
    sortOrder.value = 'asc';
  }
};

// 获取排序后的服务列表
const filteredServices = computed(() => {
  let filtered = services.value.filter(s => {
    // 如果传入了 filterHostId，则只显示该 host 的服务
    const matchHost = !props.filterHostId || s.host_id === props.filterHostId;
    const matchProject = !filterProject.value || s.project_id === filterProject.value;
    // unknown 筛选需要匹配 latestStatus 为 'unknown'、undefined、null 或空的情况
    const matchStatus = !filterStatus.value || 
      (filterStatus.value === 'unknown' 
        ? (!s.latestStatus || s.latestStatus === 'unknown')
        : s.latestStatus === filterStatus.value);
    const matchQuery = !searchQuery.value || 
      s.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      s.host.toLowerCase().includes(searchQuery.value.toLowerCase());
    return matchHost && matchProject && matchStatus && matchQuery;
  });

  // 应用排序
  if (sortBy.value && sortOrder.value) {
    filtered = [...filtered].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy.value) {
        case 'status':
          // 状态排序: down > warning > unknown > up
          const statusOrder: Record<string, number> = {
            'down': 0,
            'warning': 1,
            'unknown': 2,
            'up': 3
          };
          aValue = statusOrder[a.latestStatus || 'unknown'];
          bValue = statusOrder[b.latestStatus || 'unknown'];
          break;

        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;

        case 'project':
          aValue = a.project_name?.toLowerCase() || '';
          bValue = b.project_name?.toLowerCase() || '';
          break;

        case 'lastChecked':
          // 按时间排序，未检查的放最后
          aValue = a.latestCheck?.checked_at ? new Date(a.latestCheck.checked_at).getTime() : 0;
          bValue = b.latestCheck?.checked_at ? new Date(b.latestCheck.checked_at).getTime() : 0;
          break;

        case 'monitoring':
          aValue = a.enabled;
          bValue = b.enabled;
          break;

        case 'alerts':
          aValue = a.alert_enabled;
          bValue = b.alert_enabled;
          break;

        default:
          return 0;
      }

      // 比较值
      if (aValue < bValue) {
        return sortOrder.value === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortOrder.value === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  return filtered;
});

// Paginated services
const paginatedServices = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredServices.value.slice(start, end);
});

const fetchServices = async () => {
  loading.value = true;
  try {
    const projectId = currentProjectId?.value;
    const hostId = props.filterHostId;
    const data = await getServices(projectId, hostId);
    // Fetch status for each service
    const servicesWithStatus = await Promise.all(data.map(async (s) => {
      // Skip fetching check records for disabled services to avoid 404 errors
      if (!s.enabled) {
        return { ...s, latestStatus: 'unknown', latestCheck: null };
      }
      
      try {
        const check = await getLatestCheck(s.id);
        return { ...s, latestStatus: check.status, latestCheck: check };
      } catch (e) {
        // No check records yet - set status to unknown and no latestCheck
        return { ...s, latestStatus: 'unknown', latestCheck: null };
      }
    }));
    services.value = servicesWithStatus;
  } catch (error) {
    ElMessage.error(t('services.msgOperationFailed'));
  } finally {
    loading.value = false;
  }
};

const fetchProjects = async () => {
  try {
    projects.value = await getProjects();
  } catch (error) {
    console.error('Failed to fetch projects:', error);
  }
};

// Fetch all services for cross-project dependency selection
const fetchAllServices = async () => {
  try {
    const data = await getAllServices();
    // Add status info for display
    const servicesWithStatus = await Promise.all(data.map(async (s) => {
      // Skip fetching check records for disabled services to avoid 404 errors
      if (!s.enabled) {
        return { ...s, latestStatus: 'unknown', latestCheck: null };
      }
      
      try {
        const check = await getLatestCheck(s.id);
        return { ...s, latestStatus: check.status, latestCheck: check };
      } catch (e) {
        // No check records yet - set status to unknown and no latestCheck
        return { ...s, latestStatus: 'unknown', latestCheck: null };
      }
    }));
    allServices.value = servicesWithStatus;
  } catch (error) {
    console.error('Failed to fetch all services:', error);
  }
};

const fetchHosts = async () => {
  try {
    hosts.value = await getHosts();
  } catch (error) {
    console.error('Failed to fetch hosts:', error);
  }
};

// Filter hosts by selected project
const filteredHosts = computed(() => {
  if (!form.project_id) return hosts.value;
  return hosts.value.filter(h => h.project_id === form.project_id);
});

// Toggle new host form
const toggleNewHostForm = () => {
  isCreatingNewHost.value = !isCreatingNewHost.value;
  if (isCreatingNewHost.value) {
    selectedHostId.value = '';
    selectedHostData.value = null;
    // Sync project to new host form
    if (form.project_id) {
      newHostForm.project_id = form.project_id;
    }
  } else {
    resetNewHostForm();
    form.host = '';
  }
};

// Cancel new host creation
const cancelNewHost = () => {
  isCreatingNewHost.value = false;
  resetNewHostForm();
  form.host = '';
};

// Handle host selection
const handleHostSelect = (hostId: string) => {
  if (!hostId) {
    selectedHostData.value = null;
    form.host = '';
    return;
  }
  
  const host = hosts.value.find(h => h.id === hostId);
  if (host) {
    selectedHostData.value = host;
    // Auto-fill service host field
    form.host = host.ssh_host || host.ip || '';
  }
};

// Handle project change
const handleProjectChange = (projectId: string | number | undefined) => {
  // Reset host selection when project changes
  selectedHostId.value = '';
  selectedHostData.value = null;
  form.host = '';
  
  // Update new host form project
  if (isCreatingNewHost.value && projectId) {
    newHostForm.project_id = projectId as string;
  }
};

// Sync host IP to service form
const syncHostToService = () => {
  if (isCreatingNewHost.value && newHostForm.ip) {
    form.host = newHostForm.ip;
  }
};

// Get host status - 使用与 HostsView 相同的逻辑
const getHostStatus = (host: Host): string => {
  // 优先使用最近的连接测试结果
  if (host.last_test_at && host.last_test_status) {
    const testTime = new Date(host.last_test_at).getTime();
    const now = Date.now();
    const hoursSinceTest = (now - testTime) / (1000 * 60 * 60);
    
    // 如果测试时间在24小时内，使用测试结果
    if (hoursSinceTest < 24) {
      if (host.last_test_status === 'success') {
        // 连接成功，检查服务状态
        if (host.health_stats) {
          if (host.health_stats.down_count > 0) return 'unhealthy';
          if (host.health_stats.warning_count > 0) return 'unhealthy';
        }
        return 'healthy';
      } else {
        // 连接失败
        return 'unhealthy';
      }
    }
  }
  
  // 没有测试结果，根据服务运行情况推断
  if (host.health_stats) {
    if (host.health_stats.down_count > 0) return 'unhealthy';
    if (host.health_stats.warning_count > 0) return 'unhealthy';
    if (host.health_stats.up_count > 0) return 'healthy';
  }
  
  // 使用后端返回的 status 字段（如果有）
  if (host.status) {
    return host.status === 'error' || host.status === 'warning' ? 'unhealthy' : 'healthy';
  }
  
  // 默认返回 unhealthy（未知状态视为不健康）
  return 'unhealthy';
};

const formatTime = (isoString: string) => {
  // 处理两种格式：
  // 1. ISO格式（新）: "2026-01-20T14:39:19.000Z"
  // 2. SQLite格式（旧）: "2026-01-20 06:39:19" (需要添加Z表示UTC)
  let dateStr = isoString;
  if (dateStr && !dateStr.includes('T') && !dateStr.includes('Z')) {
    dateStr = dateStr.replace(' ', 'T') + 'Z';  // 转换为ISO UTC格式
  }
  
  const date = new Date(dateStr);
  
  // 显示具体的本地时间: "2026-01-20 14:30:45"
  return date.toLocaleString('zh-CN', { 
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

const getResponseStatus = (time: number) => {
  if (time > 1000) return 'warning';
  if (time > 5000) return 'exception';
  return 'success';
};

const resetForm = () => {
  form.name = '';
  form.project_id = undefined;
  form.host = '';
  form.port = 80;
  form.check_type = 'tcp';
  form.risk_level = 'high';
  form.check_interval = generalSettings.value.defaultInterval;
  form.warning_threshold = generalSettings.value.warningThreshold;
  form.error_threshold = generalSettings.value.errorThreshold;
  form.enabled = 1;
  form.alert_enabled = 1;
  form.dependencies = [];
  form.impact_description = '';
  form.custom_alert_template = '';
  
  // Reset check interval display fields
  const intervalDisplay = convertCheckIntervalToDisplay(generalSettings.value.defaultInterval);
  checkIntervalValue.value = intervalDisplay.value;
  checkIntervalUnit.value = intervalDisplay.unit;
  
  // HTTP config
  httpConfig.protocol = 'https';
  httpConfig.path = '';
  httpConfig.expected_status = 200;
  httpConfig.timeout = 5000;
  
  // Script check config
  scriptCheckConfig.script_type = 'bash';
  scriptCheckConfig.script_content = '';
  scriptCheckConfig.expected_exit_code = 0;
  scriptCheckConfig.timeout = 30;
  
  // Database check config
  databaseCheckConfig.database_name = '';
  databaseCheckConfig.username = '';
  databaseCheckConfig.password = '';
  databaseCheckConfig.test_query = 'SELECT 1';
  
  // File check config
  fileCheckConfig.mode = 'single';
  fileCheckConfig.file_path = '';
  fileCheckConfig.directory_path = '';
  fileCheckConfig.filename_pattern = '';
  fileCheckConfig.use_latest = true;
  fileCheckConfig.freshness_days = 0;
  fileCheckConfig.max_age_value = 60;
  fileCheckConfig.max_age_unit = 'minutes';
  fileCheckConfig.check_type = 'exists';
  fileCheckConfig.expected_size_delta = 0;
  fileCheckConfig.content_pattern = '';
  fileCheckConfig.timeout_seconds = 30;
  
  // Reset schedule config - use generalSettings default
  scheduleConfig.value = {
    type: 'fixed',
    defaultInterval: generalSettings.value.defaultInterval,
    timeRanges: []
  };
  
  isEdit.value = false;
  isCopy.value = false;
  currentId.value = null;
  // Reset dependency management
  serviceDependencies.value = [];
  newDependency.target_service_id = '';
  newDependency.dependency_type = 'depends';
  newDependency.risk_level = 'medium';
  newDependency.impact_description = '';
  newDependency.custom_alert_template = '';
  
  // Reset host selection
  isCreatingNewHost.value = false;
  selectedHostId.value = '';
  selectedHostData.value = null;
  resetNewHostForm();
};

const resetNewHostForm = () => {
  newHostForm.name = '';
  newHostForm.ip = '';
  newHostForm.project_id = '';
  newHostForm.connection_type = 'ssh';
  newHostForm.ssh_host = '';
  newHostForm.ssh_port = 22;
  newHostForm.ssh_username = '';
  newHostForm.ssh_auth_type = 'password';
  newHostForm.ssh_password = '';
  newHostForm.ssh_private_key = '';
  newHostForm.ssh_passphrase = '';
  newHostForm.ssh_proxy_host = '';
  newHostForm.ssh_proxy_port = 22;
  newHostForm.description = '';
  newHostForm.tags = [];
};

const handleAdd = () => {
  resetForm();
  isEdit.value = false;
  isCopy.value = false;
  currentId.value = null;

  // 1. First priority: Check props (Embedded mode in Host Detail)
  if (props.filterHostId && hosts.value.length > 0) {
    const host = hosts.value.find(h => h.id === props.filterHostId);
    if (host) {
      selectedHostId.value = props.filterHostId;
      selectedHostData.value = host;
      form.host = host.ssh_host || host.ip || '';
      form.port = host.ssh_port || 22;
      if (host.project_id) {
        form.project_id = host.project_id;
      }
    }
    // Use wizard dialog for embedded mode
    wizardDialogVisible.value = true;
    return;
  }
  
  // 2. Second priority: Check query parameters (Standalone mode via link)
  const hostId = route.query.host_id as string;
  const projectId = route.query.project_id as string;
  
  if (hostId && hosts.value.length > 0) {
    const host = hosts.value.find(h => h.id === hostId);
    if (host) {
      // Pre-select host
      selectedHostId.value = hostId;
      selectedHostData.value = host;
      // Pre-fill form with host information
      form.host = host.ssh_host || host.ip || '';
      form.port = host.ssh_port || 22;
      if (projectId) {
        form.project_id = projectId;
      }
      ElMessage.success(t('services.msgHostPrefilled', { name: host.name }));
      
      // Clear query parameters after using them
      if (route.path === '/services') {
        router.replace({ path: '/services' });
      }
    }
    // Use wizard dialog when host pre-selected
    wizardDialogVisible.value = true;
    return;
  }
  
  // Default: Use new wizard dialog
  wizardDialogVisible.value = true;
};

const handleCopy = async (row: Service) => {
  // Reset form and set values from the source service
  resetForm();
  
  // Copy all properties except id
  form.name = `${row.name} (Copy)`;
  form.project_id = row.project_id;
  form.host = row.host;
  form.port = row.port;
  form.check_type = row.check_type;
  form.risk_level = row.risk_level;
  form.check_interval = row.check_interval;
  form.warning_threshold = row.warning_threshold;
  form.error_threshold = row.error_threshold;
  form.failure_threshold = row.failure_threshold || 3;
  form.enabled = row.enabled;
  form.alert_enabled = row.alert_enabled;
  form.layer = row.layer;
  form.impact_description = row.impact_description || '';
  form.custom_alert_template = row.custom_alert_template || '';
  form.icon = row.icon || '';
  
  // Debug: Log icon assignment
  console.log('📝 handleCopy - Setting form.icon:', {
    'row.icon': row.icon,
    'form.icon': form.icon
  });
  
  // Convert check_interval to display format
  const intervalDisplay = convertCheckIntervalToDisplay(row.check_interval);
  checkIntervalValue.value = intervalDisplay.value;
  checkIntervalUnit.value = intervalDisplay.unit;
  
  // Parse http_config if exists
  if (row.http_config && ((row.check_type as string) === 'http' || (row.check_type as string) === 'https')) {
    try {
      const config = typeof row.http_config === 'string' 
        ? JSON.parse(row.http_config) 
        : row.http_config;
      Object.assign(httpConfig, config);
    } catch (e) {
      console.error('Failed to parse http_config:', e);
    }
  }

  // Parse script_config if exists
  if (row.script_config && (row.check_type as string) === 'script') {
    try {
      const config = typeof row.script_config === 'string'
        ? JSON.parse(row.script_config)
        : row.script_config;
      Object.assign(scriptCheckConfig, {
        script_type: 'bash',
        script_content: '',
        expected_exit_code: 0,
        timeout: 30,
        ...config
      });
    } catch (e) {
      console.error('Failed to parse script_config:', e);
    }
  }

  // Parse file/log config
  if (row.file_config && ['file', 'log'].includes(row.check_type as string)) {
    try {
      const config = typeof row.file_config === 'string'
        ? JSON.parse(row.file_config)
        : row.file_config;
      
      // Convert max_age_minutes to display format
      const ageDisplay = convertMaxAgeToDisplay(config.max_age_minutes || 60);
      
      Object.assign(fileCheckConfig, {
        mode: 'single',
        file_path: '',
        directory_path: '',
        filename_pattern: '',
        use_latest: true,
        freshness_days: 0,
        max_age_value: 60,
        max_age_unit: 'minutes',
        check_type: 'exists',
        expected_size_delta: 0,
        content_pattern: '',
        timeout_seconds: 30,
        ...config,
        ...ageDisplay
      });
    } catch (e) {
      console.error('Failed to parse file_config:', e);
    }
  }

  // Parse file/log config
  if (row.file_config && ['file', 'log'].includes(row.check_type as string)) {
    try {
      const config = typeof row.file_config === 'string'
        ? JSON.parse(row.file_config)
        : row.file_config;
      
      // Convert max_age_minutes to display format
      const ageDisplay = convertMaxAgeToDisplay(config.max_age_minutes || 60);
      
      Object.assign(fileCheckConfig, {
        mode: 'single',
        file_path: '',
        directory_path: '',
        filename_pattern: '',
        use_latest: true,
        freshness_days: 0,
        max_age_value: 60,
        max_age_unit: 'minutes',
        check_type: 'exists',
        expected_size_delta: 0,
        content_pattern: '',
        timeout_seconds: 30,
        ...config,
        ...ageDisplay
      });
    } catch (e) {
      console.error('Failed to parse file_config:', e);
    }
  }
  
  // Load dependencies from source service (they will be created as new)
  await loadServiceDependencies(row.id);
  // Mark all dependencies as new since we're copying
  serviceDependencies.value.forEach(d => {
    d.isNew = true;
    delete d.id;
  });
  
  // Open wizard dialog in copy mode (not edit or add)
  isEdit.value = false;
  isCopy.value = true;
  currentId.value = row.id; // Set to source service ID for data loading
  wizardDialogVisible.value = true;
  
  ElMessage.info(t('services.msgCopied'));
};

const handleEdit = async (row: Service) => {
  console.log('🚀 handleEdit called with row:', row);
  
  try {
    isEdit.value = true;
    isCopy.value = false;
    currentId.value = row.id;
    
    console.log('✅ Step 1: Set isEdit and currentId');
  
    // Manually copy all fields to ensure proper type handling
    form.name = row.name;
    form.project_id = row.project_id;
    form.host = row.host;
    form.port = row.port;
    form.check_type = row.check_type;
    form.risk_level = row.risk_level;
    form.check_interval = row.check_interval;
    form.warning_threshold = row.warning_threshold;
    form.error_threshold = row.error_threshold;
    form.failure_threshold = row.failure_threshold || 3;
    form.enabled = row.enabled; // Keep as number (0/1)
    form.alert_enabled = row.alert_enabled; // Keep as number (0/1)
    form.dependencies = row.dependencies || [];
    form.impact_description = row.impact_description || '';
    form.custom_alert_template = row.custom_alert_template || '';
    form.description = row.description;
    form.host_id = row.host_id;
    form.service_type = row.service_type;
    form.ssh_config_id = row.ssh_config_id;
    form.ssh_check_type = row.ssh_check_type;
    form.ssh_check_config = row.ssh_check_config;
    form.layer = row.layer;
    form.http_config = row.http_config;
    form.check_config = row.check_config;
    form.script_config = row.script_config;
    form.process_config = row.process_config;
    form.database_config = row.database_config;
    form.file_config = row.file_config;
    form.icon = row.icon || '';
    
    console.log('✅ Step 2: Form populated');
  
    // Debug: Log icon assignment
    console.log('📝 handleEdit - Setting form.icon:', {
      'row.icon': row.icon,
      'form.icon': form.icon,
      rowData: row
    });
  
    // Convert check_interval to display format
    const intervalDisplay = convertCheckIntervalToDisplay(row.check_interval);
    checkIntervalValue.value = intervalDisplay.value;
    checkIntervalUnit.value = intervalDisplay.unit;

    console.log('✅ Step 3: Check interval converted');

    const supportedCheckTypes = ['tcp', 'http', 'https', 'script', 'file', 'log'];
    if (!supportedCheckTypes.includes(form.check_type as string)) {
      form.check_type = 'tcp';
      ElMessage.warning(t('services.msgCheckTypeUnsupported'));
    }
    
    console.log('✅ Step 4: Check type validated');
    
    // Set selected host if service has host_id
    if (row.host_id) {
      console.log('✅ Step 5: Processing host_id:', row.host_id);
      selectedHostId.value = row.host_id;
      // 获取最新的 host 数据（包含最新的连接状态）
      try {
        const latestHost = await hostsApi.hostsApi.get(row.host_id);
        selectedHostData.value = latestHost;
        
        // 同时更新内存中的 hosts 列表
        const index = hosts.value.findIndex(h => h.id === row.host_id);
        if (index !== -1) {
          hosts.value[index] = latestHost;
        }
        console.log('✅ Step 5a: Host data loaded');
      } catch (error) {
        console.error('Failed to fetch latest host data:', error);
        // 回退到内存中的数据
        const host = hosts.value.find(h => h.id === row.host_id);
        if (host) {
          selectedHostData.value = host;
        }
        console.log('⚠️ Step 5b: Using cached host data');
      }
    } else {
      // If service has no host_id, reset host selection
      selectedHostId.value = '';
      selectedHostData.value = null;
      console.log('✅ Step 5: No host_id, skipped');
    }
    
    // Parse http_config if exists
    if (row.http_config && ((row.check_type as string) === 'http' || (row.check_type as string) === 'https')) {
      try {
        const config = typeof row.http_config === 'string' 
          ? JSON.parse(row.http_config) 
          : row.http_config;
        Object.assign(httpConfig, config);
      } catch (e) {
        console.error('Failed to parse http_config:', e);
      }
    }
    
    // Parse script_config if exists
    if (row.script_config && (row.check_type as string) === 'script') {
      try {
        const config = typeof row.script_config === 'string'
          ? JSON.parse(row.script_config)
          : row.script_config;
        Object.assign(scriptCheckConfig, {
          script_type: 'bash',
          script_content: '',
          expected_exit_code: 0,
          timeout: 30,
          ...config
        });
      } catch (e) {
        console.error('Failed to parse script_config:', e);
      }
    }
    
    // Parse file/log config
    if (row.file_config && ['file', 'log'].includes(row.check_type as string)) {
      try {
        const config = typeof row.file_config === 'string'
          ? JSON.parse(row.file_config)
          : row.file_config;
        
        // Convert max_age_minutes to display format
        const ageDisplay = convertMaxAgeToDisplay(config.max_age_minutes || 60);
        
        Object.assign(fileCheckConfig, {
          mode: 'single',
          file_path: '',
          directory_path: '',
          filename_pattern: '',
          use_latest: true,
          freshness_days: 0,
          max_age_value: 60,
          max_age_unit: 'minutes',
          check_type: 'exists',
          expected_size_delta: 0,
          content_pattern: '',
          timeout_seconds: 30,
          ...config,
          ...ageDisplay
        });
      } catch (e) {
        console.error('Failed to parse file_config:', e);
      }
    }
    
    console.log('✅ Step 6: Parse configs completed');
    
    // Ensure dependencies is an array
    if (!form.dependencies || !Array.isArray(form.dependencies)) {
      form.dependencies = [];
    }
    
    // Load schedule configuration
    if (row.schedule_type && row.schedule_config) {
      try {
        const config = typeof row.schedule_config === 'string'
          ? JSON.parse(row.schedule_config)
          : row.schedule_config;
        scheduleConfig.value = {
          type: row.schedule_type as 'fixed' | 'timeRange',
          defaultInterval: config.defaultInterval || 60,
          timeRanges: config.timeRanges || []
        };
        console.log('✅ Step 7: Schedule config loaded from row');
      } catch (e) {
        console.error('Failed to parse schedule_config:', e);
        // Use default schedule config
        scheduleConfig.value = {
          type: 'fixed',
          defaultInterval: row.check_interval || 60,
          timeRanges: []
        };
        console.log('⚠️ Step 7: Using default schedule config');
      }
    } else {
      // No schedule config, use default based on check_interval
      scheduleConfig.value = {
        type: 'fixed',
        defaultInterval: row.check_interval || 60,
        timeRanges: []
      };
      console.log('✅ Step 7: Using default schedule config (no stored config)');
    }
    
    console.log('✅ Step 8: About to load dependencies');
    
    // Load existing dependencies with types
    await loadServiceDependencies(row.id);
    
    console.log('✅ Step 9: Dependencies loaded, opening dialog');
    
    // Use wizard dialog for edit mode
    wizardDialogVisible.value = true;
    
    console.log('🎉 handleEdit completed successfully!');
  } catch (error) {
    console.error('❌ Error in handleEdit:', error);
    ElMessage.error(t('services.msgOperationFailed'));
  }
};

// Batch operations handlers
const handleSelectionChange = (selection: ServiceWithStatus[]) => {
  selectedServices.value = selection;
};

const clearSelection = () => {
  selectedServices.value = [];
};

const handleBatchEdit = () => {
  // Reset form
  batchEditForm.value = {
    check_interval: null,
    warning_threshold: null,
    error_threshold: null,
    risk_level: null,
    enabled: null,
    alert_enabled: null
  };
  batchEditDialogVisible.value = true;
};

const handleToggleMonitoring = async (service: Service) => {
  try {
    const newStatus = service.enabled;
    await api.patch('/services/batch', {
      serviceIds: [service.id],
      updates: { enabled: newStatus }
    });
  } catch (error: any) {
    ElMessage.error(t('services.msgMonitorFailed'));
    // Revert the switch on error
    service.enabled = service.enabled === 1 ? 0 : 1;
  }
};

const handleToggleAlerts = async (service: Service) => {
  try {
    const newStatus = service.alert_enabled;
    await api.patch('/services/batch', {
      serviceIds: [service.id],
      updates: { alert_enabled: newStatus }
    });
  } catch (error: any) {
    ElMessage.error(t('services.msgAlertStatusFailed'));
    // Revert the switch on error
    service.alert_enabled = service.alert_enabled === 1 ? 0 : 1;
  }
};

const handleBatchEnable = async () => {
  try {
    const serviceIds = selectedServices.value.map(s => s.id);
    await api.patch('/services/batch', {
      serviceIds,
      updates: { enabled: 1 }
    });
    ElMessage.success(t('services.msgEnabledN', { n: serviceIds.length }));
    await fetchServices();
    clearSelection();
  } catch (error: any) {
    ElMessage.error(t('services.msgEnableFailed'));
  }
};

const handleBatchDisable = async () => {
  try {
    const serviceIds = selectedServices.value.map(s => s.id);
    await api.patch('/services/batch', {
      serviceIds,
      updates: { enabled: 0 }
    });
    ElMessage.success(t('services.msgDisabledN', { n: serviceIds.length }));
    await fetchServices();
    clearSelection();
  } catch (error: any) {
    ElMessage.error(t('services.msgDisableFailed'));
  }
};

const handleDelete = (row: Service) => {
  ElMessageBox.confirm(
    t('services.confirmDeleteMsg', { name: row.name }),
    t('services.confirmDeleteTitle'),
    {
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(async () => {
    try {
      await deleteService(row.id);
      ElMessage.success(t('services.msgDeleteDone'));
      fetchServices();
    } catch (error) {
      ElMessage.error(t('services.msgDeleteFailed'));
    }
  }).catch(() => {
    // User cancelled
  });
};

const handleBatchDelete = () => {
  ElMessageBox.confirm(
    t('services.confirmBatchDeleteMsg', { n: selectedServices.value.length }),
    t('services.confirmBatchDeleteTitle'),
    {
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(async () => {
    try {
      const promises = selectedServices.value.map(service =>
        deleteService(service.id)
      );
      await Promise.all(promises);
      ElMessage.success(t('services.msgDeleteDone'));
      await fetchServices();
      clearSelection();
    } catch (error: any) {
      ElMessage.error(t('services.msgDeleteFailed'));
    }
  }).catch(() => {
    // User cancelled
  });
};

const submitBatchEdit = async () => {
  try {
    // Filter out null values
    const updates: any = {};
    if (batchEditForm.value.check_interval !== null) updates.check_interval = batchEditForm.value.check_interval;
    if (batchEditForm.value.warning_threshold !== null) updates.warning_threshold = batchEditForm.value.warning_threshold;
    if (batchEditForm.value.error_threshold !== null) updates.error_threshold = batchEditForm.value.error_threshold;
    if (batchEditForm.value.risk_level !== null) updates.risk_level = batchEditForm.value.risk_level;
    if (batchEditForm.value.enabled !== null) updates.enabled = batchEditForm.value.enabled ? 1 : 0;
    if (batchEditForm.value.alert_enabled !== null) updates.alert_enabled = batchEditForm.value.alert_enabled ? 1 : 0;
    
    if (Object.keys(updates).length === 0) {
      ElMessage.warning(t('services.msgBatchSelectField'));
      return;
    }
    
    const serviceIds = selectedServices.value.map(s => s.id);
    const response = await api.patch('/services/batch', { serviceIds, updates });
    
    ElMessage.success(t('services.msgUpdated'));
    batchEditDialogVisible.value = false;
    await fetchServices();
    clearSelection();
  } catch (error: any) {
    ElMessage.error(t('services.msgOperationFailed'));
  }
};

const handleSubmit = async () => {
  try {
    // Step 1: Create/Update service
    // Auto-add pending dependency if user selected but didn't click "+"
    if (newDependency.target_service_id) {
      addDependencyToList();
    }
    
    // Prepare data with check-type-specific configs
    const data: any = { ...form };
    
    // Use check_interval from schedule configuration (not from old UI fields)
    data.check_interval = scheduleConfig.value.defaultInterval;
    
    // Set host_id: use selected host or null
    // In edit mode, explicitly handle null/empty to clear host association
    if (selectedHostId.value) {
      data.host_id = selectedHostId.value;
    } else if (isEdit.value) {
      // In edit mode, if no host is selected, explicitly set to null to clear the association
      data.host_id = null;
    }
    
    // HTTP/HTTPS configuration
    if ((form.check_type as string) === 'http' || (form.check_type as string) === 'https') {
      data.http_config = JSON.stringify(httpConfig);
    } else {
      data.http_config = null;
    }
    
    // Script Check configuration
    if ((form.check_type as string) === 'script') {
      data.script_config = JSON.stringify(scriptCheckConfig);
    }
    
    // Database Check configuration
    if (['mysql', 'postgresql', 'redis', 'mongodb'].includes(form.check_type as string)) {
      data.database_config = JSON.stringify(databaseCheckConfig);
    }
    
    // File Check configuration
    if (['file', 'log'].includes(form.check_type as string)) {
      // Convert max_age_value + max_age_unit to max_age_minutes
      const configToSave = { ...fileCheckConfig };
      let maxAgeMinutes = fileCheckConfig.max_age_value;
      if (fileCheckConfig.max_age_unit === 'hours') {
        maxAgeMinutes = fileCheckConfig.max_age_value * 60;
      } else if (fileCheckConfig.max_age_unit === 'days') {
        maxAgeMinutes = fileCheckConfig.max_age_value * 1440;
      }
      configToSave.max_age_minutes = maxAgeMinutes;
      // Remove UI-only fields
      delete (configToSave as any).max_age_value;
      delete (configToSave as any).max_age_unit;
      
      data.file_config = JSON.stringify(configToSave);
    }
    
    let serviceId: string;
    
    if (isEdit.value && currentId.value) {
      await updateService(currentId.value, data);
      serviceId = currentId.value;
      
      // Handle dependency updates
      // First, get existing dependencies to compare
      const existingDeps = await getServiceDependencies(serviceId);
      const existingIds = existingDeps.dependsOn.map((d: any) => d.id);
      const currentIds = serviceDependencies.value.filter(d => !d.isNew && d.id).map(d => d.id);
      
      // Delete removed dependencies
      for (const existingDep of existingDeps.dependsOn) {
        if (!currentIds.includes(existingDep.id)) {
          await deleteDependency(existingDep.id);
        }
      }
      
      // Update modified dependencies
      for (const dep of serviceDependencies.value) {
        if (!dep.isNew && dep.isModified && dep.id) {
          await updateDependency(dep.id, {
            dependency_type: dep.dependency_type,
            risk_level: dep.risk_level,
            description: dep.description,
            impact_description: dep.impact_description,
            custom_alert_template: dep.custom_alert_template
          });
        }
      }
      
      // Create new dependencies
      for (const dep of serviceDependencies.value) {
        if (dep.isNew) {
          await createDependency({
            source_service_id: serviceId,
            target_service_id: dep.target_service_id,
            dependency_type: dep.dependency_type,
            risk_level: dep.risk_level,
            description: dep.description,
            impact_description: dep.impact_description,
            custom_alert_template: dep.custom_alert_template
          });
        }
      }
      
      // Update schedule configuration
      try {
        await axios.put(`/api/services/${serviceId}/schedule`, scheduleConfig.value);
      } catch (scheduleError: any) {
        console.error('Failed to update schedule configuration:', scheduleError);
        ElMessage.warning(t('services.msgScheduleFailed'));
      }
      
      ElMessage.success(t('services.msgUpdated'));
    } else {
      const created = await createService(data);
      serviceId = created.id;
      
      // Create dependencies for new service
      for (const dep of serviceDependencies.value) {
        await createDependency({
          source_service_id: serviceId,
          target_service_id: dep.target_service_id,
          dependency_type: dep.dependency_type,
          risk_level: dep.risk_level,
          description: dep.description,
          impact_description: dep.impact_description,
          custom_alert_template: dep.custom_alert_template
        });
      }
      
      // Set schedule configuration for new service
      try {
        await axios.put(`/api/services/${serviceId}/schedule`, scheduleConfig.value);
      } catch (scheduleError: any) {
        console.error('Failed to set schedule configuration:', scheduleError);
        ElMessage.warning(t('services.msgScheduleFailed'));
      }
      
      ElMessage.success(t('services.msgCreated'));
    }
    
    dialogVisible.value = false;
    fetchServices();
    fetchAllServices();  // Refresh all services for dependency selection
    resetForm();
  } catch (error: any) {
    // Handle duplicate name error
    if (error?.response?.data?.code === 'DUPLICATE_NAME') {
      ElMessage.error(t('services.msgNameExists'));
    } else {
      ElMessage.error(error?.response?.data?.error || t('services.msgOperationFailed'));
    }
  }
};

// Handle wizard submit
const handleWizardSubmit = async (submitData: any, dependencies: any[]) => {
  try {
    // Prepare data
    const data: any = { ...submitData };
    
    // Handle HTTP/HTTPS config
    if (data.http_config && typeof data.http_config === 'object') {
      data.http_config = JSON.stringify(data.http_config);
    }
    
    // Handle script config
    if (data.script_config && typeof data.script_config === 'object') {
      data.script_config = JSON.stringify(data.script_config);
    }
    
    // Handle file config
    if (data.file_config && typeof data.file_config === 'object') {
      data.file_config = JSON.stringify(data.file_config);
    }
    
    // Handle schedule config
    const scheduleData = data.schedule_config || scheduleConfig.value;
    delete data.schedule_config;
    
    let serviceId: string;
    
    if (isEdit.value && currentId.value) {
      await updateService(currentId.value, data);
      serviceId = currentId.value;
      ElMessage.success(t('services.msgUpdated'));
      
      // Handle dependencies for edit mode: delete removed, create new
      const existingDeps = dependencies.filter(d => d.isExisting && d.id);
      const newDeps = dependencies.filter(d => !d.isExisting);
      const existingDepIds = existingDeps.map(d => d.id);
      
      // Get current dependencies from DB to find which ones to delete
      const currentDeps = await getServiceDependencies(serviceId);
      const currentDepIds = currentDeps.dependsOn.map((d: any) => d.id);
      
      // Delete dependencies that are no longer in the list
      for (const depId of currentDepIds) {
        if (!existingDepIds.includes(depId)) {
          try {
            await deleteDependency(depId);
          } catch (e) {
            console.error('Failed to delete dependency:', e);
          }
        }
      }
      
      // Create new dependencies
      for (const dep of newDeps) {
        await createDependency({
          source_service_id: serviceId,
          target_service_id: dep.target_service_id,
          dependency_type: dep.dependency_type,
          risk_level: dep.risk_level
        });
      }
    } else {
      const created = await createService(data);
      serviceId = created.id;
      ElMessage.success(t('services.msgCreated'));
      
      // Create all dependencies for new service
      for (const dep of dependencies) {
        await createDependency({
          source_service_id: serviceId,
          target_service_id: dep.target_service_id,
          dependency_type: dep.dependency_type,
          risk_level: dep.risk_level
        });
      }
    }
    
    // Set schedule configuration
    try {
      await axios.put(`/api/services/${serviceId}/schedule`, scheduleData);
    } catch (scheduleError: any) {
      console.error('Failed to set schedule configuration:', scheduleError);
      ElMessage.warning(t('services.msgScheduleFailed'));
    }
    
    wizardDialogVisible.value = false;
    resetForm(); // Clear form state after successful submit
    fetchServices();
    fetchAllServices();
  } catch (error: any) {
    if (error?.response?.data?.code === 'DUPLICATE_NAME') {
      ElMessage.error(t('services.msgNameExists'));
    } else {
      ElMessage.error(error?.response?.data?.error || t('services.msgOperationFailed'));
    }
  }
};

// Handle host created from wizard
const handleHostCreated = (newHost: any) => {
  // Add the new host to the hosts list
  hosts.value.push(newHost);
};

const handleExport = async () => {
  try {
    const response = await axios.get('/api/services/export', {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'services.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    ElMessage.error(t('services.msgExportFailed'));
  }
};

const handleImport = async (file: File) => {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target?.result as string);
      await axios.post('/api/services/import', json);
      ElMessage.success(t('services.msgImportSuccess'));
      fetchServices();
    } catch (error) {
      ElMessage.error(t('services.msgImportFailed'));
    }
  };
  reader.readAsText(file);
  return false;
};

// Load General Settings
const loadGeneralSettings = async () => {
  try {
    const response = await axios.get('/api/config/general');
    generalSettings.value = response.data;
    // Update form default values
    form.check_interval = response.data.defaultInterval;
    form.warning_threshold = response.data.warningThreshold;
    form.error_threshold = response.data.errorThreshold;
  } catch (error) {
    console.error('Failed to load general settings:', error);
  }
};

onMounted(() => {
  loadGeneralSettings();
  fetchServices();
  fetchProjects();
  fetchHosts();
  fetchDependencyTypes();
  fetchAllServices();  // Fetch all services for cross-project dependency selection

  // SSE: subscribe to real-time check result updates
  const token = authUtils.getToken();
  const apiBase = (api.defaults.baseURL || '/api').replace(/\/$/, '');
  sseSource = new EventSource(`${apiBase}/checks/events${token ? '?token=' + encodeURIComponent(token) : ''}`);
  sseSource.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as {
        serviceId: string;
        status: string;
        responseTime: number | null;
        errorMessage: string | null;
        checkedAt: string;
      };
      const svc = services.value.find(s => s.id === event.serviceId);
      if (svc) {
        svc.latestStatus = event.status;
        if (svc.latestCheck) {
          svc.latestCheck.status = event.status;
          svc.latestCheck.response_time = event.responseTime;
          svc.latestCheck.error_message = event.errorMessage;
          svc.latestCheck.checked_at = event.checkedAt;
        } else {
          svc.latestCheck = {
            status: event.status,
            response_time: event.responseTime,
            error_message: event.errorMessage,
            checked_at: event.checkedAt,
          };
        }
        // 若对话框正在显示该服务，重新拉取完整 check 数据（含 stdout/details 等）
        if (checkDetailsVisible.value && currentDetailsServiceId.value === event.serviceId) {
          getLatestCheck(event.serviceId).then(full => {
            currentCheckDetails.value = full;
            if (svc) svc.latestCheck = full;
          }).catch(() => {});
        }
        // 通知 ProjectsView / ProjectSelector 更新项目状态统计（节流 2s）
        throttledNotifyProjects();
      }
    } catch (_) {}
  };

  // Only auto-open dialog from query params in standalone mode (not embedded)
  // When embedded (filterHostId prop exists), ignore query params
  if (!props.filterHostId) {
    // Check if there's a host_id query parameter to trigger "Add Service"
    const hostId = route.query.host_id as string;
    const editId = route.query.edit as string;
    
    if (editId) {
      // Edit mode - wait for services to be loaded before opening edit dialog
      setTimeout(() => {
        const service = services.value.find(s => s.id === editId);
        if (service) {
          handleEdit(service);
        }
      }, 500);
    } else if (hostId) {
      // Add mode - wait for hosts to be loaded before opening dialog
      setTimeout(() => {
        handleAdd();
      }, 500);
    }
  }
});

// Debug: Watch form.icon changes
watch(() => form.icon, (newVal, oldVal) => {
  console.log('👁️ ServiceListView - form.icon changed:', {
    from: oldVal,
    to: newVal,
    dialogVisible: dialogVisible.value
  });
});

// Debug: Watch dialog visibility
watch(dialogVisible, (newVal) => {
  if (newVal) {
    console.log('🔔 Dialog opened with form.icon:', form.icon);
  }
});

// Watch for project changes and reload services
watch(() => currentProjectId?.value, () => {
  fetchServices();
});
</script>

<style scoped>
.service-list {
  padding: 0;
}

/* Status & Control Section Styles */
.status-controls-section {
  background: linear-gradient(135deg, #f0f5ff 0%, #f5f0ff 100%);
  border: 2px solid #d6e4ff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: 600;
  color: #1d39c4;
}

.status-controls-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.control-card {
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s;
}

.control-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.control-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.control-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #262626;
}

.control-description {
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.5;
  margin-bottom: 8px;
}

/* Threshold Cards Styles */
.threshold-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.threshold-card {
  background: #fafafa;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 16px;
}

.threshold-card-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
}

.threshold-value {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.threshold-unit {
  font-size: 13px;
  color: #595959;
  font-weight: 500;
}

.threshold-hint {
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.4;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .status-controls-grid {
    grid-template-columns: 1fr;
  }
  
  .threshold-cards {
    grid-template-columns: 1fr;
  }
}

.stats-row {
  margin-bottom: 20px;
}
.stat-card {
  background: #fff;
  border-radius: 4px;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
  transition: all 0.3s;
  height: 100px;
  box-sizing: border-box;
}
.stat-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}
.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stat-info {
  text-align: right;
}
.stat-label {
  color: #909399;
  font-size: 14px;
  margin-bottom: 5px;
}
.stat-value {
  color: #303133;
  font-size: 24px;
  font-weight: 600;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-title {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}
.filter-bar {
  margin-bottom: 20px;
  display: flex;
  gap: 15px;
}
.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
.dependencies-table {
  background: #f9fafb;
  border-radius: 8px;
  padding: 10px;
}
.dependencies-table :deep(.el-table) {
  background: transparent;
}
.dependencies-table :deep(.el-table__header-wrapper th) {
  background: transparent;
}
.dependencies-table :deep(.el-table__row) {
  background: transparent;
}

/* Batch Operations Styles */
.batch-actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  background: linear-gradient(135deg, #e6f4ff 0%, #f0f9ff 100%);
  border: 1px solid #91caff;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.08);
  min-height: 52px;
}

.batch-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-width: 180px;
}

.batch-icon {
  font-size: 18px;
  color: #1890ff;
}

.batch-count {
  font-size: 20px;
  font-weight: 700;
  color: #1890ff;
  min-width: 24px;
  text-align: center;
}

.batch-text {
  font-size: 14px;
  color: #595959;
  font-weight: 500;
  white-space: nowrap;
}

.batch-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.batch-buttons .el-button {
  min-width: 90px;
}

/* Responsive design for batch actions */
@media (max-width: 1024px) {
  .batch-actions-bar {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .batch-info {
    justify-content: center;
  }
  
  .batch-buttons {
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .batch-buttons .button-text {
    display: none;
  }
  
  .batch-buttons .el-button {
    min-width: auto;
    padding: 8px 12px;
  }
}

/* Host Management Styles */
.host-selector-container {
  display: flex;
  gap: 10px;
  align-items: center;
}

/* Service Form Banner Styles */
.service-form-banner {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid;
  transition: all 0.3s ease;
}

.service-form-banner:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.add-banner {
  background: linear-gradient(135deg, #e8f4fd 0%, #d4e9f7 100%);
  border-color: #409eff;
}

.edit-banner {
  background: linear-gradient(135deg, #fff7e6 0%, #ffe7ba 100%);
  border-color: #e6a23c;
}

.banner-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  flex-shrink: 0;
}

.add-banner .banner-icon {
  background: linear-gradient(135deg, #409eff 0%, #1890ff 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.edit-banner .banner-icon {
  background: linear-gradient(135deg, #e6a23c 0%, #f39c12 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(230, 162, 60, 0.3);
}

.banner-content {
  flex: 1;
}

.banner-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}

.add-banner .banner-title {
  color: #1890ff;
}

.edit-banner .banner-title {
  color: #d48806;
}

.banner-description {
  font-size: 14px;
  line-height: 1.6;
  color: #606266;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.banner-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #409eff;
  font-weight: 500;
  text-decoration: none;
  padding: 2px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  background: rgba(64, 158, 255, 0.1);
  margin-left: 4px;
}

.banner-link:hover {
  background: rgba(64, 158, 255, 0.2);
  color: #1890ff;
}

.host-preview-card {
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px 16px;
  margin-top: 12px;
  margin-bottom: 12px;
}

.host-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.host-preview-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.host-preview-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.host-preview-status.active {
  background: #e6f4ea;
  color: #2e7d32;
}

.host-preview-status.inactive {
  background: #fee;
  color: #c62828;
}

.host-preview-meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 12px;
  font-size: 13px;
  color: #606266;
}

.host-preview-label {
  color: #909399;
}

.new-host-form {
  border: 2px dashed #409eff;
  background: #ecf5ff;
  border-radius: 6px;
  padding: 16px;
  margin-top: 12px;
  margin-bottom: 12px;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.new-host-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.new-host-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #409eff;
  font-size: 14px;
  font-weight: 600;
}

.auto-filled .el-input__inner {
  background-color: #f0f9ff !important;
  border-color: #67c23a !important;
}

.auto-filled::after {
  content: '✓';
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #67c23a;
  font-weight: bold;
}

/* Sortable header styles */
.sortable-header {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
}

.sortable-header:hover {
  color: #409eff;
}

.sort-icon {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  color: #409eff;
}

.sort-icon-inactive {
  color: #c0c4cc;
  opacity: 0.6;
}

.sortable-header:hover .sort-icon-inactive {
  opacity: 1;
}
</style>

<!-- Global styles for select dropdown (teleported to body) -->
<style>
/* Dependency service selector styles - must be global since dropdown is teleported */
.el-select-dropdown .el-select-group__title {
  font-weight: 600 !important;
  font-size: 13px !important;
  color: #303133 !important;
  background: #f5f7fa !important;
  padding: 8px 12px !important;
}

.el-select-dropdown .el-select-group .el-select-dropdown__item {
  padding-left: 28px !important;
  font-size: 12px !important;
  color: #606266 !important;
}

.el-select-dropdown .el-select-group .el-select-dropdown__item:hover,
.el-select-dropdown .el-select-group .el-select-dropdown__item.is-hovering {
  background: #ecf5ff !important;
}

.el-select-dropdown .coming-soon-group .el-select-group__title,
.el-select-dropdown .coming-soon-option {
  color: #bfbfbf !important;
}
</style>
