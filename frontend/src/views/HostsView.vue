<template>
  <div class="hosts-view">
    <!-- List View -->
    <div v-if="!selectedHost">
      <div class="page-header">
        <div>
          <h2>{{ $t('hosts.title') }}</h2>
          <p class="page-subtitle">{{ $t('hosts.subtitle') }}</p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <el-button v-if="isAdmin" type="primary" :icon="Plus" @click="handleAdd">{{ $t('hosts.titleAdd') }}</el-button>
        </div>
      </div>
      
      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ filteredHosts.length }}</div>
          <div class="stat-label">{{ $t('hosts.totalHosts') }}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">{{ onlineHosts }}</div>
          <div class="stat-label">{{ $t('hosts.online') }}</div>
        </div>
        <div class="stat-card error">
          <div class="stat-value">{{ offlineHosts }}</div>
          <div class="stat-label">{{ $t('hosts.offline') }}</div>
        </div>
        <div class="stat-card" style="border-color: #909399;">
          <div class="stat-value" style="color: #909399;">{{ disabledHosts }}</div>
          <div class="stat-label">{{ $t('hosts.disabled') }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ totalServices }}</div>
          <div class="stat-label">{{ $t('hosts.totalServices') }}</div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="filter-item">
          <span class="filter-label">{{ $t('hosts.filterStatus') }}</span>
          <el-select v-model="filterStatus" size="small" style="width: 120px;">
            <el-option :label="$t('hosts.filterAll')" value="all"></el-option>
            <el-option :label="$t('hosts.filterOnline')" value="healthy"></el-option>
            <el-option :label="$t('hosts.filterOffline')" value="unhealthy"></el-option>
          </el-select>
        </div>
        <div class="filter-item">
          <span class="filter-label">{{ $t('hosts.filterSearch') }}</span>
          <el-input v-model="searchQuery" :placeholder="$t('hosts.placeholderSearch')" size="small" style="width: 200px;" clearable />
        </div>
        <div class="filter-item" style="margin-left: auto;">
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button value="card">
              <el-icon><Grid /></el-icon>
            </el-radio-button>
            <el-radio-button value="table">
              <el-icon><List /></el-icon>
            </el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <el-alert v-if="error" type="error" :title="error" closable @close="error = ''" style="margin-bottom: 20px" />

      <!-- Card View -->
      <div v-if="viewMode === 'card'" class="hosts-grid" v-loading="loading">
        <div v-if="filteredHosts.length === 0" class="empty-state">
          <div class="empty-icon">🖥️</div>
          <div class="empty-text">{{ $t('hosts.emptyTitle') }}</div>
          <div class="empty-hint">{{ $t('hosts.emptyDesc') }}</div>
        </div>
        
        <div 
          v-for="host in filteredHosts" 
          :key="host.id" 
          class="host-card"
          :class="{ 'disabled-host': host.enabled === 0 }"
          @click="selectHost(host)">
          <div class="card-header">
            <div class="header-top">
              <div class="host-name">
                <span class="host-icon">🖥️</span>
                <a href="#" style="text-decoration:none;color:inherit;" @click.prevent="goToHostDetail(host)"><span>{{ host.name }}</span></a>
              </div>
              <div class="quick-badges">
                <span 
                  v-if="getConnectionStatus(host) !== 'none'" 
                  class="quick-badge" 
                  :class="`badge-conn-${getConnectionStatus(host)}`">
                  <span>●</span>{{ $t('hosts.badgeConn') }}
                </span>
                <span 
                  class="quick-badge" 
                  :class="`badge-svc-${getServiceStatus(host)}`">
                  <span v-if="getServiceStatus(host) !== 'none'">●</span>
                  <span v-else>−</span>{{ $t('hosts.badgeSvc') }}
                </span>
              </div>
            </div>
            <div class="host-meta">
              <span>📍 {{ host.ip }}</span>
              <span v-if="host.ssh_username">👤 {{ host.ssh_username }}</span>
              <span v-if="host.project_name">📦 {{ host.project_name }}</span>
            </div>
          </div>
          
          <div class="card-content">
            <div class="content-row">
              <div class="content-label">{{ $t('hosts.labelServices') }}</div>
              <div class="content-value">
                <span v-if="!host.service_count" class="no-services">{{ $t('hosts.noServices') }}</span>
                <template v-else>
                  <span class="info-text">{{ host.service_count }} {{ $t('hosts.monitored') }}</span>
                  <el-button type="text" size="small" @click.stop="goToHostDetail(host)" style="margin-left:8px">{{ $t('hosts.btnViewServices') }}</el-button>
                  <span v-if="host.health_stats?.up_count > 0" class="stat-chip up">
                    <span>✓</span>
                    <span>{{ host.health_stats.up_count }} {{ $t('statusLabels.up') }}</span>
                  </span>
                  <span v-if="host.health_stats?.warning_count > 0" class="stat-chip warning">
                    <span>⚠</span>
                    <span>{{ host.health_stats.warning_count }} {{ $t('statusLabels.warning') }}</span>
                  </span>
                  <span v-if="host.health_stats?.down_count > 0" class="stat-chip down">
                    <span>✗</span>
                    <span>{{ host.health_stats.down_count }} {{ $t('statusLabels.down') }}</span>
                  </span>
                  <span v-if="host.health_stats?.unknown_count > 0" class="stat-chip unknown">
                    <span>?</span>
                    <span>{{ host.health_stats.unknown_count }} {{ $t('statusLabels.unknown') }}</span>
                  </span>
                </template>
              </div>
            </div>
            <div class="content-row">
              <div class="content-label">{{ $t('hosts.labelConnection') }}</div>
              <div class="content-value">
                <div class="info-tags">
                  <span class="info-tag">{{ getConnectionTypeLabel(host.connection_type) }}</span>
                  <template v-if="host.connection_type === 'ssh'">
                    <span v-if="host.ssh_auth_type" class="info-tag">{{ getAuthLabel(host.ssh_auth_type) }}</span>
                    <span v-if="host.ssh_proxy_host" class="info-tag">{{ $t('hosts.viaProxy', { host: host.ssh_proxy_host }) }}</span>
                    <span v-if="host.ssh_port && host.ssh_port !== 22" class="info-tag">{{ $t('hosts.portN', { port: host.ssh_port }) }}</span>
                  </template>
                </div>
              </div>
            </div>
          </div>
          
          <div class="card-footer" @click.stop>
            <div class="last-check">🕐 {{ host.last_test_at ? formatTime(host.last_test_at) : $t('hosts.neverTested') }}</div>
            <div class="card-actions">
              <!-- Spec 027: Host monitoring toggle -->
              <div v-if="isAdmin" class="monitoring-toggle" @click.stop>
                <el-tooltip :content="host.enabled ? $t('hosts.tooltipDisable') : $t('hosts.tooltipEnable')">
                  <el-switch
                    :model-value="host.enabled === 1"
                    @change="(val: boolean) => handleToggleMonitoring(host, val)"
                    size="small"
                    :active-color="'#67c23a'"
                    :inactive-color="'#909399'"
                  />
                </el-tooltip>
                <span class="monitoring-status">
                  {{ host.enabled ? $t('hosts.monitoring') : $t('common.disabled') }}
                </span>
              </div>
              <el-button v-if="isAdmin" size="small" @click.stop="handleEdit(host)">{{ $t('common.edit') }}</el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- Table View -->
      <el-table v-else :data="filteredHosts" style="width: 100%" v-loading="loading" @row-click="selectHost">
        <el-table-column prop="name" :label="$t('hosts.colHostname')" sortable />
        <el-table-column prop="ip" :label="$t('hosts.colIPAddress')" width="150" />
        <el-table-column :label="$t('hosts.labelConnection')" width="250">
          <template #default="scope">
            <template v-if="scope.row.connection_type === 'ssh'">
              <span v-if="scope.row.ssh_host">
                {{ scope.row.ssh_username }}@{{ scope.row.ssh_host }}:{{ scope.row.ssh_port }}
                <el-tag v-if="scope.row.ssh_proxy_host" size="small" type="info" style="margin-left: 5px">
                  {{ $t('hosts.viaProxy', { host: scope.row.ssh_proxy_host }) }}
                </el-tag>
              </span>
              <el-tag v-else type="warning" size="small">{{ $t('hosts.noSSHConfig') }}</el-tag>
            </template>
            <el-tag v-else type="info" size="small">{{ $t('hosts.localConnection') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="project_name" :label="$t('hosts.labelProject')" width="150" />
        <el-table-column prop="status" :label="$t('common.status')" width="100">
          <template #default="scope">
            <el-tag 
              :type="getHostStatus(scope.row) === 'healthy' ? 'success' : 'danger'"
              size="small">
              {{ $t('statusLabels.' + getHostStatus(scope.row)) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('hosts.monitoring')" width="120">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
              {{ row.enabled ? $t('common.enabled') : $t('common.disabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="service_count" :label="$t('hosts.labelServices')" width="100" align="center" /> 
        <el-table-column :label="$t('common.actions')" width="200" align="right">
          <template #default="scope">
            <el-button v-if="isAdmin" size="small" @click.stop="handleEdit(scope.row)">{{ $t('common.edit') }}</el-button>
            <el-button v-if="isAdmin" size="small" type="danger" @click.stop="handleDelete(scope.row)">{{ $t('common.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- Detail View -->
    <div v-else class="host-detail">
      <div class="detail-header">
        <el-page-header @back="handleBackToList">
          <template #content>
            <div class="detail-title">
              <span>🖥️ {{ selectedHost.name }}</span>
              <el-tag :type="getHostStatus(selectedHost) === 'healthy' ? 'success' : 'danger'" style="margin-left: 12px;">
                {{ $t('statusLabels.' + getHostStatus(selectedHost)) }}
              </el-tag>
            </div>
          </template>
        </el-page-header>
        <div class="detail-actions">
          <el-button @click="testConnection(selectedHost)">{{ $t('hosts.btnTestConn') }}</el-button>
          <el-button v-if="isAdmin" @click="handleEdit(selectedHost)">{{ $t('hosts.btnEditConfig') }}</el-button>
          <el-button v-if="isAdmin" type="danger" @click="handleDelete(selectedHost)">{{ $t('hosts.btnDeleteHost') }}</el-button>
        </div>
      </div>

      <div class="detail-subtitle">
        {{ selectedHost.ip }} 
        <span v-if="selectedHost.ssh_host">
          · {{ selectedHost.ssh_username }}@{{ selectedHost.ssh_host }}:{{ selectedHost.ssh_port }}
        </span>
      </div>

      <!-- Services Table -->
      <div class="services-section">
        <ServiceListView 
          :filter-host-id="selectedHost.id" 
          hide-project-filter
          hide-actions
        />
      </div>
    </div>

    <!-- Add/Edit Host Dialog -->
    <el-dialog 
      v-model="showDialog" 
      :title="isEditing ? $t('hosts.titleEdit') : $t('hosts.titleAdd')"
      width="600px"
      @close="resetForm">
      <el-form :model="hostForm" label-width="140px" :rules="formRules" ref="formRef">
        <el-form-item :label="$t('hosts.labelHostName')" prop="name">
          <el-input v-model="hostForm.name" :placeholder="$t('hosts.placeholderHostName')" />
        </el-form-item>
        
        <el-form-item :label="$t('hosts.labelIP')" prop="ip">
          <el-input v-model="hostForm.ip" :placeholder="$t('hosts.placeholderIP')" />
        </el-form-item>
        
        <el-form-item :label="$t('hosts.labelProject')">
          <el-select v-model="hostForm.project_id" :placeholder="$t('hosts.placeholderProject')" clearable style="width: 100%">
            <el-option 
              v-for="project in projects" 
              :key="project.id" 
              :label="project.name" 
              :value="project.id" />
          </el-select>
        </el-form-item>
        
        <el-form-item :label="$t('hosts.labelConnType')">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            <div 
              class="connection-card"
              :class="{ active: hostForm.connection_type === 'ssh' }"
              @click="hostForm.connection_type = 'ssh'">
              <div class="connection-icon">🔐</div>
              <div class="connection-name">{{ $t('hosts.cardSSH') }}</div>
              <div class="connection-desc">{{ $t('hosts.cardSSHDesc') }}</div>
            </div>
            <div 
              class="connection-card"
              :class="{ active: hostForm.connection_type === 'local' }"
              @click="hostForm.connection_type = 'local'">
              <div class="connection-icon">💻</div>
              <div class="connection-name">{{ $t('hosts.cardLocal') }}</div>
              <div class="connection-desc">{{ $t('hosts.cardLocalDesc') }}</div>
            </div>
          </div>
          <div style="margin-top: 8px; font-size: 12px; color: #909399;">
            {{ $t('hosts.hintSSHLocal') }}
          </div>
        </el-form-item>
        
        <!-- SSH Configuration Section -->
        <template v-if="hostForm.connection_type === 'ssh'">
          <el-divider content-position="left">{{ $t('hosts.dividerSSH') }}</el-divider>
          
          <el-form-item :label="$t('hosts.labelSSHPort')" prop="ssh_port">
            <el-input-number v-model="hostForm.ssh_port" :min="1" :max="65535" style="width: 150px" />
            <span style="margin-left: 12px; color: #909399;">{{ $t('hosts.noteDefault22') }}</span>
          </el-form-item>
          
          <el-form-item :label="$t('hosts.labelUsername')" prop="ssh_username">
            <el-input v-model="hostForm.ssh_username" :placeholder="$t('hosts.placeholderUsername')" />
          </el-form-item>
          
          <el-form-item :label="$t('hosts.labelAuthType')" prop="ssh_auth_type">
            <el-radio-group v-model="hostForm.ssh_auth_type">
              <el-radio value="password">{{ $t('hosts.optPassword') }}</el-radio>
              <el-radio value="private_key">{{ $t('hosts.optPrivateKey') }}</el-radio>
            </el-radio-group>
          </el-form-item>
          
          <el-form-item v-if="hostForm.ssh_auth_type === 'password'" :label="$t('hosts.labelPassword')">
            <el-input 
              v-model="hostForm.ssh_password" 
              type="password" 
              show-password 
              :placeholder="$t('hosts.placeholderPassword')" />
          </el-form-item>
          
          <el-form-item v-if="hostForm.ssh_auth_type === 'private_key'" :label="$t('hosts.labelPrivateKey')">
            <el-input 
              v-model="hostForm.ssh_private_key" 
              type="textarea" 
              :rows="6"
              :placeholder="$t('hosts.placeholderPrivateKey')" />
          </el-form-item>
          
          <el-form-item v-if="hostForm.ssh_auth_type === 'private_key'" :label="$t('hosts.labelPassphrase')">
            <el-input 
              v-model="hostForm.ssh_passphrase" 
              type="password" 
              show-password 
              :placeholder="$t('hosts.placeholderPassphrase')" />
          </el-form-item>
          
          <el-divider content-position="left">{{ $t('hosts.dividerProxy') }}</el-divider>
          
          <el-form-item :label="$t('hosts.labelProxyHost')">
            <el-select 
              v-model="hostForm.ssh_proxy_host" 
              :placeholder="$t('hosts.placeholderProxyHost')"
              filterable
              allow-create
              clearable
              @change="handleProxyHostChange"
              style="width: 100%">
              <el-option
                v-for="host in availableProxyHosts"
                :key="host.id"
                :label="`${host.name} (${host.ssh_host || host.ip})`"
                :value="host.ssh_host || host.ip">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>{{ host.name }}</span>
                  <span style="font-size: 12px; color: #909399;">{{ host.ssh_username }}@{{ host.ssh_host || host.ip }}:{{ host.ssh_port }}</span>
                </div>
              </el-option>
            </el-select>
            <div style="margin-top: 4px; font-size: 12px; color: #909399;">
              {{ $t('hosts.hintProxySelect') }}
            </div>
          </el-form-item>
          
          <el-form-item v-if="hostForm.ssh_proxy_host" :label="$t('hosts.labelProxyPort')">
            <el-input-number v-model="hostForm.ssh_proxy_port" :min="1" :max="65535" style="width: 150px" />
            <span style="margin-left: 12px; color: #909399;">{{ $t('hosts.hintAutoFilled') }}</span>
          </el-form-item>
          
          <el-divider content-position="left">{{ $t('hosts.dividerAdvanced') }}</el-divider>
          
          <el-form-item :label="$t('hosts.labelMaxRetries')">
            <el-input-number v-model="hostForm.ssh_max_retries" :min="1" :max="10" style="width: 150px" />
            <span style="margin-left: 12px; color: #909399;">{{ $t('hosts.hintRetries') }}</span>
          </el-form-item>
          
          <el-form-item :label="$t('hosts.labelRetryDelay')">
            <el-input-number v-model="hostForm.ssh_retry_delay" :min="1" :max="10" :step="1" style="width: 150px" /> s
            <span style="margin-left: 12px; color: #909399;">{{ $t('hosts.hintRetryDelay') }}</span>
          </el-form-item>
          
          <el-form-item :label="$t('hosts.labelConnTimeout')">
            <el-input-number v-model="hostForm.ssh_connection_timeout" :min="5" :max="60" :step="1" style="width: 150px" /> s
            <span style="margin-left: 12px; color: #909399;">{{ $t('hosts.hintConnTimeout') }}</span>
          </el-form-item>
          
          <el-form-item :label="$t('hosts.labelCmdTimeout')">
            <el-input-number v-model="hostForm.ssh_command_timeout" :min="10" :max="300" :step="5" style="width: 150px" /> s
            <span style="margin-left: 12px; color: #909399;">{{ $t('hosts.hintCmdTimeout') }}</span>
          </el-form-item>
        </template>
        
        <!-- Host Check Interval (for both SSH and Local types) -->
        <el-divider content-position="left">{{ $t('hosts.dividerMonitoring') }}</el-divider>
        
        <el-form-item :label="$t('hosts.labelCheckInterval')">
          <el-input-number v-model="hostForm.check_interval" :min="60" :max="3600" :step="60" style="width: 150px" /> {{ $t('common.seconds') }}
          <span style="margin-left: 12px; color: #909399;">
            {{ $t('hosts.hintCheckInterval') }}
            <template v-if="hostForm.connection_type === 'ssh'">{{ $t('hosts.viaSSH') }}</template>
            <template v-else>{{ $t('hosts.viaPing') }}</template>
          </span>
        </el-form-item>
        
        <el-form-item :label="$t('hosts.labelDesc')">
          <el-input 
            v-model="hostForm.description" 
            type="textarea" 
            :rows="3"
            :placeholder="$t('hosts.placeholderDesc')" />
        </el-form-item>
        
        <el-form-item :label="$t('hosts.labelTags')">
          <el-select 
            v-model="hostForm.tags" 
            multiple 
            filterable 
            allow-create 
            :placeholder="$t('hosts.placeholderTags')"
            style="width: 100%">
          </el-select>
        </el-form-item>
        
        <!-- Test Connection Section (only for editing) -->
        <el-form-item v-if="isEditing" :label="$t('hosts.labelConnTest')">
          <el-button 
            @click="testConnectionDialog" 
            :loading="testing"
            :disabled="hostForm.connection_type === 'ssh' && (!hostForm.ssh_host || !hostForm.ssh_username || (hostForm.ssh_auth_type === 'password' && !hostForm.ssh_password) || (hostForm.ssh_auth_type === 'private_key' && !hostForm.ssh_private_key))"
            style="width: 100%">
            <template v-if="hostForm.connection_type === 'ssh'">
              🔌 {{ $t('hosts.btnTestSSH') }}
            </template>
            <template v-else>
              📡 {{ $t('hosts.btnTestPing') }}
            </template>
          </el-button>
          <div style="margin-top: 8px; font-size: 12px; color: #909399;">
            <template v-if="hostForm.connection_type === 'ssh'">
              {{ $t('hosts.hintTestSSH') }}
            </template>
            <template v-else>
              {{ $t('hosts.hintTestPing') }}
            </template>
          </div>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <div style="display: flex; justify-content: space-between; width: 100%;">
          <el-button @click="showDialog = false">{{ $t('common.close') }}</el-button>
          <el-button type="primary" @click="handleSave" :loading="saving">
            {{ isEditing ? $t('common.update') : $t('common.create') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted, watch, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Plus, Search, Grid, List, Connection } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, ElLoading, type FormInstance, type FormRules } from 'element-plus';
import { useI18n } from 'vue-i18n';
import hostsApi from '../api/hosts';
import type { Host, CreateHostDto } from '../types/host';
import { getProjects, type ProjectWithStats } from '../api/projects';
import api from '../api';
import authUtils from '../utils/auth';
import ServiceListView from './ServiceListView.vue';

// Router
// Router
const router = useRouter();
const route = useRoute();

// i18n
const { t } = useI18n();

// Inject context
const currentProjectId = inject('currentProjectId');

// Permission check
const isAdmin = computed(() => authUtils.isAdmin());

const loading = ref(false);
const saving = ref(false);
const testing = ref(false);
const allHosts = ref<Host[]>([]);
const autoRefresh = ref(true); // Default to true, timer starts in onMounted
let refreshTimer: number | null = null;
const projects = ref<ProjectWithStats[]>([]);
const searchQuery = ref('');
const error = ref('');
const filterStatus = ref('all');
const viewMode = ref<'card' | 'table'>('card');
const selectedHost = ref<Host | null>(null);

const showDialog = ref(false);
const isEditing = ref(false);
const editingId = ref('');
const formRef = ref<FormInstance>();

const hostForm = ref<CreateHostDto>({
  name: '',
  ip: '',
  project_id: '',
  connection_type: 'local',  // 默认为 local
  ssh_host: '',
  ssh_port: 22,
  ssh_username: '',
  ssh_auth_type: 'password',
  ssh_password: '',
  ssh_private_key: '',
  ssh_passphrase: '',
  ssh_proxy_host: '',
  ssh_proxy_port: 22,
  // SSH connection settings
  ssh_max_retries: 3,
  ssh_retry_delay: 2,
  ssh_connection_timeout: 10,
  ssh_command_timeout: 30,
  // Host check interval
  check_interval: 300,
  description: '',
  tags: []
});

const formRules = computed<FormRules>(() => ({
  name: [
    { required: true, message: t('hosts.ruleNameRequired'), trigger: 'blur' }
  ],
  ip: [
    { required: true, message: t('hosts.ruleAddressRequired'), trigger: 'blur' },
    { 
      validator: (rule: any, value: any, callback: any) => {
        // Allow IP address (e.g., 192.168.1.100) or hostname/domain (e.g., example.com, localhost)
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        const hostnamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
        
        if (ipPattern.test(value) || hostnamePattern.test(value)) {
          callback();
        } else {
          callback(new Error(t('hosts.ruleInvalidAddress')));
        }
      },
      trigger: 'blur'
    }
  ]
}));

const checkRouteParams = () => {
  const hostId = route.params.hostId as string;
  const queryHostId = route.query.host_id as string;
  
  if (hostId) {
    const host = allHosts.value.find(h => h.id === hostId);
    if (host) {
      selectedHost.value = host;
    }
  } else if (queryHostId) {
    const host = allHosts.value.find(h => h.id === queryHostId);
    if (host) {
      selectedHost.value = host;
    }
  }
  // Note: Do NOT clear selectedHost when no route params
  // User may have selected a host via UI click without updating route
};

const fetchHosts = async () => {
  loading.value = true;
  error.value = '';
  try {
    const routePId = route.params.projectId as string;
    const pId = routePId || (currentProjectId && (currentProjectId as any).value ? (currentProjectId as any).value : undefined);
    const data = await hostsApi.getAll(pId);
    allHosts.value = data;
    
    // Keep selectedHost in sync with updated data (update reference to fresh data)
    if (selectedHost.value) {
      const updatedHost = data.find(h => h.id === selectedHost.value!.id);
      if (updatedHost) {
        selectedHost.value = updatedHost; // Update to new reference with latest status
      }
      // If host no longer exists, keep selectedHost for now (user can still see it)
    } else {
      // Only check route params when no host is currently selected
      checkRouteParams();
    }
  } catch (err: any) {
    console.error('Failed to fetch hosts:', err);
    error.value = err.response?.data?.error || t('hosts.msgLoadFailed');
  } finally {
    loading.value = false;
  }
};

const fetchProjects = async () => {
  try {
    projects.value = await getProjects();
  } catch (err) {
    console.error('Failed to fetch projects:', err);
  }
};

watch(() => route.params.hostId, () => {
  checkRouteParams();
});

watch(() => route.params.projectId, () => {
  fetchHosts();
});

onMounted(() => {
  fetchHosts();
  fetchProjects();
  
  // 自动启动定时刷新（每 30 秒）
  refreshTimer = window.setInterval(() => {
    fetchHosts();
  }, 30000);
});

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
});

watch(() => (currentProjectId as any)?.value, () => {
  fetchHosts();
});

// 自动刷新处理
const handleAutoRefreshChange = (enabled: boolean) => {
  // Always clear existing timer first to prevent duplicates
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  
  if (enabled) {
    // Start auto-refresh every 30 seconds
    refreshTimer = window.setInterval(() => {
      fetchHosts();
    }, 30000);
    ElMessage.success(t('hosts.msgAutoRefresh'));
  } else {
    ElMessage.info(t('hosts.msgAutoRefreshStopped'));
  }
};

// 计算可用的代理主机（SSH类型且不是当前正在编辑的主机）
const availableProxyHosts = computed(() => {
  return allHosts.value.filter(host => {
    // 只显示SSH连接类型的主机
    if (host.connection_type !== 'ssh') return false;
    // 排除当前正在编辑的主机（避免循环代理）
    if (isEditing.value && host.id === editingId.value) return false;
    // 需要有有效的SSH配置
    return host.ssh_host || host.ip;
  });
});

const filteredHosts = computed(() => {
  let list = allHosts.value;
  
  // Filter by status
  if (filterStatus.value !== 'all') {
    list = list.filter(h => getHostStatus(h) === filterStatus.value);
  }
  
  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    list = list.filter(h => 
      h.name.toLowerCase().includes(query) || 
      h.ip.includes(query) ||
      (h.project_name && h.project_name.toLowerCase().includes(query))
    );
  }
  
  return list;
});

const onlineHosts = computed(() => 
  allHosts.value.filter(h => getHostConnectionStatus(h) === 'online').length
);

const offlineHosts = computed(() => 
  allHosts.value.filter(h => getHostConnectionStatus(h) === 'offline').length
);

const disabledHosts = computed(() => 
  allHosts.value.filter(h => h.enabled === 0).length
);

const totalServices = computed(() => 
  allHosts.value.reduce((sum, h) => sum + (h.service_count || 0), 0)
);

// 主机连接状态（基于连接测试结果和服务健康检查）
const getHostConnectionStatus = (host: Host): 'online' | 'offline' | 'unknown' => {
  // Bug #014 Fix: 检查SSH服务的健康状态来推断连接状态
  // 如果host使用SSH连接且有服务配置
  if (host.connection_type === 'ssh' && host.health_stats && host.health_stats.total_services > 0) {
    const stats = host.health_stats;
    
    // 如果所有服务都DOWN，很可能是SSH连接失败
    if (stats.down_count === stats.total_services && stats.down_count > 0) {
      // 进一步检查：如果最近的手动测试是成功的（30分钟内），可能是服务本身的问题
      if (host.last_test_at && host.last_test_status === 'success') {
        const testTime = new Date(host.last_test_at).getTime();
        const now = Date.now();
        const minutesSinceTest = (now - testTime) / (1000 * 60);
        
        // 如果测试在30分钟内且成功，信任手动测试结果
        if (minutesSinceTest < 30) {
          return 'online';
        }
      }
      
      // 所有服务DOWN，推断为连接失败
      return 'offline';
    }
    
    // 如果超过一半的服务DOWN，也可能是连接问题
    if (stats.down_count > stats.total_services / 2) {
      return 'offline';
    }
    
    // 有服务UP，说明连接正常
    if (stats.up_count > 0) {
      return 'online';
    }
  }
  
  // 使用手动测试结果（如果存在）
  if (host.last_test_at && host.last_test_status) {
    const testTime = new Date(host.last_test_at).getTime();
    const now = Date.now();
    const hoursSinceTest = (now - testTime) / (1000 * 60 * 60);
    
    // 如果测试时间在24小时内，使用测试结果
    if (hoursSinceTest < 24) {
      return host.last_test_status === 'success' ? 'online' : 'offline';
    }
  }
  
  // Local类型的host，根据服务运行情况推断
  if (host.health_stats && host.health_stats.up_count > 0) {
    return 'online';  // 有服务在运行说明主机在线
  }
  
  return 'unknown';  // 无法确定
};

// 服务健康状态（独立于主机连接状态）
const getServicesHealthStatus = (host: Host): 'healthy' | 'degraded' | 'critical' | 'none' => {
  if (!host.service_count || host.service_count === 0) {
    return 'none';
  }
  
  if (!host.health_stats) {
    return 'none';
  }
  
  if (host.health_stats.down_count > 0) {
    return 'critical';
  }
  
  if (host.health_stats.warning_count > 0) {
    return 'degraded';
  }
  
  if (host.health_stats.up_count > 0) {
    return 'healthy';
  }
  
  return 'none';
};

// 兼容旧的 getHostStatus（用于表格视图）
const getHostStatus = (host: Host): string => {
  const connStatus = getHostConnectionStatus(host);
  const svcStatus = getServicesHealthStatus(host);
  
  // 如果主机离线，显示为 unhealthy
  if (connStatus === 'offline') {
    return 'unhealthy';
  }
  
  // 如果有服务且服务有问题，显示为 unhealthy
  if (svcStatus === 'critical' || svcStatus === 'degraded') {
    return 'unhealthy';
  }
  
  // 主机在线且服务正常
  if (connStatus === 'online') {
    return 'healthy';
  }
  
  // 无法确定
  return 'unhealthy';
};

const getConnectionTypeLabel = (type: string | null | undefined): string => {
  if (type === 'ssh') return t('hosts.typeSSH');
  if (type === 'local') return t('hosts.typeLocal');
  return t('statusLabels.unknown');
};

const getAuthLabel = (authType: string): string => {
  if (authType === 'password') return t('hosts.authPassword');
  if (authType === 'private_key') return t('hosts.authKey');
  return authType;
};

const getConnectionStatus = (host: Host): string => {
  // 优先检查连接测试结果（如果最近测试过）
  if (host.last_test_at && host.last_test_status) {
    const testTime = new Date(host.last_test_at).getTime();
    const now = Date.now();
    const hoursSinceTest = (now - testTime) / (1000 * 60 * 60);
    
    // 如果测试时间在24小时内，使用测试结果
    if (hoursSinceTest < 24) {
      if (host.last_test_status === 'success') {
        return 'ok';
      } else {
        return 'fail';
      }
    }
  }
  
  // 没有最近的测试结果，根据配置和服务状态推测
  // 有服务且服务正常运行，说明连接应该是正常的
  if (host.service_count && host.service_count > 0 && host.health_stats) {
    // 如果所有服务都 down，可能是连接问题
    if (host.health_stats.down_count === host.service_count) {
      return 'fail';
    }
    // 如果有服务 up，说明连接正常
    if (host.health_stats.up_count > 0) {
      return 'ok';
    }
  }
  
  // 其他情况不显示连接状态
  return 'none';
};

const getServiceStatus = (host: Host): string => {
  // 没有服务
  if (!host.service_count || host.service_count === 0) {
    return 'none';
  }
  
  // 有服务但没有健康统计
  if (!host.health_stats) {
    return 'none';
  }
  
  // 有 down 的服务
  if (host.health_stats.down_count > 0) {
    return 'error';
  }
  
  // 有 warning 的服务
  if (host.health_stats.warning_count > 0) {
    return 'warn';
  }
  
  // 全部 up
  if (host.health_stats.up_count > 0) {
    return 'ok';
  }
  
  return 'none';
};

const selectHost = async (host: Host) => {
  selectedHost.value = host;
};

const handleBackToList = () => {
  selectedHost.value = null;
  // 清除可能导致过滤的 query 参数
  router.push({ 
    path: '/hosts',
    query: {} // 清空所有查询参数
  });
};

const formatTime = (timestamp: string): string => {
  // 修复时区问题：确保时间字符串被正确解析为UTC时间
  // SQLite CURRENT_TIMESTAMP 返回格式: "2026-02-05 05:27:08" (空格分隔，无时区)
  // JavaScript API 返回格式: "2026-02-05T03:30:15.000" (T分隔，无时区)
  let dateStr = timestamp;
  
  // 检查是否没有时区标记（没有'Z'也没有'+'表示时区偏移）
  if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
    // 将空格替换为'T'以符合ISO 8601格式
    dateStr = dateStr.replace(' ', 'T');
    // 添加'Z'表示UTC时间
    dateStr = dateStr + 'Z';
  }
  
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return t('common.timeAgoS', { n: seconds });
  if (minutes < 60) return t('common.timeAgoM', { n: minutes });
  if (hours < 24) return t('common.timeAgoH', { n: hours });
  return t('common.timeAgoD', { n: days });
};

const testConnection = async (host: Host) => {
  if (host.connection_type === 'ssh' && !host.ssh_host && !host.ip) {
    ElMessage.warning(t('hosts.msgNoSSHConfig'));
    return;
  }
  
  testing.value = true;
  const typeLabel = host.connection_type === 'ssh' ? t('hosts.typeSSH') : 'Ping';
  
  // 显示 Loading 提示
  const loadingInstance = ElLoading.service({
    lock: true,
    text: t('hosts.msgTesting', { type: typeLabel, name: host.name }) + '\n' + t('hosts.msgTestWait'),
    background: 'rgba(0, 0, 0, 0.7)'
  });
  
  // 用于存储超时警告消息实例
  let warningMessageInstance: any = null;
  
  // 10秒后显示超时警告
  const timeoutWarning = setTimeout(() => {
    if (testing.value) {
      warningMessageInstance = ElMessage.warning({
        message: t('hosts.msgTestTimeout'),
        duration: 0,
        showClose: true
      });
    }
  }, 10000);
  
  try {
    // 传递完整配置到API body，允许测试未保存的配置
    // 测试时始终使用ip字段作为ssh_host，确保测试的是用户当前填写的地址
    const response = await api.post(`/hosts/${host.id}/test`, {
      connection_type: host.connection_type,
      ip: host.ip,
      ssh_host: host.ip,  // 使用ip字段作为SSH目标地址
      ssh_port: host.ssh_port,
      ssh_username: host.ssh_username,
      ssh_auth_type: host.ssh_auth_type,
      ssh_password: host.ssh_password,
      ssh_private_key: host.ssh_private_key,
      ssh_passphrase: host.ssh_passphrase,
      ssh_proxy_host: host.ssh_proxy_host,
      ssh_proxy_port: host.ssh_proxy_port,
      // SSH connection settings (per-host)
      ssh_max_retries: host.ssh_max_retries,
      ssh_retry_delay: host.ssh_retry_delay * 1000,
      ssh_connection_timeout: host.ssh_connection_timeout * 1000,
      ssh_command_timeout: host.ssh_command_timeout * 1000
    });
    
    clearTimeout(timeoutWarning);
    if (warningMessageInstance) warningMessageInstance.close();
    loadingInstance.close();
    
    if (response.data.success) {
      const latencyInfo = response.data.latency ? ` (${response.data.latency}ms)` : '';
      ElMessage.success({
        message: `✅ ${t('hosts.msgTestSuccess')}${latencyInfo}`,
        duration: 3000
      });
    } else {
      ElMessage.error({
        message: `❌ ${t('hosts.msgTestError')}`,
        duration: 5000,
        showClose: true
      });
    }
    
    // 刷新主机列表以显示最新状态
    await fetchHosts();
  } catch (err: any) {
    clearTimeout(timeoutWarning);
    if (warningMessageInstance) warningMessageInstance.close();
    loadingInstance.close();
    
    console.error('Test connection error:', err);
    const errorMsg = err.response?.data?.error || err.message || 'Unknown error';
    const detailMsg = err.response?.data?.details ? `\n${err.response.data.details}` : '';
    
    ElMessage.error({
      message: `❌ ${t('hosts.msgTestFailed', { error: errorMsg })}${detailMsg}`,
      duration: 8000,
      showClose: true
    });
  } finally {
    testing.value = false;
  }
};

const testConnectionDialog = async () => {
  if (!editingId.value) {
    ElMessage.warning(t('hosts.msgSaveFirst'));
    return;
  }
  
  // For SSH type, check SSH configuration
  if (hostForm.value.connection_type === 'ssh') {
    if (!hostForm.value.ssh_host || !hostForm.value.ssh_username) {
      ElMessage.warning(t('hosts.msgConfigSSH'));
      return;
    }
  }
  
  // Create a temporary host object to test
  const tempHost: Host = {
    id: editingId.value,
    name: hostForm.value.name,
    ip: hostForm.value.ip,
    connection_type: hostForm.value.connection_type,
    ssh_host: hostForm.value.ssh_host,
    ssh_port: hostForm.value.ssh_port,
    ssh_username: hostForm.value.ssh_username,
    ssh_auth_type: hostForm.value.ssh_auth_type,
    ssh_password: hostForm.value.ssh_password,
    ssh_private_key: hostForm.value.ssh_private_key,
    ssh_passphrase: hostForm.value.ssh_passphrase,
    ssh_proxy_host: hostForm.value.ssh_proxy_host,
    ssh_proxy_port: hostForm.value.ssh_proxy_port,
    // SSH connection settings (per-host)
    ssh_max_retries: hostForm.value.ssh_max_retries,
    ssh_retry_delay: hostForm.value.ssh_retry_delay * 1000,
    ssh_connection_timeout: hostForm.value.ssh_connection_timeout * 1000,
    ssh_command_timeout: hostForm.value.ssh_command_timeout * 1000,
    created_at: '',
    updated_at: ''
  };

  await testConnection(tempHost);
};

const handleAddService = () => {
  if (!selectedHost.value) return;
  
  // Navigate to services page with host filter parameter
  router.push({
    path: '/services',
    query: {
      host_id: selectedHost.value.id,
      project_id: selectedHost.value.project_id
    }
  });
};

// Project-aware navigation helpers
const goToHostDetail = (host: Host) => {
  if (host && host.project_id) {
    router.push({ name: 'host-detail', params: { projectId: host.project_id, hostId: host.id } });
  } else {
    // fallback to internal detail view
    selectedHost.value = host;
  }
};

// 处理代理主机选择变化，自动填充端口
const handleProxyHostChange = (value: string) => {
  if (!value) {
    hostForm.value.ssh_proxy_port = 22;
    return;
  }
  
  // 查找选中的主机
  const selectedProxyHost = allHosts.value.find(h => 
    (h.ssh_host || h.ip) === value && h.connection_type === 'ssh'
  );
  
  if (selectedProxyHost) {
    // 自动填充端口
    hostForm.value.ssh_proxy_port = selectedProxyHost.ssh_port || 22;
    ElMessage.success(t('hosts.msgProxyPort', { port: hostForm.value.ssh_proxy_port }));
  }
};

const handleAdd = () => {
  isEditing.value = false;
  editingId.value = '';
  resetForm();
  showDialog.value = true;
};

// Spec 027: Toggle host monitoring
const handleToggleMonitoring = async (host: Host, enabled: boolean) => {
  try {
    const enabledValue = enabled ? 1 : 0;
    await api.patch(`/hosts/${host.id}/toggle-enabled`, {
      enabled: enabledValue
    });
    
    ElMessage.success(
      enabled ? t('hosts.msgMonitorEnabled', { name: host.name }) : t('hosts.msgMonitorDisabled', { name: host.name })
    );
    
    // 刷新列表
    await fetchHosts();
  } catch (err: any) {
    ElMessage.error(t('hosts.msgOperationFailed', { error: err.response?.data?.error || err.message }));
    // 刷新列表以恢复UI状态
    await fetchHosts();
  }
};

const handleEdit = (host: Host) => {
  isEditing.value = true;
  editingId.value = host.id;
  hostForm.value = {
    name: host.name,
    ip: host.ip,
    project_id: host.project_id || '',
    connection_type: host.connection_type,
    ssh_host: host.ssh_host || '',
    ssh_port: host.ssh_port || 22,
    ssh_username: host.ssh_username || '',
    ssh_auth_type: host.ssh_auth_type || 'password',
    ssh_password: host.ssh_password || '',
    ssh_private_key: host.ssh_private_key || '',
    ssh_passphrase: host.ssh_passphrase || '',
    ssh_proxy_host: host.ssh_proxy_host || '',
    ssh_proxy_port: host.ssh_proxy_port || 22,
    // SSH connection settings
    ssh_max_retries: host.ssh_max_retries || 3,
    ssh_retry_delay: (host.ssh_retry_delay || 2000) / 1000,
    ssh_connection_timeout: (host.ssh_connection_timeout || 10000) / 1000,
    ssh_command_timeout: (host.ssh_command_timeout || 30000) / 1000,
    // Host check interval
    check_interval: host.check_interval || 300,
    description: host.description || '',
    tags: host.tags || []
  };
  showDialog.value = true;
  selectedHost.value = null; // Close detail view if open
};

const handleSave = async () => {
  if (!formRef.value) return;
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    
    saving.value = true;
    try {
      // 准备提交的数据，根据认证类型清除不相关的字段
      const submitData = {
        ...hostForm.value,
        // Bug #031: 前端秒 → 后端毫秒
        ssh_retry_delay: hostForm.value.ssh_retry_delay * 1000,
        ssh_connection_timeout: hostForm.value.ssh_connection_timeout * 1000,
        ssh_command_timeout: hostForm.value.ssh_command_timeout * 1000,
      };
      
      // 如果选择 password 认证，清除 private key 相关字段
      if (submitData.ssh_auth_type === 'password') {
        submitData.ssh_private_key = '';
        submitData.ssh_passphrase = '';
      }
      // 如果选择 private_key 认证，清除 password 字段
      else if (submitData.ssh_auth_type === 'private_key') {
        submitData.ssh_password = '';
      }
      
      if (isEditing.value) {
        await hostsApi.update(editingId.value, submitData);
        
        // 立即显示成功消息
        ElMessage.success({
          message: '✅ ' + t('hosts.msgUpdated'),
          duration: 2000
        });
        
        // 立即刷新一次获取更新后的数据
        await fetchHosts();
        
        // 重新加载表单数据，确保按钮状态正确
        const updatedHost = allHosts.value.find(h => h.id === editingId.value);
        if (updatedHost) {
          hostForm.value = {
            name: updatedHost.name,
            ip: updatedHost.ip,
            project_id: updatedHost.project_id || '',
            connection_type: updatedHost.connection_type,
            ssh_host: updatedHost.ssh_host || '',
            ssh_port: updatedHost.ssh_port || 22,
            ssh_username: updatedHost.ssh_username || '',
            ssh_auth_type: updatedHost.ssh_auth_type || 'password',
            ssh_password: updatedHost.ssh_password || '',
            ssh_private_key: updatedHost.ssh_private_key || '',
            ssh_passphrase: updatedHost.ssh_passphrase || '',
            ssh_proxy_host: updatedHost.ssh_proxy_host || '',
            ssh_proxy_port: updatedHost.ssh_proxy_port || 22,
            // SSH connection settings
            ssh_max_retries: updatedHost.ssh_max_retries || 3,
            ssh_retry_delay: (updatedHost.ssh_retry_delay || 2000) / 1000,
            ssh_connection_timeout: (updatedHost.ssh_connection_timeout || 10000) / 1000,
            ssh_command_timeout: (updatedHost.ssh_command_timeout || 30000) / 1000,
            description: updatedHost.description || '',
            tags: updatedHost.tags || []
          };
        }
        
        // 后台自动测试连接 - 3秒后刷新一次获取测试结果
        setTimeout(async () => {
          await fetchHosts();
        }, 3000);
      } else {
        const newHost = await hostsApi.create(submitData);
        ElMessage.success(t('hosts.msgCreated'));
        // 新建时切换到编辑模式，方便用户测试
        isEditing.value = true;
        editingId.value = newHost.id;
        await fetchHosts();
      }
    } catch (err: any) {
      console.error('Failed to save host:', err);
      ElMessage.error(err.response?.data?.error || t('hosts.msgSaveFailed'));
    } finally {
      saving.value = false;
    }
  });
};

const handleDelete = async (host: Host) => {
  try {
    await ElMessageBox.confirm(
      t('hosts.confirmDeleteMsg', { name: host.name }),
      t('hosts.confirmDeleteTitle'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    );
    
    await hostsApi.delete(host.id);
    ElMessage.success(t('hosts.msgDeleted'));
    selectedHost.value = null; // Close detail view if open
    await fetchHosts();
  } catch (err: any) {
    if (err !== 'cancel') {
      console.error('Failed to delete host:', err);
      ElMessage.error(err.response?.data?.error || t('hosts.msgDeleteFailed'));
    }
  }
};

const resetForm = () => {
  hostForm.value = {
    name: '',
    ip: '',
    project_id: '',
    connection_type: 'local',  // 默认为 local
    ssh_host: '',
    ssh_port: 22,
    ssh_username: '',
    ssh_auth_type: 'password',
    ssh_password: '',
    ssh_private_key: '',
    ssh_passphrase: '',
    ssh_proxy_host: '',
    ssh_proxy_port: 22,
    // SSH connection settings
    ssh_max_retries: 3,
    ssh_retry_delay: 2000,
    ssh_connection_timeout: 10000,
    ssh_command_timeout: 30000,
    // Host check interval
    check_interval: 300,
    description: '',
    tags: []
  };
  formRef.value?.clearValidate();
};
</script>

<style scoped>
.hosts-view {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-subtitle {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

/* Stats Cards */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.stat-card.success .stat-value {
  color: #52c41a;
}

.stat-card.error .stat-value {
  color: #f5222d;
}

.stat-value {
  font-size: 36px;
  font-weight: 600;
  color: #333;
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  color: #999;
  margin-top: 8px;
}

/* Filter Bar */
.filter-bar {
  background: white;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  gap: 12px;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 14px;
  color: #666;
}

/* Host Cards */
.hosts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.host-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transition: all 0.3s;
  border: 1px solid #e8e8e8;
  cursor: pointer;
  width: 400px;
}

.host-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  transform: translateY(-4px);
  border-color: #1890ff;
}

.card-header {
  padding: 16px 18px 14px;
  border-bottom: 1px solid #f0f0f0;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.host-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.host-icon {
  font-size: 18px;
}

.host-meta {
  font-size: 12px;
  color: #999;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* Quick Status Badges */
.quick-badges {
  display: flex;
  gap: 5px;
}

.quick-badge {
  padding: 3px 7px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.quick-badge span {
  font-size: 10px;
  line-height: 1;
}

.badge-conn-ok {
  background: rgba(46, 125, 50, 0.2);
  color: #1b5e20;
  border: 1px solid rgba(46, 125, 50, 0.3);
}

.badge-conn-fail {
  background: rgba(198, 40, 40, 0.2);
  color: #b71c1c;
  border: 1px solid rgba(198, 40, 40, 0.3);
}

.badge-svc-ok {
  background: rgba(46, 125, 50, 0.2);
  color: #1b5e20;
  border: 1px solid rgba(46, 125, 50, 0.3);
}

.badge-svc-error {
  background: rgba(198, 40, 40, 0.2);
  color: #b71c1c;
  border: 1px solid rgba(198, 40, 40, 0.3);
}

.badge-svc-warn {
  background: rgba(237, 108, 2, 0.2);
  color: #e65100;
  border: 1px solid rgba(237, 108, 2, 0.3);
}

.badge-svc-none {
  background: rgba(117, 117, 117, 0.2);
  color: #616161;
  border: 1px solid rgba(117, 117, 117, 0.3);
}

.card-content {
  padding: 14px 18px;
}

.content-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}

.content-row:last-child {
  margin-bottom: 0;
}

.content-label {
  font-size: 11px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  min-width: 80px;
}

.content-value {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.info-text {
  font-size: 12px;
  color: #666;
}

.info-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.info-tag {
  padding: 2px 8px;
  background: #f5f5f5;
  border: 1px solid #e8e8e8;
  border-radius: 3px;
  font-size: 11px;
  color: #666;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.stat-chip.up {
  background: #e8f5e9;
  color: #2e7d32;
}

.stat-chip.down {
  background: #ffebee;
  color: #c62828;
}

.stat-chip.warning {
  background: #fff3e0;
  color: #ef6c00;
}

.stat-chip.unknown {
  background: #f2f4f7;
  color: #475467;
}

.no-services {
  color: #999;
  font-size: 11px;
  font-style: italic;
}

.card-footer {
  padding: 12px 18px;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.last-check {
  font-size: 11px;
  color: #999;
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

/* Spec 027: Disabled host styling */
.disabled-host {
  opacity: 0.6;
  border: 2px dashed #dcdfe6 !important;
}

.disabled-host:hover {
  opacity: 0.8;
}

.monitoring-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 8px;
}

.monitoring-status {
  font-size: 12px;
  color: #909399;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
  grid-column: 1 / -1;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 16px;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 14px;
  color: #bbb;
}

/* Detail View */
.host-detail {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.detail-title {
  font-size: 24px;
  font-weight: 600;
  display: flex;
  align-items: center;
}

.detail-subtitle {
  font-size: 14px;
  color: #999;
  margin-bottom: 24px;
}

.detail-actions {
  display: flex;
  gap: 12px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.metric-card {
  background: white;
  padding: 16px;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
}

.metric-value {
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.metric-label {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.services-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
  border: 1px solid #f0f0f0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  font-size: 18px;
  margin: 0;
}

/* Connection Type Cards */
.connection-card {
  border: 2px solid #dcdfe6;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  text-align: center;
  transition: all 0.3s;
}

.connection-card:hover {
  border-color: #409eff;
  background: #f0f9ff;
}

.connection-card.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.connection-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.connection-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.connection-desc {
  font-size: 12px;
  color: #909399;
}
</style>