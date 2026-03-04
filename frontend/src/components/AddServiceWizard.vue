<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? 'Edit Service' : (isCopy ? 'Copy Service' : 'Add Service')"
    width="800px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :destroy-on-close="false"
    class="add-service-wizard-dialog"
  >
    <!-- Info Banner (Dismissible) -->
    <div v-if="showBanner" :class="['wizard-banner', isEdit ? 'edit-banner' : 'add-banner']">
      <div class="banner-icon">
        <el-icon :size="24">
          <component :is="isEdit ? 'Edit' : 'Plus'" />
        </el-icon>
      </div>
      <div class="banner-content">
        <div class="banner-title">
          {{ isEdit ? '✏️ Editing Service' : (isCopy ? '📋 Copying Service' : '➕ Adding New Service') }}
        </div>
        <div class="banner-description">
          <template v-if="isEdit">
            <span>💡 Modify the service settings below. Changes will take effect immediately after saving.</span>
          </template>
          <template v-else-if="isCopy">
            <span>📋 Creating a copy. Modify the settings and save as a new service.</span>
          </template>
          <template v-else>
            <span>📋 Configure service monitoring in {{ totalSteps }} easy steps.</span>
          </template>
        </div>
      </div>
      <el-button class="banner-close" type="info" link @click="showBanner = false">
        <el-icon><Close /></el-icon>
      </el-button>
    </div>

    <!-- Step Indicator -->
    <div class="wizard-stepper">
      <div
        v-for="(step, index) in steps"
        :key="step.key"
        class="wizard-step"
        :class="{
          active: currentStep === index,
          completed: currentStep > index
        }"
        @click="goToStep(index)"
      >
        <div class="step-circle">
          <el-icon v-if="currentStep > index"><Check /></el-icon>
          <span v-else>{{ index + 1 }}</span>
        </div>
        <div class="step-label">{{ step.title }}</div>
      </div>
    </div>

    <!-- Step Content -->
    <div class="wizard-content">
      <!-- Step 1: Basic Information -->
      <div v-show="currentStep === 0" class="step-panel">
        <div class="section-title">
          <el-icon><Setting /></el-icon>
          <span>Service Status & Control</span>
        </div>

        <div class="status-controls-grid">
          <!-- Monitoring Toggle -->
          <div class="control-card">
            <div class="control-card-header">
              <div class="control-label">
                <el-icon><Monitor /></el-icon>
                <span>Monitoring</span>
              </div>
              <el-switch v-model="form.enabled" :active-value="1" :inactive-value="0" size="large" />
            </div>
            <div class="control-description">Enable health check monitoring</div>
            <el-tag :type="form.enabled ? 'success' : 'info'" size="small">
              {{ form.enabled ? 'Active' : 'Disabled' }}
            </el-tag>
          </div>

          <!-- Alerts Toggle -->
          <div class="control-card">
            <div class="control-card-header">
              <div class="control-label">
                <el-icon><Bell /></el-icon>
                <span>Alerts</span>
              </div>
              <el-switch v-model="form.alert_enabled" :active-value="1" :inactive-value="0" size="large" />
            </div>
            <div class="control-description">Send notifications on failure</div>
            <el-tag :type="form.alert_enabled ? 'success' : 'info'" size="small">
              {{ form.alert_enabled ? 'Enabled' : 'Disabled' }}
            </el-tag>
          </div>

          <!-- Risk Level -->
          <div class="control-card">
            <div class="control-card-header">
              <div class="control-label">
                <el-icon><Warning /></el-icon>
                <span>Risk Level</span>
              </div>
            </div>
            <el-select v-model="form.risk_level" style="width: 100%; margin-top: 8px;">
              <el-option label="🟢 Low" value="low" />
              <el-option label="🟡 Medium" value="medium" />
              <el-option label="🟠 High" value="high" />
              <el-option label="🔴 Critical" value="critical" />
            </el-select>
          </div>
        </div>

        <div class="section-title" style="margin-top: 20px;">
          <el-icon><Document /></el-icon>
          <span>Basic Information</span>
        </div>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="Service Name" required>
              <el-input v-model="form.name" placeholder="e.g. API Gateway" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Icon">
              <IconSelector v-model="form.icon" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="Project">
              <el-select v-model="form.project_id" placeholder="Select project" clearable style="width: 100%;">
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

        <div class="section-title">
          <el-icon><Monitor /></el-icon>
          <span>Host Configuration</span>
        </div>

        <el-row :gutter="12">
          <el-col :span="18">
            <el-form-item label="Select Host" :required="!isEdit">
              <el-select
                v-model="selectedHostId"
                placeholder="-- Select an existing host --"
                style="width: 100%;"
                @change="handleHostSelect"
                clearable
              >
                <el-option
                  v-for="host in filteredHosts"
                  :key="host.id"
                  :label="`🖥️ ${host.name} (${host.ip})`"
                  :value="host.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label=" ">
              <el-button type="primary" plain @click="showAddHostDialog = true" style="width: 100%;">
                <el-icon><Plus /></el-icon>
                <span>New Host</span>
              </el-button>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- Selected Host Preview -->
        <div v-if="selectedHostData" class="host-preview-card">
          <div class="host-preview-header">
            <el-icon><Monitor /></el-icon>
            <span>{{ selectedHostData.name }}</span>
            <el-tag :type="selectedHostData.status === 'healthy' ? 'success' : 'danger'" size="small">
              {{ selectedHostData.status || 'unknown' }}
            </el-tag>
          </div>
          <div class="host-preview-meta">
            <span>📍 IP: {{ selectedHostData.ip }}</span>
            <span v-if="selectedHostData.ssh_host">🔗 SSH: {{ selectedHostData.ssh_host }}:{{ selectedHostData.ssh_port }}</span>
          </div>
        </div>
      </div>

      <!-- Step 2: Health Check Configuration -->
      <div v-show="currentStep === 1" class="step-panel">
        <div class="section-title">
          <el-icon><Pointer /></el-icon>
          <span>Health Check Configuration</span>
        </div>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="Check Type" required>
              <el-select v-model="form.check_type" @change="handleCheckTypeChange" style="width: 100%;">
                <el-option-group label="Network Checks">
                  <el-option label="🔌 TCP Port Check" value="tcp" />
                  <el-option label="🌐 HTTP Check" value="http" />
                  <el-option label="🔒 HTTPS Check" value="https" />
                </el-option-group>
                <el-option-group label="System Checks">
                  <el-option label="📜 Script Check" value="script" />
                </el-option-group>
                <el-option-group label="File Checks">
                  <el-option label="📄 File Exists Check" value="file" />
                  <el-option label="📋 Log Monitor" value="log" />
                </el-option-group>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="!['script', 'file', 'log'].includes(form.check_type as string)">
            <el-form-item label="Port" required>
              <el-input-number v-model="form.port" :min="1" :max="65535" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- Check Type Info -->
        <el-alert type="info" :closable="false" show-icon style="margin-bottom: 16px;">
          <template #title>
            <span v-if="form.check_type === 'tcp'">TCP Port Check: Verifies if the specified port is open and accepting connections.</span>
            <span v-else-if="form.check_type === 'http'">HTTP Check: Sends HTTP request and validates response status code.</span>
            <span v-else-if="form.check_type === 'https'">HTTPS Check: Sends secure HTTPS request with SSL validation.</span>
            <span v-else-if="form.check_type === 'script'">Script Check: Executes a custom script and checks exit code.</span>
            <span v-else-if="form.check_type === 'file'">File Check: Monitors file existence and properties.</span>
            <span v-else-if="form.check_type === 'log'">Log Monitor: Monitors log files for patterns.</span>
          </template>
        </el-alert>

        <!-- HTTP Configuration -->
        <template v-if="form.check_type === 'http' || form.check_type === 'https'">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="Health Check Path">
                <el-input v-model="httpConfig.path" placeholder="/health or /api/health" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="Expected Status">
                <el-input-number v-model="httpConfig.expected_status" :min="100" :max="599" style="width: 100%;" controls-position="right" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="Timeout (ms)">
                <el-input-number v-model="httpConfig.timeout" :min="1000" :max="30000" :step="1000" style="width: 100%;" controls-position="right" />
              </el-form-item>
            </el-col>
          </el-row>
        </template>

        <!-- Script Configuration -->
        <template v-if="form.check_type === 'script'">
          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="Script Type" required>
                <el-select v-model="scriptCheckConfig.script_type" style="width: 100%;">
                  <el-option label="🐚 Bash Script" value="bash" />
                  <el-option label="🐍 Python Script" value="python" />
                  <el-option label="💻 PowerShell Script" value="powershell" />
                  <el-option label="📗 Node.js Script" value="nodejs" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="Expected Exit Code">
                <el-input-number v-model="scriptCheckConfig.expected_exit_code" :min="0" :max="255" style="width: 100%;" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="Timeout (sec)">
                <el-input-number v-model="scriptCheckConfig.timeout" :min="1" :max="300" style="width: 100%;" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="Script Content" required>
            <el-input
              v-model="scriptCheckConfig.script_content"
              type="textarea"
              :rows="6"
              :placeholder="scriptPlaceholder"
              style="font-family: 'Courier New', monospace;"
            />
          </el-form-item>
        </template>

        <!-- File Check Configuration -->
        <template v-if="form.check_type === 'file' || form.check_type === 'log'">
          <el-row :gutter="20">
            <el-col :span="24">
              <el-form-item label="Monitoring Mode">
                <el-radio-group v-model="fileCheckConfig.mode">
                  <el-radio-button label="single">Single File</el-radio-button>
                  <el-radio-button label="folder">Folder + Pattern</el-radio-button>
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20" v-if="fileCheckConfig.mode === 'single'">
            <el-col :span="24">
              <el-form-item label="File Path" required>
                <el-input v-model="fileCheckConfig.file_path" placeholder="e.g. /var/log/app.log" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20" v-else>
            <el-col :span="12">
              <el-form-item label="Directory Path" required>
                <el-input v-model="fileCheckConfig.directory_path" placeholder="e.g. /var/log/myapp/$(date +%F) or /var/log/myapp/*" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="Filename Pattern">
                <el-input v-model="fileCheckConfig.filename_pattern" placeholder="e.g. app-.*\.log or *.log" />
              </el-form-item>
            </el-col>
          </el-row>
        </template>

      </div>

      <!-- Step 3: Schedule Configuration -->
      <div v-show="currentStep === 2" class="step-panel">
        <div class="section-title">
          <el-icon><Clock /></el-icon>
          <span>Schedule Configuration</span>
        </div>

        <ScheduleConfigPanel v-model="scheduleConfig" />
      </div>

      <!-- Step 4: Alert Configuration -->
      <div v-show="currentStep === 3" class="step-panel">
        <div class="section-title">
          <el-icon><Bell /></el-icon>
          <span>Alert Thresholds</span>
        </div>

        <div class="threshold-cards">
          <div class="threshold-card">
            <div class="threshold-card-header">
              <el-icon style="color: #fa8c16;"><Warning /></el-icon>
              <span>Warning Threshold</span>
            </div>
            <div class="threshold-value">
              <el-input-number v-model="form.warning_threshold" :min="1" :max="30" size="large" />
              <span class="threshold-unit">consecutive failures</span>
            </div>
            <div class="threshold-hint">Range: 1-30</div>
          </div>

          <div class="threshold-card">
            <div class="threshold-card-header">
              <el-icon style="color: #f5222d;"><CircleClose /></el-icon>
              <span>Error Threshold</span>
            </div>
            <div class="threshold-value">
              <el-input-number v-model="form.error_threshold" :min="1" :max="50" size="large" />
              <span class="threshold-unit">consecutive failures</span>
            </div>
            <div class="threshold-hint">Range: 1-50</div>
          </div>

          <div class="threshold-card">
            <div class="threshold-card-header">
              <el-icon style="color: #722ed1;"><Bell /></el-icon>
              <span>Alert Trigger</span>
            </div>
            <div class="threshold-value">
              <el-input-number v-model="form.failure_threshold" :min="1" :max="10" size="large" />
              <span class="threshold-unit">consecutive failures</span>
            </div>
            <div class="threshold-hint">Send alert after this many failures (Range: 1-10)</div>
          </div>
        </div>

        <div class="section-title" style="margin-top: 24px;">
          <el-icon><Edit /></el-icon>
          <span>Alert Customization (Optional)</span>
        </div>

        <el-form-item label="Service Impact Description">
          <el-input
            v-model="form.impact_description"
            type="textarea"
            :rows="2"
            placeholder="Describe the impact when this service is down..."
          />
        </el-form-item>

        <el-form-item label="Custom Alert Template">
          <el-input
            v-model="form.custom_alert_template"
            placeholder="{service_name} is down! {impact_description}"
          />
          <div class="form-hint">Variables: {service_name}, {host}, {port}, {risk_level}, {down_time}</div>
        </el-form-item>

        <el-divider content-position="left">Dependencies (Optional)</el-divider>

        <!-- Dependencies Table -->
        <div v-if="serviceDependencies.length > 0" class="dependencies-table">
          <el-table :data="serviceDependencies" size="small" style="margin-bottom: 15px;">
            <el-table-column label="Target Service" min-width="180">
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
            <el-table-column label="Type" width="120">
              <template #default="scope">
                <el-select v-model="scope.row.dependency_type" size="small">
                  <el-option
                    v-for="type in dependencyTypes"
                    :key="type.name"
                    :label="`${type.icon} ${type.label}`"
                    :value="type.name"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="Risk" width="100">
              <template #default="scope">
                <el-select v-model="scope.row.risk_level" size="small">
                  <el-option label="Low" value="low" />
                  <el-option label="Medium" value="medium" />
                  <el-option label="High" value="high" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column width="60">
              <template #default="scope">
                <el-button link type="danger" @click="removeDependency(scope.$index)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- Add New Dependency -->
        <el-row :gutter="10" style="margin-top: 12px;">
          <el-col :span="10">
            <el-select
              v-model="newDependency.target_service_id"
              placeholder="Select service"
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
            <el-select v-model="newDependency.dependency_type" style="width: 100%;">
              <el-option
                v-for="type in dependencyTypes"
                :key="type.name"
                :label="`${type.icon} ${type.label}`"
                :value="type.name"
              />
            </el-select>
          </el-col>
          <el-col :span="5">
            <el-select v-model="newDependency.risk_level" style="width: 100%;">
              <el-option label="Low" value="low" />
              <el-option label="Medium" value="medium" />
              <el-option label="High" value="high" />
            </el-select>
          </el-col>
          <el-col :span="3">
            <el-button type="primary" @click="addDependency" :disabled="!newDependency.target_service_id">
              <el-icon><Plus /></el-icon>
            </el-button>
          </el-col>
        </el-row>
      </div>

      <!-- Step 5: Confirm & Review -->
      <div v-show="currentStep === 4" class="step-panel">
        <el-alert type="success" :closable="false" show-icon style="margin-bottom: 20px;">
          <template #title>
            Review your configuration below. Click "{{ isEdit ? 'Update' : 'Create' }}" to save.
          </template>
        </el-alert>

        <div class="review-section">
          <div class="review-section-title">
            <el-icon><Document /></el-icon>
            <span>Basic Information</span>
            <el-button link type="primary" size="small" @click="goToStep(0)">Edit</el-button>
          </div>
          <div class="review-grid">
            <div class="review-item">
              <span class="review-label">Service Name</span>
              <span class="review-value">{{ form.name || '-' }}</span>
            </div>
            <div class="review-item">
              <span class="review-label">Icon</span>
              <span class="review-value" style="font-size: 20px;">{{ form.icon || '🔧' }}</span>
            </div>
            <div class="review-item">
              <span class="review-label">Project</span>
              <span class="review-value">{{ getProjectName(form.project_id) || '-' }}</span>
            </div>
            <div class="review-item">
              <span class="review-label">Host</span>
              <span class="review-value">{{ selectedHostData?.name || form.host || '-' }}</span>
            </div>
            <div class="review-item">
              <span class="review-label">Risk Level</span>
              <span class="review-value">{{ form.risk_level }}</span>
            </div>
            <div class="review-item">
              <span class="review-label">Monitoring</span>
              <el-tag :type="form.enabled ? 'success' : 'info'" size="small">
                {{ form.enabled ? 'Active' : 'Disabled' }}
              </el-tag>
            </div>
            <div class="review-item">
              <span class="review-label">Alerts</span>
              <el-tag :type="form.alert_enabled ? 'success' : 'info'" size="small">
                {{ form.alert_enabled ? 'Enabled' : 'Disabled' }}
              </el-tag>
            </div>
          </div>
        </div>

        <div class="review-section">
          <div class="review-section-title">
            <el-icon><Pointer /></el-icon>
            <span>Health Check</span>
            <el-button link type="primary" size="small" @click="goToStep(1)">Edit</el-button>
          </div>
          <div class="review-grid">
            <div class="review-item">
              <span class="review-label">Check Type</span>
              <span class="review-value">{{ form.check_type?.toUpperCase() }}</span>
            </div>
            <div class="review-item" v-if="!['script', 'file', 'log'].includes(form.check_type as string)">
              <span class="review-label">Port</span>
              <span class="review-value">{{ form.port }}</span>
            </div>
          </div>
        </div>

        <div class="review-section">
          <div class="review-section-title">
            <el-icon><Clock /></el-icon>
            <span>Schedule</span>
            <el-button link type="primary" size="small" @click="goToStep(2)">Edit</el-button>
          </div>
          <div class="review-grid">
            <div class="review-item">
              <span class="review-label">Mode</span>
              <span class="review-value">{{ scheduleConfig.type === 'fixed' ? 'Fixed Interval' : 'Time Rules' }}</span>
            </div>
            <div class="review-item">
              <span class="review-label">Default Interval</span>
              <span class="review-value">{{ scheduleConfig.defaultInterval }} seconds</span>
            </div>
          </div>
        </div>

        <div class="review-section">
          <div class="review-section-title">
            <el-icon><Bell /></el-icon>
            <span>Alert Settings</span>
            <el-button link type="primary" size="small" @click="goToStep(3)">Edit</el-button>
          </div>
          <div class="review-grid">
            <div class="review-item">
              <span class="review-label">Warning / Error</span>
              <span class="review-value">{{ form.warning_threshold }} / {{ form.error_threshold }} failures</span>
            </div>
            <div class="review-item">
              <span class="review-label">Alert Trigger</span>
              <span class="review-value">After {{ form.failure_threshold }} failures</span>
            </div>
            <div class="review-item" v-if="serviceDependencies.length > 0">
              <span class="review-label">Dependencies</span>
              <span class="review-value">{{ serviceDependencies.length }} service(s)</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <div class="wizard-footer">
        <el-button @click="handlePrevious" :disabled="currentStep === 0">
          ← Previous
        </el-button>
        <div class="footer-right">
          <el-button @click="handleCancel">Cancel</el-button>
          <el-button
            type="primary"
            @click="handleNext"
            :loading="submitting"
          >
            {{ currentStep === totalSteps - 1 ? (isEdit ? 'Update' : 'Create') : 'Next →' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>

  <!-- Add Host Dialog (Full Version) -->
  <el-dialog
    v-model="showAddHostDialog"
    title="Add New Host"
    width="650px"
    :close-on-click-modal="false"
  >
    <el-form :model="newHostForm" label-width="140px">
      <el-form-item label="Host Name" required>
        <el-input v-model="newHostForm.name" placeholder="prod-web-01" />
      </el-form-item>
      
      <el-form-item label="IP / Hostname" required>
        <el-input v-model="newHostForm.ip" placeholder="192.168.1.100 or example.com" />
      </el-form-item>
      
      <el-form-item label="Project">
        <el-select v-model="newHostForm.project_id" placeholder="Select project" clearable style="width: 100%;">
          <el-option
            v-for="proj in projects"
            :key="proj.id"
            :label="proj.name"
            :value="proj.id"
          />
        </el-select>
      </el-form-item>
      
      <el-form-item label="Connection Type">
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
          <div 
            class="connection-card"
            :class="{ active: newHostForm.connection_type === 'ssh' }"
            @click="newHostForm.connection_type = 'ssh'">
            <div class="connection-icon">🔐</div>
            <div class="connection-name">SSH</div>
            <div class="connection-desc">Remote access</div>
          </div>
          <div 
            class="connection-card"
            :class="{ active: newHostForm.connection_type === 'local' }"
            @click="newHostForm.connection_type = 'local'">
            <div class="connection-icon">💻</div>
            <div class="connection-name">Local</div>
            <div class="connection-desc">Ping check</div>
          </div>
        </div>
      </el-form-item>
      
      <!-- SSH Configuration Section -->
      <template v-if="newHostForm.connection_type === 'ssh'">
        <el-divider content-position="left">SSH Configuration</el-divider>
        
        <el-form-item label="SSH Port">
          <el-input-number v-model="newHostForm.ssh_port" :min="1" :max="65535" style="width: 150px" />
          <span style="margin-left: 12px; color: #909399;">Default: 22</span>
        </el-form-item>
        
        <el-form-item label="Username">
          <el-input v-model="newHostForm.ssh_username" placeholder="root or admin" />
        </el-form-item>
        
        <el-form-item label="Auth Type">
          <el-radio-group v-model="newHostForm.ssh_auth_type">
            <el-radio value="password">Password</el-radio>
            <el-radio value="private_key">Private Key</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item v-if="newHostForm.ssh_auth_type === 'password'" label="Password">
          <el-input 
            v-model="newHostForm.ssh_password" 
            type="password" 
            show-password 
            placeholder="SSH password" />
        </el-form-item>
        
        <el-form-item v-if="newHostForm.ssh_auth_type === 'private_key'" label="Private Key">
          <el-input 
            v-model="newHostForm.ssh_private_key" 
            type="textarea" 
            :rows="4"
            placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----" />
        </el-form-item>
        
        <el-form-item v-if="newHostForm.ssh_auth_type === 'private_key'" label="Passphrase">
          <el-input 
            v-model="newHostForm.ssh_passphrase" 
            type="password" 
            show-password 
            placeholder="Leave empty if no passphrase" />
        </el-form-item>
        
        <el-divider content-position="left">Proxy (Optional)</el-divider>
        
        <el-form-item label="Proxy Host">
          <el-select 
            v-model="newHostForm.ssh_proxy_host" 
            placeholder="Select proxy or enter manually"
            filterable
            allow-create
            clearable
            style="width: 100%">
            <el-option
              v-for="host in hosts.filter(h => h.connection_type === 'ssh' && h.ssh_host)"
              :key="host.id"
              :label="`${host.name} (${host.ssh_host || host.ip})`"
              :value="host.ssh_host || host.ip">
            </el-option>
          </el-select>
        </el-form-item>
        
        <el-form-item v-if="newHostForm.ssh_proxy_host" label="Proxy Port">
          <el-input-number v-model="newHostForm.ssh_proxy_port" :min="1" :max="65535" style="width: 150px" />
        </el-form-item>
        
        <el-divider content-position="left">Advanced Settings</el-divider>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="Max Retries">
              <el-input-number v-model="newHostForm.ssh_max_retries" :min="1" :max="10" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Retry Delay (s)">
              <el-input-number v-model="newHostForm.ssh_retry_delay" :min="1" :max="10" :step="1" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="Conn Timeout (s)">
              <el-input-number v-model="newHostForm.ssh_connection_timeout" :min="5" :max="60" :step="1" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Cmd Timeout (s)">
              <el-input-number v-model="newHostForm.ssh_command_timeout" :min="10" :max="300" :step="5" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="Check Interval">
          <el-input-number v-model="newHostForm.check_interval" :min="60" :max="3600" :step="60" style="width: 150px" />
          <span style="margin-left: 12px; color: #909399;">seconds (60-3600s)</span>
        </el-form-item>
      </template>
      
      <el-form-item label="Description">
        <el-input 
          v-model="newHostForm.description" 
          type="textarea" 
          :rows="2"
          placeholder="Optional description" />
      </el-form-item>
      
      <el-form-item label="Tags">
        <el-select 
          v-model="newHostForm.tags" 
          multiple 
          filterable 
          allow-create 
          placeholder="Add tags"
          style="width: 100%">
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showAddHostDialog = false">Cancel</el-button>
      <el-button type="primary" @click="handleCreateHost" :loading="creatingHost">
        Create Host
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Plus, Edit, Monitor, Right, Check, Setting, Bell, Warning,
  Document, Pointer, DataLine, Clock, CircleClose, Link, Delete, Close
} from '@element-plus/icons-vue';
import ScheduleConfigPanel from './ScheduleConfigPanel.vue';
import IconSelector from './IconSelector.vue';
import { hostsApi } from '../api/hosts';
import { getServiceDependencies } from '../api/dependencies';
import type { ScheduleConfig } from '../types/schedule';
import type { Service, CreateServiceDto } from '../types/service';
import type { Host, CreateHostDto } from '../types/host';
import type { ProjectWithStats } from '../api/projects';
import type { DependencyType } from '../api/dependency-types';

// Props
interface DefaultSettings {
  defaultInterval: number;
  warningThreshold: number;
  errorThreshold: number;
}

const props = defineProps<{
  modelValue: boolean;
  isEdit?: boolean;
  isCopy?: boolean;
  editData?: Service | null;
  projects: ProjectWithStats[];
  hosts: Host[];
  allServices: Service[];
  dependencyTypes: DependencyType[];
  defaultSettings?: DefaultSettings;
}>();

// Emits
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit', data: CreateServiceDto, dependencies: any[]): void;
  (e: 'cancel'): void;
  (e: 'host-created', host: Host): void;
}>();

// Dialog visibility
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

// Wizard state
const steps = [
  { key: 'basic', title: 'Basic' },
  { key: 'check', title: 'Health Check' },
  { key: 'schedule', title: 'Schedule' },
  { key: 'alerts', title: 'Alerts' },
  { key: 'confirm', title: 'Confirm' }
];
const totalSteps = steps.length;
const currentStep = ref(0);
const submitting = ref(false);
const showBanner = ref(true);

// Form data
const form = reactive<CreateServiceDto>({
  name: '',
  project_id: undefined,
  host: '',
  port: 80,
  check_type: 'tcp',
  risk_level: 'high',
  check_interval: 60,
  warning_threshold: 3,
  error_threshold: 5,
  failure_threshold: 3,
  enabled: 1,
  alert_enabled: 1,
  dependencies: [],
  impact_description: '',
  custom_alert_template: '',
  icon: ''
});

// Host selection
const selectedHostId = ref<string>('');
const selectedHostData = ref<Host | null>(null);

// Add Host Dialog
const showAddHostDialog = ref(false);
const creatingHost = ref(false);
const newHostForm = reactive<CreateHostDto>({
  name: '',
  ip: '',
  project_id: '',
  connection_type: 'local',
  ssh_host: '',
  ssh_port: 22,
  ssh_username: '',
  ssh_auth_type: 'password',
  ssh_password: '',
  ssh_private_key: '',
  ssh_passphrase: '',
  ssh_proxy_host: '',
  ssh_proxy_port: 22,
  ssh_max_retries: 3,
  ssh_retry_delay: 2,
  ssh_connection_timeout: 10,
  ssh_command_timeout: 30,
  check_interval: 300,
  description: '',
  tags: []
});

// HTTP config
const httpConfig = reactive({
  protocol: 'https',
  path: '/',
  expected_status: 200,
  timeout: 5000
});

// Script config
const scriptCheckConfig = reactive({
  script_type: 'bash',
  script_content: '',
  expected_exit_code: 0,
  timeout: 30
});

// File check config
const fileCheckConfig = reactive({
  mode: 'single',
  file_path: '',
  directory_path: '',
  filename_pattern: ''
});



// Schedule config
const scheduleConfig = ref<ScheduleConfig>({
  type: 'fixed',
  defaultInterval: 60,
  timeRanges: []
});

// Dependencies
interface ServiceDepItem {
  target_service_id: string;
  dependency_type: string;
  risk_level: string;
  isNew?: boolean;
}
const serviceDependencies = ref<ServiceDepItem[]>([]);
const newDependency = reactive({
  target_service_id: '',
  dependency_type: 'depends',
  risk_level: 'medium'
});

// Computed
const scriptPlaceholder = computed(() => {
  const templates = {
    bash: '#!/bin/bash\n# Your monitoring script here\n# Exit 0 for success, non-zero for failure\necho "Checking service status..."\nexit 0',
    python: '#!/usr/bin/env python3\n# Your monitoring script here\n# Exit 0 for success, non-zero for failure\nimport sys\nprint("Checking service status...")\nsys.exit(0)',
    powershell: '# Your monitoring script here\n# Exit 0 for success, non-zero for failure\nWrite-Host "Checking service status..."\nexit 0',
    nodejs: '#!/usr/bin/env node\n// Your monitoring script here\n// Exit 0 for success, non-zero for failure\nconsole.log("Checking service status...");\nprocess.exit(0);'
  };
  return templates[scriptCheckConfig.script_type as keyof typeof templates] || templates.bash;
});

const filteredHosts = computed(() => {
  if (!form.project_id) return props.hosts;
  return props.hosts.filter(h => h.project_id === form.project_id);
});

const availableServices = computed(() => {
  const addedIds = serviceDependencies.value.map(d => d.target_service_id);
  // Exclude current service in edit mode
  const currentId = props.editData?.id;
  return props.allServices.filter(s => s.id !== currentId && !addedIds.includes(s.id));
});

// Group available services by project for dependency selector
const groupedServicesForDep = computed(() => {
  const groups: { projectName: string; projectId: string | null; services: any[] }[] = [];
  const projectMap = new Map<string | null, any[]>();
  
  // Group services by project
  availableServices.value.forEach(service => {
    const projectId = service.project_id || null;
    if (!projectMap.has(projectId)) {
      projectMap.set(projectId, []);
    }
    projectMap.get(projectId)!.push(service);
  });
  
  // Convert to array with project names
  projectMap.forEach((serviceList, projectId) => {
    const project = props.projects.find(p => p.id === projectId);
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

// Format service label based on check type
const formatServiceLabel = (service: any): string => {
  if (['script', 'file', 'log'].includes(service.check_type)) {
    return `${service.name} (${service.host})`;
  }
  return `${service.name} (${service.host}:${service.port})`;
};

// Methods
const handleHostSelect = (hostId: string) => {
  if (!hostId) {
    selectedHostData.value = null;
    form.host = '';
    return;
  }
  const host = props.hosts.find(h => h.id === hostId);
  if (host) {
    selectedHostData.value = host;
    form.host = host.ssh_host || host.ip || '';
  }
};

const handleCreateHost = async () => {
  if (!newHostForm.name || !newHostForm.ip) {
    ElMessage.warning('Please enter host name and IP address');
    return;
  }
  
  creatingHost.value = true;
  try {
    // Bug #031: 前端秒 → 后端毫秒
    const submitHostData = {
      ...newHostForm,
      ssh_retry_delay: newHostForm.ssh_retry_delay * 1000,
      ssh_connection_timeout: newHostForm.ssh_connection_timeout * 1000,
      ssh_command_timeout: newHostForm.ssh_command_timeout * 1000,
    };
    const createdHost = await hostsApi.create(submitHostData);
    ElMessage.success(`Host "${createdHost.name}" created successfully`);
    
    // Emit event so parent can refresh hosts list
    emit('host-created', createdHost);
    
    // Auto-select the new host
    selectedHostId.value = createdHost.id;
    selectedHostData.value = createdHost;
    form.host = createdHost.ssh_host || createdHost.ip || '';
    
    // Reset form and close dialog
    resetHostForm();
    showAddHostDialog.value = false;
  } catch (err: any) {
    console.error('Failed to create host:', err);
    ElMessage.error(err.response?.data?.error || 'Failed to create host');
  } finally {
    creatingHost.value = false;
  }
};

const resetHostForm = () => {
  newHostForm.name = '';
  newHostForm.ip = '';
  newHostForm.project_id = '';
  newHostForm.connection_type = 'local';
  newHostForm.ssh_host = '';
  newHostForm.ssh_port = 22;
  newHostForm.ssh_username = '';
  newHostForm.ssh_auth_type = 'password';
  newHostForm.ssh_password = '';
  newHostForm.ssh_private_key = '';
  newHostForm.ssh_passphrase = '';
  newHostForm.ssh_proxy_host = '';
  newHostForm.ssh_proxy_port = 22;
  newHostForm.ssh_max_retries = 3;
  newHostForm.ssh_retry_delay = 2;
  newHostForm.ssh_connection_timeout = 10;
  newHostForm.ssh_command_timeout = 30;
  newHostForm.check_interval = 300;
  newHostForm.description = '';
  newHostForm.tags = [];
};

const handleCheckTypeChange = () => {
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
};

const getProjectName = (projectId: string | number | undefined) => {
  if (!projectId) return null;
  const project = props.projects.find(p => p.id === projectId);
  return project?.name;
};

const getServiceNameById = (serviceId: string) => {
  const service = props.allServices.find(s => s.id === serviceId);
  if (service) {
    const project = props.projects.find(p => p.id === service.project_id);
    const projectName = project ? project.name : '';
    const portInfo = service.port && !['script', 'file', 'log'].includes(service.check_type) ? `:${service.port}` : '';
    return projectName ? `[${projectName}] ${service.name} (${service.host}${portInfo})` : `${service.name} (${service.host}${portInfo})`;
  }
  return serviceId;
};

// Check if a dependency is cross-project
const isCrossProjectDependency = (targetServiceId: string): boolean => {
  const targetService = props.allServices.find(s => s.id === targetServiceId);
  // Compare with current form project_id
  const currentProjectId = form.project_id;
  if (!targetService) return false;
  return targetService.project_id !== currentProjectId;
};

const addDependency = () => {
  if (!newDependency.target_service_id) return;
  serviceDependencies.value.push({
    target_service_id: newDependency.target_service_id,
    dependency_type: newDependency.dependency_type,
    risk_level: newDependency.risk_level,
    isExisting: false
  });
  newDependency.target_service_id = '';
  newDependency.dependency_type = 'depends';
  newDependency.risk_level = 'medium';
};

const removeDependency = (index: number) => {
  serviceDependencies.value.splice(index, 1);
};

const goToStep = (step: number) => {
  // Auto-add pending dependency when leaving Alerts step (step 3)
  if (currentStep.value === 3 && newDependency.target_service_id) {
    addDependency();
  }
  
  if (step >= 0 && step < totalSteps) {
    currentStep.value = step;
  }
};

const validateCurrentStep = (): boolean => {
  switch (currentStep.value) {
    case 0: // Basic
      if (!form.name) {
        ElMessage.warning('Please enter a service name');
        return false;
      }
      if (!props.isEdit && !selectedHostId.value && !form.host) {
        ElMessage.warning('Please select a host');
        return false;
      }
      return true;
    case 1: // Health Check
      if (!form.check_type) {
        ElMessage.warning('Please select a check type');
        return false;
      }
      if (!['script', 'file', 'log'].includes(form.check_type as string) && !form.port) {
        ElMessage.warning('Please enter a port number');
        return false;
      }
      return true;
    case 2: // Schedule
      return true;
    case 3: // Alerts
      return true;
    case 4: // Confirm
      return true;
    default:
      return true;
  }
};

const handleNext = async () => {
  if (!validateCurrentStep()) return;

  // Auto-add pending dependency when leaving Alerts step (step 3)
  if (currentStep.value === 3 && newDependency.target_service_id) {
    addDependency();
  }

  if (currentStep.value < totalSteps - 1) {
    currentStep.value++;
  } else {
    // Submit
    await handleSubmit();
  }
};

const handlePrevious = () => {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
};

const handleSubmit = async () => {
  submitting.value = true;
  try {
    // Auto-add pending dependency if user filled the form but didn't click +
    if (newDependency.target_service_id) {
      addDependency();
    }
    
    // Build final form data
    const submitData: CreateServiceDto = {
      ...form,
      check_interval: scheduleConfig.value.defaultInterval,
      schedule_config: scheduleConfig.value
    };

    // Add host_id from selected host
    if (selectedHostId.value) {
      submitData.host_id = selectedHostId.value;
    }

    // Clear port for script/file/log check types (they don't use ports)
    if (['script', 'file', 'log'].includes(form.check_type as string)) {
      submitData.port = 0;
    }

    // Add HTTP config if applicable
    if (form.check_type === 'http' || form.check_type === 'https') {
      (submitData as any).http_config = httpConfig;
    }

    // Add script config if applicable
    if (form.check_type === 'script') {
      (submitData as any).script_config = scriptCheckConfig;
    }

    // Add file config if applicable
    if (form.check_type === 'file' || form.check_type === 'log') {
      (submitData as any).file_config = fileCheckConfig;
    }

    emit('submit', submitData, serviceDependencies.value);
  } finally {
    submitting.value = false;
  }
};

const handleCancel = () => {
  emit('cancel');
  visible.value = false;
};

const resetForm = () => {
  currentStep.value = 0;
  form.name = '';
  form.project_id = undefined;
  form.host = '';
  form.port = 80;
  form.check_type = 'tcp';
  form.risk_level = 'high';
  // Use default settings from props if available
  const defaultInterval = props.defaultSettings?.defaultInterval || 60;
  form.check_interval = defaultInterval;
  form.warning_threshold = props.defaultSettings?.warningThreshold || 3;
  form.error_threshold = props.defaultSettings?.errorThreshold || 5;
  form.failure_threshold = 3;
  form.enabled = 1;
  form.alert_enabled = 1;
  form.impact_description = '';
  form.custom_alert_template = '';
  selectedHostId.value = '';
  selectedHostData.value = null;
  scheduleConfig.value = { type: 'fixed', defaultInterval: defaultInterval, timeRanges: [] };
  serviceDependencies.value = [];
  
  // Reset health check configurations
  Object.assign(httpConfig, {
    protocol: 'https',
    path: '/',
    expected_status: 200,
    timeout: 5000
  });
  
  Object.assign(scriptCheckConfig, {
    script_type: 'bash',
    script_content: '',
    expected_exit_code: 0,
    timeout: 30
  });
  
  Object.assign(fileCheckConfig, {
    mode: 'single',
    file_path: '',
    directory_path: '',
    filename_pattern: ''
  });
};

// Watch for dialog open to reset or populate form
watch(() => props.modelValue, async (newVal) => {
  if (newVal) {
    // Show banner when dialog opens
    showBanner.value = true;
    
    if ((props.isEdit || props.isCopy) && props.editData) {
      // Reset step to first
      currentStep.value = 0;
      
      // Populate form with edit data
      form.name = props.isCopy ? `${props.editData.name} - Copy` : (props.editData.name || '');
      form.project_id = props.editData.project_id;
      form.host = props.editData.host || '';
      form.port = props.editData.port || 80;
      form.check_type = props.editData.check_type || 'tcp';
      form.risk_level = props.editData.risk_level || 'high';
      form.check_interval = props.editData.check_interval || 60;
      form.warning_threshold = props.editData.warning_threshold || 10;
      form.error_threshold = props.editData.error_threshold || 20;
      form.failure_threshold = props.editData.failure_threshold || 3;
      form.enabled = props.editData.enabled;
      form.alert_enabled = props.editData.alert_enabled;
      form.impact_description = props.editData.impact_description || '';
      form.custom_alert_template = props.editData.custom_alert_template || '';
      form.icon = props.editData.icon || '';
      
      // Debug: Log icon loading in wizard
      console.log('🎨 AddServiceWizard - Loading edit data:', {
        'editData.icon': props.editData.icon,
        'form.icon': form.icon,
        'isCopy': props.isCopy
      });
      
      // Parse HTTP config
      if (props.editData.http_config) {
        try {
          const config = typeof props.editData.http_config === 'string' 
            ? JSON.parse(props.editData.http_config) 
            : props.editData.http_config;
          Object.assign(httpConfig, config);
        } catch (e) {
          console.error('Failed to parse http_config:', e);
        }
      }
      
      // Parse script config
      if (props.editData.script_config) {
        try {
          const config = typeof props.editData.script_config === 'string'
            ? JSON.parse(props.editData.script_config)
            : props.editData.script_config;
          Object.assign(scriptCheckConfig, config);
        } catch (e) {
          console.error('Failed to parse script_config:', e);
        }
      }
      
      // Parse file config
      if (props.editData.file_config) {
        try {
          const config = typeof props.editData.file_config === 'string'
            ? JSON.parse(props.editData.file_config)
            : props.editData.file_config;
          Object.assign(fileCheckConfig, config);
        } catch (e) {
          console.error('Failed to parse file_config:', e);
        }
      }
      
      // Load schedule configuration
      if (props.editData.schedule_type && props.editData.schedule_config) {
        try {
          const config = typeof props.editData.schedule_config === 'string'
            ? JSON.parse(props.editData.schedule_config)
            : props.editData.schedule_config;
          scheduleConfig.value = {
            type: props.editData.schedule_type as 'fixed' | 'timeRange',
            defaultInterval: config.defaultInterval || 60,
            timeRanges: config.timeRanges || []
          };
        } catch (e) {
          console.error('Failed to parse schedule_config:', e);
          scheduleConfig.value = {
            type: 'fixed',
            defaultInterval: props.editData.check_interval || 60,
            timeRanges: []
          };
        }
      } else {
        scheduleConfig.value = {
          type: 'fixed',
          defaultInterval: props.editData.check_interval || 60,
          timeRanges: []
        };
      }
      
      // Find and set host
      if (props.editData.host_id) {
        const host = props.hosts.find(h => h.id === props.editData?.host_id);
        if (host) {
          selectedHostId.value = host.id;
          selectedHostData.value = host;
        }
      } else {
        const host = props.hosts.find(h => h.ip === props.editData?.host || h.ssh_host === props.editData?.host);
        if (host) {
          selectedHostId.value = host.id;
          selectedHostData.value = host;
        }
      }
      
      // Load existing dependencies for edit mode only (not for copy mode)
      if (props.isEdit && props.editData.id) {
        try {
          const deps = await getServiceDependencies(props.editData.id);
          serviceDependencies.value = deps.dependsOn.map((d: any) => ({
            id: d.id,
            target_service_id: d.target_service_id,
            dependency_type: d.dependency_type,
            risk_level: d.risk_level || 'medium',
            isExisting: true
          }));
        } catch (error) {
          console.error('Failed to load service dependencies:', error);
          serviceDependencies.value = [];
        }
      } else {
        serviceDependencies.value = [];
      }
    } else {
      resetForm();
    }
  }
});

// Expose for parent component
defineExpose({
  resetForm
});
</script>

<style scoped>
.add-service-wizard-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.wizard-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  padding-right: 40px;
  margin: 16px 20px;
  border-radius: 8px;
  position: relative;
}

.wizard-banner.add-banner {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  color: white;
}

.wizard-banner.edit-banner {
  background: linear-gradient(135deg, #e6a23c 0%, #f0c78a 100%);
  color: white;
}

.banner-icon {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.banner-content {
  flex: 1;
}

.banner-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.banner-description {
  font-size: 12px;
  opacity: 0.9;
}

.banner-link {
  color: white;
  text-decoration: underline;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.banner-close {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
}

.banner-close:hover {
  color: white;
}

.wizard-stepper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px 20px;
  background: #fafbfc;
  border-bottom: 1px solid #e4e7ed;
  gap: 8px;
}

.wizard-step {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.wizard-step:hover:not(.active) {
  background: #e4e7ed;
}

.wizard-step::after {
  content: '';
  width: 24px;
  height: 2px;
  background: #e4e7ed;
  margin: 0 4px;
}

.wizard-step:last-child::after {
  display: none;
}

.wizard-step.completed::after {
  background: #67c23a;
}

.step-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e4e7ed;
  color: #909399;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 12px;
  transition: all 0.3s;
}

.wizard-step.active .step-circle {
  background: #409eff;
  color: white;
  box-shadow: 0 0 0 4px rgba(64, 158, 255, 0.15);
}

.wizard-step.completed .step-circle {
  background: #67c23a;
  color: white;
}

.step-label {
  margin-left: 8px;
  font-size: 13px;
  color: #909399;
  font-weight: 500;
  white-space: nowrap;
}

.wizard-step.active .step-label {
  color: #409eff;
}

.wizard-step.completed .step-label {
  color: #67c23a;
}

.wizard-content {
  padding: 20px;
  max-height: calc(80vh - 220px);
  overflow-y: auto;
}

.step-panel {
  min-height: 300px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #ebeef5;
}

.status-controls-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.control-card {
  background: #f9fafb;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
}

.control-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.control-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: #303133;
}

.control-description {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.host-preview-card {
  background: #f0f9eb;
  border: 1px solid #c2e7b0;
  border-radius: 8px;
  padding: 12px 16px;
  margin-top: 12px;
}

.host-preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  margin-bottom: 8px;
}

.host-preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: #606266;
}

.form-hint {
  font-size: 11px;
  color: #909399;
  margin-top: 4px;
}

.threshold-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.threshold-card {
  background: #f9fafb;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  flex: 1 1 180px;
  min-width: 180px;
  max-width: 240px;
}

.threshold-card-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 12px;
}

.threshold-value {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
}

.threshold-unit {
  font-size: 12px;
  color: #909399;
}

.threshold-hint {
  font-size: 11px;
  color: #909399;
}

.dependencies-table {
  margin-bottom: 12px;
}

.review-section {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.review-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.review-section-title .el-button {
  margin-left: auto;
}

.review-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 24px;
}

.review-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.review-label {
  color: #909399;
  min-width: 100px;
}

.review-value {
  color: #303133;
  font-weight: 500;
}

.wizard-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-right {
  display: flex;
  gap: 12px;
}

/* Connection Card Styles */
.connection-card {
  background: #f5f7fa;
  border: 2px solid #dcdfe6;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.connection-card:hover {
  border-color: #409eff;
  background: #ecf5ff;
}

.connection-card.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.connection-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.connection-name {
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.connection-desc {
  font-size: 12px;
  color: #909399;
}
</style>
