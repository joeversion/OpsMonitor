<template>
  <div class="settings-view">
    <div class="page-header">
      <h1>{{ $t('settings.title') }}</h1>
    </div>

    <!-- Dependency Types Management -->
    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <el-icon><Share /></el-icon>
          <span>{{ $t('settings.cardDepTypes') }}</span>
        </div>
      </template>

      <div class="dependency-types-section">
        <p>{{ $t('settings.depTypesDesc') }}</p>
        
        <el-table :data="dependencyTypes" style="width: 100%" v-loading="loadingTypes">
          <el-table-column prop="name" :label="$t('settings.colName')" width="100" />
          <el-table-column prop="label" :label="$t('settings.colLabel')" width="120" />
          <el-table-column :label="$t('settings.colIcon')" width="80">
            <template #default="{ row }">
              <span class="icon-preview" :style="{ color: row.color || getIconColor(row.icon) }">{{ row.icon }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="$t('settings.colLineStyle')" width="120">
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
          <el-table-column :label="$t('settings.colType')" width="80">
            <template #default="{ row }">
              <el-tag :type="row.is_system ? 'info' : 'success'" size="small">
                {{ row.is_system ? $t('settings.tagSystem') : $t('settings.tagCustom') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="$t('common.actions')" width="150" v-if="isAdmin">
            <template #default="{ row }">
              <el-button 
                size="small" 
                @click="editDependencyType(row)"
              >
                {{ $t('common.edit') }}
              </el-button>
              <el-button 
                size="small" 
                type="danger" 
                @click="deleteDependencyType(row)"
                :disabled="!!row.is_system"
              >
                {{ $t('common.delete') }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="add-type-btn" v-if="isAdmin">
          <el-button type="primary" @click="showAddTypeDialog">
            <el-icon><Plus /></el-icon>
            {{ $t('settings.btnAddCustom') }}
          </el-button>
        </div>
      </div>
    </el-card>

    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <el-icon><Setting /></el-icon>
          <span>{{ $t('settings.cardGeneral') }}</span>
        </div>
      </template>

      <el-form :model="settings" label-width="200px" label-position="left" v-loading="loadingSettings">
        <!-- System Timezone -->
        <el-divider content-position="left">
          <span style="font-weight: 600; color: #303133;">{{ $t('settings.sectionSystem') }}</span>
        </el-divider>
        
        <el-form-item :label="$t('settings.labelTimezone')">
          <el-select 
            v-model="settings.timezone" 
            filterable
            :placeholder="$t('settings.placeholderTimezone')"
            style="width: 300px"
            :disabled="!isAdmin"
            @change="handleTimezoneChange">
            <el-option-group :label="$t('settings.tzCommon')">
              <el-option value="UTC" label="UTC (Coordinated Universal Time)" />
              <el-option value="Asia/Shanghai" label="Asia/Shanghai (Beijing Time, UTC+8)" />
              <el-option value="Asia/Tokyo" label="Asia/Tokyo (Japan Time, UTC+9)" />
              <el-option value="America/New_York" label="America/New_York (Eastern Time)" />
              <el-option value="America/Los_Angeles" label="America/Los_Angeles (Pacific Time)" />
              <el-option value="Europe/London" label="Europe/London (GMT/BST)" />
            </el-option-group>
            <el-option-group :label="$t('settings.tzAsia')">
              <el-option value="Asia/Hong_Kong" label="Asia/Hong_Kong (HKT, UTC+8)" />
              <el-option value="Asia/Singapore" label="Asia/Singapore (SGT, UTC+8)" />
              <el-option value="Asia/Dubai" label="Asia/Dubai (GST, UTC+4)" />
              <el-option value="Asia/Seoul" label="Asia/Seoul (KST, UTC+9)" />
              <el-option value="Asia/Bangkok" label="Asia/Bangkok (ICT, UTC+7)" />
            </el-option-group>
            <el-option-group :label="$t('settings.tzAmericas')">
              <el-option value="America/Chicago" label="America/Chicago (Central Time)" />
              <el-option value="America/Denver" label="America/Denver (Mountain Time)" />
              <el-option value="America/Toronto" label="America/Toronto (Eastern Time)" />
              <el-option value="America/Sao_Paulo" label="America/Sao_Paulo (BRT)" />
            </el-option-group>
            <el-option-group :label="$t('settings.tzEurope')">
              <el-option value="Europe/Paris" label="Europe/Paris (CET/CEST)" />
              <el-option value="Europe/Berlin" label="Europe/Berlin (CET/CEST)" />
              <el-option value="Europe/Moscow" label="Europe/Moscow (MSK, UTC+3)" />
            </el-option-group>
            <el-option-group :label="$t('settings.tzAustralia')">
              <el-option value="Australia/Sydney" label="Australia/Sydney (AEDT/AEST)" />
              <el-option value="Australia/Melbourne" label="Australia/Melbourne (AEDT/AEST)" />
            </el-option-group>
          </el-select>
          <div class="form-tip">{{ $t('settings.tipTimezone', { time: currentTime }) }}</div>
        </el-form-item>

        <el-form-item :label="$t('settings.labelDateFormat')">
          <el-input 
            v-model="settings.dateFormat" 
            placeholder="YYYY-MM-DD HH:mm:ss"
            style="width: 300px"
            :disabled="!isAdmin" />
          <div class="form-tip">{{ $t('settings.tipDateFormat') }}</div>
        </el-form-item>

        <!-- Service Defaults -->
        <el-divider content-position="left">
          <span style="font-weight: 600; color: #303133;">{{ $t('settings.sectionDefaults') }}</span>
        </el-divider>

        <el-form-item :label="$t('settings.labelDefaultInterval')">
          <el-input-number v-model="settings.defaultInterval" :min="10" :max="3600" :disabled="!isAdmin" />
          <span class="unit-text">{{ $t('settings.unitDefaultInterval') }}</span>
        </el-form-item>
        <el-form-item :label="$t('settings.labelDefaultWarn')">
          <el-input-number v-model="settings.warningThreshold" :min="1" :max="30" :disabled="!isAdmin" />
          <span class="unit-text">{{ $t('settings.unitWarnThreshold') }}</span>
        </el-form-item>
        <el-form-item :label="$t('settings.labelDefaultError')">
          <el-input-number v-model="settings.errorThreshold" :min="1" :max="50" :disabled="!isAdmin" />
          <span class="unit-text">{{ $t('settings.unitErrorThreshold') }}</span>
        </el-form-item>
        
        <!-- Data Management -->
        <el-divider content-position="left">
          <span style="font-weight: 600; color: #303133;">{{ $t('settings.sectionData') }}</span>
        </el-divider>

        <el-form-item :label="$t('settings.labelLogRetention')">
          <el-input-number v-model="settings.logRetentionDays" :min="1" :max="365" :disabled="!isAdmin" />
          <span class="unit-text">{{ $t('settings.unitLogRetention') }}</span>
        </el-form-item>

        <el-form-item :label="$t('settings.labelDataRetention')">
          <el-input-number v-model="settings.dataRetentionDays" :min="1" :max="365" :disabled="!isAdmin" />
          <span class="unit-text">{{ $t('settings.unitDataRetention') }}</span>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <el-icon><FolderOpened /></el-icon>
          <span>{{ $t('settings.cardImportExport') }}</span>
        </div>
      </template>

      <div class="import-export-section">
        <p>{{ $t('settings.importExportDesc') }}</p>
        <div class="action-buttons">
          <el-button type="primary" @click="exportConfig">
            <el-icon><Download /></el-icon>
            {{ $t('settings.btnExportConfig') }}
          </el-button>
          <el-upload
            v-if="isAdmin"
            ref="uploadRef"
            action="#"
            :auto-upload="false"
            :show-file-list="false"
            accept=".json"
            :on-change="handleImportFile"
          >
            <el-button>
              <el-icon><Upload /></el-icon>
              {{ $t('settings.btnImportConfig') }}
            </el-button>
          </el-upload>
        </div>
      </div>
    </el-card>

    <div class="form-actions" v-if="isAdmin">
      <el-button type="primary" size="large" @click="saveSettings" :loading="saving">
        {{ $t('settings.btnSaveSettings') }}
      </el-button>
    </div>

    <!-- Dependency Type Edit Dialog -->
    <el-dialog 
      v-model="typeDialogVisible" 
      :title="editingType ? $t('settings.titleEditDep') : $t('settings.titleAddDep')"
      width="500px"
    >
      <el-form :model="typeForm" label-width="100px">
        <el-form-item :label="$t('settings.labelName')" required>
          <el-input 
            v-model="typeForm.name" 
            :placeholder="$t('settings.placeholderDepName')"
          />
          <div class="form-tip" v-if="!editingType">{{ $t('settings.tipDepNameUnique') }}</div>
          <div class="form-tip warning" v-else>
            <span style="color: #f59e0b;">⚠️ {{ $t('settings.warningLabel') }}</span> {{ $t('settings.tipDepNameWarning') }}
          </div>
        </el-form-item>
        <el-form-item :label="$t('settings.labelLabel')" required>
          <el-input v-model="typeForm.label" :placeholder="$t('settings.placeholderDepLabel')" />
          <div class="form-tip">{{ $t('settings.tipDepLabel') }}</div>
        </el-form-item>
        <el-form-item :label="$t('settings.labelIcon')">
          <div class="icon-input-section">
            <div class="icon-input-wrapper">
              <el-input 
                v-model="typeForm.icon" 
                :placeholder="$t('settings.placeholderIcon')"
                maxlength="2"
                style="width: 200px;"
              />
              <span class="icon-live-preview">{{ typeForm.icon || '🔗' }}</span>
            </div>
            <div class="form-tip">{{ $t('settings.tipIcon') }}</div>
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
        <el-form-item :label="$t('settings.labelColor')">
          <el-color-picker v-model="typeForm.color" />
          <span style="margin-left: 10px;">{{ typeForm.color || $t('settings.colorDefault') }}</span>
        </el-form-item>
        <el-form-item :label="$t('settings.labelLineStyle')">
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
        <el-button @click="typeDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveType" :loading="savingType">
          {{ editingType ? $t('common.update') : $t('common.create') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Setting, FolderOpened, Download, Upload, Share, Plus } from '@element-plus/icons-vue';
import api from '../api';
import { getDependencyTypes, createDependencyType, updateDependencyType, deleteDependencyType as apiDeleteType } from '../api/dependency-types';
import { getGeneralSettings, updateGeneralSettings } from '../api/config';
import authUtils from '../utils/auth';

// Permission check
const isAdmin = computed(() => authUtils.isAdmin());

const { t } = useI18n();

interface DependencyType {
  id?: number;
  name: string;
  label: string;
  icon: string;
  color?: string;
  line_style?: string;
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
    ElMessage.warning(t('settings.msgLoadFailedDefaults'));
  } finally {
    loadingSettings.value = false;
  }
};

const saveSettings = async () => {
  if (!isAdmin.value) {
    ElMessage.warning(t('settings.msgAdminOnly'));
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
    
    ElMessage.success(t('settings.msgSaved'));
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || t('settings.msgSaveFailed'));
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
    ElMessage.success(t('settings.msgExported'));
  } catch (error) {
    ElMessage.error(t('settings.msgExportFailed'));
  }
};

const handleImportFile = async (file: any) => {
  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        await api.post('/services/import', content);
        ElMessage.success(t('settings.msgImported'));
      } catch (err: any) {
        ElMessage.error(err.response?.data?.error || t('settings.msgImportFailed'));
      }
    };
    reader.readAsText(file.raw);
  } catch (error) {
    ElMessage.error(t('settings.msgReadFailed'));
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

const availableLineStyles = computed(() => [
  { value: 'solid', label: t('settings.styleSolid'), dasharray: 'none' },
  { value: 'dashed', label: t('settings.styleDashed'), dasharray: '8,4' },
  { value: 'dotted', label: t('settings.styleDotted'), dasharray: '2,4' },
  { value: 'long-dash', label: t('settings.styleLongDash'), dasharray: '12,6' }
]);

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
  const style = availableLineStyles.value.find(s => s.value === lineStyle);
  return style?.dasharray || 'none';
};

const loadDependencyTypes = async () => {
  loadingTypes.value = true;
  try {
    dependencyTypes.value = await getDependencyTypes();
  } catch (error) {
    ElMessage.error(t('settings.msgDepLoadFailed'));
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
    ElMessage.warning(t('settings.msgNameLabelRequired'));
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
      ElMessage.success(t('settings.msgDepTypeUpdated'));
    } else {
      await createDependencyType({
        name: typeForm.value.name.toLowerCase().replace(/\s+/g, '_'),
        label: typeForm.value.label,
        icon: typeForm.value.icon,
        color: typeForm.value.color || undefined,
        line_style: typeForm.value.line_style
      });
      ElMessage.success(t('settings.msgDepTypeCreated'));
    }
    typeDialogVisible.value = false;
    await loadDependencyTypes();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || t('settings.msgDepTypeSaveFailed'));
  } finally {
    savingType.value = false;
  }
};

const deleteDependencyType = async (type: DependencyType) => {
  try {
    await ElMessageBox.confirm(
      t('settings.confirmDeleteDepMsg', { name: type.label }),
      t('settings.confirmDeleteDepTitle'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    );
    
    await apiDeleteType(type.id!);
    ElMessage.success(t('settings.msgDepTypeDeleted'));
    await loadDependencyTypes();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || t('settings.msgDepTypeDeleteFailed'));
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
