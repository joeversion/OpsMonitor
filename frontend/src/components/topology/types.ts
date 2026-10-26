import type { XYPosition } from '@vue-flow/core';

export interface ServiceNodeData {
  name?: string;
  status?: string;
  enabled?: number;
  port?: number;
  responseTime?: number;
  icon?: string;
  [key: string]: unknown;
}

export interface ServiceNode {
  id: string;
  name?: string;
  x: number;
  y: number;
  status?: string;
  enabled?: number;
  port?: number;
  responseTime?: number;
  icon?: string;
  data?: ServiceNodeData;
  isCrossProjectService?: boolean;
  project_name?: string;
}

export interface ServiceLink {
  id: string;
  source: string;
  target: string;
  dependencyType?: string;
  linkDirection?: 'normal' | 'reverse';
  status?: string;
  isCrossProject?: boolean;
}

export interface CardData {
  service: ServiceNode;
  editing: boolean;
  highlighted: boolean;
  dimmed: boolean;
}

export interface Rect extends XYPosition {
  width: number;
  height: number;
}

export type LineStyle = 'bezier' | 'orthogonal';
export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';
export type LayoutKind = 'layered' | 'force' | 'box';

export interface RoutedEdge {
  points: XYPosition[];
  source: Rect;
  target: Rect;
}

export interface DependencyEdgeData {
  lineStyle: LineStyle;
  direction: LayoutDirection;
  color: string;
  dash?: string;
  label: string;
  dimmed: boolean;
  route?: RoutedEdge;
}
