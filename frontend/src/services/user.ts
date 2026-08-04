import { apiRequest } from './api';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  workspace: string;
  role: string;
  timezone: string;
  notifications: {
    flowFailure: boolean;
    weeklySummary: boolean;
    securityAlerts: boolean;
  };
  subscription: {
    tier: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'canceled' | 'past_due';
    executionsUsed: number;
    executionsLimit: number;
    nextInvoiceDate: string;
  };
  apiKeys: Array<{
    id: string;
    name: string;
    key: string;
    masked: string;
    created: string;
  }>;
}

export interface UpdateProfileData {
  displayName?: string;
  workspace?: string;
  role?: string;
  timezone?: string;
  notifications?: Partial<UserProfile['notifications']>;
  subscription?: Partial<UserProfile['subscription']>;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  masked: string;
  created: string;
}

export const userService = {
  async getProfile(): Promise<UserProfile> {
    return apiRequest<UserProfile>('/api/user/profile');
  },

  async updateProfile(data: UpdateProfileData): Promise<UserProfile> {
    return apiRequest<UserProfile>('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async createApiKey(name: string): Promise<ApiKey> {
    return apiRequest<ApiKey>('/api/user/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async revokeApiKey(keyId: string): Promise<void> {
    return apiRequest<void>(`/api/user/api-keys/${keyId}`, {
      method: 'DELETE',
    });
  },

  async updateSubscription(tier: UserProfile['subscription']['tier']): Promise<UserProfile['subscription']> {
    return apiRequest<UserProfile['subscription']>('/api/user/subscription', {
      method: 'PUT',
      body: JSON.stringify({ tier }),
    });
  },
};