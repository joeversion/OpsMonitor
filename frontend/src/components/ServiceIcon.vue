<template>
  <span class="service-icon" :style="{ fontSize: size + 'px' }">
    <Icon v-if="isIconifyIcon" :icon="icon" :width="size" />
    <span v-else class="icon-emoji">{{ icon || defaultIcon }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';

const props = withDefaults(defineProps<{
  icon?: string;
  size?: number;
  defaultIcon?: string;
}>(), {
  size: 20,
  defaultIcon: '🔧'
});

const isIconifyIcon = computed(() => {
  return props.icon && props.icon.includes(':');
});
</script>

<style scoped>
.service-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.icon-emoji {
  font-size: inherit;
}
</style>
