<template>
  <div class="schedule-config-panel">
    <el-form :model="config" label-width="140px">
      <!-- Schedule Type -->
      <el-form-item label="Schedule Mode">
        <el-radio-group v-model="config.type" @change="onTypeChange">
          <el-radio-button label="fixed">
            <el-icon><Clock /></el-icon>
            Fixed Interval
          </el-radio-button>
          <el-radio-button label="timeRange">
            <el-icon><Calendar /></el-icon>
            Time Rules
          </el-radio-button>
        </el-radio-group>
      </el-form-item>
      
      <!-- Fixed Interval Mode -->
      <div v-if="config.type === 'fixed'" class="fixed-mode">
        <el-form-item label="Check Interval">
          <div class="interval-controls">
            <el-input-number 
              v-model="intervalValue" 
              :min="minValue"
              :max="maxValue"
              @change="updateFixedInterval"
            />
            <el-select 
              v-model="intervalUnit" 
              style="width: 100px;"
              @change="updateFixedInterval"
            >
              <el-option label="Seconds" value="seconds" />
              <el-option label="Minutes" value="minutes" />
              <el-option label="Hours" value="hours" />
            </el-select>
          </div>
          <div class="interval-desc">
            <el-text size="small" type="info">
              {{ fixedIntervalDescription }}
            </el-text>
          </div>
        </el-form-item>
      </div>
      
      <!-- Time Range Mode -->
      <div v-else class="time-range-mode">
        <!-- Default Interval -->
        <el-form-item label="Default Interval">
          <div class="interval-controls">
            <el-input-number 
              v-model="defaultIntervalValue" 
              :min="defaultMinValue"
              :max="defaultMaxValue"
              @change="updateDefaultInterval"
            />
            <el-select 
              v-model="defaultIntervalUnit" 
              style="width: 100px;"
              @change="updateDefaultInterval"
            >
              <el-option label="Seconds" value="seconds" />
              <el-option label="Minutes" value="minutes" />
              <el-option label="Hours" value="hours" />
            </el-select>
          </div>
          <div class="interval-desc">
            <el-text size="small" type="info">
              {{ defaultIntervalDescription }}
            </el-text>
          </div>
        </el-form-item>
        
        <!-- Time Rules List -->
        <el-form-item label="Time Rules">
          <div class="time-ranges-container" v-loading="previewLoading">
            <el-empty 
              v-if="!config.timeRanges || config.timeRanges.length === 0"
              description="No time rules"
              :image-size="60"
            >
              <el-button type="primary" @click="addTimeRange">
                <el-icon><Plus /></el-icon>
                Add First Rule
              </el-button>
            </el-empty>
            
            <div v-else class="time-ranges-list">
              <TimeRangeEditor
                v-for="(range, index) in config.timeRanges"
                :key="`range-${index}`"
                :range="range"
                :index="index"
                @update="updateRange"
                @delete="deleteRange"
                @move-up="moveRangeUp"
                @move-down="moveRangeDown"
              />
              <el-button 
                type="primary" 
                plain
                @click="addTimeRange"
                style="width: 100%;"
              >
                <el-icon><Plus /></el-icon>
                Add Time Rule
              </el-button>
            </div>
          </div>
        </el-form-item>
        
        <!-- Execution Preview -->
        <el-form-item label="Execution Preview">
          <div class="preview-container">
            <el-card shadow="never" class="preview-card">
              <template #header>
                <div class="preview-header">
                  <span>Next Check Time</span>
                  <el-button 
                    size="small" 
                    text 
                    :icon="Refresh"
                    @click="refreshPreview"
                    :loading="previewLoading"
                  >
                    Refresh
                  </el-button>
                </div>
              </template>
              
              <div v-if="previewData" class="preview-content">
                <el-descriptions :column="1" border size="small">
                  <el-descriptions-item label="Current Time">
                    {{ previewData.currentTimeString }}
                  </el-descriptions-item>
                  <el-descriptions-item label="Current Range">
                    <el-tag :type="previewData.currentRange === 'default' ? 'info' : 'success'">
                      {{ previewData.currentRange }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="Current Interval">
                    {{ previewData.currentInterval }} seconds
                  </el-descriptions-item>
                  <el-descriptions-item label="Next Run">
                    <el-text type="primary">{{ formatNextRun(previewData.nextRunTime) }}</el-text>
                  </el-descriptions-item>
                </el-descriptions>
                
                <!-- Future execution schedule -->
                <el-divider content-position="left">Execution Plan (Next 24 Hours)</el-divider>
                <div class="future-runs">
                  <el-timeline>
                    <el-timeline-item
                      v-for="(item, index) in previewData.preview.slice(0, 10)"
                      :key="index"
                      :timestamp="item.timeString"
                      placement="top"
                    >
                      <el-tag size="small">{{ item.range }}</el-tag>
                      <el-text size="small" type="info" style="margin-left: 8px;">
                        interval {{ item.interval }}s
                      </el-text>
                    </el-timeline-item>
                  </el-timeline>
                </div>
              </div>
              
              <el-alert
                v-if="previewError"
                :title="previewError"
                type="error"
                :closable="false"
              />
            </el-card>
          </div>
        </el-form-item>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Clock, Calendar, Plus, Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import type { ScheduleConfig, TimeRange, SchedulePreview } from '@/types/schedule';
import TimeRangeEditor from './TimeRangeEditor.vue';

const props = defineProps<{
  modelValue: ScheduleConfig;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: ScheduleConfig): void;
}>();

// Configuration data
const config = ref<ScheduleConfig>({ ...props.modelValue });

// Fixed interval related
const intervalValue = ref(1);
const intervalUnit = ref<'seconds' | 'minutes' | 'hours'>('minutes');

// Default interval (for Time Range mode) related
const defaultIntervalValue = ref(1);
const defaultIntervalUnit = ref<'seconds' | 'minutes' | 'hours'>('minutes');

// Preview related
const previewData = ref<SchedulePreview | null>(null);
const previewLoading = ref(false);
const previewError = ref('');

// Calculate min/max values
const minValue = computed(() => {
  return intervalUnit.value === 'seconds' ? 10 : 1;
});

const maxValue = computed(() => {
  switch (intervalUnit.value) {
    case 'seconds': return 3600;
    case 'minutes': return 60;
    case 'hours': return 24;
    default: return 60;
  }
});

// Calculate min/max values for default interval (Time Range mode)
const defaultMinValue = computed(() => {
  return defaultIntervalUnit.value === 'seconds' ? 10 : 1;
});

const defaultMaxValue = computed(() => {
  switch (defaultIntervalUnit.value) {
    case 'seconds': return 3600;
    case 'minutes': return 60;
    case 'hours': return 24;
    default: return 60;
  }
});

// Fixed interval description
const fixedIntervalDescription = computed(() => {
  if (config.value.type === 'fixed') {
    const seconds = config.value.defaultInterval;
    if (seconds < 60) {
      return `Check every ${seconds} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `Check every ${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      return `Check every ${hours} hour${hours > 1 ? 's' : ''}`;
    }
  }
  return '';
});

// Default interval description (for Time Range mode)
const defaultIntervalDescription = computed(() => {
  const seconds = config.value.defaultInterval;
  if (seconds < 60) {
    return `Used when no time rule matches (${seconds} seconds)`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `Used when no time rule matches (${minutes} minute${minutes > 1 ? 's' : ''})`;
  } else {
    const hours = Math.floor(seconds / 3600);
    return `Used when no time rule matches (${hours} hour${hours > 1 ? 's' : ''})`;
  }
});

// Initialize fixed interval value
function initFixedInterval() {
  const seconds = config.value.defaultInterval;
  if (seconds >= 3600 && seconds % 3600 === 0) {
    intervalUnit.value = 'hours';
    intervalValue.value = seconds / 3600;
  } else if (seconds >= 60 && seconds % 60 === 0) {
    intervalUnit.value = 'minutes';
    intervalValue.value = seconds / 60;
  } else {
    intervalUnit.value = 'seconds';
    intervalValue.value = seconds;
  }
}

// Update fixed interval
function updateFixedInterval() {
  let seconds = intervalValue.value;
  switch (intervalUnit.value) {
    case 'minutes':
      seconds = intervalValue.value * 60;
      break;
    case 'hours':
      seconds = intervalValue.value * 3600;
      break;
  }
  config.value.defaultInterval = seconds;
  emitUpdate();
}

// Initialize default interval (for Time Range mode)
function initDefaultInterval() {
  const seconds = config.value.defaultInterval;
  if (seconds >= 3600 && seconds % 3600 === 0) {
    defaultIntervalUnit.value = 'hours';
    defaultIntervalValue.value = seconds / 3600;
  } else if (seconds >= 60 && seconds % 60 === 0) {
    defaultIntervalUnit.value = 'minutes';
    defaultIntervalValue.value = seconds / 60;
  } else {
    defaultIntervalUnit.value = 'seconds';
    defaultIntervalValue.value = seconds;
  }
}

// Update default interval (for Time Range mode)
function updateDefaultInterval() {
  let seconds = defaultIntervalValue.value;
  switch (defaultIntervalUnit.value) {
    case 'minutes':
      seconds = defaultIntervalValue.value * 60;
      break;
    case 'hours':
      seconds = defaultIntervalValue.value * 3600;
      break;
  }
  config.value.defaultInterval = seconds;
  emitUpdate();
}

// Switch schedule type
function onTypeChange() {
  if (config.value.type === 'timeRange') {
    if (!config.value.timeRanges) {
      config.value.timeRanges = [];
    }
    // Initialize default interval display
    initDefaultInterval();
    // Add default rule if no rules exist
    if (config.value.timeRanges.length === 0) {
      config.value.timeRanges.push({
        name: 'Business Hours',
        start: '09:00',
        end: '18:00',
        interval: config.value.defaultInterval,
        enabled: true
      });
    }
    refreshPreview();
  }
  emitUpdate();
}

// Time range operations
function addTimeRange() {
  if (!config.value.timeRanges) {
    config.value.timeRanges = [];
  }
  const newRange: TimeRange = {
    name: `Range ${config.value.timeRanges.length + 1}`,
    start: '09:00',
    end: '18:00',
    interval: config.value.defaultInterval,
    enabled: true
  };
  config.value.timeRanges.push(newRange);
  emitUpdate();
  refreshPreview();
}

function updateRange(index: number, range: TimeRange) {
  if (config.value.timeRanges) {
    config.value.timeRanges[index] = range;
    emitUpdate();
    refreshPreview();
  }
}

function deleteRange(index: number) {
  config.value.timeRanges?.splice(index, 1);
  
  // If all time rules are deleted, switch back to Fixed Interval mode
  if (!config.value.timeRanges || config.value.timeRanges.length === 0) {
    config.value.type = 'fixed';
    ElMessage.info('Switched to Fixed Interval mode as all time rules were deleted');
  }
  
  emitUpdate();
  refreshPreview();
}

function moveRangeUp(index: number) {
  if (index > 0 && config.value.timeRanges) {
    const temp = config.value.timeRanges[index];
    config.value.timeRanges[index] = config.value.timeRanges[index - 1];
    config.value.timeRanges[index - 1] = temp;
    emitUpdate();
  }
}

function moveRangeDown(index: number) {
  if (config.value.timeRanges && index < config.value.timeRanges.length - 1) {
    const temp = config.value.timeRanges[index];
    config.value.timeRanges[index] = config.value.timeRanges[index + 1];
    config.value.timeRanges[index + 1] = temp;
    emitUpdate();
  }
}

// Refresh preview
async function refreshPreview() {
  if (config.value.type !== 'timeRange') return;
  
  previewLoading.value = true;
  previewError.value = '';
  
  try {
    const response = await axios.post('/api/preview', config.value);
    previewData.value = response.data;
  } catch (error: any) {
    previewError.value = 'Preview failed: ' + (error.response?.data?.error || error.message);
    console.error('Preview failed:', error);
  } finally {
    previewLoading.value = false;
  }
}

// Format next run time
function formatNextRun(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const seconds = Math.floor(diff / 1000);
  
  if (seconds < 60) {
    return `in ${seconds} seconds`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return `in ${mins} minute${mins > 1 ? 's' : ''}`;
  } else {
    return date.toLocaleString('en-US');
  }
}

// Emit update event
function emitUpdate() {
  emit('update:modelValue', { ...config.value });
}

// Watch external changes
watch(() => props.modelValue, (newVal) => {
  config.value = { ...newVal };
  initFixedInterval();
  initDefaultInterval();
}, { deep: true });

// Initialize
onMounted(() => {
  initFixedInterval();
  initDefaultInterval();
  // Add default rule if type is timeRange and no rules exist
  if (config.value.type === 'timeRange') {
    if (!config.value.timeRanges || config.value.timeRanges.length === 0) {
      if (!config.value.timeRanges) {
        config.value.timeRanges = [];
      }
      config.value.timeRanges.push({
        name: 'Business Hours',
        start: '09:00',
        end: '18:00',
        interval: config.value.defaultInterval,
        enabled: true
      });
    }
    refreshPreview();
  }
});
</script>

<style scoped>
.schedule-config-panel {
  width: 100%;
}

.interval-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.unit {
  color: var(--el-text-color-regular);
  margin-left: 8px;
}

.interval-desc {
  margin-top: 8px;
}

.time-ranges-container {
  width: 100%;
  min-height: 100px;
}

.time-ranges-list {
  width: 100%;
}

.preview-container {
  width: 100%;
}

.preview-card {
  background-color: var(--el-fill-color-light);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-content {
  max-height: 600px;
  overflow-y: auto;
}

.future-runs {
  margin-top: 16px;
}

.fixed-mode,
.time-range-mode {
  margin-top: 16px;
}
</style>
