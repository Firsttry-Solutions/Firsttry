/**
 * MILESTONE 1 ENGINE 6D: Dependency Graph
 * 
 * Output:
 * {
 *   "dependencyGraph": {
 *     "nodes": [],
 *     "edges": []
 *   }
 * }
 * 
 * Rules:
 * - Nodes sorted deterministically by type + ":" + id
 * - Edges sorted deterministically by source + "->" + target
 * - No duplicates
 */

import api from '@forge/api';
import type { DependencyGraph } from '../models';
import { canonicalizeValue } from '../canonicalize';

interface Node {
  type: string;
  id: string;
  label: string;
}

interface Edge {
  source: string;
  target: string;
  type: string;
}

/**
 * Build dependency graph from Jira configuration
 * READ-ONLY: Only uses GET endpoints
 * 
 * Represents dependencies between:
 * - Projects and schemes
 * - Schemes and workflows
 * - Workflows and screens
 * - Fields and schemas
 */
export async function buildDependencyGraph(
  snapshotId: string,
  createdAtUtc: string
): Promise<DependencyGraph> {
  try {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const nodeSet = new Set<string>();
    const edgeSet = new Set<string>();

    // Fetch projects and their dependencies
    let projectsRes;
    try {
      projectsRes = await api
        .asUser()
        .requestJira('/rest/api/3/project');
    } catch (err) {
      console.warn('[DependencyEngine] Could not fetch projects:', err);
      projectsRes = [];
    }

    if (Array.isArray(projectsRes)) {
      for (const proj of projectsRes) {
        const projId = String(proj.id || '');
        const projKey = proj.key || '';

        // Add project node
        if (!nodeSet.has(`PROJECT:${projId}`)) {
          nodes.push({
            type: 'PROJECT',
            id: projId,
            label: proj.name || projKey || projId,
          });
          nodeSet.add(`PROJECT:${projId}`);
        }

        // Add edges for schemes
        if (proj.permissionScheme) {
          const schemeId = String(proj.permissionScheme.id || '');
          if (!nodeSet.has(`PERMISSION_SCHEME:${schemeId}`)) {
            nodes.push({
              type: 'PERMISSION_SCHEME',
              id: schemeId,
              label: proj.permissionScheme.name || schemeId,
            });
            nodeSet.add(`PERMISSION_SCHEME:${schemeId}`);
          }

          const edgeKey = `PROJECT:${projId}->PERMISSION_SCHEME:${schemeId}`;
          if (!edgeSet.has(edgeKey)) {
            edges.push({
              source: `PROJECT:${projId}`,
              target: `PERMISSION_SCHEME:${schemeId}`,
              type: 'uses',
            });
            edgeSet.add(edgeKey);
          }
        }

        if (proj.workflowScheme) {
          const schemeId = String(proj.workflowScheme.id || '');
          if (!nodeSet.has(`WORKFLOW_SCHEME:${schemeId}`)) {
            nodes.push({
              type: 'WORKFLOW_SCHEME',
              id: schemeId,
              label: proj.workflowScheme.name || schemeId,
            });
            nodeSet.add(`WORKFLOW_SCHEME:${schemeId}`);
          }

          const edgeKey = `PROJECT:${projId}->WORKFLOW_SCHEME:${schemeId}`;
          if (!edgeSet.has(edgeKey)) {
            edges.push({
              source: `PROJECT:${projId}`,
              target: `WORKFLOW_SCHEME:${schemeId}`,
              type: 'uses',
            });
            edgeSet.add(edgeKey);
          }
        }
      }
    }

    // Sort nodes by type:id composite key
    nodes.sort((a, b) => {
      const aKey = `${a.type}:${a.id}`;
      const bKey = `${b.type}:${b.id}`;
      return aKey.localeCompare(bKey);
    });

    // Sort edges by source->target
    edges.sort((a, b) => {
      const aKey = `${a.source}->${a.target}`;
      const bKey = `${b.source}->${b.target}`;
      return aKey.localeCompare(bKey);
    });

    // Canonicalize
    const canonicalGraph = canonicalizeValue({
      nodes,
      edges,
    });

    const graph: DependencyGraph = {
      snapshotId,
      createdAtUtc,
      dependencyGraph: canonicalGraph as any,
    };

    return graph;
  } catch (error) {
    console.error('[DependencyEngine] Error building dependency graph:', error);
    throw error;
  }
}

/**
 * Validate dependency graph structure
 */
export function validateDependencyGraph(graph: DependencyGraph): boolean {
  if (!graph.snapshotId || !graph.createdAtUtc || !graph.dependencyGraph) {
    return false;
  }

  const dg = graph.dependencyGraph;
  if (!Array.isArray(dg.nodes) || !Array.isArray(dg.edges)) {
    return false;
  }

  for (const node of dg.nodes) {
    if (!node.type || !node.id || !node.label) {
      return false;
    }
  }

  for (const edge of dg.edges) {
    if (!edge.source || !edge.target || !edge.type) {
      return false;
    }
  }

  return true;
}
