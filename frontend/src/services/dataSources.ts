import { apiRequest } from './api';

export interface DataSource {
  id: string;
  name: string;
  connected: boolean;
  config: Record<string, unknown>;
  lastSync?: string;
  status?: 'connected' | 'disconnected' | 'error' | 'pending';
  error?: string;
}

export interface UpdateDataSourceData {
  connected?: boolean;
  config?: Record<string, unknown>;
}

export const dataSourcesService = {
  async getAll(): Promise<DataSource[]> {
    return apiRequest<DataSource[]>('/api/data-sources');
  },

  async getById(id: string): Promise<DataSource> {
    return apiRequest<DataSource>(`/api/data-sources/${id}`);
  },

  async update(id: string, data: UpdateDataSourceData): Promise<DataSource> {
    return apiRequest<DataSource>(`/api/data-sources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async testConnection(id: string): Promise<{ success: boolean; message?: string }> {
    return apiRequest<{ success: boolean; message?: string }>(`/api/data-sources/${id}/test`, {
      method: 'POST',
    });
  },

  async sync(id: string): Promise<{ success: boolean; recordsSynced?: number; error?: string }> {
    return apiRequest<{ success: boolean; recordsSynced?: number; error?: string }>(`/api/data-sources/${id}/sync`, {
      method: 'POST',
    });
  },
};