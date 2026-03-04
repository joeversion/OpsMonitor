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
      <el-text size="small" type="info">Empty means all days are active</el-text>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  modelValue?: number[];
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: number[] | undefined): void;
}>();

const weekdays = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 7 }
];

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
