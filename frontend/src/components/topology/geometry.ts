import { Position, type XYPosition } from '@vue-flow/core';
import type { LayoutDirection, Rect } from './types';

export function directionalHandles(source: Rect, target: Rect, direction: LayoutDirection) {
  const dx = target.x + target.width / 2 - source.x - source.width / 2;
  const dy = target.y + target.height / 2 - source.y - source.height / 2;
  const horizontal = {
    sourceX: source.x + (dx >= 0 ? source.width : 0),
    sourceY: source.y + source.height / 2,
    targetX: target.x + (dx >= 0 ? 0 : target.width),
    targetY: target.y + target.height / 2,
    sourcePosition: dx >= 0 ? Position.Right : Position.Left,
    targetPosition: dx >= 0 ? Position.Left : Position.Right,
  };
  const vertical = {
    sourceX: source.x + source.width / 2,
    sourceY: source.y + (dy >= 0 ? source.height : 0),
    targetX: target.x + target.width / 2,
    targetY: target.y + (dy >= 0 ? 0 : target.height),
    sourcePosition: dy >= 0 ? Position.Bottom : Position.Top,
    targetPosition: dy >= 0 ? Position.Top : Position.Bottom,
  };
  return direction === 'TB' || direction === 'BT'
    ? Math.abs(dy) < 20 ? horizontal : vertical
    : Math.abs(dx) < 20 ? vertical : horizontal;
}

export interface Guide {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function alignNode(moving: Rect, others: Rect[], zoom: number) {
  let bestX: { delta: number; coordinate: number; other: Rect } | undefined;
  let bestY: { delta: number; coordinate: number; other: Rect } | undefined;
  for (const other of others) {
    for (const fraction of [0, 0.5, 1]) {
      const coordinateX = other.x + other.width * fraction;
      const coordinateY = other.y + other.height * fraction;
      const deltaX = coordinateX - moving.x - moving.width * fraction;
      const deltaY = coordinateY - moving.y - moving.height * fraction;
      if (Math.abs(deltaX) * zoom <= 8 && (!bestX || Math.abs(deltaX) < Math.abs(bestX.delta))) {
        bestX = { delta: deltaX, coordinate: coordinateX, other };
      }
      if (Math.abs(deltaY) * zoom <= 8 && (!bestY || Math.abs(deltaY) < Math.abs(bestY.delta))) {
        bestY = { delta: deltaY, coordinate: coordinateY, other };
      }
    }
  }
  const guides: Guide[] = [];
  const x = moving.x + (bestX?.delta ?? 0);
  const y = moving.y + (bestY?.delta ?? 0);
  if (bestX) guides.push({
    x1: bestX.coordinate, x2: bestX.coordinate,
    y1: Math.min(y, bestX.other.y) - 24,
    y2: Math.max(y + moving.height, bestX.other.y + bestX.other.height) + 24,
  });
  if (bestY) guides.push({
    y1: bestY.coordinate, y2: bestY.coordinate,
    x1: Math.min(x, bestY.other.x) - 24,
    x2: Math.max(x + moving.width, bestY.other.x + bestY.other.width) + 24,
  });
  return { x, y, alignedX: !!bestX, alignedY: !!bestY, guides };
}

export function sameRect(a: Rect, b: Rect) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function polyline(points: XYPosition[]) {
  return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
}

export function pathMidpoint(points: XYPosition[]): XYPosition {
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index]!.x, point.y - points[index]!.y));
  let remaining = lengths.reduce((total, length) => total + length, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]!) {
      const ratio = lengths[i] ? remaining / lengths[i]! : 0;
      return { x: points[i]!.x + (points[i + 1]!.x - points[i]!.x) * ratio, y: points[i]!.y + (points[i + 1]!.y - points[i]!.y) * ratio };
    }
    remaining -= lengths[i]!;
  }
  return points[0] ?? { x: 0, y: 0 };
}
