<template>
  <div class="schedule-template-selector">
    <el-space wrap>
      <el-card
        v-for="template in templates"
        :key="template.id"
        shadow="hover"
        class="template-card"
        :class="{ 'is-loading': loading }"
        @click="handleSelect(template)"
      >
        <div class="template-content">
          <div class="template-icon">{{ template.icon }}</div>
          <div class="template-info">
            <div class="template-name">{{ template.name }}</div>
            <div class="template-desc">{{ template.description }}</div>
          </div>
        </div>
      </el-card>
    </el-space>
    
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      style="margin-top: 12px;"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import type { ScheduleTemplate } from '@/types/schedule';

const emit = defineEmits<{
  (e: 'select', template: ScheduleTemplate): void;
}>();

const templates = ref<ScheduleTemplate[]>([]);
const loading = ref(false);
const error = ref('');
const { t } = useI18n();

async function loadTemplates() {
  loading.value = true;
  error.value = '';
  
  try {
    const response = await axios.get('/api/schedule/templates');
    templates.value = response.data;
  } catch (err: any) {
    error.value = t('schedule.templateLoadFailed') + ': ' + (err.message || 'Unknown error');
    console.error('Failed to load templates:', err);
  } finally {
    loading.value = false;
  }
}

function handleSelect(template: ScheduleTemplate) {
  if (loading.value) return;
  
  ElMessage.success(t('schedule.templateApplied', { name: template.name }));
  emit('select', template);
}

onMounted(() => {
  loadTemplates();
});
</script>

<style scoped>
.schedule-template-selector {
  width: 100%;
}

.template-card {
  width: 240px;
  cursor: pointer;
  transition: all 0.3s;
}

.template-card:hover {
  transform: translateY(-2px);
  border-color: var(--el-color-primary);
}

.template-card.is-loading {
  cursor: not-allowed;
  opacity: 0.6;
}

.template-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.template-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.template-info {
  flex: 1;
  min-width: 0;
}

.template-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.template-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  word-wrap: break-word;
}
</style>
