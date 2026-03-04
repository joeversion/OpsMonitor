<template>
  <el-tag :type="type" effect="dark">
    {{ status.toUpperCase() }}
  </el-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  status: string;
}>();

const type = computed(() => {
  switch (props.status) {
    case 'up': return 'success';
    case 'warning': return 'warning';
    case 'down': return 'danger';
    default: return 'info';
  }
});
</script>
