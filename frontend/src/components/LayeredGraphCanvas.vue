<template>
  <div class="layered-graph-canvas">
    <!-- Zone Backgrounds (Vertical) -->
    <div v-if="layout === 'zoned'" class="zone-backgrounds">
      <div 
        v-for="(zone, index) in zones" 
        :key="zone.id"
        class="zone-bg"
        :class="zone.id"
        :style="getZoneStyle(index)"
      >
        <span class="zone-label">{{ zone.label }}</span>
      </div>
    </div>

    <!-- Layer Backgrounds (Horizontal) -->
    <div v-else class="layer-backgrounds">
      <div 
        v-for="(layer, index) in layers" 
        :key="layer.id"
        class="layer-bg"
        :class="layer.id"
        :style="getLayerStyle(index)"
      >
        <span class="layer-label">{{ layer.icon }} {{ layer.label }}</span>
      </div>
    </div>
    
    <!-- Graph Container -->
    <div ref="graphContainer" class="graph-container"></div>
    
    <!-- Slot for overlays like annotations, panels -->
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { LayerConfig, ZoneConfig } from '../utils/graphUtils';

interface Props {
  layers?: LayerConfig[];
  zones?: ZoneConfig[];
  layout?: 'layered' | 'zoned';
  height?: number;
}

const props = withDefaults(defineProps<Props>(), {
  layers: () => [],
  zones: () => [],
  layout: 'layered',
  height: 550
});

const graphContainer = ref<HTMLElement | null>(null);

// Calculate layer positions (Horizontal)
const getLayerStyle = (index: number) => {
  const totalLayers = props.layers.length;
  if (totalLayers === 0) return {};
  
  const defaultHeight = 100 / totalLayers;
  
  let top = 0;
  for (let i = 0; i < index; i++) {
    const l = props.layers[i];
    if (l) {
      top += l.height || defaultHeight;
    }
  }
  
  const layer = props.layers[index];
  if (!layer) return {};
  const height = layer.height || defaultHeight;
  
  return {
    top: `${top}%`,
    height: `${height}%`,
    '--layer-color': layer.color,
    '--layer-bg': layer.bgColor
  };
};

// Calculate zone positions (Vertical)
const getZoneStyle = (index: number) => {
  const totalZones = props.zones.length;
  if (totalZones === 0) return {};

  const defaultWidth = 100 / totalZones;
  
  let left = 0;
  for (let i = 0; i < index; i++) {
    const z = props.zones[i];
    if (z) {
      left += z.width || defaultWidth;
    }
  }
  
  const zone = props.zones[index];
  if (!zone) return {};
  const width = zone.width || defaultWidth;
  
  return {
    left: `${left}%`,
    width: `${width}%`,
    backgroundColor: zone.bgColor || 'transparent'
  };
};

// Expose the container ref for parent to use with G6
defineExpose({
  graphContainer
});
</script>

<style scoped>
.layered-graph-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #fafbfc 0%, #f5f7fa 100%);
  overflow: hidden;
}

/* Zone Backgrounds */
.zone-backgrounds {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 0;
  display: flex;
}

.zone-bg {
  position: absolute;
  top: 0;
  bottom: 0;
  border-right: 1px dashed #e4e7ec;
  padding: 10px;
  display: flex;
  justify-content: center;
}

.zone-label {
  font-size: 14px;
  font-weight: 600;
  color: #667085;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 10px;
}

/* Layer Backgrounds */
.layer-backgrounds {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 0;
}

.layer-bg {
  position: absolute;
  left: 0;
  right: 0;
  border-bottom: 1px dashed #e4e7ec;
  padding: 8px 20px;
  background: var(--layer-bg);
}

.layer-bg .layer-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--layer-color);
  opacity: 0.9;
}

/* Layer specific backgrounds */
.layer-bg.frontend {
  background: rgba(59, 130, 246, 0.03);
}
.layer-bg.frontend .layer-label {
  color: #3b82f6;
}

.layer-bg.backend {
  background: rgba(16, 185, 129, 0.03);
}
.layer-bg.backend .layer-label {
  color: #10b981;
}

.layer-bg.database {
  background: rgba(245, 158, 11, 0.03);
}
.layer-bg.database .layer-label {
  color: #f59e0b;
}

.layer-bg.external {
  background: rgba(139, 92, 246, 0.03);
}
.layer-bg.external .layer-label {
  color: #8b5cf6;
}

/* Graph Container sits on top of backgrounds */
.graph-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  overflow: hidden; /* 防止 canvas 溢出 */
}

/* 确保 canvas 不会溢出并遮挡其他UI - 不强制修改尺寸，让 G6 控制 */
.layered-graph-canvas :deep(canvas) {
  /* 只限制最大尺寸，不强制修改实际尺寸 */
  max-width: 100%;
  max-height: 100%;
}
</style>
