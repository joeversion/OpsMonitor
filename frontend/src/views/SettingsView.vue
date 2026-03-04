<template>
  <div class="settings-view">
    <div class="page-header">
      <h1>Settings</h1>
    </div>

    <!-- Dependency Types Management -->
    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <el-icon><Share /></el-icon>
          <span>Dependency Types</span>
        </div>
      </template>

      <div class="dependency-types-section">
        <p>Manage dependency types used in service relationships. System types cannot be deleted.</p>
        
        <el-table :data="dependencyTypes" style="width: 100%" v-loading="loadingTypes">
          <el-table-column prop="name" label="Name" width="100" />
          <el-table-column prop="label" label="Label" width="120" />
          <el-table-column label="Icon" width="80">
            <template #default="{ row }">
              <span class="icon-preview" :style="{ color: row.color || getIconColor(row.icon) }">{{ row.icon }}</span>
            </template>
          </el-table-column>
          <el-table-column label="Line Style" width="120">
            <template #default="{ row }">
              <svg width="50" height="16" class="line-preview-cell">
                <line 
                  x1="2" y1="8" x2="48" y2="8" 
                  :stroke="row.color || '#6366f1'" 
                  stroke-width="2"
                  :stroke-dasharray="getLineDashArray(row.line_style)"
                />
              </svg>
            </template>
          </el-table-column>
          <el-table-column label="Type" width="80">
            <template #default="{ row }">
              <el-tag :type="row.is_system ? 'info' : 'success'" size="small">
                {{ row.is_system ? 'System' : 'Custom' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Actions" width="150" v-if="isAdmin">
            <template #default="{ row }">
              <el-button 
                size="small" 
                @click="editDependencyType(row)"
              >
                Edit
              </el-button>
              <el-button 
                size="small" 
                type="danger" 
                @click="deleteDependencyType(row)"
                :disabled="!!row.is_system"
              >
                Delete
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="add-type-btn" v-if="isAdmin">
          <el-button type="primary" @click="showAddTypeDialog">
            <el-icon><Plus /></el-icon>
            Add Custom Type
          </el-button>
        </div>
      </div>
    </el-card>

    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <el-icon><Setting /></el-icon>
          <span>General Settings</span>
        </div>
      </template>

      <el-form :model="settings" label-width="200px" label-position="left" v-loading="loadingSettings">
        <!-- System Timezone -->
        <el-divider content-position="left">
          <span style="font-weight: 600; color: #303133;">System Configuration</span>
        </el-divider>
        
        <el-form-item label="System Timezone">
          <el-select 
            v-model="settings.timezone" 
            filterable
            placeholder="Select timezone"
            style="width: 300px"
            :disabled="!isAdmin"
            @change="handleTimezoneChange">
            <el-option-group label="Common Timezones">
              <el-option value="UTC" label="UTC (Coordinated Universal Time)" />
              <el-option value="Asia/Shanghai" label="Asia/Shanghai (Beijing Time, UTC+8)" />
              <el-option value="Asia/Tokyo" label="Asia/Tokyo (Japan Time, UTC+9)" />
              <el-option value="America/New_York" label="America/New_York (Eastern Time)" />
              <el-option value="America/Los_Angeles" label="America/Los_Angeles (Pacific Time)" />
              <el-option value="Europe/London" label="Europe/London (GMT/BST)" />
            </el-option-group>
            <el-option-group label="Asia">
              <el-option value="Asia/Hong_Kong" label="Asia/Hong_Kong (HKT, UTC+8)" />
              <el-option value="Asia/Singapore" label="Asia/Singapore (SGT, UTC+8)" />
              <el-option value="Asia/Dubai" label="Asia/Dubai (GST, UTC+4)" />
              <el-option value="Asia/Seoul" label="Asia/Seoul (KST, UTC+9)" />
              <el-option value="Asia/Bangkok" label="Asia/Bangkok (ICT, UTC+7)" />
            </el-option-group>
            <el-option-group label="Americas">
              <el-option value="America/Chicago" label="America/Chicago (Central Time)" />
              <el-option value="America/Denver" label="America/Denver (Mountain Time)" />
              <el-option value="America/Toronto" label="America/Toronto (Eastern Time)" />
              <el-option value="America/Sao_Paulo" label="America/Sao_Paulo (BRT)" />
            </el-option-group>
            <el-option-group label="Europe">
              <el-option value="Europe/Paris" label="Europe/Paris (CET/CEST)" />
              <el-option value="Europe/Berlin" label="Europe/Berlin (CET/CEST)" />
              <el-option value="Europe/Moscow" label="Europe/Moscow (MSK, UTC+3)" />
            </el-option-group>
            <el-option-group label="Australia">
              <el-option value="Australia/Sydney" label="Australia/Sydney (AEDT/AEST)" />
              <el-option value="Australia/Melbourne" label="Australia/Melbourne (AEDT/AEST)" />
            </el-option-group>
          </el-select>
          <div class="form-tip">Affects backend log timestamps and system time display. Current time: {{ currentTime }}</div>
        </el-form-item>

        <el-form-item label="Date Format">
          <el-input 
            v-model="settings.dateFormat" 
            placeholder="YYYY-MM-DD HH:mm:ss"
            style="width: 300px"
            :disabled="!isAdmin" />
          <div class="form-tip">Display format for dates and times in the UI</div>
        </el-form-item>

        <!-- Service Defaults -->
        <el-divider content-position="left">
          <span style="font-weight: 600; color: #303133;">Service Defaults</span>
        </el-divider>

        <el-form-item label="Default Check Interval">
          <el-input-number v-model="settings.defaultInterval" :min="10" :max="3600" :disabled="!isAdmin" />
          <span class="unit-text">seconds (Used for new services in Fixed Interval mode)</span>
        </el-form-item>
        <el-form-item label="Default Warning Threshold">
          <el-input-number v-model="settings.warningThreshold" :min="1" :max="30" :disabled="!isAdmin" />
          <span class="unit-text">consecutive failures (Range: 1-30)</span>
        </el-form-item>
        <el-form-item label="Default Error Threshold">
          <el-input-number v-model="settings.errorThreshold" :min="1" :max="50" :disabled="!isAdmin" />
          <span class="unit-text">consecutive failures (Range: 1-50)</span>
        </el-form-item>
        
        <!-- Data Management -->
        <el-divider content-position="left">
          <span style="font-weight: 600; color: #303133;">Data Management</span>
        </el-divider>

        <el-form-item label="Log Retention">
          <el-input-number v-model="settings.logRetentionDays" :min="1" :max="365" :disabled="!isAdmin" />
          <span class="unit-text">days (Number of days to keep backend logs)</span>
        </el-form-item>

        <el-form-item label="Data Retention">
          <el-input-number v-model="settings.dataRetentionDays" :min="1" :max="365" :disabled="!isAdmin" />
          <span class="unit-text">days (Number of days to keep check records in database)</span>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <el-icon><FolderOpened /></el-icon>
          <span>Import / Export</span>
        </div>
      </template>

      <div class="import-export-section">
        <p>Export your service configurations to a JSON file for backup or migration.</p>
        <div class="action-buttons">
          <el-button type="primary" @click="exportConfig">
            <el-icon><Download /></el-icon>
            Export Configuration
          </el-button>
          <el-upload
            ref="uploadRef"
            action="#"
            :auto-upload="false"
            :show-file-list="false"
            accept=".json"
            :on-change="handleImportFile"
          >
            <el-button>
              <el-icon><Upload /></el-icon>
              Import Configuration
            </el-button>
          </el-upload>
        </div>
      </div>
    </el-card>

    <div class="form-actions">
      <el-button type="primary" size="large" @click="saveSettings" :loading="saving">
        Save Settings
      </el-button>
    </div>

    <!-- Dependency Type Edit Dialog -->
    <el-dialog 
      v-model="typeDialogVisible" 
      :title="editingType ? 'Edit Dependency Type' : 'Add Dependency Type'"
      width="500px"
    >
      <el-form :model="typeForm" label-width="100px">
        <el-form-item label="Name" required>
          <el-input 
            v-model="typeForm.name" 
            placeholder="e.g., monitors"
          />
          <div class="form-tip" v-if="!editingType">Unique identifier (lowercase, no spaces)</div>
          <div class="form-tip warning" v-else>
            <span style="color: #f59e0b;">⚠️ Warning:</span> Changing name will update all existing dependencies using this type
          </div>
        </el-form-item>
        <el-form-item label="Label" required>
          <el-input v-model="typeForm.label" placeholder="e.g., Monitors" />
          <div class="form-tip">Display name shown in UI</div>
        </el-form-item>
        <el-form-item label="Icon">
          <div class="icon-input-section">
            <div class="icon-input-wrapper">
              <el-input 
                v-model="typeForm.icon" 
                placeholder="Enter emoji (e.g., 🔗)"
                maxlength="2"
                style="width: 200px;"
              />
              <span class="icon-live-preview">{{ typeForm.icon || '🔗' }}</span>
            </div>
            <div class="form-tip">Enter any emoji or select from quick options below</div>
            <div class="quick-icon-selector">
              <button 
                v-for="icon in availableIcons" 
                :key="icon.value"
                type="button"
                class="quick-icon-btn"
                :class="{ selected: typeForm.icon === icon.value }"
                @click="typeForm.icon = icon.value"
                :title="icon.label"
              >
                {{ icon.value }}
              </button>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="Color">
          <el-color-picker v-model="typeForm.color" />
          <span style="margin-left: 10px;">{{ typeForm.color || 'Default' }}</span>
        </el-form-item>
        <el-form-item label="Line Style">
          <div class="line-style-selector">
            <div 
              v-for="style in availableLineStyles" 
              :key="style.value"
              class="line-style-option"
              :class="{ selected: typeForm.line_style === style.value }"
              @click="typeForm.line_style = style.value"
            >
              <svg width="60" height="20" class="line-preview">
                <line 
                  x1="5" y1="10" x2="55" y2="10" 
                  :stroke="typeForm.color || '#6366f1'" 
                  stroke-width="2"
                  :stroke-dasharray="style.dasharray"
                />
              </svg>
              <span class="line-style-label">{{ style.label }}</span>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="typeDialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="saveType" :loading="savingType">
          {{ editingType ? 'Update' : 'Create' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Setting, FolderOpened, Download, Upload, Share, Plus } from '@element-plus/icons-vue';
import api from '../api';
import { getDependencyTypes, createDependencyType, updateDependencyType, deleteDependencyType as apiDeleteType } from '../api/dependency-types';
import { getGeneralSettings, updateGeneralSettings } from '../api/config';
import authUtils from '../utils/auth';

// Permission check
const isAdmin = computed(() => authUtils.isAdmin());

interface DependencyType {
  id?: number;
  name: string;
  label: string;
  icon: string;
  color?: string;
  is_system: boolean;
}

const settings = ref({
  timezone: 'UTC',
  dateFormat: 'YYYY-MM-DD HH:mm:ss',
  logRetentionDays: 30,
  defaultInterval: 60,
  warningThreshold: 3,
  errorThreshold: 5,
  dataRetentionDays: 30
});

const currentTime = ref('');
let timeInterval: number | null = null;

// Update current time display
const updateCurrentTime = () => {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: settings.value.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    currentTime.value = formatter.format(now);
  } catch (error) {
    currentTime.value = now.toISOString().replace('T', ' ').substring(0, 19);
  }
};

const handleTimezoneChange = async () => {
  updateCurrentTime();
};

const saving = ref(false);
const loadingSettings = ref(false);

const loadGeneralSettings = async () => {
  loadingSettings.value = true;
  try {
    const data = await getGeneralSettings();
    settings.value = { ...settings.value, ...data };
    
    // Load system settings
    const systemSettings = await api.get('/system-settings');
    systemSettings.data.forEach((setting: any) => {
      if (setting.key === 'timezone') {
        settings.value.timezone = setting.value;
      } else if (setting.key === 'date_format') {
        settings.value.dateFormat = setting.value;
      } else if (setting.key === 'log_retention_days') {
        settings.value.logRetentionDays = parseInt(setting.value);
      }
    });
    
    updateCurrentTime();
  } catch (error) {
    console.error('Failed to load settings:', error);
    ElMessage.warning('Failed to load settings, using defaults');
  } finally {
    loadingSettings.value = false;
  }
};

const saveSettings = async () => {
  if (!isAdmin.value) {
    ElMessage.warning('Only administrators can modify settings');
    return;
  }
  
  saving.value = true;
  try {
    // Save general settings
    await updateGeneralSettings({
      defaultInterval: settings.value.defaultInterval,
      warningThreshold: settings.value.warningThreshold,
      errorThreshold: settings.value.errorThreshold,
      dataRetentionDays: settings.value.dataRetentionDays
    });
    
    // Save system settings
    await Promise.all([
      api.put('/system-settings/timezone', { value: settings.value.timezone }),
      api.put('/system-settings/date_format', { value: settings.value.dateFormat }),
      api.put('/system-settings/log_retention_days', { value: String(settings.value.logRetentionDays) })
    ]);
    
    ElMessage.success('Settings saved successfully!');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || 'Failed to save settings');
  } finally {
    saving.value = false;
  }
};

const exportConfig = async () => {
  try {
    const response = await api.get('/services/export');
    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `services-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('Configuration exported!');
  } catch (error) {
    ElMessage.error('Failed to export configuration');
  }
};

const handleImportFile = async (file: any) => {
  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        await api.post('/services/import', content);
        ElMessage.success('Configuration imported successfully!');
      } catch (err: any) {
        ElMessage.error(err.response?.data?.error || 'Failed to import configuration');
      }
    };
    reader.readAsText(file.raw);
  } catch (error) {
    ElMessage.error('Failed to read file');
  }
};

// Dependency Types Management
const dependencyTypes = ref<DependencyType[]>([]);
const loadingTypes = ref(false);
const typeDialogVisible = ref(false);
const editingType = ref<DependencyType | null>(null);
const savingType = ref(false);

const typeForm = ref({
  name: '',
  label: '',
  icon: '🔗',
  color: '',
  line_style: 'solid' as 'solid' | 'dashed' | 'dotted' | 'long-dash'
});

const availableLineStyles = [
  { value: 'solid', label: 'Solid', dasharray: 'none' },
  { value: 'dashed', label: 'Dashed', dasharray: '8,4' },
  { value: 'dotted', label: 'Dotted', dasharray: '2,4' },
  { value: 'long-dash', label: 'Long Dash', dasharray: '12,6' }
];

const availableIcons = [
  { value: '🔗', label: 'Link', color: '#409EFF' },
  { value: '⚡', label: 'Lightning', color: '#E6A23C' },
  { value: '🔄', label: 'Sync', color: '#67C23A' },
  { value: '💾', label: 'Backup', color: '#909399' },
  { value: '📡', label: 'Signal', color: '#F56C6C' },
  { value: '🔌', label: 'Plugin', color: '#9B59B6' },
  { value: '📊', label: 'Chart', color: '#3498DB' },
  { value: '🔒', label: 'Lock', color: '#2C3E50' },
  { value: '📧', label: 'Email', color: '#E74C3C' },
  { value: '🗄️', label: 'Database', color: '#1ABC9C' },
  { value: '🌐', label: 'Web', color: '#3498DB' },
  { value: '⚙️', label: 'Gear', color: '#95A5A6' },
  { value: '🔍', label: 'Search', color: '#9B59B6' },
  { value: '📝', label: 'Edit', color: '#F39C12' },
  { value: '🛡️', label: 'Shield', color: '#27AE60' },
  { value: '🔔', label: 'Bell', color: '#E67E22' }
];

const getIconColor = (icon: string) => {
  const found = availableIcons.find(i => i.value === icon);
  return found?.color || '#409EFF';
};

const getLineDashArray = (lineStyle: string) => {
  const style = availableLineStyles.find(s => s.value === lineStyle);
  return style?.dasharray || 'none';
};

const loadDependencyTypes = async () => {
  loadingTypes.value = true;
  try {
    dependencyTypes.value = await getDependencyTypes();
  } catch (error) {
    ElMessage.error('Failed to load dependency types');
  } finally {
    loadingTypes.value = false;
  }
};

const showAddTypeDialog = () => {
  editingType.value = null;
  typeForm.value = {
    name: '',
    label: '',
    icon: '🔗',
    color: '',
    line_style: 'solid'
  };
  typeDialogVisible.value = true;
};

const editDependencyType = (type: DependencyType) => {
  editingType.value = type;
  typeForm.value = {
    name: type.name,
    label: type.label,
    icon: type.icon,
    color: type.color || '',
    line_style: type.line_style || 'solid'
  };
  typeDialogVisible.value = true;
};

const saveType = async () => {
  if (!typeForm.value.name.trim() || !typeForm.value.label.trim()) {
    ElMessage.warning('Name and Label are required');
    return;
  }

  savingType.value = true;
  try {
    if (editingType.value) {
      // 格式化 name
      const formattedName = typeForm.value.name.toLowerCase().replace(/\s+/g, '_');
      
      await updateDependencyType(editingType.value.id!, {
        name: formattedName,
        label: typeForm.value.label,
        icon: typeForm.value.icon,
        color: typeForm.value.color || undefined,
        line_style: typeForm.value.line_style
      });
      ElMessage.success('Dependency type updated');
    } else {
      await createDependencyType({
        name: typeForm.value.name.toLowerCase().replace(/\s+/g, '_'),
        label: typeForm.value.label,
        icon: typeForm.value.icon,
        color: typeForm.value.color || undefined,
        line_style: typeForm.value.line_style
      });
      ElMessage.success('Dependency type created');
    }
    typeDialogVisible.value = false;
    await loadDependencyTypes();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || 'Failed to save dependency type');
  } finally {
    savingType.value = false;
  }
};

const deleteDependencyType = async (type: DependencyType) => {
  try {
    await ElMessageBox.confirm(
      `Are you sure you want to delete the dependency type "${type.label}"?`,
      'Delete Dependency Type',
      {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    );
    
    await apiDeleteType(type.id!);
    ElMessage.success('Dependency type deleted');
    await loadDependencyTypes();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || 'Failed to delete dependency type');
    }
  }
};

onMounted(() => {
  loadDependencyTypes();
  loadGeneralSettings();
  
  // Update time every second
  timeInterval = window.setInterval(updateCurrentTime, 1000);
});

// Cleanup
onUnmounted(() => {
  if (timeInterval) {
    clearInterval(timeInterval);
  }
});
</script>

<style scoped>
.settings-view {
  max-width: 800px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  color: #303133;
}

.settings-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  display: block;
  clear: both;
}

.form-tip.warning {
  color: #f59e0b;
  background-color: #fef3c7;
  padding: 8px 12px;
  border-radius: 4px;
  border-left: 3px solid #f59e0b;
  font-weight: 500;
}

.unit-text {
  margin-left: 8px;
  color: #606266;
  font-size: 14px;
}

.import-export-section {
  padding: 10px 0;
}

.import-export-section p {
  color: #606266;
  margin-bottom: 15px;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.form-actions {
  margin-top: 20px;
  text-align: right;
}

/* Dependency Types Styles */
.dependency-types-section {
  padding: 10px 0;
}

.dependency-types-section > p {
  color: #606266;
  margin-bottom: 15px;
}

.add-type-btn {
  margin-top: 15px;
}

.icon-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-preview {
  font-size: 18px;
}

.icon-text {
  font-size: 12px;
  color: #909399;
}

/* Simplified Icon Input Section */
.icon-input-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.icon-input-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
}

.icon-live-preview {
  font-size: 40px;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #e4e7ec;
  border-radius: 8px;
  background: #f9fafb;
  transition: all 0.2s;
}

.quick-icon-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e4e7ec;
  max-height: 160px;
  overflow-y: auto;
}

.quick-icon-btn {
  font-size: 24px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.15s;
  padding: 0;
}

.quick-icon-btn:hover {
  border-color: #409EFF;
  background: #ecf5ff;
  transform: scale(1.1);
}

.quick-icon-btn.selected {
  border-color: #409EFF;
  background: #ecf5ff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.1);
}

/* Line Style Selector */
.line-style-selector {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 8px;
  border: 1px solid #DCDFE6;
  border-radius: 4px;
}

.line-style-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.line-style-option:hover {
  background-color: #F5F7FA;
}

.line-style-option.selected {
  border-color: #409EFF;
  background-color: #ECF5FF;
}

.line-preview {
  margin-bottom: 4px;
}

.line-style-label {
  font-size: 11px;
  color: #606266;
}

.line-preview-cell {
  display: block;
}
</style>
