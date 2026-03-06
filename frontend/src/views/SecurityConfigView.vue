<template>
  <div class="security-config-list">
    <!-- Stats Cards -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #f0f9eb; color: #67C23A;">
            <el-icon :size="24"><CircleCheckFilled /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('security.normal') }}</div>
            <div class="stat-value" style="color: #67C23A">{{ stats.normal }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #fdf6ec; color: #E6A23C;">
            <el-icon :size="24"><WarningFilled /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('security.warning') }}</div>
            <div class="stat-value" style="color: #E6A23C">{{ stats.warning }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #fef0f0; color: #F56C6C;">
            <el-icon :size="24"><WarningFilled /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('security.critical') }}</div>
            <div class="stat-value" style="color: #F56C6C">{{ stats.critical }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #f4f4f5; color: #909399;">
            <el-icon :size="24"><CircleCloseFilled /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('security.expired') }}</div>
            <div class="stat-value" style="color: #909399">{{ stats.expired }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- Main Table Card -->
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">🔐 {{ $t('security.title') }}</span>
          <div class="actions">
            <el-button @click="triggerExpiryCheck" :loading="checking">
              <el-icon><Bell /></el-icon> {{ $t('security.btnCheckExpiry') }}
            </el-button>
            <el-button @click="loadData">
              <el-icon><Refresh /></el-icon> {{ $t('common.refresh') }}
            </el-button>
            <el-button type="primary" @click="handleAdd" v-if="isAdmin">
              <el-icon><Plus /></el-icon> {{ $t('security.btnAdd') }}
            </el-button>
          </div>
        </div>
      </template>

      <!-- Filters -->
      <div class="filter-bar">
        <el-input v-model="searchQuery" :placeholder="$t('security.searchPlaceholder')" :prefix-icon="Search" style="width: 250px;" clearable />
        <el-select v-model="filterType" :placeholder="$t('common.type')" clearable style="width: 130px;">
          <el-option :label="$t('security.allTypes')" value="" />
          <el-option :label="$t('security.typeAccessKey')" value="accesskey" />
          <el-option :label="$t('security.typeFtpPassword')" value="ftp" />
          <el-option :label="$t('security.typeSSL')" value="ssl" />
        </el-select>
        <el-select v-model="filterStatus" :placeholder="$t('common.status')" clearable style="width: 130px;">
          <el-option :label="$t('security.allStatus')" value="" />
          <el-option :label="$t('security.normal')" value="normal" />
          <el-option :label="$t('security.warning')" value="warning" />
          <el-option :label="$t('security.critical')" value="critical" />
          <el-option :label="$t('security.expired')" value="expired" />
        </el-select>
      </div>

      <el-table :data="paginatedConfigs" style="width: 100%" v-loading="loading" row-key="id">
        <el-table-column :label="$t('security.colNo')" width="60" align="center">
          <template #default="{ $index }">
            {{ (currentPage - 1) * pageSize + $index + 1 }}
          </template>
        </el-table-column>
        <el-table-column :label="$t('security.colStatus')" width="80" align="center">
          <template #default="scope">
            <el-tag :type="getStatusTagType(scope.row.status)" size="small" effect="dark">
              {{ getStatusLabel(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('security.colName')" min-width="200">
          <template #default="scope">
            <div class="config-name">{{ scope.row.name }}</div>
            <div class="config-services" v-if="scope.row.affected_services?.length">
              {{ $t('security.affectsN', { n: scope.row.affected_services.length }) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="$t('security.colType')" width="110">
          <template #default="scope">
            <el-tag size="small" effect="plain">{{ getTypeLabel(scope.row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('security.colDaysRemaining')" width="150">
          <template #default="scope">
            <div class="days-cell">
              <el-progress 
                :percentage="getDaysPercentage(scope.row)" 
                :status="getProgressStatus(scope.row.status)"
                :stroke-width="8"
                :show-text="false"
                style="width: 60px;"
              />
              <span :class="['days-text', scope.row.status]">
                {{ scope.row.days_remaining > 0 ? $t('security.daysN', { n: scope.row.days_remaining }) : $t('security.expired') }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="$t('security.colExpiryDate')" width="130">
          <template #default="scope">
            {{ formatDate(scope.row.expiry_date) }}
          </template>
        </el-table-column>
        <el-table-column :label="$t('security.colActions')" width="180" align="right" v-if="isAdmin">
          <template #default="scope">
            <el-button link type="success" size="small" @click="handleExtend(scope.row)">
              <el-icon><Promotion /></el-icon> {{ $t('security.btnExtend') }}
            </el-button>
            <el-button link type="primary" size="small" @click="handleEdit(scope.row)">{{ $t('security.btnEdit') }}</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(scope.row)">{{ $t('security.btnDelete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 15, 20, 50]"
          :total="filteredConfigs.length"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
    </el-card>

    <!-- Add/Edit Dialog -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? $t('security.titleEdit') : $t('security.titleAdd')" width="550px">
      <el-form :model="form" label-width="120px">
        <el-form-item :label="$t('security.labelName')" required>
          <el-input v-model="form.name" :placeholder="$t('security.placeholderName')" />
        </el-form-item>
        <el-form-item :label="$t('security.labelType')" required>
          <el-radio-group v-model="form.type">
            <el-radio value="accesskey">{{ $t('security.typeAccessKey') }}</el-radio>
            <el-radio value="ftp">{{ $t('security.typePassword') }}</el-radio>
            <el-radio value="ssl">{{ $t('security.typeSSL') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="$t('security.labelValidity')">
          <el-input-number v-model="form.validity_days" :min="1" :max="365" /> {{ $t('common.days') }}
          <span style="color: #909399; margin-left: 10px;">{{ $t('security.defaultValidity', { n: 60 }) }}</span>
        </el-form-item>
        <el-form-item :label="$t('security.labelExpiry')">
          <el-date-picker 
            v-model="form.expiry_date" 
            type="date" 
            :placeholder="$t('security.placeholderExpiry')"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item :label="$t('security.labelReminder')">
          <el-checkbox-group v-model="form.reminder_days">
            <el-checkbox :value="7">{{ $t('security.reminderDays', { n: 7 }) }}</el-checkbox>
            <el-checkbox :value="3">{{ $t('security.reminderDays', { n: 3 }) }}</el-checkbox>
            <el-checkbox :value="1">{{ $t('security.reminderDays', { n: 1 }) }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item :label="$t('security.labelAffectedServices')">
          <el-select 
            v-model="form.affected_services" 
            multiple 
            :placeholder="$t('security.placeholderAffectedServices')" 
            style="width: 100%;"
            filterable
          >
            <el-option-group
              v-for="project in projectsWithServices"
              :key="project.id"
              :label="`📁 ${project.name} (${project.selectedCount}/${project.services.length})`"
            >
              <el-option 
                v-for="service in project.services" 
                :key="service.id" 
                :label="formatServiceLabel(service)" 
                :value="service.id"
              />
            </el-option-group>
          </el-select>
          <div v-if="form.affected_services.length > 0" class="selected-summary">
            {{ $t('security.summarySelected', { n: form.affected_services.length }) }}
          </div>
        </el-form-item>
        <el-form-item :label="$t('security.labelNotes')">
          <el-input 
            v-model="form.notes" 
            type="textarea" 
            :rows="3" 
            :placeholder="$t('security.placeholderNotes')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">{{ $t('common.save') }}</el-button>
      </template>
    </el-dialog>

    <!-- Extend Dialog -->
    <el-dialog v-model="extendDialogVisible" :title="$t('security.titleExtend')" width="400px">
      <div style="margin-bottom: 20px;">
        <p>{{ $t('security.labelCurrentConfig') }} <strong>{{ currentConfig?.name }}</strong></p>
        <p>{{ $t('security.labelDaysRemaining') }} <strong :class="currentConfig?.status">{{ $t('security.daysN', { n: currentConfig?.days_remaining }) }}</strong></p>
      </div>
      <el-form-item :label="$t('security.labelExtendDays')">
        <el-input-number v-model="extendDays" :min="1" :max="365" style="width: 150px;" /> {{ $t('common.days') }}
      </el-form-item>
      <template #footer>
        <el-button @click="extendDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="confirmExtend" :loading="extending">{{ $t('security.btnConfirmExtend') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { 
  CircleCheckFilled, WarningFilled, CircleCloseFilled, 
  Plus, Refresh, Search, Promotion, Bell 
} from '@element-plus/icons-vue';
import { 
  getSecurityConfigs, getSecurityConfigStats, createSecurityConfig, 
  updateSecurityConfig, deleteSecurityConfig, extendSecurityConfig,
  type SecurityConfig, type SecurityConfigStats 
} from '../api/security-configs';
import { getServices, type Service } from '../api/services';
import { getProjects, type ProjectWithStats } from '../api/projects';
import authUtils from '../utils/auth';
import api from '../api';

const { t } = useI18n();

// Permission check
const isAdmin = computed(() => authUtils.isAdmin());

const loading = ref(false);
const submitting = ref(false);
const extending = ref(false);
const checking = ref(false);
const configs = ref<SecurityConfig[]>([]);
const services = ref<Service[]>([]);
const projects = ref<ProjectWithStats[]>([]);
const stats = ref<SecurityConfigStats>({ total: 0, normal: 0, warning: 0, critical: 0, expired: 0 });

const searchQuery = ref('');
const filterType = ref('');
const filterStatus = ref('');

const dialogVisible = ref(false);
const extendDialogVisible = ref(false);
const isEdit = ref(false);
const currentConfig = ref<SecurityConfig | null>(null);
const extendDays = ref(60);

const form = ref({
  id: '',
  name: '',
  type: 'accesskey' as 'accesskey' | 'ftp' | 'ssl',
  validity_days: 60,
  expiry_date: '',
  reminder_days: [7, 3, 1] as number[],
  affected_services: [] as string[],
  notes: ''
});

// Pagination
const pageSize = ref(15);
const currentPage = ref(1);

const filteredConfigs = computed(() => {
  return configs.value.filter(c => {
    const matchSearch = !searchQuery.value || 
      c.name.toLowerCase().includes(searchQuery.value.toLowerCase());
    const matchType = !filterType.value || c.type === filterType.value;
    const matchStatus = !filterStatus.value || c.status === filterStatus.value;
    return matchSearch && matchType && matchStatus;
  });
});

const paginatedConfigs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredConfigs.value.slice(start, end);
});

// Group services by project for the selector
const projectsWithServices = computed(() => {
  return projects.value.map(project => ({
    ...project,
    services: services.value.filter(s => s.project_id === project.id),
    selectedCount: services.value.filter(s => 
      s.project_id === project.id && form.value.affected_services.includes(s.id)
    ).length
  }));
});

// Format service label to show host and port info
const formatServiceLabel = (service: Service): string => {
  if (['script', 'file', 'log'].includes(service.check_type)) {
    return `${service.name} (${service.host})`;
  }
  return `${service.name} (${service.host}:${service.port})`;
};

const triggerExpiryCheck = async () => {
  checking.value = true;
  try {
    await api.post('/config/security-check/trigger');
    ElMessage.success(t('security.msgCheckTriggered'));
    
    // Refresh data to show updated last_reminded_at
    await loadData();
  } catch (error: any) {
    ElMessage.error(t('security.msgCheckFailed') + ': ' + (error.response?.data?.error || error.message));
  } finally {
    checking.value = false;
  }
};

const loadData = async () => {
  loading.value = true;
  try {
    const [configsData, statsData, servicesData, projectsData] = await Promise.all([
      getSecurityConfigs(),
      getSecurityConfigStats(),
      getServices(),
      getProjects()
    ]);
    configs.value = configsData;
    stats.value = statsData;
    services.value = servicesData;
    projects.value = projectsData;
  } catch (error: any) {
    ElMessage.error(t('security.msgLoadFailed') + ': ' + error.message);
  } finally {
    loading.value = false;
  }
};

const handleAdd = () => {
  isEdit.value = false;
  form.value = {
    id: '',
    name: '',
    type: 'accesskey',
    validity_days: 60,
    expiry_date: '',
    reminder_days: [7, 3, 1],
    affected_services: [],
    notes: ''
  };
  dialogVisible.value = true;
};

const handleEdit = (row: SecurityConfig) => {
  isEdit.value = true;
  form.value = {
    id: row.id,
    name: row.name,
    type: row.type,
    validity_days: row.validity_days || 60,
    expiry_date: row.expiry_date?.split('T')[0] || '',
    reminder_days: row.reminder_days || [7, 3, 1],
    affected_services: row.affected_services || [],
    notes: row.notes || ''
  };
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  if (!form.value.name) {
    ElMessage.warning(t('security.msgEnterName'));
    return;
  }
  
  submitting.value = true;
  try {
    const data: Record<string, any> = {
      name: form.value.name,
      type: form.value.type,
      validity_days: form.value.validity_days,
      expiry_date: form.value.expiry_date || undefined,
      reminder_days: form.value.reminder_days,
      affected_services: form.value.affected_services,
      notes: form.value.notes || undefined
    };

    if (isEdit.value) {
      await updateSecurityConfig(form.value.id, data);
      ElMessage.success(t('security.msgUpdated'));
    } else {
      await createSecurityConfig(data);
      ElMessage.success(t('security.msgCreated'));
    }
    dialogVisible.value = false;
    loadData();
  } catch (error: any) {
    ElMessage.error(t('security.msgOperationFailed') + ': ' + error.message);
  } finally {
    submitting.value = false;
  }
};

const handleDelete = async (row: SecurityConfig) => {
  try {
    await ElMessageBox.confirm(t('security.confirmDeleteMsg', { name: row.name }), t('security.confirmDeleteTitle'), {
      type: 'warning'
    });
    await deleteSecurityConfig(row.id);
    ElMessage.success(t('security.msgDeleted'));
    loadData();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(t('security.msgDeleteFailed') + ': ' + error.message);
    }
  }
};

const handleExtend = (row: SecurityConfig) => {
  currentConfig.value = row;
  extendDays.value = row.validity_days || 60;
  extendDialogVisible.value = true;
};

const confirmExtend = async () => {
  if (!currentConfig.value) return;
  
  extending.value = true;
  try {
    const result = await extendSecurityConfig(currentConfig.value.id, extendDays.value);
    ElMessage.success(t('security.msgExtended', { n: extendDays.value, date: formatDate(result.new_expiry_date) }));
    extendDialogVisible.value = false;
    loadData();
  } catch (error: any) {
    ElMessage.error(t('security.msgExtendFailed') + ': ' + error.message);
  } finally {
    extending.value = false;
  }
};

// Helper functions
const getStatusTagType = (status: string) => {
  switch (status) {
    case 'normal': return 'success';
    case 'warning': return 'warning';
    case 'critical': return 'danger';
    case 'expired': return 'info';
    default: return 'info';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'normal': return t('security.normal');
    case 'warning': return t('security.warning');
    case 'critical': return t('security.critical');
    case 'expired': return t('security.expired');
    default: return status;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'accesskey': return t('security.typeAccessKey');
    case 'ftp': return t('security.typeFtpPassword');
    case 'ssl': return t('security.typeSSL');
    default: return type;
  }
};

const getProgressStatus = (status: string) => {
  switch (status) {
    case 'normal': return 'success';
    case 'warning': return 'warning';
    case 'critical': 
    case 'expired': return 'exception';
    default: return '';
  }
};

const getDaysPercentage = (row: SecurityConfig) => {
  if (row.days_remaining <= 0) return 100;
  const total = row.validity_days || 60;
  return Math.min(((total - row.days_remaining) / total) * 100, 100);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US');
};

onMounted(() => {
  loadData();
});
</script>

<style scoped lang="scss">
.security-config-list {
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

    &:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transform: translateY(-2px);
    }
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

    .card-title {
      font-size: 18px;
      font-weight: 600;
    }

    .actions {
      display: flex;
      gap: 10px;
    }
  }

  .filter-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .config-name {
    font-weight: 500;
    color: #303133;
  }

  .config-services {
    font-size: 12px;
    color: #909399;
  }

  .days-cell {
    display: flex;
    align-items: center;
    gap: 10px;

    .days-text {
      font-weight: 500;
      
      &.normal { color: #67c23a; }
      &.warning { color: #e6a23c; }
      &.critical { color: #f56c6c; }
      &.expired { color: #909399; }
    }
  }

  .selected-summary {
    margin-top: 8px;
    padding: 8px 12px;
    background: #ecf5ff;
    border-radius: 4px;
    font-size: 12px;
    color: #409eff;
  }

  .test-result {
    margin-left: 12px;
    font-size: 13px;
    
    &.success {
      color: #67c23a;
    }
    
    &.error {
      color: #f56c6c;
    }
  }
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
