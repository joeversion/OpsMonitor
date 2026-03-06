<template>
  <div class="weekday-selector">
    <el-checkbox-group v-model="selectedDays" @change="handleChange">
      <el-checkbox-button
        v-for="day in weekdays"
        :key="day.value"
        :label="day.value"
        :disabled="disabled"
      >
        {{ day.label }}
      </el-checkbox-button>
    </el-checkbox-group>
    <div v-if="!selectedDays || selectedDays.length === 0" class="hint">
      <el-text size="small" type="info">{{ $t('weekday.hintEmpty') }}</el-text>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  modelValue?: number[];
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: number[] | undefined): void;
}>();

const { t } = useI18n();

const weekdays = computed(() => [
  { label: t('weekday.mon'), value: 1 },
  { label: t('weekday.tue'), value: 2 },
  { label: t('weekday.wed'), value: 3 },
  { label: t('weekday.thu'), value: 4 },
  { label: t('weekday.fri'), value: 5 },
  { label: t('weekday.sat'), value: 6 },
  { label: t('weekday.sun'), value: 7 }
]);

const selectedDays = ref<number[]>(props.modelValue || []);

watch(() => props.modelValue, (newVal) => {
  selectedDays.value = newVal || [];
});

function handleChange(value: number[]) {
  emit('update:modelValue', value.length > 0 ? value : undefined);
}
</script>

<style scoped>
.weekday-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hint {
  margin-top: 4px;
}
</style>
