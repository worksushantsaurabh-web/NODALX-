import { apiRequest } from './api';

export interface Flow {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'draft';
  trigger: string;
  actions: number;
  lastRun: string;
  nextRun: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFlowData {
  name: string;
  description: string;
  trigger: string;
  status?: 'active' | 'inactive' | 'draft';
}

export interface UpdateFlowData extends Partial<CreateFlowData> {
  id: string;
}

export const flowsService = {
  async getAll(): Promise<Flow[]> {
    return apiRequest<Flow[]>('/api/flows');
  },

  async getById(id: string): Promise<Flow> {
    return apiRequest<Flow>(`/api/flows/${id}`);
  },

  async create(data: CreateFlowData): Promise<Flow> {
    return apiRequest<Flow>('/api/flows', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(data: UpdateFlowData): Promise<Flow> {
    const { id, ...updateData } = data;
    return apiRequest<Flow>(`/api/flows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },

  async delete(id: string): Promise<void> {
    return apiRequest<void>(`/api/flows/${id}`, {
      method: 'DELETE',
    });
  },

  async test(id: string, testData?: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    return apiRequest<{ success: boolean; result?: unknown; error?: string }>(`/api/flows/${id}/test`, {
      method: 'POST',
      body: JSON.stringify(testData || {}),
    });
  },
};