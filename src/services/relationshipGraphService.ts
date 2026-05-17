import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface GraphNode {
  id: string;
  name: string;
  roleType: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationType: string;
  description: string;
}

export interface RelationshipGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const relationshipGraphService = {
  async getGraph(projectId: string): Promise<ApiResponse<RelationshipGraphData>> {
    return apiClient.get(`/projects/${projectId}/relationship-graph`);
  },
};
