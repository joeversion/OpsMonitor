<template>
  <BaseEdge :id="id" :path="geometry.path" :marker-end="markerEnd" :interaction-width="20"
    :label="data.label" :label-x="geometry.x" :label-y="geometry.y"
    :label-show-bg="true" :label-bg-padding="[6, 4]" :label-bg-border-radius="4"
    :label-style="{ fill: data.color, fontSize: '10px', opacity: data.dimmed ? 0.2 : 1 }"
    :label-bg-style="{ fill: '#fff', opacity: data.dimmed ? 0.2 : 1 }"
    :style="{ stroke: data.color, strokeWidth: 2, strokeDasharray: data.dash, opacity: data.dimmed ? 0.15 : 1 }" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BaseEdge, getBezierPath, getSmoothStepPath, type EdgeProps } from '@vue-flow/core';
import { directionalHandles, sameRect, polyline, pathMidpoint } from './geometry';
import type { DependencyEdgeData, Rect } from './types';

const props = defineProps<EdgeProps<DependencyEdgeData>>();
const geometry = computed(() => {
  const source: Rect = { ...props.sourceNode.computedPosition, ...props.sourceNode.dimensions };
  const target: Rect = { ...props.targetNode.computedPosition, ...props.targetNode.dimensions };
  const anchors = directionalHandles(source, target, props.data.direction);
  const route = props.data.route;
  const first = route?.points[0];
  const last = route?.points[route.points.length - 1];
  if (props.data.lineStyle === 'orthogonal' && route && sameRect(source, route.source) && sameRect(target, route.target)
    && first?.x === anchors.sourceX && first.y === anchors.sourceY
    && last?.x === anchors.targetX && last.y === anchors.targetY) {
    const middle = pathMidpoint(route.points);
    return { path: polyline(route.points), ...middle };
  }
  const [path, x, y] = props.data.lineStyle === 'bezier' ? getBezierPath(anchors) : getSmoothStepPath({ ...anchors, borderRadius: 8 });
  return { path, x, y };
});
</script>
