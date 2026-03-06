<template>
  <el-card 
    class="time-range-card" 
    :class="{ 'is-disabled': !localRange.enabled }"
    shadow="never"
  >
    <template #header>
      <div class="card-header">
        <el-checkbox 
          v-model="localRange.enabled" 
          @change="handleUpdate"
          class="range-checkbox"
        >
          <el-input
            v-model="localRange.name"
            placeholder="e.g., Business Hours"
            @input="handleUpdate"
            @click.stop
            size="small"
            style="width: 180px;"
          />
        </el-checkbox>
        <div class="actions">
          <el-tooltip :content="$t('timeRange.tooltipMoveUp')" placement="top">
            <el-button 
              size="small" 
              text 
              :icon="ArrowUp"
              :disabled="index === 0"
              @click="emit('move-up', index)" 
            />
          </el-tooltip>
          <el-tooltip :content="$t('timeRange.tooltipMoveDown')" placement="top">
            <el-button 
              size="small" 
              text 
              :icon="ArrowDown"
              @click="emit('move-down', index)" 
            />
          </el-tooltip>
          <el-tooltip :content="$t('timeRange.tooltipDelete')" placement="top">
            <el-button 
              size="small" 
              text 
              type="danger" 
              :icon="Delete"
              @click="handleDelete" 
            />
          </el-tooltip>
        </div>
      </div>
    </template>
    
    <el-form label-width="100px" size="small" :disabled="!localRange.enabled">
      <el-form-item :label="$t('timeRange.labelTimeRange')">
        <div class="time-range-input">
          <el-time-select
            v-model="localRange.start"
            start="00:00"
            step="00:15"
            end="23:45"
            :placeholder="$t('timeRange.placeholderStart')"
            @change="handleUpdate"
          />
          <span class="separator">{{ $t('common.to') }}</span>
          <el-time-select
            v-model="localRange.end"
            start="00:00"
            step="00:15"
            end="23:45"
            :placeholder="$t('timeRange.placeholderEnd')"
            @change="handleUpdate"
          />
        </div>
        <div class="time-hint">
          <el-text size="small" type="info">
            {{ $t('timeRange.hintOvernight') }}
          </el-text>
        </div>
      </el-form-item>
      
      <el-form-item :label="$t('timeRange.labelInterval')">
        <div class="interval-input">
          <el-input-number 
            v-model="intervalValue" 
            :min="minValue"
            :max="maxValue"
            @change="updateInterval"
          />
          <el-select 
            v-model="intervalUnit" 
            style="width: 100px; margin-left: 8px;"
            @change="updateInterval"
          >
            <el-option :label="$t('schedule.unitSeconds')" value="seconds" />
            <el-option :label="$t('schedule.unitMinutes')" value="minutes" />
            <el-option :label="$t('schedule.unitHours')" value="hours" />
          </el-select>
        </div>
        <div class="interval-hint">
          <el-text size="small" type="info">
            {{ intervalDescription }}
          </el-text>
        </div>
      </el-form-item>
      
      <el-form-item :label="$t('timeRange.labelActiveDays')">
        <WeekdaySelector 
          v-model="localRange.weekdays" 
          :disabled="!localRange.enabled"
          @update:model-value="handleUpdate"
        />
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { ArrowUp, ArrowDown, Delete } from '@element-plus/icons-vue';
import { ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import type { TimeRange } from '@/types/schedule';
import WeekdaySelector from './WeekdaySelector.vue';

const props = defineProps<{
  range: TimeRange;
  index: number;
}>();

const emit = defineEmits<{
  (e: 'update', index: number, range: TimeRange): void;
  (e: 'delete', index: number): void;
  (e: 'move-up', index: number): void;
  (e: 'move-down', index: number): void;
}>();

const localRange = ref<TimeRange>({ ...props.range });
const { t } = useI18n();

// Interval display fields
const intervalValue = ref(1);
const intervalUnit = ref<'seconds' | 'minutes' | 'hours'>('minutes');

// Initialize interval display from seconds
function initInterval() {
  const seconds = localRange.value.interval;
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

initInterval();

// 监听props变化
watch(() => props.range, (newVal) => {
  localRange.value = { ...newVal };
  initInterval();
}, { deep: true });

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

// 计算间隔描述
const intervalDescription = computed(() => {
  const seconds = localRange.value.interval;
  if (seconds < 60) {
    return `Check every ${seconds} seconds`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `Check every ${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `Check every ${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}` : `Check every ${hours} hour${hours > 1 ? 's' : ''}`;
  }
});

// Update interval from display values
function updateInterval() {
  let seconds = intervalValue.value;
  switch (intervalUnit.value) {
    case 'minutes':
      seconds = intervalValue.value * 60;
      break;
    case 'hours':
      seconds = intervalValue.value * 3600;
      break;
  }
  localRange.value.interval = seconds;
  handleUpdate();
}

function handleUpdate() {
  emit('update', props.index, { ...localRange.value });
}

async function handleDelete() {
  try {
    await ElMessageBox.confirm(
      t('timeRange.confirmDelete'),
      t('timeRange.confirmDeleteTitle'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    );
    emit('delete', props.index);
  } catch {
    // User cancelled
  }
}
</script>

<style scoped>
.time-range-card {
  margin-bottom: 12px;
  border: 1px solid var(--el-border-color);
  transition: all 0.3s;
}

.time-range-card:hover {
  border-color: var(--el-color-primary);
}

.time-range-card.is-disabled {
  opacity: 0.6;
  background-color: var(--el-fill-color-lighter);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.range-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
}

.range-checkbox :deep(.el-checkbox__label) {
  display: flex;
  align-items: center;
}

.actions {
  display: flex;
  gap: 4px;
}

.time-range-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.separator {
  color: var(--el-text-color-secondary);
}

.interval-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.unit {
  color: var(--el-text-color-regular);
}

.time-hint,
.interval-hint {
  margin-top: 4px;
}
</style>
