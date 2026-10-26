<template>
  <div class="service-node" :class="[
    `status-${status}`,
    { highlighted: data.highlighted, 'is-selected': props.selected, dimmed: data.dimmed && status !== 'down' && status !== 'warning', 'cross-project-node': service.isCrossProjectService }
  ]" :data-id="id">
    <Handle v-for="side in sides" :id="side" :key="side" type="source" :position="side"
      :class="{ 'handle-hidden': !data.editing }" />
    <div v-if="service.isCrossProjectService" class="project-identity">
      <span class="project-identity-label"><TopRight aria-hidden="true" />{{ t('services.tagXProject') }}</span>
      <span class="project-identity-divider" aria-hidden="true" />
      <span class="project-name" :title="projectName">{{ projectName }}</span>
    </div>
    <div class="node-body">
      <div class="node-icon"><ServiceIcon :icon="service.icon || service.data?.icon" :size="28" /></div>
      <div class="node-info">
        <div class="node-name">{{ service.name || service.data?.name || service.id }}</div>
        <div class="node-meta">
          <span class="status-label">{{ statusLabel }}</span>
          <span v-if="port">:{{ port }}</span>
          <span v-if="responseTime != null">{{ responseTime }} ms</span>
        </div>
      </div>
      <button v-if="!data.editing" type="button" class="node-details-btn nodrag nopan"
        :title="t('graphCanvas.viewServiceDetails', { name: service.name || service.data?.name || service.id })"
        :aria-label="t('graphCanvas.viewServiceDetails', { name: service.name || service.data?.name || service.id })"
        @pointerdown.stop @mousedown.stop @keydown.stop @click.stop="emit('details', id)">
        <InfoFilled aria-hidden="true" />
      </button>
      <span class="status-dot" :title="statusLabel" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position, type NodeProps } from '@vue-flow/core';
import { InfoFilled, TopRight } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import ServiceIcon from '../ServiceIcon.vue';
import type { CardData } from './types';

const props = defineProps<NodeProps<CardData>>();
const emit = defineEmits<{ details: [id: string] }>();
const { t } = useI18n();
const sides = [Position.Top, Position.Right, Position.Bottom, Position.Left];
const service = computed(() => props.data.service);
const projectName = computed(() => service.value.project_name || t('graphCanvas.badgeExternal'));
const status = computed(() => {
  if ((service.value.enabled ?? service.value.data?.enabled) === 0) return 'disabled';
  const value = service.value.status || service.value.data?.status;
  return value === 'up' || value === 'warning' || value === 'down' ? value : 'unknown';
});
const statusLabel = computed(() => t({
  up: 'graph.healthyNode', warning: 'graph.warningNode', down: 'graph.down',
  unknown: 'graph.unknown', disabled: 'common.notMonitored',
}[status.value]));
const port = computed(() => service.value.port ?? service.value.data?.port);
const responseTime = computed(() => status.value === 'unknown' || status.value === 'disabled'
  ? undefined : service.value.responseTime ?? service.value.data?.responseTime);
</script>

<style scoped>
.service-node { box-sizing: border-box; position: relative; width: max-content; min-width: 180px; max-width: 350px; border: 2px solid #dce3ed; border-radius: 9px; background: #fff; box-shadow: 0 3px 8px #1524490a; transition: border-color .15s, box-shadow .15s, opacity .15s; }
.node-body { box-sizing: border-box; position: relative; display: flex; align-items: center; gap: 10px; min-height: 60px; padding: 12px 38px 12px 14px; }
.service-node:hover { border-color: #a5bdf0; box-shadow: 0 4px 14px #15244916; }
.service-node.highlighted { border-color: #8caff7; }
.service-node.is-selected { outline: 3px solid #3568ed; outline-offset: 3px; box-shadow: 0 0 0 7px #3568ed16; }
.service-node.dimmed { opacity: .25; }
.service-node.status-up { background: #ecfdf3; border-color: #12b76a; }
.service-node.status-down { background: #fff6f5; border-color: #f04438; }
.service-node.status-warning { background: #fffaeb; border-color: #f79009; }
.service-node.status-unknown { background: #f2f4f7; border-color: #98a2b3; }
.service-node.status-disabled { background: #f9fafb; border-color: #98a2b3; border-style: dashed; }
.status-label { font-weight: 600; }
.node-icon { width: 32px; flex-shrink: 0; }
.node-info { min-width: 0; }
.node-name { font-size: 13px; font-weight: 600; color: #182230; overflow-wrap: anywhere; }
.node-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; color: #667085; margin-top: 3px; }
.node-details-btn { position: absolute; right: 9px; top: 9px; display: grid; place-items: center; width: 22px; height: 22px; padding: 3px; border: 1px solid #d5deec; border-radius: 5px; color: #3568ed; background: white; cursor: pointer; }
.node-details-btn:hover, .node-details-btn:focus-visible { outline: 2px solid #b2ccff; }
.node-details-btn svg { width: 14px; height: 14px; }
.status-dot { position: absolute; right: 12px; bottom: 10px; width: 8px; height: 8px; border-radius: 50%; background: #98a2b3; }
.status-up .status-dot { background: #12b76a; }
.status-warning .status-dot { background: #f79009; }
.status-down .status-dot { background: #f04438; }
.project-identity { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 5px 12px; border-bottom: 1px solid #ded2fa; border-radius: 6px 6px 0 0; background: #f2edff; color: #6941c6; font-size: 11px; line-height: 18px; }
.project-identity-label { display: flex; align-items: center; gap: 4px; flex-shrink: 0; font-weight: 700; white-space: nowrap; }
.project-identity-label svg { width: 12px; height: 12px; }
.project-identity-divider { flex-shrink: 0; height: 12px; border-left: 1px solid #cab5f0; }
.project-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cross-project-node .node-body::before { content: ''; position: absolute; left: 0; top: 16px; bottom: 16px; width: 3px; border-radius: 0 3px 3px 0; background: #9e77ed; }
.handle-hidden { visibility: hidden; }
</style>
