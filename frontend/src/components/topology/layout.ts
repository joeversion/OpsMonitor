import ELK from 'elkjs/lib/elk-api';
import ElkWorker from 'elkjs/lib/elk-worker.min.js?worker';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { LayoutDirection, LayoutKind, Rect, RoutedEdge, ServiceLink } from './types';

export function createLayoutEngine() {
  const elk = new ELK({ workerFactory: () => new ElkWorker() });
  return {
    destroy: () => elk.terminateWorker(),
    async layout(nodes: (Rect & { id: string })[], links: ServiceLink[], kind: LayoutKind, direction: LayoutDirection) {
      const graph: ElkNode = {
        id: 'topology',
        layoutOptions: {
          'elk.algorithm': kind === 'box' ? 'rectpacking' : kind,
          'elk.direction': { TB: 'DOWN', BT: 'UP', LR: 'RIGHT', RL: 'LEFT' }[direction],
          'elk.edgeRouting': 'ORTHOGONAL',
          'elk.spacing.nodeNode': '55',
          'elk.layered.spacing.nodeNodeBetweenLayers': '100',
          'elk.padding': '[top=40,left=40,bottom=40,right=40]',
          'elk.randomSeed': '1',
        },
        children: nodes.map(node => {
          const horizontal = direction === 'LR' || direction === 'RL';
          const reversed = direction === 'RL' || direction === 'BT';
          return {
            id: node.id, width: node.width, height: node.height,
            ...(kind === 'layered' ? {
              layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
              ports: [
                { id: `${node.id}:out`, x: horizontal ? (reversed ? 0 : node.width) : node.width / 2, y: horizontal ? node.height / 2 : (reversed ? 0 : node.height) },
                { id: `${node.id}:in`, x: horizontal ? (reversed ? node.width : 0) : node.width / 2, y: horizontal ? node.height / 2 : (reversed ? node.height : 0) },
              ],
            } : {}),
          };
        }),
        edges: links.map(link => ({
          id: link.id,
          sources: [(link.linkDirection === 'reverse' ? link.target : link.source) + (kind === 'layered' ? ':out' : '')],
          targets: [(link.linkDirection === 'reverse' ? link.source : link.target) + (kind === 'layered' ? ':in' : '')],
        })),
      };
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        elk.layout(graph),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Topology layout timed out after 30 seconds')), 30_000);
        }),
      ]).finally(() => clearTimeout(timeout));
      const positions = new Map<string, Rect>();
      for (const node of result.children ?? []) {
        if (node.x == null || node.y == null || node.width == null || node.height == null) {
          throw new Error(`Incomplete ELK layout for node ${node.id}`);
        }
        positions.set(node.id, { x: node.x, y: node.y, width: node.width, height: node.height });
      }
      const routes = new Map<string, RoutedEdge>();
      const linksById = new Map(links.map(link => [link.id, link]));
      for (const edge of result.edges ?? []) {
        if (kind !== 'layered') continue;
        const section = edge.sections?.[0];
        const link = linksById.get(edge.id)!;
        const source = positions.get(link.linkDirection === 'reverse' ? link.target : link.source);
        const target = positions.get(link.linkDirection === 'reverse' ? link.source : link.target);
        if (section && source && target) routes.set(edge.id, {
          source, target, points: [section.startPoint, ...(section.bendPoints ?? []), section.endPoint],
        });
      }
      return { positions, routes };
    },
  };
}
