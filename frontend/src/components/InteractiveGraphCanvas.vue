<template>
  <div 
    class="graph-canvas" 
    :class="{ 'edit-mode': isEditMode, 'panning': isPanning }" 
    ref="canvasRef" 
    @contextmenu.prevent 
    @wheel.prevent="handleWheel"
    @mousedown="startPan"
  >
    <!-- Layout Selector (shown in edit mode) -->
    <div v-if="isEditMode" class="layout-toolbar">
      <div class="layout-section">
        <span class="toolbar-label">Layout:</span>
        <div class="layout-options">
          <button 
            v-for="layout in layoutOptions" 
            :key="layout.value"
            class="layout-btn"
            :class="{ active: currentLayout === layout.value }"
            @click="applyLayout(layout.value)"
            :title="layout.description"
          >
            <span class="layout-icon">{{ layout.icon }}</span>
            <span>{{ layout.label }}</span>
          </button>
        </div>
      </div>
      <div class="toolbar-divider"></div>
      <div class="layout-section">
        <span class="toolbar-label">Direction:</span>
        <div class="direction-options">
          <button 
            v-for="dir in directionOptions" 
            :key="dir.value"
            class="direction-btn"
            :class="{ active: layoutDirection === dir.value }"
            @click="layoutDirection = dir.value; applyLayout(currentLayout)"
            :title="dir.label"
          >
            {{ dir.icon }}
          </button>
        </div>
      </div>
    </div>

    <!-- Zoom/Pan Container -->
    <div 
      class="zoom-container" 
      :style="{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`, transformOrigin: 'top left' }"
    >
    <!-- SVG Connections -->
    <svg class="connections-layer" :class="{ 'edit-mode-layer': isEditMode }">
      <!-- Animated Background for Warning Links -->
      <defs>
        <!-- Grid Pattern -->
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#cbd5e1" stroke-width="1"/>
        </pattern>
        <pattern id="grid-large" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="url(#grid)"/>
          <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
        </pattern>
        
        <linearGradient id="warningGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#f79009;stop-opacity:1">
            <animate attributeName="offset" values="0;1;0" dur="2s" repeatCount="indefinite" />
          </stop>
          <stop offset="50%" style="stop-color:#fbbf24;stop-opacity:1">
            <animate attributeName="offset" values="0.5;1.5;0.5" dur="2s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" style="stop-color:#f79009;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="downGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#f04438;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#dc2626;stop-opacity:1" />
        </linearGradient>
        <!-- Animated dash for warning/down links -->
        <pattern id="warningPattern" patternUnits="userSpaceOnUse" width="12" height="4">
          <line x1="0" y1="2" x2="12" y2="2" stroke="#f79009" stroke-width="3" stroke-dasharray="8,4">
            <animate attributeName="x1" from="0" to="12" dur="0.5s" repeatCount="indefinite" />
          </line>
        </pattern>
        <!-- Arrow Markers - Enhanced size for better visibility -->
        <marker id="arrowNormal" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,8 L10,4 z" fill="#10b981" />
        </marker>
        <marker id="arrowWarning" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,8 L10,4 z" fill="#f79009" />
        </marker>
        <marker id="arrowDown" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,8 L10,4 z" fill="#f04438" />
        </marker>
        <marker id="arrowSelected" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,8 L10,4 z" fill="#409EFF" />
        </marker>
        <!-- Dependency type markers -->
        <marker id="arrowUses" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
          <circle cx="4" cy="3" r="3" fill="#6366f1" />
        </marker>
        <marker id="arrowSync" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,3 L5,0 L5,6 Z M5,3 L10,0 L10,6 Z" fill="#06b6d4" />
        </marker>
        <marker id="arrowHighlight" markerWidth="14" markerHeight="14" refX="11" refY="5" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,10 L12,5 z" fill="#8b5cf6" />
        </marker>
        
        <!-- Mask for hiding lines behind labels -->
        <mask id="labelMask">
          <!-- White rectangle = visible area (entire canvas) -->
          <rect x="-5000" y="-5000" width="10000" height="10000" fill="white"/>
          <!-- Black rectangles = hidden areas (label positions) -->
          <g v-for="link in links" :key="'mask-' + link.id">
            <!-- Mask for dependency type label -->
            <rect 
              v-if="link.dependencyType && isLinkValid(link)"
              :x="getLinkLabelPosition(link).x - 25"
              :y="getLinkLabelPosition(link).y - 14"
              width="50"
              height="28"
              rx="6"
              fill="black"
            />
            <!-- Mask for status indicator -->
            <rect 
              v-if="isLinkValid(link) && getLinkStatus(link) !== 'up' && getLinkStatus(link) !== 'unknown'"
              :x="getLinkLabelPosition(link).x + 15"
              :y="getLinkLabelPosition(link).y - 10"
              width="20"
              height="20"
              rx="10"
              fill="black"
            />
            <!-- Mask for cross-project badge -->
            <rect 
              v-if="isLinkValid(link) && link.isCrossProject"
              :x="getLinkLabelPosition(link).x - 28"
              :y="getLinkLabelPosition(link).y + 10"
              width="56"
              height="20"
              rx="10"
              fill="black"
            />
          </g>
        </mask>
      </defs>
      
      <!-- Grid Background -->
      <rect 
        v-if="props.showGrid" 
        x="-5000" 
        y="-5000" 
        width="10000" 
        height="10000" 
        fill="url(#grid-large)" 
        class="grid-background"
      />
      
      <!-- Connection Links Layer (底层：所有连接线，应用 mask 截断标签区域) -->
      <g class="links-layer" mask="url(#labelMask)">
        <g v-for="link in links" :key="link.id">
          <!-- Link hit area for easier clicking -->
          <path 
            :d="getLinkPath(link)"
            class="link-hitarea"
            @click.stop="onLinkClick($event, link)"
            @contextmenu.stop.prevent="onLinkContextMenu($event, link)"
          />
          <!-- Glow effect for down/warning status -->
          <path 
            v-if="getLinkStatus(link) === 'down' || getLinkStatus(link) === 'warning'"
            :d="getLinkPath(link)"
            :class="['link-glow', `link-glow-${getLinkStatus(link)}`]"
          />
          <!-- Visible link -->
          <path 
            :d="getLinkPath(link)"
            :class="getLinkClass(link)"
            :style="getLinkStyle(link)"
            :marker-end="getLinkMarker(link)"
          />
          <!-- Animated particles for active connections -->
          <circle 
            v-if="getLinkStatus(link) === 'up'"
            r="3" 
            fill="#10b981"
            class="link-particle"
          >
            <animateMotion :dur="getParticleDuration(link)" repeatCount="indefinite">
              <mpath :href="'#path-' + link.id" />
            </animateMotion>
          </circle>
          <!-- Hidden path for particle motion -->
          <path 
            :id="'path-' + link.id"
            :d="getLinkPath(link)"
            style="visibility: hidden"
          />
        </g>
      </g>
      
      <!-- Labels Layer (顶层：所有标签，确保在连接线之上) -->
      <g class="labels-layer">
        <g v-for="link in links" :key="'label-' + link.id">
          <!-- Link label for dependency type (only shown when both nodes exist) -->
          <g v-if="link.dependencyType && isLinkValid(link)">
            <rect 
              :x="getLinkLabelPosition(link).x - 22"
              :y="getLinkLabelPosition(link).y - 11"
              width="44"
              height="22"
              rx="5"
              class="link-label-bg"
              :style="getLinkLabelBgStyle(link)"
            />
            <text 
              :x="getLinkLabelPosition(link).x"
              :y="getLinkLabelPosition(link).y + 4"
              class="link-label"
            >{{ getLinkTypeLabel(link.dependencyType) }}</text>
          </g>
          <!-- Status indicator on link -->
          <g v-if="isLinkValid(link) && getLinkStatus(link) !== 'up' && getLinkStatus(link) !== 'unknown'">
            <circle 
              :cx="getLinkLabelPosition(link).x + 25"
              :cy="getLinkLabelPosition(link).y"
              r="8"
              :class="['link-status-indicator', `status-${getLinkStatus(link)}`]"
            />
            <text 
              :x="getLinkLabelPosition(link).x + 25"
              :y="getLinkLabelPosition(link).y + 4"
              class="link-status-icon"
            >{{ getLinkStatus(link) === 'down' ? '!' : '⚠' }}</text>
          </g>
          <!-- Cross-project indicator -->
          <g v-if="isLinkValid(link) && link.isCrossProject" class="cross-project-indicator">
            <rect 
              :x="getLinkLabelPosition(link).x - 25"
              :y="getLinkLabelPosition(link).y + 12"
              width="50"
              height="16"
              rx="8"
              class="cross-project-badge-bg"
            />
            <text 
              :x="getLinkLabelPosition(link).x"
              :y="getLinkLabelPosition(link).y + 23"
              class="cross-project-badge-text"
            >X-Project</text>
          </g>
        </g>
      </g>
      
      <!-- Temporary link during creation -->
      <path 
        v-if="tempLink"
        :d="getTempLinkPath()"
        class="link-drag"
      />
    </svg>
    
    <!-- Nodes (inside zoom container) -->
    <div 
      v-for="node in nodes" 
      :key="node.id"
      class="service-node"
      :data-id="node.id"
      :class="[
        `layer-${getNodeLayer(node)}`, 
        `status-${getNodeStatus(node)}`,
        { 
          'selected': selectedNodeIds.has(node.id),
          'highlighted': highlightedNodes.has(node.id),
          'dimmed': (highlightedNodes.size > 0 || selectedNodeIds.size > 0) && !highlightedNodes.has(node.id) && !selectedNodeIds.has(node.id),
          'cross-project-node': node.isCrossProjectService
        }
      ]"
      :style="{ top: (node.y || 100) + 'px', left: (node.x || 100) + 'px' }"
      @mousedown.stop="startDragNode($event, node)"
      @click.stop="selectNode(node, $event)"
    >
      <!-- Cross-project badge with project name -->
      <div v-if="node.isCrossProjectService" class="cross-project-node-badge">{{ node.project_name || 'External' }}</div>
      <!-- Connection Handles -->
      <div class="node-handle handle-top" @mousedown.stop="startDragLink($event, node, 'top')"></div>
      <div class="node-handle handle-bottom" @mousedown.stop="startDragLink($event, node, 'bottom')"></div>
      <div class="node-handle handle-left" @mousedown.stop="startDragLink($event, node, 'left')"></div>
      <div class="node-handle handle-right" @mousedown.stop="startDragLink($event, node, 'right')"></div>
      
      <div class="node-icon">
        <ServiceIcon :icon="getNodeIcon(node)" :size="28" />
      </div>
      <div class="node-info">
        <div class="node-name">{{ node.name || node.data?.name }}</div>
        <div class="node-meta">
          <span v-if="getNodePort(node)">:{{ getNodePort(node) }}</span>
          <span v-if="getNodeResponseTime(node)">• {{ getNodeResponseTime(node) }}ms</span>
        </div>
      </div>
      <!-- Status indicator -->
      <div class="node-status-indicator" :class="`status-${getNodeStatus(node)}`"></div>
      <!-- Multi-select indicator -->
      <div v-if="selectedNodeIds.size > 1 && selectedNodeIds.has(node.id)" class="multi-select-badge">
        {{ Array.from(selectedNodeIds).indexOf(node.id) + 1 }}
      </div>
    </div>
    </div><!-- End zoom-container -->
    
    <!-- Box Selection Visual -->
    <div 
      v-if="isBoxSelecting" 
      class="box-selection"
      :style="{
        left: (boxSelectionRect.x * scale + panOffset.x) + 'px',
        top: (boxSelectionRect.y * scale + panOffset.y) + 'px',
        width: (boxSelectionRect.width * scale) + 'px',
        height: (boxSelectionRect.height * scale) + 'px'
      }"
    ></div>
    
    <!-- Link Context Menu -->
    <div 
      v-if="linkContextMenu.visible" 
      class="link-context-menu"
      :style="{ left: linkContextMenu.x + 'px', top: linkContextMenu.y + 'px' }"
      @click.stop
    >
      <div class="context-menu-header">Dependency Settings</div>
      <div class="context-menu-section">
        <div class="context-menu-label">Type</div>
        <div class="context-menu-options">
          <button 
            v-for="type in dependencyTypes" 
            :key="type.value"
            class="type-option"
            :class="{ active: linkContextMenu.link?.dependencyType === type.value }"
            @click="updateLinkType(type.value)"
          >
            <span class="type-icon">{{ type.icon }}</span>
            <span>{{ type.label }}</span>
          </button>
        </div>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-section">
        <div class="context-menu-label">Line Direction</div>
        <div class="direction-options-menu">
          <button 
            v-for="dir in linkDirectionOptions" 
            :key="dir.value"
            class="direction-option"
            :class="{ active: (linkContextMenu.link?.linkDirection || 'normal') === dir.value }"
            @click="updateLinkDirection(dir.value)"
            :title="dir.label"
          >
            <span class="direction-icon">{{ dir.icon }}</span>
            <span class="direction-text">{{ dir.shortLabel }}</span>
          </button>
        </div>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item danger" @click="deleteLink">
        <span class="menu-icon">🗑️</span>
        <span>Delete Connection</span>
      </div>
    </div>
    
    <!-- Link Type Selector (shown when creating new link) -->
    <div 
      v-if="showLinkTypeSelector" 
      class="link-type-selector"
      :style="{ left: linkTypeSelectorPos.x + 'px', top: linkTypeSelectorPos.y + 'px' }"
      @click.stop
    >
      <div class="selector-header">Select Dependency Type</div>
      <div class="selector-options">
        <button 
          v-for="type in dependencyTypes" 
          :key="type.value"
          class="selector-option"
          @click="confirmNewLink(type.value)"
        >
          <span class="option-icon">{{ type.icon }}</span>
          <div class="option-info">
            <span class="option-label">{{ type.label }}</span>
            <span class="option-desc">{{ type.description }}</span>
          </div>
        </button>
      </div>
      <button class="selector-cancel" @click="cancelNewLink">Cancel</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { getDependencyTypes } from '../api/dependency-types';
import ServiceIcon from './ServiceIcon.vue';

interface NodeData {
  name?: string;
  layer?: string;
  status?: string;
  port?: number;
  responseTime?: number;
  [key: string]: any;
}

interface Node {
  id: string;
  name?: string;
  layer?: string;
  status?: string;
  port?: number;
  responseTime?: number;
  x: number;
  y: number;
  data?: NodeData;
  isCrossProjectService?: boolean;  // Cross-project service flag
  project_id?: string;
  project_name?: string;  // Project name for display
  [key: string]: any;
}

interface Link {
  id: string;
  source: string;
  target: string;
  status?: string;
  type?: string;
  dependencyType?: string;
  riskLevel?: string;
  linkDirection?: 'normal' | 'reverse';  // 连线方向：normal(A→B) 或 reverse(A←B)
  isCrossProject?: boolean;  // Cross-project dependency flag
  sourceProjectName?: string;
  targetProjectName?: string;
}

interface Props {
  nodes: Node[];
  links: Link[];
  isEditMode?: boolean;
  selectedNodeId?: string | null;
  showGrid?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isEditMode: false,
  selectedNodeId: null,
  showGrid: false
});

const emit = defineEmits([
  'select-node', 
  'update:nodes', 
  'add-link', 
  'update-link',
  'delete-link',
  'save-layout'
]);

const canvasRef = ref<HTMLElement | null>(null);

// Zoom and pan state
const scale = ref(1);
const panOffset = ref({ x: 0, y: 0 });
const minScale = 0.3;
const maxScale = 2;

// Layout algorithm configuration
const currentLayout = ref<'dagre' | 'layered' | 'force' | 'grid'>('dagre');
const layoutDirection = ref<'TB' | 'LR' | 'BT' | 'RL'>('TB');
const isInitialLoad = ref(true); // Track if this is the first data load

const layoutOptions = [
  { value: 'layered', label: 'Layered', icon: '📊', description: 'Auto-arrange by service layer (recommended)' },
  { value: 'dagre', label: 'Directed', icon: '🔀', description: 'Auto-calculate optimal dependency path layout' },
  { value: 'force', label: 'Force', icon: '🧲', description: 'Physics simulation, auto-cluster related nodes' },
  { value: 'grid', label: 'Grid', icon: '⊞', description: 'Neat grid arrangement' }
];

const directionOptions = [
  { value: 'TB', label: 'Top to Bottom', icon: '↓' },
  { value: 'LR', label: 'Left to Right', icon: '→' },
  { value: 'BT', label: 'Bottom to Top', icon: '↑' },
  { value: 'RL', label: 'Right to Left', icon: '←' }
];

// Link direction options for individual link customization
// Controls arrow direction: normal (A→B) or reverse (A←B)
const linkDirectionOptions = [
  { value: 'normal', label: 'Normal (A → B)', shortLabel: 'A→B', icon: '→' },
  { value: 'reverse', label: 'Reverse (A ← B)', shortLabel: 'A←B', icon: '←' }
];

// Dependency types - dynamically loaded from API
const dependencyTypes = ref<{ value: string; label: string; icon: string; description: string; color: string; line_style: string }[]>([
  // Default fallback types
  { value: 'depends', label: 'Depends', icon: '🔗', description: 'Strong dependency, must be available', color: '#ef4444', line_style: 'solid' },
  { value: 'uses', label: 'Uses', icon: '📡', description: 'Weak dependency, can degrade', color: '#6366f1', line_style: 'dashed' },
  { value: 'sync', label: 'Sync', icon: '🔄', description: 'Data synchronization relationship', color: '#06b6d4', line_style: 'dotted' },
  { value: 'backup', label: 'Backup', icon: '💾', description: 'Backup/redundancy relationship', color: '#10b981', line_style: 'long-dash' }
]);

// Load dependency types from API
const loadDependencyTypes = async () => {
  try {
    const types = await getDependencyTypes();
    dependencyTypes.value = types.map(t => ({
      value: t.name,
      label: t.label,
      icon: t.icon,
      description: t.description || '',
      color: t.color,
      line_style: t.line_style || 'solid'
    }));
  } catch (error) {
    console.error('Failed to load dependency types:', error);
    // Keep default fallback types
  }
};

// Node helper functions
const getNodeLayer = (node: Node | undefined): string => {
  if (!node) return 'backend';
  return node.layer || node.data?.layer || 'backend';
};

const getNodeStatus = (node: Node | undefined): string => {
  if (!node) return 'unknown';
  return node.status || node.data?.status || 'unknown';
};

const getNodePort = (node: Node | undefined): number | undefined => {
  if (!node) return undefined;
  return node.port || node.data?.port;
};

const getNodeResponseTime = (node: Node | undefined): number | undefined => {
  if (!node) return undefined;
  return node.responseTime || node.data?.responseTime;
};

// Icons mapping
const getNodeIcon = (node: any) => {
  // Use custom icon from service data
  if (node?.data?.icon) return node.data.icon;
  if (node?.icon) return node.icon;
  
  // Fallback to default service icon
  return '🔧';
};

// Get actual node dimensions from DOM
const getNodeDimensions = (nodeId: string) => {
  const nodeElement = canvasRef.value?.querySelector(`[data-id="${nodeId}"]`) as HTMLElement;
  if (nodeElement) {
    return {
      width: nodeElement.offsetWidth,
      height: nodeElement.offsetHeight
    };
  }
  // Fallback to default dimensions
  return { width: 180, height: 64 };
};

// Link Path Calculation with intelligent anchor point selection
// Adaptive Rule: Adjust connection strategy based on global layout direction
// Per-link direction setting controls arrow direction (normal vs reverse)
const getLinkPath = (link: Link) => {
  const sourceNode = props.nodes.find(n => n.id === link.source);
  const targetNode = props.nodes.find(n => n.id === link.target);
  
  if (!sourceNode || !targetNode) return '';
  
  // Get actual node dimensions from DOM
  const sourceDim = getNodeDimensions(sourceNode.id);
  const targetDim = getNodeDimensions(targetNode.id);
  const nodeWidth = sourceDim.width;
  const nodeHeight = sourceDim.height;
  const targetWidth = targetDim.width;
  const targetHeight = targetDim.height;
  
  // Determine if we should reverse the path direction
  const isReversed = link.linkDirection === 'reverse';
  
  // When reversed, swap source and target for path calculation
  const effectiveSource = isReversed ? targetNode : sourceNode;
  const effectiveTarget = isReversed ? sourceNode : targetNode;
  
  // Calculate node positions
  const sourceX = effectiveSource.x || 100;
  const sourceY = effectiveSource.y || 100;
  const targetX = effectiveTarget.x || 100;
  const targetY = effectiveTarget.y || 100;
  
  // Calculate center positions
  const sourceCenterX = sourceX + nodeWidth / 2;
  const sourceCenterY = sourceY + nodeHeight / 2;
  const targetCenterX = targetX + targetWidth / 2;
  const targetCenterY = targetY + targetHeight / 2;
  
  // Calculate relative position
  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;
  const absVerticalGap = Math.abs(dy);
  const absHorizontalGap = Math.abs(dx);
  
  let startX, startY, endX, endY;
  let connectionType: 'vertical' | 'horizontal';
  
  // Anchor point selection based on GLOBAL layout direction
  const isVerticalLayout = layoutDirection.value === 'TB' || layoutDirection.value === 'BT';
  
  const alignmentThreshold = 20;
  
  if (isVerticalLayout) {
    // VERTICAL LAYOUT (TB/BT): Prefer vertical connections
    if (absVerticalGap < alignmentThreshold) {
      connectionType = 'horizontal';
      if (dx > 0) {
        startX = sourceX + nodeWidth;
        startY = sourceCenterY;
        endX = targetX;
        endY = targetCenterY;
      } else {
        startX = sourceX;
        startY = sourceCenterY;
        endX = targetX + targetWidth;
        endY = targetCenterY;
      }
    } else {
      connectionType = 'vertical';
      if (dy > 0) {
        startX = sourceCenterX;
        startY = sourceY + nodeHeight;
        endX = targetCenterX;
        endY = targetY;
      } else {
        startX = sourceCenterX;
        startY = sourceY;
        endX = targetCenterX;
        endY = targetY + targetHeight;
      }
    }
  } else {
    // HORIZONTAL LAYOUT (LR/RL): Prefer horizontal connections
    if (absHorizontalGap < alignmentThreshold) {
      connectionType = 'vertical';
      if (dy > 0) {
        startX = sourceCenterX;
        startY = sourceY + nodeHeight;
        endX = targetCenterX;
        endY = targetY;
      } else {
        startX = sourceCenterX;
        startY = sourceY;
        endX = targetCenterX;
        endY = targetY + targetHeight;
      }
    } else {
      connectionType = 'horizontal';
      if (dx > 0) {
        startX = sourceX + nodeWidth;
        startY = sourceCenterY;
        endX = targetX;
        endY = targetCenterY;
      } else {
        startX = sourceX;
        startY = sourceCenterY;
        endX = targetX + targetWidth;
        endY = targetCenterY;
      }
    }
  }
  
  // Generate smooth bezier curve
  if (connectionType === 'vertical') {
    const verticalDistance = Math.abs(endY - startY);
    const controlOffset = Math.max(verticalDistance * 0.35, 40);
    const horizontalOffset = Math.abs(endX - startX);
    const curveDir = startY < endY ? 1 : -1;
    
    if (horizontalOffset > 50) {
      const midControlOffset = controlOffset * 0.6;
      return `M ${startX} ${startY} C ${startX} ${startY + curveDir * midControlOffset}, ${endX} ${endY - curveDir * midControlOffset}, ${endX} ${endY}`;
    } else {
      return `M ${startX} ${startY} C ${startX} ${startY + curveDir * controlOffset}, ${endX} ${endY - curveDir * controlOffset}, ${endX} ${endY}`;
    }
  } else {
    const horizontalDistance = Math.abs(endX - startX);
    const controlOffset = Math.max(horizontalDistance * 0.35, 40);
    const verticalOffset = Math.abs(endY - startY);
    const curveDir = startX < endX ? 1 : -1;
    
    if (verticalOffset > 15) {
      const midControlOffset = controlOffset * 0.6;
      return `M ${startX} ${startY} C ${startX + curveDir * midControlOffset} ${startY}, ${endX - curveDir * midControlOffset} ${endY}, ${endX} ${endY}`;
    } else {
      return `M ${startX} ${startY} C ${startX + curveDir * controlOffset} ${startY}, ${endX - curveDir * controlOffset} ${endY}, ${endX} ${endY}`;
    }
  }
};

// Get link label position (midpoint of the curve)
const getLinkLabelPosition = (link: Link) => {
  const sourceNode = props.nodes.find(n => n.id === link.source);
  const targetNode = props.nodes.find(n => n.id === link.target);
  
  if (!sourceNode || !targetNode) return { x: 0, y: 0 };
  
  // Get actual node dimensions from DOM
  const sourceDim = getNodeDimensions(sourceNode.id);
  const targetDim = getNodeDimensions(targetNode.id);
  
  const sourceX = (sourceNode.x || 100) + sourceDim.width / 2;
  const sourceY = (sourceNode.y || 100) + sourceDim.height;
  const targetX = (targetNode.x || 100) + targetDim.width / 2;
  const targetY = targetNode.y || 100;
  
  return {
    x: (sourceX + targetX) / 2,
    y: (sourceY + targetY) / 2
  };
};

const getLinkTypeLabel = (type?: string): string => {
  const typeInfo = dependencyTypes.value.find(t => t.value === type);
  return typeInfo?.label || type || '';
};

// Check if link has valid source and target nodes
const isLinkValid = (link: Link): boolean => {
  const sourceNode = props.nodes.find(n => n.id === link.source);
  const targetNode = props.nodes.find(n => n.id === link.target);
  return !!(sourceNode && targetNode && sourceNode.x !== undefined && targetNode.x !== undefined);
};

// Handle mouse wheel for zoom
const handleWheel = (event: WheelEvent) => {
  const delta = event.deltaY > 0 ? -0.1 : 0.1;
  const newScale = Math.max(minScale, Math.min(maxScale, scale.value + delta));
  
  // Calculate mouse position relative to canvas
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;
  
  // Adjust pan to zoom towards mouse position
  const scaleDiff = newScale - scale.value;
  panOffset.value = {
    x: panOffset.value.x - (mouseX - panOffset.value.x) * (scaleDiff / scale.value),
    y: panOffset.value.y - (mouseY - panOffset.value.y) * (scaleDiff / scale.value)
  };
  
  scale.value = newScale;
};

// Fit view to show all nodes
const fitView = () => {
  if (props.nodes.length === 0) return;
  
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  
  // Find bounding box of all nodes
  const nodeWidth = 180;
  const nodeHeight = 64;
  const padding = 40; // 减小边距使布局更紧凑
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  props.nodes.forEach(node => {
    const x = node.x || 100;
    const y = node.y || 100;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + nodeWidth);
    maxY = Math.max(maxY, y + nodeHeight);
  });
  
  const contentWidth = maxX - minX + padding * 2;
  const contentHeight = maxY - minY + padding * 2;
  
  // Calculate scale to fit - 优化缩放范围使内容更紧凑可见
  const scaleX = rect.width / contentWidth;
  const scaleY = rect.height / contentHeight;
  // 最大缩放到 1.2，确保节点较多时仍能看到所有内容
  const newScale = Math.max(minScale, Math.min(1.2, Math.min(scaleX, scaleY)));
  
  // Calculate pan to center
  const scaledWidth = contentWidth * newScale;
  const scaledHeight = contentHeight * newScale;
  
  scale.value = newScale;
  panOffset.value = {
    x: (rect.width - scaledWidth) / 2 - (minX - padding) * newScale,
    y: (rect.height - scaledHeight) / 2 - (minY - padding) * newScale
  };
};

// Get link status based on source/target node status
const getLinkStatus = (link: Link): string => {
  const targetNode = props.nodes.find(n => n.id === link.target);
  const sourceNode = props.nodes.find(n => n.id === link.source);
  const targetStatus = getNodeStatus(targetNode as Node);
  const sourceStatus = getNodeStatus(sourceNode as Node);
  
  // Priority: down > warning > up
  if (targetStatus === 'down' || sourceStatus === 'down') return 'down';
  if (targetStatus === 'warning' || sourceStatus === 'warning') return 'warning';
  return targetStatus;
};

// Get particle animation duration based on response time
const getParticleDuration = (link: Link): string => {
  const targetNode = props.nodes.find(n => n.id === link.target);
  const responseTime = getNodeResponseTime(targetNode as Node);
  // Faster particles for faster response times
  if (responseTime && responseTime < 100) return '2s';
  if (responseTime && responseTime < 300) return '3s';
  return '4s';
};

// Dynamic link class based on status
const getLinkClass = (link: Link) => {
  const targetNode = props.nodes.find(n => n.id === link.target);
  const sourceNode = props.nodes.find(n => n.id === link.source);
  const targetStatus = getNodeStatus(targetNode as Node);
  const sourceStatus = getNodeStatus(sourceNode as Node);
  
  const classes = ['link'];
  
  // Highlight effect when node is selected
  const isHighlighted = highlightedLinks.value.has(link.id);
  const hasHighlights = highlightedLinks.value.size > 0;
  
  if (isHighlighted) {
    classes.push('link-highlighted');
  } else if (hasHighlights) {
    classes.push('link-dimmed');
  }
  
  // Status-based styling (priority)
  if (targetStatus === 'down' || sourceStatus === 'down') {
    classes.push('link-down');
  } else if (targetStatus === 'warning' || sourceStatus === 'warning') {
    classes.push('link-warning');
  } else {
    classes.push('link-normal');
  }
  
  // Dependency type styling
  if (link.dependencyType) {
    classes.push(`link-type-${link.dependencyType}`);
  }
  
  // Selected state
  if (linkContextMenu.value.link?.id === link.id) {
    classes.push('link-selected');
  }
  
  return classes.join(' ');
};

// Get dynamic line style based on dependency type
const getLinkStyle = (link: Link): Record<string, string> => {
  const typeInfo = dependencyTypes.value.find(t => t.value === link.dependencyType);
  
  // Default style for links without a matching type
  const defaultColor = '#10b981';
  const defaultLineStyle = 'solid';
  
  const color = typeInfo?.color || defaultColor;
  const lineStyle = typeInfo?.line_style || defaultLineStyle;
  
  const dashArrayMap: Record<string, string> = {
    'solid': 'none',
    'dashed': '8,4',
    'dotted': '2,4',
    'long-dash': '12,6'
  };
  
  const dashArray = dashArrayMap[lineStyle] || 'none';
  return {
    'stroke-dasharray': dashArray,
    'stroke': color
  };
};

// Get dynamic label background style based on dependency type
const getLinkLabelBgStyle = (link: Link): Record<string, string> => {
  const typeInfo = dependencyTypes.value.find(t => t.value === link.dependencyType);
  if (!typeInfo) return {};
  
  // Generate a lighter fill color from the main color
  const color = typeInfo.color;
  return {
    'stroke': color,
    'fill': `${color}20`  // 20 = 12.5% opacity in hex
  };
};

const getLinkMarker = (link: Link) => {
  const targetNode = props.nodes.find(n => n.id === link.target);
  const targetStatus = getNodeStatus(targetNode as Node);
  
  if (targetStatus === 'down') return 'url(#arrowDown)';
  if (targetStatus === 'warning') return 'url(#arrowWarning)';
  if (linkContextMenu.value.link?.id === link.id) return 'url(#arrowSelected)';
  return 'url(#arrowNormal)';
};

// Canvas Panning Logic
const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0 });

const startPan = (e: MouseEvent) => {
  // Only start panning with left mouse button
  if (e.button !== 0) return;
  
  // Don't pan if clicking on a node, link, or interactive element
  const target = e.target as HTMLElement;
  if (target.closest('.service-node') || 
      target.closest('.link-hitarea') || 
      target.closest('.context-menu') ||
      target.closest('.link-context-menu') ||
      target.closest('.link-type-selector') ||
      target.closest('.layout-toolbar') ||
      target.closest('button')) {
    return;
  }
  
  // Get canvas rect for coordinate calculation
  const canvasRect = canvasRef.value?.getBoundingClientRect();
  if (!canvasRect) return;
  
  const clientX = e.clientX - canvasRect.left;
  const clientY = e.clientY - canvasRect.top;
  
  // Convert to canvas coordinates (accounting for zoom and pan)
  const canvasX = (clientX - panOffset.value.x) / scale.value;
  const canvasY = (clientY - panOffset.value.y) / scale.value;
  
  // Check if Shift key is pressed for box selection in edit mode
  if (props.isEditMode && e.shiftKey) {
    // Start box selection
    isBoxSelecting.value = true;
    boxSelectionStart.value = { x: canvasX, y: canvasY };
    boxSelectionEnd.value = { x: canvasX, y: canvasY };
    
    window.addEventListener('mousemove', onBoxSelect);
    window.addEventListener('mouseup', stopBoxSelect);
    return;
  }
  
  // Clicking on blank canvas - clear highlights and deselect all
  selectedNodeIds.value.clear();
  highlightedLinks.value.clear();
  highlightedNodes.value.clear();
  emit('select-node', null);
  
  isPanning.value = true;
  panStart.value = {
    x: e.clientX - panOffset.value.x,
    y: e.clientY - panOffset.value.y
  };
  
  window.addEventListener('mousemove', onPan);
  window.addEventListener('mouseup', stopPan);
};

const onPan = (e: MouseEvent) => {
  if (!isPanning.value) return;
  
  panOffset.value = {
    x: e.clientX - panStart.value.x,
    y: e.clientY - panStart.value.y
  };
};

const stopPan = () => {
  isPanning.value = false;
  window.removeEventListener('mousemove', onPan);
  window.removeEventListener('mouseup', stopPan);
};

// Box Selection Logic
const onBoxSelect = (e: MouseEvent) => {
  if (!isBoxSelecting.value) return;
  
  const canvasRect = canvasRef.value?.getBoundingClientRect();
  if (!canvasRect) return;
  
  const clientX = e.clientX - canvasRect.left;
  const clientY = e.clientY - canvasRect.top;
  
  // Convert to canvas coordinates
  const canvasX = (clientX - panOffset.value.x) / scale.value;
  const canvasY = (clientY - panOffset.value.y) / scale.value;
  
  boxSelectionEnd.value = { x: canvasX, y: canvasY };
};

const stopBoxSelect = () => {
  if (!isBoxSelecting.value) return;
  
  isBoxSelecting.value = false;
  window.removeEventListener('mousemove', onBoxSelect);
  window.removeEventListener('mouseup', stopBoxSelect);
  
  // Select all nodes within the box
  const rect = boxSelectionRect.value;
  const nodeWidth = 180;
  const nodeHeight = 64;
  
  selectedNodeIds.value.clear();
  
  props.nodes.forEach(node => {
    const nodeX = node.x || 100;
    const nodeY = node.y || 100;
    
    // Check if node intersects with selection box
    const nodeRight = nodeX + nodeWidth;
    const nodeBottom = nodeY + nodeHeight;
    const boxRight = rect.x + rect.width;
    const boxBottom = rect.y + rect.height;
    
    const intersects = !(nodeRight < rect.x || 
                        nodeX > boxRight || 
                        nodeBottom < rect.y || 
                        nodeY > boxBottom);
    
    if (intersects) {
      selectedNodeIds.value.add(node.id);
    }
  });
  
  // Update highlights
  if (selectedNodeIds.value.size > 0) {
    updateHighlightsForMultiSelection();
    // Set the first selected node as primary
    const firstNode = props.nodes.find(n => selectedNodeIds.value.has(n.id));
    if (firstNode) {
      emit('select-node', firstNode);
    }
  }
};

// Select all nodes (Ctrl/Cmd + A)
const selectAllNodes = () => {
  if (!props.isEditMode) return;
  
  selectedNodeIds.value.clear();
  props.nodes.forEach(node => {
    selectedNodeIds.value.add(node.id);
  });
  
  updateHighlightsForMultiSelection();
  
  if (selectedNodeIds.value.size > 0) {
    const firstNode = props.nodes[0];
    if (firstNode) {
      emit('select-node', firstNode);
    }
  }
};

// Keyboard shortcuts
const handleKeyDown = (e: KeyboardEvent) => {
  // Ctrl/Cmd + A: Select all
  if ((e.ctrlKey || e.metaKey) && e.key === 'a' && props.isEditMode) {
    e.preventDefault();
    selectAllNodes();
  }
  
  // Escape: Clear selection
  if (e.key === 'Escape') {
    selectedNodeIds.value.clear();
    highlightedLinks.value.clear();
    highlightedNodes.value.clear();
    emit('select-node', null);
  }
};

// Dragging Logic - supports multi-node dragging
const draggingNode = ref<Node | null>(null);
const dragOffset = ref({ x: 0, y: 0 });
const dragStartPositions = ref<Map<string, { x: number, y: number }>>(new Map());

const startDragNode = (e: MouseEvent, node: Node) => {
  if (!props.isEditMode) return;
  
  draggingNode.value = node;
  dragOffset.value = {
    x: e.clientX - (node.x || 100),
    y: e.clientY - (node.y || 100)
  };
  
  // If this node is part of multi-selection, prepare to drag all selected nodes
  if (selectedNodeIds.value.has(node.id) && selectedNodeIds.value.size > 1) {
    // Store initial positions of all selected nodes
    dragStartPositions.value.clear();
    selectedNodeIds.value.forEach(nodeId => {
      const selectedNode = props.nodes.find(n => n.id === nodeId);
      if (selectedNode) {
        dragStartPositions.value.set(nodeId, {
          x: selectedNode.x || 100,
          y: selectedNode.y || 100
        });
      }
    });
  } else {
    // Single node drag
    dragStartPositions.value.clear();
  }
  
  window.addEventListener('mousemove', onDragNode);
  window.addEventListener('mouseup', stopDragNode);
};

const onDragNode = (e: MouseEvent) => {
  if (!draggingNode.value) return;
  
  // Calculate new position for the dragging node
  const newX = Math.max(-50, e.clientX - dragOffset.value.x);
  const newY = Math.max(-20, e.clientY - dragOffset.value.y);
  
  // If multi-selection, move all selected nodes together
  if (dragStartPositions.value.size > 1) {
    const deltaX = newX - (dragStartPositions.value.get(draggingNode.value.id)?.x || 0);
    const deltaY = newY - (dragStartPositions.value.get(draggingNode.value.id)?.y || 0);
    
    // Move all selected nodes by the same delta
    selectedNodeIds.value.forEach(nodeId => {
      const node = props.nodes.find(n => n.id === nodeId);
      const startPos = dragStartPositions.value.get(nodeId);
      if (node && startPos) {
        node.x = Math.max(-50, startPos.x + deltaX);
        node.y = Math.max(-20, startPos.y + deltaY);
      }
    });
  } else {
    // Single node drag
    draggingNode.value.x = newX;
    draggingNode.value.y = newY;
  }
};

const stopDragNode = () => {
  draggingNode.value = null;
  dragStartPositions.value.clear();
  window.removeEventListener('mousemove', onDragNode);
  window.removeEventListener('mouseup', stopDragNode);
  // Emit update to parent to save if needed
  emit('update:nodes', props.nodes);
};

// Link Creation Logic
const tempLink = ref<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
const sourceNodeForLink = ref<Node | null>(null);
const pendingLinkTarget = ref<string | null>(null);
const showLinkTypeSelector = ref(false);
const linkTypeSelectorPos = ref({ x: 0, y: 0 });

const startDragLink = (e: MouseEvent, node: Node, position: 'top' | 'bottom' | 'left' | 'right') => {
  if (!props.isEditMode) return;
  
  sourceNodeForLink.value = node;
  const rect = (e.target as HTMLElement).getBoundingClientRect();
  const canvasRect = canvasRef.value!.getBoundingClientRect();
  
  const startX = rect.left - canvasRect.left + rect.width / 2;
  const startY = rect.top - canvasRect.top + rect.height / 2;
  
  tempLink.value = {
    startX,
    startY,
    endX: startX,
    endY: startY
  };
  
  window.addEventListener('mousemove', onDragLink);
  window.addEventListener('mouseup', stopDragLink);
};

const onDragLink = (e: MouseEvent) => {
  if (!tempLink.value) return;
  const canvasRect = canvasRef.value!.getBoundingClientRect();
  tempLink.value.endX = e.clientX - canvasRect.left;
  tempLink.value.endY = e.clientY - canvasRect.top;
};

const stopDragLink = (e: MouseEvent) => {
  window.removeEventListener('mousemove', onDragLink);
  window.removeEventListener('mouseup', stopDragLink);
  
  // Check if dropped on a node
  const element = document.elementFromPoint(e.clientX, e.clientY);
  const nodeEl = element?.closest('.service-node') as HTMLElement;
  
  if (nodeEl && sourceNodeForLink.value) {
    const targetId = nodeEl.dataset.id;
    if (targetId && targetId !== sourceNodeForLink.value.id) {
      // Show link type selector
      pendingLinkTarget.value = targetId;
      showLinkTypeSelector.value = true;
      linkTypeSelectorPos.value = {
        x: e.clientX - canvasRef.value!.getBoundingClientRect().left,
        y: e.clientY - canvasRef.value!.getBoundingClientRect().top
      };
      // Keep tempLink visible until type is selected
      return;
    }
  }
  
  tempLink.value = null;
  sourceNodeForLink.value = null;
};

const confirmNewLink = (dependencyType: string) => {
  if (sourceNodeForLink.value && pendingLinkTarget.value) {
    emit('add-link', {
      source: sourceNodeForLink.value.id,
      target: pendingLinkTarget.value,
      dependencyType
    });
  }
  cancelNewLink();
};

const cancelNewLink = () => {
  tempLink.value = null;
  sourceNodeForLink.value = null;
  pendingLinkTarget.value = null;
  showLinkTypeSelector.value = false;
};

const getTempLinkPath = () => {
  if (!tempLink.value) return '';
  const { startX, startY, endX, endY } = tempLink.value;
  const dist = Math.abs(endY - startY);
  const controlOffset = Math.max(dist * 0.3, 30);
  return `M ${startX} ${startY} C ${startX} ${startY + controlOffset}, ${endX} ${endY - controlOffset}, ${endX} ${endY}`;
};

// Link Context Menu
const linkContextMenu = ref<{
  visible: boolean;
  x: number;
  y: number;
  link: Link | null;
}>({
  visible: false,
  x: 0,
  y: 0,
  link: null
});

// Highlight related dependencies when clicking a node
const highlightedLinks = ref<Set<string>>(new Set());
const highlightedNodes = ref<Set<string>>(new Set());

// Multi-selection support
const selectedNodeIds = ref<Set<string>>(new Set());

// Box selection state
const isBoxSelecting = ref(false);
const boxSelectionStart = ref({ x: 0, y: 0 });
const boxSelectionEnd = ref({ x: 0, y: 0 });
const boxSelectionRect = computed(() => {
  const x1 = Math.min(boxSelectionStart.value.x, boxSelectionEnd.value.x);
  const y1 = Math.min(boxSelectionStart.value.y, boxSelectionEnd.value.y);
  const x2 = Math.max(boxSelectionStart.value.x, boxSelectionEnd.value.x);
  const y2 = Math.max(boxSelectionStart.value.y, boxSelectionEnd.value.y);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
});

const onLinkClick = (e: MouseEvent, link: Link) => {
  if (!props.isEditMode) return;
  // Select the link
  linkContextMenu.value.link = link;
};

const onLinkContextMenu = (e: MouseEvent, link: Link) => {
  if (!props.isEditMode) return;
  
  const canvasRect = canvasRef.value!.getBoundingClientRect();
  linkContextMenu.value = {
    visible: true,
    x: e.clientX - canvasRect.left,
    y: e.clientY - canvasRect.top,
    link
  };
};

const updateLinkType = (type: string) => {
  if (linkContextMenu.value.link) {
    emit('update-link', {
      id: linkContextMenu.value.link.id,
      dependencyType: type
    });
    // Don't update local state here - let parent component handle it after API call succeeds
  }
  closeLinkContextMenu();
};

const updateLinkDirection = (direction: string) => {
  if (linkContextMenu.value.link) {
    emit('update-link', {
      id: linkContextMenu.value.link.id,
      linkDirection: direction
    });
    // Update local state immediately for visual feedback
    linkContextMenu.value.link.linkDirection = direction as 'normal' | 'reverse';
  }
  closeLinkContextMenu();
};

const deleteLink = () => {
  if (linkContextMenu.value.link) {
    emit('delete-link', linkContextMenu.value.link);
  }
  closeLinkContextMenu();
};

const closeLinkContextMenu = () => {
  linkContextMenu.value = {
    visible: false,
    x: 0,
    y: 0,
    link: null
  };
};

const selectNode = (node: Node, event?: MouseEvent) => {
  closeLinkContextMenu();
  
  const isMultiSelect = event && (event.ctrlKey || event.metaKey);
  
  if (isMultiSelect) {
    // Multi-select mode: toggle node selection
    if (selectedNodeIds.value.has(node.id)) {
      // Deselect this node
      selectedNodeIds.value.delete(node.id);
    } else {
      // Add to selection
      selectedNodeIds.value.add(node.id);
    }
    
    // Update highlights for all selected nodes
    updateHighlightsForMultiSelection();
    
    // If selection is empty, clear everything
    if (selectedNodeIds.value.size === 0) {
      emit('select-node', null);
    } else {
      // Keep the last selected node as primary
      emit('select-node', node);
    }
  } else {
    // Single select mode
    // Toggle: if clicking the same node (and it's the only one selected), clear
    if (selectedNodeIds.value.size === 1 && selectedNodeIds.value.has(node.id)) {
      selectedNodeIds.value.clear();
      highlightedLinks.value.clear();
      highlightedNodes.value.clear();
      emit('select-node', null);
      return;
    }
    
    // Clear previous selection and select this node
    selectedNodeIds.value.clear();
    selectedNodeIds.value.add(node.id);
    
    // Highlight related dependencies for single node
    const relatedLinks = props.links.filter(link => 
      link.source === node.id || link.target === node.id
    );
    
    highlightedLinks.value = new Set(relatedLinks.map(link => link.id));
    
    // Highlight connected nodes
    const connectedNodes = new Set<string>();
    relatedLinks.forEach(link => {
      if (link.source === node.id) connectedNodes.add(link.target);
      if (link.target === node.id) connectedNodes.add(link.source);
    });
    highlightedNodes.value = connectedNodes;
    
    emit('select-node', node);
  }
};

// Update highlights for multi-selection
const updateHighlightsForMultiSelection = () => {
  const allRelatedLinks = new Set<string>();
  const allConnectedNodes = new Set<string>();
  
  selectedNodeIds.value.forEach(nodeId => {
    const relatedLinks = props.links.filter(link => 
      link.source === nodeId || link.target === nodeId
    );
    
    relatedLinks.forEach(link => {
      allRelatedLinks.add(link.id);
      if (link.source === nodeId) allConnectedNodes.add(link.target);
      if (link.target === nodeId) allConnectedNodes.add(link.source);
    });
  });
  
  highlightedLinks.value = allRelatedLinks;
  highlightedNodes.value = allConnectedNodes;
};

// Apply layout algorithm
const applyLayout = (layoutType: 'dagre' | 'layered' | 'force' | 'grid') => {
  currentLayout.value = layoutType;
  
  // Create a copy of nodes to modify
  const updatedNodes = props.nodes.map(n => ({ ...n }));
  
  switch (layoutType) {
    case 'layered':
      applyLayeredLayoutToNodes(updatedNodes);
      break;
    case 'dagre':
      applyDagreLayoutToNodes(updatedNodes);
      break;
    case 'force':
      applyForceLayoutToNodes(updatedNodes);
      break;
    case 'grid':
      applyGridLayoutToNodes(updatedNodes);
      break;
  }
  
  emit('update:nodes', updatedNodes);
};

// Layered layout - organize by service layer (frontend, backend, database, external)
const applyLayeredLayoutToNodes = (nodes: Node[]) => {
  const layers: Record<string, Node[]> = {
    frontend: [],
    backend: [],
    database: [],
    external: []
  };
  
  nodes.forEach(node => {
    const layer = getNodeLayer(node);
    if (layers[layer]) {
      layers[layer].push(node);
    } else {
      layers.backend.push(node);
    }
  });
  
  const layerOrder = layoutDirection.value === 'TB' || layoutDirection.value === 'BT' 
    ? ['frontend', 'backend', 'database', 'external']
    : ['external', 'database', 'backend', 'frontend'];
  
  if (layoutDirection.value === 'BT' || layoutDirection.value === 'RL') {
    layerOrder.reverse();
  }
  
  const nodeWidth = 190;
  const nodeHeight = 70;
  const horizontalGap = 30; // 减小横向间距
  const verticalGap = 80;  // 减小纵向间距
  const canvasWidth = canvasRef.value?.clientWidth || 800;
  const canvasHeight = canvasRef.value?.clientHeight || 600;
  
  const isHorizontal = layoutDirection.value === 'LR' || layoutDirection.value === 'RL';
  
  if (isHorizontal) {
    let currentX = 40;
    layerOrder.forEach(layerName => {
      const nodesInLayer = layers[layerName];
      if (nodesInLayer.length === 0) return;
      
      const totalHeight = nodesInLayer.length * nodeHeight + (nodesInLayer.length - 1) * verticalGap / 2;
      let startY = Math.max(30, (canvasHeight - totalHeight) / 2);
      
      nodesInLayer.forEach((node, index) => {
        node.x = currentX;
        node.y = startY + index * (nodeHeight + verticalGap / 2);
      });
      
      currentX += nodeWidth + horizontalGap * 1.2;
    });
  } else {
    let currentY = 40;
    layerOrder.forEach(layerName => {
      const nodesInLayer = layers[layerName];
      if (nodesInLayer.length === 0) return;
      
      const totalWidth = nodesInLayer.length * nodeWidth + (nodesInLayer.length - 1) * horizontalGap;
      let startX = Math.max(30, (canvasWidth - totalWidth) / 2);
      
      nodesInLayer.forEach((node, index) => {
        node.x = startX + index * (nodeWidth + horizontalGap);
        node.y = currentY;
      });
      
      currentY += nodeHeight + verticalGap;
    });
  }
};

// Dagre-like layout - topological sort based on dependencies
const applyDagreLayoutToNodes = (nodes: Node[]) => {
  // Build adjacency list
  const inDegree: Record<string, number> = {};
  const adjList: Record<string, string[]> = {};
  
  nodes.forEach(node => {
    inDegree[node.id] = 0;
    adjList[node.id] = [];
  });
  
  props.links.forEach(link => {
    if (adjList[link.source] && inDegree[link.target] !== undefined) {
      adjList[link.source].push(link.target);
      inDegree[link.target]++;
    }
  });
  
  // Topological sort with levels
  const levels: Node[][] = [];
  const visited = new Set<string>();
  
  while (visited.size < nodes.length) {
    const currentLevel: Node[] = [];
    nodes.forEach(node => {
      if (!visited.has(node.id) && inDegree[node.id] === 0) {
        currentLevel.push(node);
        visited.add(node.id);
      }
    });
    
    if (currentLevel.length === 0) {
      // Handle cycles - add remaining nodes
      nodes.forEach(node => {
        if (!visited.has(node.id)) {
          currentLevel.push(node);
          visited.add(node.id);
        }
      });
    }
    
    levels.push(currentLevel);
    
    // Reduce in-degree for next level
    currentLevel.forEach(node => {
      adjList[node.id]?.forEach(targetId => {
        if (inDegree[targetId] !== undefined) {
          inDegree[targetId]--;
        }
      });
    });
  }
  
  // Position nodes
  const nodeWidth = 190;
  const nodeHeight = 70;
  const horizontalGap = 35; // 减小横向间距
  const verticalGap = 85;   // 减小纵向间距
  const canvasWidth = canvasRef.value?.clientWidth || 800;
  const canvasHeight = canvasRef.value?.clientHeight || 600;
  
  const isHorizontal = layoutDirection.value === 'LR' || layoutDirection.value === 'RL';
  
  if (isHorizontal) {
    const startX = layoutDirection.value === 'RL' ? canvasWidth - 240 : 40;
    const xStep = layoutDirection.value === 'RL' ? -(nodeWidth + horizontalGap) : (nodeWidth + horizontalGap);
    
    levels.forEach((level, levelIndex) => {
      const totalHeight = level.length * nodeHeight + (level.length - 1) * verticalGap / 2;
      let startY = Math.max(30, (canvasHeight - totalHeight) / 2);
      
      level.forEach((node, nodeIndex) => {
        node.x = startX + levelIndex * xStep;
        node.y = startY + nodeIndex * (nodeHeight + verticalGap / 2);
      });
    });
  } else {
    const startY = layoutDirection.value === 'BT' ? canvasHeight - 120 : 40;
    const yStep = layoutDirection.value === 'BT' ? -(nodeHeight + verticalGap) : (nodeHeight + verticalGap);
    
    levels.forEach((level, levelIndex) => {
      const totalWidth = level.length * nodeWidth + (level.length - 1) * horizontalGap;
      let startX = Math.max(30, (canvasWidth - totalWidth) / 2);
      
      level.forEach((node, nodeIndex) => {
        node.x = startX + nodeIndex * (nodeWidth + horizontalGap);
        node.y = startY + levelIndex * yStep;
      });
    });
  }
};

// Force-directed layout simulation
const applyForceLayoutToNodes = (nodes: Node[]) => {
  const canvasWidth = canvasRef.value?.clientWidth || 800;
  const canvasHeight = canvasRef.value?.clientHeight || 600;
  
  // Initialize random positions if not set
  nodes.forEach(node => {
    if (!node.x || !node.y) {
      node.x = Math.random() * (canvasWidth - 200) + 100;
      node.y = Math.random() * (canvasHeight - 100) + 50;
    }
  });
  
  const iterations = 100;
  const k = Math.sqrt((canvasWidth * canvasHeight) / nodes.length) * 0.8;
  
  for (let iter = 0; iter < iterations; iter++) {
    const temperature = 1 - iter / iterations;
    
    // Calculate repulsive forces between all nodes
    const forces: Record<string, { fx: number; fy: number }> = {};
    nodes.forEach(node => {
      forces[node.id] = { fx: 0, fy: 0 };
    });
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];
        
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        
        const repulsiveForce = (k * k) / dist;
        const fx = (dx / dist) * repulsiveForce;
        const fy = (dy / dist) * repulsiveForce;
        
        forces[nodeA.id].fx -= fx;
        forces[nodeA.id].fy -= fy;
        forces[nodeB.id].fx += fx;
        forces[nodeB.id].fy += fy;
      }
    }
    
    // Calculate attractive forces for connected nodes
    props.links.forEach(link => {
      const sourceNode = nodes.find(n => n.id === link.source);
      const targetNode = nodes.find(n => n.id === link.target);
      
      if (sourceNode && targetNode) {
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        
        const attractiveForce = (dist * dist) / k;
        const fx = (dx / dist) * attractiveForce * 0.3;
        const fy = (dy / dist) * attractiveForce * 0.3;
        
        forces[sourceNode.id].fx += fx;
        forces[sourceNode.id].fy += fy;
        forces[targetNode.id].fx -= fx;
        forces[targetNode.id].fy -= fy;
      }
    });
    
    // Apply forces with damping
    nodes.forEach(node => {
      const force = forces[node.id];
      const maxMove = 50 * temperature;
      
      node.x += Math.max(-maxMove, Math.min(maxMove, force.fx * 0.1));
      node.y += Math.max(-maxMove, Math.min(maxMove, force.fy * 0.1));
      
      // Keep within bounds
      node.x = Math.max(50, Math.min(canvasWidth - 200, node.x));
      node.y = Math.max(50, Math.min(canvasHeight - 100, node.y));
    });
  }
};

// Grid layout
const applyGridLayoutToNodes = (nodes: Node[]) => {
  const nodeWidth = 190;
  const nodeHeight = 70;
  const horizontalGap = 30; // 减小横向间距
  const verticalGap = 50;   // 减小纵向间距
  const canvasWidth = canvasRef.value?.clientWidth || 800;
  
  const nodesPerRow = Math.max(1, Math.floor((canvasWidth - 40) / (nodeWidth + horizontalGap)));
  
  nodes.forEach((node, index) => {
    const row = Math.floor(index / nodesPerRow);
    const col = index % nodesPerRow;
    
    node.x = 40 + col * (nodeWidth + horizontalGap);
    node.y = 40 + row * (nodeHeight + verticalGap);
  });
};

// Auto arrange nodes (legacy compatibility)
const autoArrangeNodes = () => {
  applyLayout(currentLayout.value);
};

// Save layout to backend
const saveCurrentLayout = () => {
  emit('save-layout');
};

// Close menus when clicking outside
const handleGlobalClick = (e: MouseEvent) => {
  if (linkContextMenu.value.visible) {
    const menuEl = document.querySelector('.link-context-menu');
    if (menuEl && !menuEl.contains(e.target as HTMLElement)) {
      closeLinkContextMenu();
    }
  }
  if (showLinkTypeSelector.value) {
    const selectorEl = document.querySelector('.link-type-selector');
    if (selectorEl && !selectorEl.contains(e.target as HTMLElement)) {
      cancelNewLink();
    }
  }
};

// Check if nodes have saved layout positions (from database)
const hasSavedLayout = (): boolean => {
  if (props.nodes.length === 0) return false;
  // Consider layout as saved if at least one node has valid x,y that's not default auto-generated
  // Default auto-generated positions are usually 100 or calculated based on index
  return props.nodes.some(node => {
    const x = node.x;
    const y = node.y;
    // Check if node has non-default position (saved positions are typically different from 100)
    // Also check if x,y values seem intentionally set (not just default fallbacks)
    return typeof x === 'number' && typeof y === 'number' && 
           (x !== 100 || y !== 100) && // Not default fallback
           !(x === 0 && y === 0); // Not uninitialized
  });
};

// Watch for nodes changes and apply default dagre layout on initial load or when nodes count changes
watch(() => props.nodes.length, (newLength, oldLength) => {
  // Apply dagre layout when:
  // 1. First load (isInitialLoad is true) AND no saved layout exists
  // 2. Node count changes (oldLength is undefined or different) AND no saved layout
  if (newLength > 0 && (isInitialLoad.value || oldLength === undefined || oldLength !== newLength)) {
    // Use nextTick to ensure DOM is ready
    nextTick(() => {
      // Only apply auto layout if nodes don't have saved positions
      if (!hasSavedLayout()) {
        applyLayout('dagre');
      }
      // Auto fit view after layout
      setTimeout(() => fitView(), 100);
      if (isInitialLoad.value) {
        isInitialLoad.value = false; // Mark as loaded
      }
    });
  }
}, { immediate: true });

onMounted(() => {
  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('keydown', handleKeyDown);
  // Load dependency types from API
  loadDependencyTypes();
});

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick);
  document.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('mousemove', onPan);
  window.removeEventListener('mouseup', stopPan);
});
</script>

<style scoped>
/* Graph Canvas */
.graph-canvas {
    position: relative;
    width: 100%;
    height: 100%;
    flex: 1;
    background: 
        linear-gradient(90deg, #f8fafc 1px, transparent 1px),
        linear-gradient(#f8fafc 1px, transparent 1px),
        #fff;
    background-size: 30px 30px;
    overflow: hidden;
    cursor: grab;
}

.graph-canvas.panning {
    cursor: grabbing;
}

.graph-canvas.edit-mode {
    cursor: default;
}

.graph-canvas.edit-mode.panning {
    cursor: grabbing;
}

/* Zoom/Pan Container */
.zoom-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 10000px;
    height: 10000px;
    transition: transform 0.1s ease-out;
    overflow: visible;
}

/* Service Node */
.service-node {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: #fff;
    border-radius: 10px;
    border: 2px solid #e4e7ec;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 6px rgba(0,0,0,0.04);
    z-index: 20;
    min-width: 180px;
    max-width: 350px;
}

.service-node:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.1);
}

.service-node.selected {
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
}

.service-node.highlighted {
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.4);
    transform: scale(1.02);
}

.service-node.dimmed {
    opacity: 0.3;
}

/* Node Layer Colors */
.layer-frontend { border-color: #3b82f6; }
.layer-backend { border-color: #10b981; }
.layer-database { border-color: #f59e0b; }
.layer-external { border-color: #8b5cf6; }

/* Node Status */
.status-down {
    background: #fef3f2;
    border-color: #f04438 !important;
}
.status-warning {
    border-color: #f79009 !important;
}
.status-unknown {
    border-color: #98a2b3;
}

/* Node Status Indicator */
.node-status-indicator {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.node-status-indicator.status-up { background: #12b76a; }
.node-status-indicator.status-warning { background: #f79009; }
.node-status-indicator.status-down { background: #f04438; animation: pulse-down 1.5s infinite; }
.node-status-indicator.status-unknown { background: #98a2b3; }

/* Multi-select badge */
.multi-select-badge {
    position: absolute;
    top: -8px;
    left: -8px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #fff;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
    z-index: 10;
}

/* Box Selection Visual */
.box-selection {
    position: absolute;
    border: 2px dashed #667eea;
    background: rgba(102, 126, 234, 0.1);
    pointer-events: none;
    z-index: 100;
    border-radius: 4px;
    box-shadow: 0 0 0 1px rgba(102, 126, 234, 0.2);
}

@keyframes pulse-down {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.8; }
}

.node-icon {
    width: 32px; height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
}

.layer-frontend .node-icon { background: #eff6ff; color: #3b82f6; }
.layer-backend .node-icon { background: #ecfdf5; color: #10b981; }
.layer-database .node-icon { background: #fffbeb; color: #f59e0b; }
.layer-external .node-icon { background: #f5f3ff; color: #8b5cf6; }

.node-info { display: flex; flex-direction: column; flex: 1; }
.node-name { font-size: 13px; font-weight: 600; color: #101828; word-break: break-word; }
.node-meta { font-size: 11px; color: #667085; display: flex; gap: 6px; flex-wrap: wrap; }

/* SVG Connections */
.connections-layer { 
    position: absolute; 
    top: 0; 
    left: 0; 
    width: 10000px; 
    height: 10000px; 
    pointer-events: none; 
    z-index: 1;
    overflow: visible;
}

/* Grid Background */
.grid-background {
    pointer-events: none;
    opacity: 0.7;
}

/* In edit mode, raise connections above nodes for easier editing */
.connections-layer.edit-mode-layer {
    z-index: 30;
}

/* Link Styles */
.link { 
    fill: none; 
    stroke-width: 2.5;
    transition: stroke 0.3s, stroke-width 0.3s;
}

.link-hitarea {
    fill: none;
    stroke: transparent;
    stroke-width: 20;
    cursor: pointer;
    pointer-events: stroke;
}

.link-hitarea:hover + .link {
    stroke-width: 3.5;
    filter: drop-shadow(0 0 4px currentColor);
}

.link-normal { 
    stroke-width: 2.5;
}

.link-warning { 
    stroke: #f79009; 
    stroke-dasharray: 8,4; 
    animation: dash-warning 1s linear infinite;
    stroke-width: 3;
    filter: drop-shadow(0 0 2px #f79009);
}

.link-down { 
    stroke: #f04438; 
    stroke-width: 3.5;
    stroke-dasharray: 6,3;
    animation: dash-down 0.5s linear infinite;
    filter: drop-shadow(0 0 3px #f04438);
}

.link-selected {
    stroke: #409EFF !important;
    stroke-width: 3 !important;
    filter: drop-shadow(0 0 4px rgba(64, 158, 255, 0.5));
}

.link-highlighted {
    stroke-width: 4 !important;
    filter: drop-shadow(0 0 8px currentColor);
    animation: highlight-pulse 1.5s ease-in-out infinite;
}

.link-dimmed {
    opacity: 0.2;
    stroke-width: 1.5 !important;
}

@keyframes highlight-pulse {
    0%, 100% { 
        stroke-width: 4;
        filter: drop-shadow(0 0 8px currentColor);
    }
    50% { 
        stroke-width: 4.5;
        filter: drop-shadow(0 0 12px currentColor);
    }
}

/* Dependency Type Styles - now dynamically applied via getLinkStyle */

.link-drag { 
    stroke: #409EFF; 
    stroke-dasharray: 6,4;
    stroke-width: 2;
    fill: none;
}

.link-label {
    font-size: 11px;
    font-weight: 600;
    fill: #1f2937;
    text-anchor: middle;
    pointer-events: none;
    text-shadow: 0 0 3px rgba(255, 255, 255, 0.8);
}

@keyframes dash-warning {
    to { stroke-dashoffset: -12; }
}

@keyframes dash-down {
    to { stroke-dashoffset: -9; }
}

/* Controls */
/* Graph controls removed */

/* Connection Handles */
.node-handle {
    position: absolute;
    width: 12px; height: 12px;
    background: #fff;
    border: 2px solid #409EFF;
    border-radius: 50%;
    z-index: 25;
    display: none;
    cursor: crosshair;
    transition: transform 0.15s, background 0.15s;
}
.node-handle:hover {
    background: #409EFF;
    transform: scale(1.2);
}
.edit-mode .node-handle { display: block; }
.handle-top { top: -6px; left: 50%; transform: translateX(-50%); }
.handle-bottom { bottom: -6px; left: 50%; transform: translateX(-50%); }
.handle-left { left: -6px; top: 50%; transform: translateY(-50%); }
.handle-right { right: -6px; top: 50%; transform: translateY(-50%); }

/* Link Context Menu */
.link-context-menu {
    position: absolute;
    background: #fff;
    border: 1px solid #e4e7ec;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    min-width: 200px;
    z-index: 100;
    overflow: hidden;
}

.context-menu-header {
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 600;
    color: #101828;
    background: #f9fafb;
    border-bottom: 1px solid #e4e7ec;
}

.context-menu-section {
    padding: 12px 16px;
}

.context-menu-label {
    font-size: 11px;
    font-weight: 500;
    color: #667085;
    text-transform: uppercase;
    margin-bottom: 8px;
}

.context-menu-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}

.type-option {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border: 1px solid #e4e7ec;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    font-size: 12px;
    color: #344054;
    transition: all 0.15s;
}
.type-option:hover {
    background: #f9fafb;
    border-color: #d0d5dd;
}
.type-option.active {
    background: #eff6ff;
    border-color: #409EFF;
    color: #409EFF;
}
.type-icon {
    font-size: 14px;
}

.context-menu-divider {
    height: 1px;
    background: #e4e7ec;
}

.context-menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    font-size: 13px;
    color: #344054;
    cursor: pointer;
    transition: background 0.15s;
}
.context-menu-item:hover {
    background: #f9fafb;
}
.context-menu-item.danger {
    color: #f04438;
}
.context-menu-item.danger:hover {
    background: #fef3f2;
}
.menu-icon {
    font-size: 14px;
}

/* Link Type Selector */
.link-type-selector {
    position: absolute;
    background: #fff;
    border: 1px solid #e4e7ec;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    min-width: 240px;
    z-index: 100;
    overflow: hidden;
}

.selector-header {
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 600;
    color: #101828;
    background: #f9fafb;
    border-bottom: 1px solid #e4e7ec;
}

.selector-options {
    padding: 8px;
}

.selector-option {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: background 0.15s;
}
.selector-option:hover {
    background: #f9fafb;
}
.option-icon {
    font-size: 18px;
    margin-top: 2px;
}
.option-info {
    display: flex;
    flex-direction: column;
}
.option-label {
    font-size: 13px;
    font-weight: 500;
    color: #101828;
}
.option-desc {
    font-size: 11px;
    color: #667085;
    margin-top: 2px;
}

.selector-cancel {
    display: block;
    width: calc(100% - 16px);
    margin: 8px;
    padding: 10px;
    border: 1px solid #e4e7ec;
    border-radius: 8px;
    background: #fff;
    color: #667085;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
}
.selector-cancel:hover {
    background: #f9fafb;
    color: #344054;
}

/* Layout Toolbar */
.layout-toolbar {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: #fff;
    padding: 8px 16px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    border: 1px solid #e4e7ec;
    display: flex;
    align-items: center;
    gap: 16px;
    z-index: 30;
}

.layout-section {
    display: flex;
    align-items: center;
    gap: 10px;
}

.toolbar-label {
    font-size: 12px;
    color: #667085;
    font-weight: 500;
}

.toolbar-divider {
    width: 1px;
    height: 28px;
    background: #e4e7ec;
}

.layout-options {
    display: flex;
    gap: 6px;
}

.layout-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid #e4e7ec;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    font-size: 12px;
    color: #344054;
    transition: all 0.15s;
}

.layout-btn:hover {
    background: #f9fafb;
    border-color: #d0d5dd;
}

.layout-btn.active {
    background: #eff6ff;
    border-color: #409EFF;
    color: #409EFF;
}

.layout-icon {
    font-size: 14px;
}

.direction-options {
    display: flex;
    gap: 4px;
}

.direction-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e4e7ec;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    font-size: 14px;
    color: #667085;
    transition: all 0.15s;
}

.direction-btn:hover {
    background: #f9fafb;
    border-color: #d0d5dd;
}

.direction-btn.active {
    background: #eff6ff;
    border-color: #409EFF;
    color: #409EFF;
}

/* Direction options in link context menu */
.direction-options-menu {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.direction-option {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border: 1px solid #e4e7ec;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    font-size: 12px;
    color: #667085;
    transition: all 0.15s;
}

.direction-option:hover {
    background: #f9fafb;
    border-color: #d0d5dd;
}

.direction-option.active {
    background: #eff6ff;
    border-color: #409EFF;
    color: #409EFF;
}

.direction-icon {
    font-size: 14px;
}

.direction-text {
    font-size: 11px;
    font-weight: 500;
}

.save-layout-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.save-layout-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

/* Link Glow Effects */
.link-glow {
    fill: none;
    stroke-width: 8;
    opacity: 0.3;
    filter: blur(4px);
}

.link-glow-warning {
    stroke: #f79009;
    animation: glow-pulse-warning 2s ease-in-out infinite;
}

.link-glow-down {
    stroke: #f04438;
    animation: glow-pulse-down 1s ease-in-out infinite;
}

@keyframes glow-pulse-warning {
    0%, 100% { opacity: 0.2; stroke-width: 6; }
    50% { opacity: 0.4; stroke-width: 10; }
}

@keyframes glow-pulse-down {
    0%, 100% { opacity: 0.3; stroke-width: 8; }
    50% { opacity: 0.5; stroke-width: 12; }
}

/* Link Label Background */
.link-label-bg {
    fill: #ffffff;
    stroke: #d1d5db;
    stroke-width: 1;
    opacity: 1;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.12));
}

/* Dependency type label backgrounds - now dynamically applied via getLinkLabelBgStyle */

/* Link Status Indicator */
.link-status-indicator {
    stroke: #fff;
    stroke-width: 2;
}

.link-status-indicator.status-warning {
    fill: #f79009;
    animation: status-pulse 1.5s ease-in-out infinite;
}

.link-status-indicator.status-down {
    fill: #f04438;
    animation: status-pulse 0.8s ease-in-out infinite;
}

@keyframes status-pulse {
    0%, 100% { r: 8; opacity: 1; }
    50% { r: 10; opacity: 0.8; }
}

.link-status-icon {
    fill: #fff;
    font-size: 10px;
    font-weight: bold;
    text-anchor: middle;
    pointer-events: none;
}

/* Link Particle */
.link-particle {
    filter: drop-shadow(0 0 2px rgba(16, 185, 129, 0.5));
}

/* Cross-project dependency indicator */
.cross-project-badge-bg {
    fill: #f79009;
    opacity: 0.9;
}

.cross-project-badge-text {
    fill: #fff;
    font-size: 10px;
    font-weight: 600;
    text-anchor: middle;
    pointer-events: none;
}

.cross-project-indicator {
    cursor: pointer;
}

/* Cross-project node styling */
.cross-project-node {
    border: 2px dashed #f79009 !important;
    background: linear-gradient(135deg, #fff9f0 0%, #fff 100%) !important;
}

.cross-project-node-badge {
    position: absolute;
    top: -10px;
    right: -10px;
    background: #f79009;
    color: white;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 8px;
    z-index: 10;
    box-shadow: 0 2px 4px rgba(247, 144, 9, 0.3);
}

/* Layer style for external (cross-project) services */
.service-node.layer-external {
    border-left: 4px solid #f79009;
}

.service-node.layer-external .node-icon {
    background: linear-gradient(135deg, #f79009, #fbbf24);
}

/* Link type styles are now dynamically applied via getLinkStyle() */
</style>
