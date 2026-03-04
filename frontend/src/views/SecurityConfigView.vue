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
            <div class="stat-label">Normal</div>
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
            <div class="stat-label">Warning</div>
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
            <div class="stat-label">Critical</div>
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
            <div class="stat-label">Expired</div>
            <div class="stat-value" style="color: #909399">{{ stats.expired }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- Main Table Card -->
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">🔐 Security Configs</span>
          <div class="actions">
            <el-button @click="triggerExpiryCheck" :loading="checking">
              <el-icon><Bell /></el-icon> Check Expiry Now
            </el-button>
            <el-button @click="loadData">
              <el-icon><Refresh /></el-icon> Refresh
            </el-button>
            <el-button type="primary" @click="handleAdd" v-if="isAdmin">
              <el-icon><Plus /></el-icon> Add
            </el-button>
          </div>
        </div>
      </template>

      <!-- Filters -->
      <div class="filter-bar">
        <el-input v-model="searchQuery" placeholder="Search name..." :prefix-icon="Search" style="width: 250px;" clearable />
        <el-select v-model="filterType" placeholder="Type" clearable style="width: 130px;">
          <el-option label="All Types" value="" />
          <el-option label="AccessKey" value="accesskey" />
          <el-option label="FTP Password" value="ftp" />
          <el-option label="SSL Certificate" value="ssl" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="Status" clearable style="width: 130px;">
          <el-option label="All Status" value="" />
          <el-option label="Normal" value="normal" />
          <el-option label="Warning" value="warning" />
          <el-option label="Critical" value="critical" />
          <el-option label="Expired" value="expired" />
        </el-select>
      </div>

      <el-table :data="paginatedConfigs" style="width: 100%" v-loading="loading" row-key="id">
        <el-table-column label="No." width="60" align="center">
          <template #default="{ $index }">
            {{ (currentPage - 1) * pageSize + $index + 1 }}
          </template>
        </el-table-column>
        <el-table-column label="Status" width="80" align="center">
          <template #default="scope">
            <el-tag :type="getStatusTagType(scope.row.status)" size="small" effect="dark">
              {{ getStatusLabel(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Name" min-width="200">
          <template #default="scope">
            <div class="config-name">{{ scope.row.name }}</div>
            <div class="config-services" v-if="scope.row.affected_services?.length">
              Affects: {{ scope.row.affected_services.length }} services
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Type" width="110">
          <template #default="scope">
            <el-tag size="small" effect="plain">{{ getTypeLabel(scope.row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Days Remaining" width="150">
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
                {{ scope.row.days_remaining > 0 ? scope.row.days_remaining + ' days' : 'Expired' }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Expiry Date" width="130">
          <template #default="scope">
            {{ formatDate(scope.row.expiry_date) }}
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="180" align="right" v-if="isAdmin">
          <template #default="scope">
            <el-button link type="success" size="small" @click="handleExtend(scope.row)">
              <el-icon><Promotion /></el-icon> Extend
            </el-button>
            <el-button link type="primary" size="small" @click="handleEdit(scope.row)">Edit</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(scope.row)">Delete</el-button>
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
    <el-dialog v-model="dialogVisible" :title="isEdit ? 'Edit Configuration' : 'Add Configuration'" width="550px">
      <el-form :model="form" label-width="120px">
        <el-form-item label="Name" required>
          <el-input v-model="form.name" placeholder="e.g., Nova Email AccessKeys" />
        </el-form-item>
        <el-form-item label="Type" required>
          <el-radio-group v-model="form.type">
            <el-radio value="accesskey">AccessKey</el-radio>
            <el-radio value="ftp">Password</el-radio>
            <el-radio value="ssl">SSL Certificate</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Validity Period">
          <el-input-number v-model="form.validity_days" :min="1" :max="365" /> days
          <span style="color: #909399; margin-left: 10px;">Default: 60 days</span>
        </el-form-item>
        <el-form-item label="Expiry Date">
          <el-date-picker 
            v-model="form.expiry_date" 
            type="date" 
            placeholder="Select expiry date"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="Reminder Rules">
          <el-checkbox-group v-model="form.reminder_days">
            <el-checkbox :value="7">7 days before</el-checkbox>
            <el-checkbox :value="3">3 days before</el-checkbox>
            <el-checkbox :value="1">1 day before</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="Affected Services">
          <el-select 
            v-model="form.affected_services" 
            multiple 
            placeholder="Select affected services" 
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
            ✓ {{ form.affected_services.length }} services selected
          </div>
        </el-form-item>
        <el-form-item label="Notes">
          <el-input 
            v-model="form.notes" 
            type="textarea" 
            :rows="3" 
            placeholder="Add any comments or notes about this configuration..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">Save</el-button>
      </template>
    </el-dialog>

    <!-- Extend Dialog -->
    <el-dialog v-model="extendDialogVisible" title="Confirm Extension" width="400px">
      <div style="margin-bottom: 20px;">
        <p>Current Config: <strong>{{ currentConfig?.name }}</strong></p>
        <p>Days Remaining: <strong :class="currentConfig?.status">{{ currentConfig?.days_remaining }} days</strong></p>
      </div>
      <el-form-item label="Extend Days">
        <el-input-number v-model="extendDays" :min="1" :max="365" style="width: 150px;" /> days
      </el-form-item>
      <template #footer>
        <el-button @click="extendDialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="confirmExtend" :loading="extending">Confirm Extension</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
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
    ElMessage.success('Expiry check triggered successfully! Check Teams/Email for alerts.');
    
    // Refresh data to show updated last_reminded_at
    await loadData();
  } catch (error: any) {
    ElMessage.error('Failed to trigger expiry check: ' + (error.response?.data?.error || error.message));
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
    ElMessage.error('Failed to load data: ' + error.message);
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
    ElMessage.warning('Please enter a name');
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
      ElMessage.success('Updated successfully');
    } else {
      await createSecurityConfig(data);
      ElMessage.success('Created successfully');
    }
    dialogVisible.value = false;
    loadData();
  } catch (error: any) {
    ElMessage.error('Operation failed: ' + error.message);
  } finally {
    submitting.value = false;
  }
};

const handleDelete = async (row: SecurityConfig) => {
  try {
    await ElMessageBox.confirm(`Are you sure to delete "${row.name}"?`, 'Confirm Delete', {
      type: 'warning'
    });
    await deleteSecurityConfig(row.id);
    ElMessage.success('Deleted successfully');
    loadData();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('Delete failed: ' + error.message);
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
    ElMessage.success(`Extended by ${extendDays.value} days, new expiry date: ${formatDate(result.new_expiry_date)}`);
    extendDialogVisible.value = false;
    loadData();
  } catch (error: any) {
    ElMessage.error('Extension failed: ' + error.message);
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
    case 'normal': return 'Normal';
    case 'warning': return 'Warning';
    case 'critical': return 'Critical';
    case 'expired': return 'Expired';
    default: return status;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'accesskey': return 'AccessKey';
    case 'ftp': return 'FTP Password';
    case 'ssl': return 'SSL Certificate';
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
