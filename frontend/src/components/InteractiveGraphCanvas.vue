<template>
  <Teleport to="body" :disabled="!windowFullscreen">
    <section ref="canvas" class="graph-canvas" :class="{ 'window-fullscreen': windowFullscreen, 'edit-mode': editable }"
      tabindex="-1" @keydown="onKeyDown">
      <div v-if="editable" class="layout-toolbar">
        <label>{{ t('graphCanvas.layoutLabel') }}
          <select v-model="layoutKind" :disabled="layoutBusy" :aria-label="t('graphCanvas.layoutLabel')">
            <option value="layered">{{ t('graphCanvas.layoutDirected') }}</option>
            <option value="force">{{ t('graphCanvas.layoutForce') }}</option>
            <option value="box">{{ t('graphCanvas.layoutGrid') }}</option>
          </select>
        </label>
        <select v-model="direction" :disabled="layoutBusy" :aria-label="t('graphCanvas.directionLabel')">
          <option value="TB">{{ t('graphCanvas.dirTopBottom') }}</option>
          <option value="BT">{{ t('graphCanvas.dirBottomTop') }}</option>
          <option value="LR">{{ t('graphCanvas.dirLeftRight') }}</option>
          <option value="RL">{{ t('graphCanvas.dirRightLeft') }}</option>
        </select>
        <button :disabled="layoutBusy || !nodesReady || !nodes.length" @click="applyLayout">{{ t(layoutBusy ? 'graphCanvas.layoutRunning' : 'graphCanvas.applyLayout') }}</button>
        <button @click="lineStyle = lineStyle === 'bezier' ? 'orthogonal' : 'bezier'">
          {{ t(lineStyle === 'bezier' ? 'graphCanvas.lineBezier' : 'graphCanvas.lineOrthogonal') }}
        </button>
        <label :title="t('graphCanvas.snapGridDesc')"><input v-model="snapGrid" type="checkbox">{{ t('graphCanvas.snapGrid') }}</label>
        <label><input v-model="snapGuides" type="checkbox">{{ t('graphCanvas.snapAlign') }}</label>
      </div>
      <div class="flow-stage" :class="{ 'show-grid': editable && snapGrid }" :style="{ backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`, backgroundPosition: `${viewport.x}px ${viewport.y}px` }">
        <VueFlow :id="flowId" v-model:nodes="flowNodes" :edges="flowEdges"
          :connection-mode="ConnectionMode.Loose" :nodes-draggable="editable && !layoutBusy"
          :nodes-connectable="editable && !layoutBusy" :elements-selectable="true"
          :select-nodes-on-drag="true" :selection-key-code="editable ? 'Shift' : null"
          :multi-selection-key-code="['Control', 'Meta']" :delete-key-code="null"
          :pan-on-drag="[0, 1]" :zoom-on-double-click="false" :min-zoom="0.15" :max-zoom="2"
          :node-drag-threshold="5" :auto-connect="false" :elevate-edges-on-select="false"
          :edges-updatable="false" :is-valid-connection="validateConnection"
          @node-click="onNodeClick" @pane-click="clearSelection" @connect="onConnect"
          @node-drag-start="onDragStart" @node-drag="onDrag" @node-drag-stop="onDragStop"
          @selection-drag-start="onDragStart" @selection-drag="onDrag" @selection-drag-stop="onDragStop"
          @edge-context-menu="onEdgeMenu" @edge-click="onEdgeMenu"
          @nodes-initialized="onInitialized" @error="onFlowError">
          <template #node-service="nodeProps">
            <ServiceTopologyNode v-bind="nodeProps" @details="emit('view-service', $event)" />
          </template>
          <template #edge-dependency="edgeProps"><ServiceTopologyEdge v-bind="edgeProps" /></template>
          <MiniMap pannable zoomable :node-color="minimapColor" />
        </VueFlow>
        <svg class="alignment-overlay" aria-hidden="true">
          <g :transform="`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`">
            <line v-for="(guide, index) in guides" :key="index" v-bind="guide"
              stroke="#e04aab" stroke-width="1.25" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" />
          </g>
        </svg>
        <div v-if="selectedIds.size" class="selection-summary">
          {{ t('graphCanvas.selectedCount', { count: selectedIds.size }) }}
          <button @click="clearSelection">{{ t('common.clear') }} ×</button>
        </div>
        <div class="viewport-controls">
          <button :title="t('graphCanvas.zoomOut')" :aria-label="t('graphCanvas.zoomOut')" :disabled="viewport.zoom <= 0.15" @click="zoomOut()">−</button>
          <span>{{ Math.round(viewport.zoom * 100) }}%</span>
          <button :title="t('graphCanvas.zoomIn')" :aria-label="t('graphCanvas.zoomIn')" :disabled="viewport.zoom >= 2" @click="zoomIn()">+</button>
          <button @click="fit">{{ t('graphCanvas.fitView') }}</button>
          <button :aria-pressed="isFullscreen" @click="toggleFullscreen">
            {{ t(isFullscreen ? 'graphCanvas.exitFullscreen' : 'graphCanvas.enterFullscreen') }}
          </button>
        </div>
        <div v-if="menu" class="link-menu nowheel nopan" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }" @keydown.stop>
          <div class="menu-heading">{{ t(menu.kind === 'create' ? 'graphCanvas.selectDepType' : 'graphCanvas.edgeSettingsTitle') }}</div>
          <button v-for="type in dependencyTypes" :key="type.value" :class="{ active: (resolveDependencyType(menu.link?.dependencyType)?.name || menu.link?.dependencyType) === type.value }" @click="chooseType(type.value)">
            <span :style="{ color: type.color }">{{ type.icon }}</span> {{ type.label }}
          </button>
          <template v-if="menu.kind === 'edit'">
            <hr>
            <button v-for="value in (['normal', 'reverse'] as const)" :key="value"
              :class="{ active: (menu.link?.linkDirection || 'normal') === value }" @click="changeDirection(value)">
              {{ t(value === 'normal' ? 'graphCanvas.edgeDirNormal' : 'graphCanvas.edgeDirReverse') }}
            </button>
            <button class="danger" @click="removeLink">{{ t('graphCanvas.btnDeleteConn') }}</button>
          </template>
          <button @click="menu = null">{{ t('common.cancel') }}</button>
        </div>
      </div>
      <footer class="viewport-hint">{{ t('graphCanvas.viewportHint') }}</footer>
      <slot name="overlay" />
    </section>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue';
import {
  ConnectionMode, MarkerType, VueFlow, useVueFlow,
  type Connection, type Edge, type EdgeMouseEvent, type Node as FlowNode, type NodeDragEvent,
  type NodeMouseEvent, type GraphNode,
} from '@vue-flow/core';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/minimap/dist/style.css';
import { getDependencyTypes, dependencyTypeCatalog, resolveDependencyType } from '../api/dependency-types';
import ServiceTopologyNode from './topology/ServiceTopologyNode.vue';
import ServiceTopologyEdge from './topology/ServiceTopologyEdge.vue';
import { alignNode, type Guide } from './topology/geometry';
import { createLayoutEngine } from './topology/layout';
import type {
  CardData, DependencyEdgeData, LayoutDirection, LayoutKind, LineStyle,
  Rect, RoutedEdge, ServiceLink, ServiceNode,
} from './topology/types';

const props = withDefaults(defineProps<{
  nodes: ServiceNode[];
  links: ServiceLink[];
  isEditMode?: boolean;
  readonly?: boolean;
  selectedNodeId?: string | null;
  isDetailsOpen?: boolean;
}>(), { isEditMode: false, readonly: false, selectedNodeId: null, isDetailsOpen: false });
const emit = defineEmits<{
  'update:nodes': [nodes: ServiceNode[]];
  'select-node': [node: ServiceNode | null];
  'view-service': [id: string];
  'add-link': [link: { source: string; target: string; dependencyType: string }];
  'update-link': [link: { id: string; dependencyType?: string; linkDirection?: 'normal' | 'reverse' }];
  'delete-link': [link: ServiceLink];
  'layout-busy': [busy: boolean];
}>();
const { t } = useI18n();
const flowId = `service-topology-${useId()}`;
const {
  viewport, getNodes, getSelectedNodes, findNode, updateNode, addSelectedNodes,
  removeSelectedNodes, fitView, zoomIn, zoomOut, setViewport,
} = useVueFlow(flowId);
const canvas = ref<HTMLElement>();
const flowNodes = shallowRef<FlowNode<CardData>[]>([]);
const draggingIds = new Set<string>();
const selectionKey = computed(() => getSelectedNodes.value.map(node => node.id).sort().join('\0'));
const selectedIds = computed(() => new Set(selectionKey.value ? selectionKey.value.split('\0') : []));
const editable = computed(() => props.isEditMode && !props.readonly);
const lineStyle = ref<LineStyle>('bezier');
const snapGrid = ref(false);
const snapGuides = ref(true);
const guides = shallowRef<Guide[]>([]);
const layoutKind = ref<LayoutKind>('layered');
const direction = ref<LayoutDirection>('TB');
const layoutBusy = ref(false);
const nodesReady = ref(false);
const routes = shallowRef(new Map<string, RoutedEdge>());
const nodesById = computed(() => new Map(props.nodes.map(node => [node.id, node])));
const validLinks = computed(() => props.links.filter(link => nodesById.value.has(link.source) && nodesById.value.has(link.target)));
const relatedIds = computed(() => {
  const ids = new Set(selectedIds.value);
  for (const link of validLinks.value) {
    if (selectedIds.value.has(link.source) || selectedIds.value.has(link.target)) {
      ids.add(link.source); ids.add(link.target);
    }
  }
  return ids;
});
const fallbackDependencyTypes = [
  { value: 'depends', label: t('graphCanvas.depDepends'), icon: '🔗', color: '#1570ef', line_style: 'solid' },
  { value: 'uses', label: t('graphCanvas.depUses'), icon: '📡', color: '#6366f1', line_style: 'dashed' },
  { value: 'sync', label: t('graphCanvas.depSync'), icon: '🔄', color: '#06b6d4', line_style: 'dotted' },
  { value: 'backup', label: t('graphCanvas.depBackup'), icon: '💾', color: '#10b981', line_style: 'long-dash' },
];
const dependencyTypes = computed(() => dependencyTypeCatalog.value
  ? dependencyTypeCatalog.value.map(type => ({ value: type.name, label: type.label, icon: type.icon, color: type.color, line_style: type.line_style }))
  : fallbackDependencyTypes);
const dashStyles: Record<string, string | undefined> = { solid: undefined, dashed: '7 4', dotted: '2 4', 'long-dash': '12 5' };
const flowEdges = computed<Edge<DependencyEdgeData>[]>(() => validLinks.value.map(link => {
  const type = resolveDependencyType(link.dependencyType) || dependencyTypes.value.find(type => type.value === link.dependencyType);
  const target = nodesById.value.get(link.target)!;
  const status = target.status || target.data?.status || link.status;
  const highlighted = selectedIds.value.has(link.source) || selectedIds.value.has(link.target);
  const color = highlighted ? '#3568ed' : status === 'down' ? '#f04438' : status === 'warning' ? '#f79009' : type?.color || '#9babc3';
  return {
    id: link.id, type: 'dependency',
    source: link.linkDirection === 'reverse' ? link.target : link.source,
    target: link.linkDirection === 'reverse' ? link.source : link.target,
    markerEnd: { type: MarkerType.ArrowClosed, color },
    selectable: false, focusable: editable.value, deletable: false,
    data: {
      lineStyle: lineStyle.value, direction: direction.value, color, label: `${link.isCrossProject ? `${t('graphCanvas.badgeXProject')} · ` : ''}${type?.label || link.dependencyType || ''}`,
      dash: link.isCrossProject ? '6 4' : dashStyles[type?.line_style || 'solid'],
      dimmed: selectedIds.value.size > 0 && !highlighted, route: routes.value.get(link.id),
    },
  };
}));

function cardData(service: ServiceNode): CardData {
  return { service, editing: editable.value, highlighted: relatedIds.value.has(service.id), dimmed: selectedIds.value.size > 0 && !relatedIds.value.has(service.id) };
}
function minimapColor(node: GraphNode<CardData>) {
  if ((node.data.service.enabled ?? node.data.service.data?.enabled) === 0) return '#98a2b3';
  const status = node.data.service.status || node.data.service.data?.status;
  return status === 'down' ? '#f9a39c' : status === 'warning' ? '#f7d288' : status === 'up' ? '#75dca5' : '#98a2b3';
}

// Keep Vue Flow's local drag state separate from API refreshes and emitted snapshots.
watch(() => props.nodes, services => {
  const ids = new Set(services.map(service => service.id));
  const existing = new Map(flowNodes.value.map(node => [node.id, node]));
  flowNodes.value = services.map(service => ({
    ...existing.get(service.id), id: service.id, type: 'service',
    position: draggingIds.has(service.id) && existing.has(service.id)
      ? { ...existing.get(service.id)!.position } : { x: service.x ?? 0, y: service.y ?? 0 },
    data: cardData(service),
  }));
  if (menu.value?.link && !props.links.some(link => link.id === menu.value?.link?.id)) menu.value = null;
  if (props.selectedNodeId && !ids.has(props.selectedNodeId)) clearSelection();
}, { deep: true, immediate: false });

watch([editable, relatedIds], () => {
  for (const node of getNodes.value) {
    const service = nodesById.value.get(node.id);
    if (service) updateNode(node.id, { data: cardData(service) });
  }
  if (!editable.value) { menu.value = null; guides.value = []; }
});

// Key only on graph structure: polling status must not reset the viewport or layout.
const structure = computed(() => JSON.stringify([props.nodes.map(node => node.id).sort(), validLinks.value.map(link => [link.id, link.source, link.target, link.linkDirection]).sort()]));
watch(structure, () => {
  layoutRequest++;
  layoutBusy.value = false;
  routes.value = new Map();
  menu.value = null;
  const newKey = props.nodes.map(node => node.id).sort().join('|');
  if (newKey !== graphKey) {
    graphKey = newKey;
    nodesReady.value = false;
    pendingFit = true;
    removeSelectedNodes(getSelectedNodes.value);
  }
}, { flush: 'sync' });

let graphKey = '';
let pendingFit = true;
let layoutRequest = 0;
let engine: ReturnType<typeof createLayoutEngine> | undefined;
let unmounted = false;
const menu = ref<{
  kind: 'create' | 'edit'; x: number; y: number; link?: ServiceLink; connection?: Connection;
} | null>(null);

// Initial data must also work when the canvas mounts after API loading.
flowNodes.value = props.nodes.map(service => ({
  id: service.id, type: 'service', position: { x: service.x ?? 0, y: service.y ?? 0 }, data: cardData(service),
}));
graphKey = props.nodes.map(node => node.id).sort().join('|');

function fit() {
  if (getNodes.value.length) void fitView({ padding: 0.15, minZoom: 0.15, maxZoom: 1.2, duration: 0 });
}
async function onInitialized() {
  nodesReady.value = true;
  if (props.selectedNodeId && !selectedIds.value.has(props.selectedNodeId)) {
    const selected = findNode(props.selectedNodeId);
    if (selected) addSelectedNodes([selected]);
  }
  if (pendingFit) { pendingFit = false; await nextTick(); if (!unmounted) fit(); }
}
function clearSelection() {
  removeSelectedNodes(getSelectedNodes.value);
  menu.value = null;
  emit('select-node', null);
}
let selectionBeforePointer = new Set<string>();
function onNodeClick({ node, event }: NodeMouseEvent) {
  canvas.value?.focus({ preventScroll: true });
  const multi = event.ctrlKey || event.metaKey;
  if (!multi && selectionBeforePointer.size === 1 && selectionBeforePointer.has(node.id)) clearSelection();
  else {
    const primary = selectedIds.value.has(node.id) ? node.id : getSelectedNodes.value[getSelectedNodes.value.length - 1]?.id;
    emit('select-node', primary ? nodesById.value.get(primary) ?? null : null);
  }
  selectionBeforePointer = new Set();
}
function rememberSelection(event: PointerEvent) {
  if ((event.target as Element).closest('.vue-flow__node')) selectionBeforePointer = new Set(selectedIds.value);
}
function validConnection(connection: Connection) {
  return editable.value && !layoutBusy.value && connection.source !== connection.target &&
    nodesById.value.has(connection.source) && nodesById.value.has(connection.target) &&
    !validLinks.value.some(link => link.source === connection.source && link.target === connection.target);
}
function validateConnection(connection: Connection) {
  // Vue Flow also applies this predicate to already-persisted edges.
  return 'id' in connection || validConnection(connection);
}
function onConnect(connection: Connection) {
  if (!validConnection(connection)) return;
  menu.value = { kind: 'create', connection, x: 16, y: 16 };
}
function onEdgeMenu({ edge, event }: EdgeMouseEvent) {
  if (!editable.value || layoutBusy.value) return;
  event.preventDefault();
  const stage = canvas.value?.querySelector('.flow-stage')?.getBoundingClientRect();
  const point = 'clientX' in event ? event : event.touches[0];
  const link = validLinks.value.find(link => link.id === edge.id);
  if (stage && point && link) menu.value = { kind: 'edit', link, x: Math.max(0, Math.min(point.clientX - stage.left, stage.width - 230)), y: Math.max(0, Math.min(point.clientY - stage.top, stage.height - 330)) };
}
function chooseType(dependencyType: string) {
  if (!editable.value) return;
  if (menu.value?.kind === 'create' && menu.value.connection) {
    const { source, target } = menu.value.connection;
    if (validConnection(menu.value.connection)) emit('add-link', { source, target, dependencyType });
  } else if (menu.value?.link) emit('update-link', { id: menu.value.link.id, dependencyType });
  menu.value = null;
}
function changeDirection(linkDirection: 'normal' | 'reverse') {
  if (editable.value && menu.value?.link) emit('update-link', { id: menu.value.link.id, linkDirection });
  menu.value = null;
}
function removeLink() {
  if (editable.value && menu.value?.link) emit('delete-link', menu.value.link);
  menu.value = null;
}
function nodeRect(node: GraphNode): Rect {
  return { ...node.position, ...node.dimensions };
}
function onDragStart({ nodes }: NodeDragEvent) {
  layoutRequest++;
  routes.value = new Map();
  menu.value = null;
  guides.value = [];
  draggingIds.clear();
  for (const node of nodes) draggingIds.add(node.id);
}
function onDrag({ node, nodes }: NodeDragEvent) {
  if (!editable.value) return;
  const moving = new Set(nodes.map(node => node.id));
  const rect = nodeRect(node);
  const alignment = snapGuides.value
    ? alignNode(rect, getNodes.value.filter(other => !moving.has(other.id) && !other.hidden).map(nodeRect), viewport.value.zoom)
    : { x: rect.x, y: rect.y, alignedX: false, alignedY: false, guides: [] };
  const x = snapGrid.value && !alignment.alignedX ? Math.round(alignment.x / 20) * 20 : alignment.x;
  const y = snapGrid.value && !alignment.alignedY ? Math.round(alignment.y / 20) * 20 : alignment.y;
  const correction = { x: x - node.position.x, y: y - node.position.y };
  for (const movingNode of nodes) updateNode(movingNode.id, { position: { x: movingNode.position.x + correction.x, y: movingNode.position.y + correction.y } });
  guides.value = alignment.guides;
}
function publishPositions() {
  emit('update:nodes', props.nodes.map(service => {
    const node = findNode(service.id);
    return node ? { ...service, x: node.position.x, y: node.position.y } : service;
  }));
}
function onDragStop() {
  guides.value = [];
  if (editable.value) publishPositions();
  draggingIds.clear();
}
async function applyLayout() {
  if (!editable.value || layoutBusy.value || !nodesReady.value || !props.nodes.length) return;
  const request = ++layoutRequest;
  const signature = JSON.stringify(getNodes.value.map(node => [node.id, node.position, node.dimensions]));
  layoutBusy.value = true;
  menu.value = null;
  try {
    engine ??= createLayoutEngine();
    const result = await engine.layout(getNodes.value.map(node => ({ id: node.id, ...nodeRect(node) })), validLinks.value, layoutKind.value, direction.value);
    if (unmounted || request !== layoutRequest || !editable.value ||
      signature !== JSON.stringify(getNodes.value.map(node => [node.id, node.position, node.dimensions]))) return;
    for (const [id, position] of result.positions) updateNode(id, { position: { x: position.x, y: position.y } });
    routes.value = result.routes;
    publishPositions();
    await nextTick();
    fit();
  } catch (error) {
    if (unmounted || request !== layoutRequest) return;
    console.error('Topology ELK layout failed:', error);
    ElMessage.error({ message: t('graphCanvas.layoutFailed'), appendTo: canvas.value });
    engine?.destroy();
    engine = undefined;
  } finally {
    if (request === layoutRequest) layoutBusy.value = false;
  }
}
function onFlowError(error: Error) {
  console.error('Topology rendering failed:', error);
  ElMessage.error({ message: t('graphCanvas.renderFailed'), appendTo: canvas.value });
}
const nativeFullscreen = ref(false);
const windowFullscreen = ref(false);
const isFullscreen = computed(() => nativeFullscreen.value || windowFullscreen.value);
function syncFullscreen() { nativeFullscreen.value = document.fullscreenElement === canvas.value; }
async function toggleFullscreen() {
  if (windowFullscreen.value) { windowFullscreen.value = false; return; }
  const exiting = document.fullscreenElement === canvas.value;
  try {
    if (exiting) await document.exitFullscreen();
    else await canvas.value!.requestFullscreen();
  } catch (error) {
    if (exiting) {
      console.error('Unable to exit topology fullscreen:', error);
      syncFullscreen();
      ElMessage.error({ message: t('graphCanvas.fullscreenError'), appendTo: canvas.value });
    } else {
      console.warn('Using topology window fullscreen:', error);
      windowFullscreen.value = true;
      ElMessage.warning({ message: t('graphCanvas.fullscreenFallback'), appendTo: canvas.value });
    }
  }
}
function onKeyDown(event: KeyboardEvent) {
  if ((event.target as Element).closest('input, select, textarea, .service-details-drawer')) return;
  if (event.key === 'Escape') {
    menu.value = null;
    guides.value = [];
    if (!props.isDetailsOpen) {
      if (windowFullscreen.value) windowFullscreen.value = false;
      else if (nativeFullscreen.value) void toggleFullscreen();
      else clearSelection();
    }
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' && editable.value && !props.isDetailsOpen) {
    event.preventDefault();
    addSelectedNodes(getNodes.value.filter(node => !node.hidden));
  }
}
let resizeObserver: ResizeObserver | undefined;
let stageSize: { width: number; height: number } | undefined;
onMounted(async () => {
  document.addEventListener('fullscreenchange', syncFullscreen);
  canvas.value?.addEventListener('pointerdown', rememberSelection, true);
  const stage = canvas.value?.querySelector('.flow-stage');
  resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return;
    const { width, height } = entry.contentRect;
    if (stageSize) void setViewport({
      ...viewport.value, x: viewport.value.x + (width - stageSize.width) / 2,
      y: viewport.value.y + (height - stageSize.height) / 2,
    });
    stageSize = { width, height };
  });
  if (stage) resizeObserver.observe(stage);
  try {
    await getDependencyTypes();
  } catch (error) {
    if (unmounted) return;
    console.error('Unable to load topology dependency types:', error);
    ElMessage.warning({ message: t('graphCanvas.dependencyTypesFailed'), appendTo: canvas.value });
  }
});
watch(editable, () => { layoutRequest++; layoutBusy.value = false; draggingIds.clear(); });
watch(layoutBusy, busy => emit('layout-busy', busy));
watch(() => props.selectedNodeId, id => {
  if (!id) removeSelectedNodes(getSelectedNodes.value);
  else if (!selectedIds.value.has(id)) {
    const node = findNode(id);
    if (node) addSelectedNodes([node]);
  }
});
onBeforeUnmount(() => {
  unmounted = true;
  emit('layout-busy', false);
  layoutRequest++;
  engine?.destroy();
  resizeObserver?.disconnect();
  document.removeEventListener('fullscreenchange', syncFullscreen);
  canvas.value?.removeEventListener('pointerdown', rememberSelection, true);
});
</script>

<style scoped>
.graph-canvas { display: flex; flex: 1; flex-direction: column; position: relative; width: 100%; height: 100%; min-height: 360px; overflow: hidden; border: 1px solid #cbd5e1; border-radius: 9px; background: white; outline: none; }
.graph-canvas:fullscreen, .graph-canvas.window-fullscreen { width: 100vw; height: 100vh; border-radius: 0; }
.window-fullscreen { position: fixed; inset: 0; z-index: 10000; }
.layout-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 12px; border-bottom: 1px solid #e4e7ec; background: white; z-index: 5; }
button, select { border: 1px solid #d7deea; border-radius: 6px; padding: 6px 9px; color: #344054; background: white; font: inherit; font-size: 12px; }
button { cursor: pointer; }
button:hover:not(:disabled), button.active { background: #eff5ff; border-color: #9ab8f7; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #9ab8f7; outline-offset: 2px; }
button:disabled { opacity: .45; cursor: not-allowed; }
.layout-toolbar { background: #f8faff; font-size: 12px; }
.layout-toolbar label { display: flex; align-items: center; gap: 5px; }
.flow-stage { flex: 1; min-height: 0; position: relative; background-color: #fbfcfe; background-image: radial-gradient(#cdd5e2 .8px, transparent .8px); background-size: 20px 20px; }
.flow-stage.show-grid { background-image: linear-gradient(to right, #b8c6dc 1px, transparent 1px), linear-gradient(to bottom, #b8c6dc 1px, transparent 1px); }
.alignment-overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 4; overflow: hidden; }
.viewport-controls { position: absolute; bottom: 12px; left: 12px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; max-width: calc(100% - 24px); box-sizing: border-box; background: white; border: 1px solid #d7deea; border-radius: 7px; padding: 4px; z-index: 5; }
.viewport-controls span { min-width: 43px; font-size: 12px; text-align: center; color: #667085; }
.viewport-controls button { border: none; }
.viewport-hint { padding: 8px 12px; color: #98a2b3; font-size: 11px; border-top: 1px solid #e4e7ec; }
.selection-summary { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; white-space: nowrap; padding: 6px 10px; background: white; border: 1px solid #d6e2fb; border-radius: 7px; font-size: 11px; z-index: 5; }
.selection-summary button { font-size: 10px; padding: 3px 6px; }
.link-menu { position: absolute; width: 220px; max-height: calc(100% - 16px); overflow-y: auto; z-index: 8; display: flex; flex-direction: column; gap: 5px; padding: 10px; border: 1px solid #d7deea; border-radius: 8px; background: white; box-shadow: 0 5px 20px #18223020; }
.menu-heading { font-weight: 600; font-size: 12px; padding: 4px; }
.link-menu button { text-align: left; }
.link-menu .danger { color: #d92d20; }
.link-menu hr { border: none; border-top: 1px solid #e4e7ec; width: 100%; }
:deep(.vue-flow__node-service) { border: none; padding: 0; width: max-content; max-width: 350px; background: none; }
:deep(.vue-flow__handle) { width: 8px; height: 8px; border: 2px solid white; background: #729cf4; }
:deep(.vue-flow__edge-path) { transition: stroke .15s; }
:deep(.vue-flow__minimap) { border: 1px solid #d7deea; border-radius: 7px; overflow: hidden; }
@media (max-width: 700px) { :deep(.vue-flow__minimap) { display: none; } }
@media (max-width: 600px) { .viewport-hint { font-size: 10px; } .selection-summary { max-width: calc(100% - 12px); } }
</style>
