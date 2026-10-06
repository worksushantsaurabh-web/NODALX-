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
    /**
     * Commercial plan label, not the access entitlement. Entitlement lives in
     * `users/{uid}.tier` as 'free' | 'full' and is owned by the server.
     */
    tier: 'trial' | 'starter' | 'pro' | 'growth' | 'scale' | 'enterprise';
    status: 'trialing' | 'active' | 'legacy' | 'expired' | 'canceled' | 'past_due';
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
  /**
   * `subscription` is intentionally absent. It is billing state owned by the
   * server, and the API rejects it; the server applies a field allow-list on
   * this route. Redeeming a paid key is the only way to change entitlement.
   */
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
};
