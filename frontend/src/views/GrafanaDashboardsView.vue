<template>
  <div class="grafana-dashboards-view">
    <!-- Stats Row -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="8">
        <div class="stat-card">
          <div class="stat-icon" style="background: #ecf5ff; color: #409EFF;">
            <el-icon :size="24"><DataBoard /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('grafana.totalDashboards') }}</div>
            <div class="stat-value">{{ dashboards.length }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="stat-card">
          <div class="stat-icon" style="background: #f0f9eb; color: #67C23A;">
            <el-icon :size="24"><CircleCheckFilled /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('grafana.enabled') }}</div>
            <div class="stat-value" style="color: #67C23A">{{ enabledCount }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="stat-card">
          <div class="stat-icon" style="background: #fdf6ec; color: #E6A23C;">
            <el-icon :size="24"><FolderOpened /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('grafana.projectLinked') }}</div>
            <div class="stat-value" style="color: #E6A23C">{{ projectLinkedCount }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- Main Content -->
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">📊 {{ $t('grafana.title') }}</span>
          <div class="actions">
            <el-button @click="loadData">
              <el-icon><Refresh /></el-icon> {{ $t('common.refresh') }}
            </el-button>
            <el-button type="primary" @click="handleAdd" v-if="isAdmin">
              <el-icon><Plus /></el-icon> {{ $t('grafana.addDashboard') }}
            </el-button>
          </div>
        </div>
      </template>

      <!-- Filters -->
      <div class="filter-bar">
        <el-input v-model="searchQuery" :placeholder="$t('grafana.searchPlaceholder')" :prefix-icon="Search" style="width: 250px;" clearable />
        <el-select v-model="filterProject" :placeholder="$t('grafana.filterByProject')" clearable multiple collapse-tags style="width: 200px;">
          <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
        </el-select>
        <el-select v-model="filterEnabled" :placeholder="$t('common.status')" clearable style="width: 120px;">
          <el-option :label="$t('common.all')" value="" />
          <el-option :label="$t('grafana.enabled')" value="enabled" />
          <el-option :label="$t('grafana.disabled')" value="disabled" />
        </el-select>
      </div>

      <!-- Dashboard Cards Grid -->
      <div class="dashboard-grid" v-loading="loading">
        <el-card 
          v-for="(dashboard, index) in filteredDashboards" 
          :key="dashboard.id" 
          class="dashboard-card"
          :class="{ disabled: dashboard.enabled !== true && dashboard.enabled !== 1 }"
          :style="getCardStyle(index, dashboard.enabled)"
          shadow="hover"
        >
          <template #header>
            <div class="dashboard-card-header">
              <div class="dashboard-name">
                <el-icon class="icon"><DataBoard /></el-icon>
                {{ dashboard.name }}
              </div>
              <el-switch 
                v-if="isAdmin"
                v-model="dashboard.enabled" 
                size="small"
                @change="handleToggle(dashboard)"
              />
            </div>
          </template>
          
          <div class="dashboard-info">
            <p v-if="dashboard.description" class="description">{{ dashboard.description }}</p>
            <div class="meta-info">
              <span v-if="dashboard.project_names && dashboard.project_names.length > 0" class="meta-item">
                <el-icon><FolderOpened /></el-icon> {{ dashboard.project_names.join(', ') }}
              </span>
              <span v-else-if="dashboard.project_name" class="meta-item">
                <el-icon><FolderOpened /></el-icon> {{ dashboard.project_name }}
              </span>
              <span v-if="dashboard.service_name" class="meta-item">
                <el-icon><Monitor /></el-icon> {{ dashboard.service_name }}
              </span>
              <span class="meta-item">
                <el-icon><Link /></el-icon> {{ dashboard.dashboard_uid }}
              </span>
              <span v-if="dashboard.panel_id" class="meta-item">
                {{ $t('grafana.panelLabel') }}: #{{ dashboard.panel_id }}
              </span>
            </div>
            <div class="embed-options" v-if="dashboard.embed_options">
              <el-tag size="small" v-if="dashboard.embed_options.theme">
                {{ dashboard.embed_options.theme }}
              </el-tag>
              <el-tag size="small" type="info" v-if="dashboard.embed_options.refresh">
                {{ dashboard.embed_options.refresh }}
              </el-tag>
              <el-tag size="small" type="success" v-if="dashboard.embed_options.kiosk">
                {{ $t('grafana.kiosk') }}
              </el-tag>
            </div>
          </div>
          
          <div class="dashboard-actions">
            <el-button type="primary" link @click="handleView(dashboard)">
              <el-icon><View /></el-icon> {{ $t('grafana.viewDashboard') }}
            </el-button>
            <el-button type="info" link @click="handleOpenGrafana(dashboard)">
              <el-icon><TopRight /></el-icon> {{ $t('grafana.openOriginal') }}
            </el-button>
            <template v-if="isAdmin">
              <el-button type="warning" link @click="handleEdit(dashboard)">
                <el-icon><Edit /></el-icon> {{ $t('grafana.editDashboard') }}
              </el-button>
              <el-button type="danger" link @click="handleDelete(dashboard)">
                <el-icon><Delete /></el-icon> {{ $t('grafana.deleteDashboard') }}
              </el-button>
            </template>
          </div>
        </el-card>
        
        <div v-if="filteredDashboards.length === 0 && !loading" class="empty-state">
          <el-empty :description="$t('grafana.noDashboards')">
            <el-button type="primary" @click="handleAdd" v-if="isAdmin">{{ $t('grafana.addFirstDashboard') }}</el-button>
          </el-empty>
        </div>
      </div>
    </el-card>

    <!-- Add/Edit Dialog -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? t('grafana.dialogEdit') : t('grafana.dialogCreate')" width="700px">
      <el-form :model="form" label-width="120px" ref="formRef">
        <el-divider content-position="left">{{ $t('grafana.grafanaConfig') }}</el-divider>
        
        <el-form-item :label="$t('grafana.labelGrafanaUrl')" required>
          <div style="display: flex; gap: 10px; width: 100%;">
            <el-input v-model="form.grafana_url" :placeholder="$t('grafana.placeholderGrafanaUrl')" style="flex: 1;" />
            <el-button 
              type="primary" 
              @click="handleTestConnection" 
              :loading="testing"
              :disabled="!form.grafana_url"
            >
              <el-icon><Connection /></el-icon> {{ $t('grafana.testConnection') }}
            </el-button>
          </div>
        </el-form-item>
        
        <el-form-item :label="$t('grafana.labelApiKey')">
          <el-input 
            v-model="form.api_key" 
            :placeholder="$t('grafana.placeholderApiKey')" 
            type="password"
            show-password
          />
          <template #extra>
            <span class="form-tip">{{ $t('grafana.tipApiKey') }}</span>
          </template>
        </el-form-item>

        <!-- Connection test result -->
        <el-form-item v-if="connectionTestResult" label=" ">
          <el-alert 
            :type="connectionTestResult.success ? 'success' : 'error'" 
            :title="connectionTestResult.message || connectionTestResult.error"
            :closable="false"
            show-icon
          />
        </el-form-item>

        <!-- Dashboard selector from Grafana -->
        <el-form-item :label="$t('grafana.labelDashboard')" required v-if="remoteDashboards.length > 0">
          <el-select 
            v-model="selectedRemoteDashboard" 
            :placeholder="$t('grafana.placeholderSelectDashboard')"
            style="width: 100%;"
            filterable
            @change="handleRemoteDashboardSelect"
          >
            <el-option-group v-for="folder in groupedDashboards" :key="folder.name" :label="folder.name">
              <el-option 
                v-for="d in folder.dashboards" 
                :key="d.uid" 
                :label="d.title" 
                :value="d.uid"
              >
                <span>{{ d.title }}</span>
                <span style="float: right; color: #909399; font-size: 12px;">{{ d.uid }}</span>
              </el-option>
            </el-option-group>
          </el-select>
        </el-form-item>
        
        <el-form-item :label="$t('grafana.labelDashboardUid')" required v-else>
          <el-input v-model="form.dashboard_uid" :placeholder="$t('grafana.placeholderDashboardUid')" />
          <template #extra>
            <span class="form-tip" v-html="$t('grafana.tipDashboardUid')"></span>
          </template>
        </el-form-item>

        <!-- Panel selector -->
        <el-form-item :label="$t('grafana.labelPanel')" v-if="remotePanels.length > 0">
          <el-select 
            v-model="form.panel_id" 
            :placeholder="$t('grafana.placeholderSelectPanel')"
            style="width: 100%;"
            clearable
          >
            <el-option :value="undefined" :label="$t('grafana.fullDashboard')" />
            <el-option 
              v-for="p in remotePanels" 
              :key="p.id" 
              :label="`#${p.id} - ${p.title}`" 
              :value="p.id"
            >
              <span>#{{ p.id }} - {{ p.title }}</span>
              <span style="float: right; color: #909399; font-size: 12px;">{{ p.type }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        
        <el-form-item :label="$t('grafana.labelPanelId')" v-else>
          <el-input-number v-model="form.panel_id" :min="0" :placeholder="$t('grafana.placeholderPanelId')" />
          <template #extra>
            <span class="form-tip">{{ $t('grafana.tipPanelId') }}</span>
          </template>
        </el-form-item>

        <el-divider content-position="left">{{ $t('grafana.basicInfo') }}</el-divider>
        
        <el-form-item :label="$t('grafana.labelName')" required>
          <el-input v-model="form.name" :placeholder="$t('grafana.placeholderName')" />
        </el-form-item>
        <el-form-item :label="$t('grafana.labelDesc')">
          <el-input v-model="form.description" type="textarea" :rows="2" :placeholder="$t('grafana.placeholderDesc')" />
        </el-form-item>

        <el-divider content-position="left">{{ $t('grafana.association') }}</el-divider>
        <el-form-item :label="$t('grafana.labelProjects')">
          <el-select 
            v-model="form.project_ids" 
            :multiple="projectMultiSelect" 
            :collapse-tags="projectMultiSelect"
            :collapse-tags-tooltip="projectMultiSelect"
            :placeholder="$t('grafana.placeholderSelectProjects')" 
            clearable 
            style="width: 100%;"
          >
            <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
          <div style="margin-top: 5px;">
            <el-switch v-model="projectMultiSelect" size="small" />
            <span style="margin-left: 8px; color: #909399; font-size: 12px;">{{ $t('grafana.multiSelectMode') }}</span>
          </div>
        </el-form-item>
        <el-form-item :label="$t('grafana.labelService')">
          <el-select v-model="form.service_id" :placeholder="$t('grafana.placeholderSelectService')" clearable style="width: 100%;">
            <el-option v-for="s in services" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        
        <el-divider content-position="left">{{ $t('grafana.embedOptions') }}</el-divider>
        <el-form-item :label="$t('grafana.labelTheme')">
          <el-radio-group v-model="form.embed_options.theme">
            <el-radio value="dark">{{ $t('grafana.themeDark') }}</el-radio>
            <el-radio value="light">{{ $t('grafana.themeLight') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="$t('grafana.labelTimeRange')">
          <el-select v-model="form.embed_options.from" :placeholder="$t('grafana.placeholderStartTime')" style="width: 45%;">
            <el-option :label="$t('grafana.timeLast1h')" value="now-1h" />
            <el-option :label="$t('grafana.timeLast6h')" value="now-6h" />
            <el-option :label="$t('grafana.timeLast12h')" value="now-12h" />
            <el-option :label="$t('grafana.timeLast24h')" value="now-24h" />
            <el-option :label="$t('grafana.timeLast7d')" value="now-7d" />
          </el-select>
          <span style="margin: 0 10px;">{{ $t('common.to') }}</span>
          <el-input v-model="form.embed_options.to" placeholder="now" style="width: 25%;" />
        </el-form-item>
        <el-form-item :label="$t('grafana.labelAutoRefresh')">
          <el-select v-model="form.embed_options.refresh" :placeholder="$t('grafana.placeholderSelectInterval')" clearable style="width: 200px;">
            <el-option :label="$t('grafana.refreshOff')" value="" />
            <el-option :label="$t('grafana.refresh5s')" value="5s" />
            <el-option :label="$t('grafana.refresh10s')" value="10s" />
            <el-option :label="$t('grafana.refresh30s')" value="30s" />
            <el-option :label="$t('grafana.refresh1m')" value="1m" />
            <el-option :label="$t('grafana.refresh5m')" value="5m" />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('grafana.labelKioskMode')">
          <el-switch v-model="form.embed_options.kiosk" />
          <span style="margin-left: 10px; color: #909399;">{{ $t('grafana.tipKioskMode') }}</span>
        </el-form-item>
        <el-form-item :label="$t('grafana.labelDisplayOrder')">
          <el-input-number v-model="form.display_order" :min="0" :max="999" />
        </el-form-item>
        <el-form-item :label="$t('grafana.enabled')">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">{{ $t('common.save') }}</el-button>
      </template>
    </el-dialog>

    <!-- View Dashboard Dialog -->
    <el-dialog 
      v-model="viewDialogVisible" 
      :title="viewingDashboard?.name || t('grafana.dashboard')" 
      width="95%" 
      fullscreen
      class="dashboard-view-dialog"
    >
      <div class="dashboard-toolbar">
        <el-button @click="viewDialogVisible = false" type="default">
          <el-icon><Back /></el-icon> {{ $t('common.back') }}
        </el-button>
        <div class="toolbar-divider"></div>
        <el-button @click="handleOpenGrafana(viewingDashboard!)" type="primary" link>
          <el-icon><TopRight /></el-icon> {{ $t('grafana.openInGrafana') }}
        </el-button>
        <el-button @click="refreshIframe" link>
          <el-icon><Refresh /></el-icon> {{ $t('common.refresh') }}
        </el-button>
      </div>
      <div class="iframe-container">
        <iframe 
          v-if="viewDialogVisible && viewingDashboard" 
          :src="getEmbedUrl" 
          :key="iframeKey"
          frameborder="0" 
          allowfullscreen
        ></iframe>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { 
  DataBoard, CircleCheckFilled, FolderOpened, Plus, Refresh, Search,
  View, Edit, Delete, TopRight, Monitor, Link, Connection, Back
} from '@element-plus/icons-vue';
import {
  getGrafanaDashboards, createGrafanaDashboard, updateGrafanaDashboard,
  deleteGrafanaDashboard, toggleGrafanaDashboard, testGrafanaConnection,
  fetchGrafanaDashboard,
  type GrafanaDashboard, type CreateGrafanaDashboardDto, type EmbedOptions,
  type GrafanaRemoteDashboard, type GrafanaPanel, type TestConnectionResult
} from '../api/grafana-dashboards';
import { getProjects, type Project } from '../api/projects';
import { getServices, type Service } from '../api/services';
import authUtils from '../utils/auth';

// i18n
const { t } = useI18n();

// Permission check
const isAdmin = computed(() => authUtils.isAdmin());

const loading = ref(false);
const submitting = ref(false);
const testing = ref(false);
const dashboards = ref<GrafanaDashboard[]>([]);
const projects = ref<Project[]>([]);
const services = ref<Service[]>([]);

// Filters
const searchQuery = ref('');
const filterProject = ref<number[]>([]);
const filterEnabled = ref('');

// Dialog
const dialogVisible = ref(false);
const viewDialogVisible = ref(false);
const isEdit = ref(false);
const editingId = ref('');
const viewingDashboard = ref<GrafanaDashboard | null>(null);
const iframeKey = ref(0);

// Remote Grafana data
const remoteDashboards = ref<GrafanaRemoteDashboard[]>([]);
const remotePanels = ref<GrafanaPanel[]>([]);
const selectedRemoteDashboard = ref<string>('');
const connectionTestResult = ref<TestConnectionResult | null>(null);
const projectMultiSelect = ref(false);

const defaultEmbedOptions: EmbedOptions = {
  theme: 'dark',
  from: 'now-6h',
  to: 'now',
  refresh: '30s',
  kiosk: true,
  vars: {}
};

interface FormData extends Omit<CreateGrafanaDashboardDto, 'project_id' | 'project_ids'> {
  embed_options: EmbedOptions;
  api_key?: string;
  project_ids: string | string[];
}

const form = reactive<FormData>({
  name: '',
  description: '',
  project_ids: [],
  service_id: undefined,
  grafana_url: '',
  dashboard_uid: '',
  panel_id: undefined,
  embed_options: { ...defaultEmbedOptions },
  display_order: 0,
  enabled: true,
  api_key: ''
});

// Computed
const enabledCount = computed(() => dashboards.value.filter(d => d.enabled).length);
const projectLinkedCount = computed(() => dashboards.value.filter(d => d.project_id || (d.project_ids && d.project_ids.length > 0)).length);

// 5 card theme colors
const cardThemes = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',  // purple
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',  // pink
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',  // blue-cyan
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',  // green
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',  // orange-yellow
];

const getCardStyle = (index: number, enabled: boolean | number) => {
  // Handle both 0/1 and true/false cases
  const isEnabled = enabled === true || enabled === 1;
  const bg = isEnabled 
    ? cardThemes[index % cardThemes.length]
    : 'linear-gradient(135deg, #bdc3c7 0%, #95a5a6 100%)';
  return { '--card-header-bg': bg };
};

const filteredDashboards = computed(() => {
  return dashboards.value.filter(d => {
    const matchSearch = !searchQuery.value || 
      d.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      d.description?.toLowerCase().includes(searchQuery.value.toLowerCase());
    const matchProject = filterProject.value.length === 0 || filterProject.value.includes(d.project_id);
    const matchEnabled = !filterEnabled.value || 
      (filterEnabled.value === 'enabled' ? d.enabled : !d.enabled);
    return matchSearch && matchProject && matchEnabled;
  });
});

// Group dashboards by folder
const groupedDashboards = computed(() => {
  const groups: Record<string, GrafanaRemoteDashboard[]> = {};
  for (const d of remoteDashboards.value) {
    const folder = d.folderTitle || 'General';
    if (!groups[folder]) groups[folder] = [];
    groups[folder].push(d);
  }
  return Object.keys(groups).sort().map(name => ({
    name,
    dashboards: groups[name].sort((a, b) => a.title.localeCompare(b.title))
  }));
});

// Methods
const loadData = async () => {
  loading.value = true;
  try {
    const [dashboardsData, projectsData, servicesData] = await Promise.all([
      getGrafanaDashboards(),
      getProjects(),
      getServices()
    ]);
    dashboards.value = dashboardsData;
    projects.value = projectsData;
    services.value = servicesData;
  } catch (error: any) {
    ElMessage.error(t('grafana.loadFailed') + ': ' + error.message);
  } finally {
    loading.value = false;
  }
};

const resetForm = () => {
  form.name = '';
  form.description = '';
  form.project_ids = [];
  form.service_id = undefined;
  form.grafana_url = '';
  form.dashboard_uid = '';
  form.panel_id = undefined;
  form.embed_options = { ...defaultEmbedOptions };
  form.display_order = 0;
  form.enabled = true;
  form.api_key = '';
  remoteDashboards.value = [];
  remotePanels.value = [];
  selectedRemoteDashboard.value = '';
  connectionTestResult.value = null;
  projectMultiSelect.value = false;
};

const handleTestConnection = async () => {
  if (!form.grafana_url) {
    ElMessage.warning(t('grafana.enterGrafanaUrlFirst'));
    return;
  }

  testing.value = true;
  connectionTestResult.value = null;
  remoteDashboards.value = [];
  remotePanels.value = [];

  try {
    const result = await testGrafanaConnection(form.grafana_url, form.api_key);
    connectionTestResult.value = result;
    
    if (result.success && result.dashboards) {
      remoteDashboards.value = result.dashboards;
      ElMessage.success(t('grafana.connectionSuccess', { count: result.dashboards.length }));
    }
  } catch (error: any) {
    connectionTestResult.value = { 
      success: false, 
      error: error.response?.data?.error || error.message 
    };
  } finally {
    testing.value = false;
  }
};

const handleRemoteDashboardSelect = async (uid: string) => {
  form.dashboard_uid = uid;
  remotePanels.value = [];
  
  // Find selected dashboard and auto-fill name
  const selected = remoteDashboards.value.find(d => d.uid === uid);
  if (selected && !form.name) {
    form.name = selected.title;
  }

  // Fetch panels
  if (uid && form.grafana_url) {
    try {
      const result = await fetchGrafanaDashboard(form.grafana_url, uid, form.api_key);
      if (result.success && result.panels) {
        remotePanels.value = result.panels;
      }
      if (result.dashboard?.description && !form.description) {
        form.description = result.dashboard.description;
      }
    } catch (error) {
      // Ignore panel fetch errors
    }
  }
};

const handleAdd = () => {
  isEdit.value = false;
  editingId.value = '';
  resetForm();
  dialogVisible.value = true;
};

const handleEdit = (dashboard: GrafanaDashboard) => {
  isEdit.value = true;
  editingId.value = dashboard.id;
  form.name = dashboard.name;
  form.description = dashboard.description || '';
  // Handle project_ids - support both single and multiple
  if (dashboard.project_ids && dashboard.project_ids.length > 0) {
    form.project_ids = dashboard.project_ids;
    projectMultiSelect.value = dashboard.project_ids.length > 1;
  } else if (dashboard.project_id) {
    form.project_ids = dashboard.project_id;
    projectMultiSelect.value = false;
  } else {
    form.project_ids = [];
    projectMultiSelect.value = false;
  }
  form.service_id = dashboard.service_id;
  form.grafana_url = dashboard.grafana_url;
  form.dashboard_uid = dashboard.dashboard_uid;
  form.panel_id = dashboard.panel_id;
  form.embed_options = { ...defaultEmbedOptions, ...dashboard.embed_options };
  form.display_order = dashboard.display_order;
  // Handle 0/1 to boolean conversion
  form.enabled = dashboard.enabled === true || dashboard.enabled === 1;
  form.api_key = '';
  remoteDashboards.value = [];
  remotePanels.value = [];
  selectedRemoteDashboard.value = dashboard.dashboard_uid;
  connectionTestResult.value = null;
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  if (!form.name || !form.grafana_url || !form.dashboard_uid) {
    ElMessage.warning(t('grafana.fillRequired'));
    return;
  }
  
  submitting.value = true;
  try {
    // Convert project_ids to array format
    let projectIds: string[] = [];
    if (Array.isArray(form.project_ids)) {
      projectIds = form.project_ids;
    } else if (form.project_ids) {
      projectIds = [form.project_ids];
    }
    
    const data: CreateGrafanaDashboardDto = {
      name: form.name,
      description: form.description || undefined,
      project_id: projectIds.length === 1 ? projectIds[0] : undefined,
      project_ids: projectIds.length > 0 ? projectIds : undefined,
      service_id: form.service_id || undefined,
      grafana_url: form.grafana_url,
      dashboard_uid: form.dashboard_uid,
      panel_id: form.panel_id || undefined,
      embed_options: form.embed_options,
      display_order: form.display_order,
      enabled: form.enabled
    };
    
    if (isEdit.value) {
      await updateGrafanaDashboard(editingId.value, data);
      ElMessage.success(t('grafana.updateSuccess'));
    } else {
      await createGrafanaDashboard(data);
      ElMessage.success(t('grafana.createSuccess'));
    }
    dialogVisible.value = false;
    await loadData();
  } catch (error: any) {
    ElMessage.error(t('grafana.saveFailed') + ': ' + error.message);
  } finally {
    submitting.value = false;
  }
};

const handleDelete = async (dashboard: GrafanaDashboard) => {
  try {
    await ElMessageBox.confirm(
      t('grafana.deleteConfirm', { name: dashboard.name }),
      t('grafana.confirmDeleteTitle'),
      { type: 'warning' }
    );
    await deleteGrafanaDashboard(dashboard.id);
    ElMessage.success(t('grafana.deleteSuccess'));
    await loadData();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(t('grafana.deleteFailed') + ': ' + error.message);
    }
  }
};

const handleToggle = async (dashboard: GrafanaDashboard) => {
  try {
    await toggleGrafanaDashboard(dashboard.id);
  } catch (error: any) {
    ElMessage.error(t('grafana.operationFailed') + ': ' + error.message);
    dashboard.enabled = !dashboard.enabled;
  }
};

const handleView = (dashboard: GrafanaDashboard) => {
  viewingDashboard.value = dashboard;
  viewDialogVisible.value = true;
};

// Generate embed URL, force add kiosk mode
const getEmbedUrl = computed(() => {
  if (!viewingDashboard.value) return '';
  let url = viewingDashboard.value.embed_url;
  // Force add kiosk param for fullscreen display
  if (!url.includes('kiosk')) {
    url += (url.includes('?') ? '&' : '?') + 'kiosk';
  }
  return url;
});

const handleOpenGrafana = (dashboard: GrafanaDashboard) => {
  const url = `${dashboard.grafana_url}/d/${dashboard.dashboard_uid}`;
  window.open(url, '_blank');
};

const refreshIframe = () => {
  iframeKey.value++;
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.grafana-dashboards-view {
  padding: 20px;
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
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.dashboard-card {
  transition: all 0.3s;
}

.dashboard-card.disabled {
  opacity: 0.6;
}

.dashboard-card {
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.dashboard-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

/* 卡片头部基础样式 */
.dashboard-card :deep(.el-card__header) {
  color: white;
  border-bottom: none;
  padding: 16px 20px;
  background: var(--card-header-bg, linear-gradient(135deg, #667eea 0%, #764ba2 100%));
}

.dashboard-card.disabled :deep(.el-card__header) {
  background: var(--card-header-bg, linear-gradient(135deg, #bdc3c7 0%, #95a5a6 100%));
}

.dashboard-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 16px;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.dashboard-name .icon {
  font-size: 22px;
  color: white;
}

.dashboard-card :deep(.el-switch__core) {
  background-color: rgba(255, 255, 255, 0.3);
}

.dashboard-card :deep(.el-switch.is-checked .el-switch__core) {
  background-color: #67c23a;
}

.dashboard-info {
  min-height: 100px;
  padding: 12px 0;
}

.dashboard-info .description {
  color: #1a1a2e;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 16px;
  font-weight: 500;
}

.meta-info {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #2d3748;
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  padding: 6px 12px;
  border-radius: 20px;
}

.meta-item .el-icon {
  color: #5b21b6;
}

.embed-options {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.dashboard-actions {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  border-top: 1px solid #ebeef5;
  padding-top: 16px;
  margin-top: 16px;
}

.dashboard-actions .el-button {
  font-weight: 500;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: #dcdfe6;
  margin: 0 8px;
}

.empty-state {
  grid-column: 1 / -1;
  padding: 40px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
}

/* View Dialog - 全屏显示 */
.dashboard-view-dialog :deep(.el-dialog) {
  margin: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: 100vw !important;
}

.dashboard-view-dialog :deep(.el-dialog__header) {
  padding: 10px 20px;
  margin: 0;
  border-bottom: 1px solid #e4e7ed;
}

.dashboard-view-dialog :deep(.el-dialog__body) {
  padding: 0;
  height: calc(100vh - 60px);
  overflow: hidden;
}

.dashboard-toolbar {
  padding: 8px 20px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  gap: 16px;
  height: 40px;
  align-items: center;
}

.iframe-container {
  width: 100%;
  height: calc(100vh - 100px);
  overflow: hidden;
}

.iframe-container iframe {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
