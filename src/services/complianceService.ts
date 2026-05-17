import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface ComplianceRule {
  id: string;
  projectId: string;
  name: string;
  category: string;
  pattern: string;
  severity: string;
  replacement: string;
  enabled: boolean;
  platform: string;
}

export interface ComplianceReport {
  id: string;
  projectId: string;
  chapterId: string | null;
  platform: string;
  totalIssues: number;
  severityBreakdown: Record<string, number>;
  issues: ComplianceIssueItem[];
  status: string;
  createdAt: string;
}

export interface ComplianceIssueItem {
  ruleId: string;
  ruleName: string;
  category: string;
  severity: string;
  matched: string;
  position: number;
  suggestion: string;
}

export const complianceService = {
  getRules: (projectId: string) => apiClient.get<ComplianceRule[]>(`/projects/${projectId}/compliance/rules`),
  createRule: (projectId: string, data: Partial<ComplianceRule>) => apiClient.post(`/projects/${projectId}/compliance/rules`, data),
  updateRule: (projectId: string, ruleId: string, data: Partial<ComplianceRule>) => apiClient.patch(`/projects/${projectId}/compliance/rules/${ruleId}`, data),
  deleteRule: (projectId: string, ruleId: string) => apiClient.delete(`/projects/${projectId}/compliance/rules/${ruleId}`),
  check: (projectId: string, data: { chapterIds?: string[]; platform?: string }): Promise<ApiResponse<ComplianceReport>> => apiClient.post(`/projects/${projectId}/compliance/check`, data),
  getReports: (projectId: string) => apiClient.get<ComplianceReport[]>(`/projects/${projectId}/compliance/reports`),
  updateReportStatus: (projectId: string, reportId: string, status: string) => apiClient.patch(`/projects/${projectId}/compliance/reports/${reportId}`, { status }),
};
