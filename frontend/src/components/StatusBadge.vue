<template>
  <el-tag :type="type" effect="dark">
    {{ $t('statusLabels.' + status) }}
  </el-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

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
