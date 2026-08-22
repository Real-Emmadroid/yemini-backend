export interface DeviceRegistration {
  id: number;
  device_id: string;
  fcm_token: string;
  user_id: number | null;
  platform: string;
  app_version: string | null;
  installed_at: string;
  last_seen_at: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  database: {
    configured: boolean;
    connected: boolean;
    error?: string;
  };
  env: {
    github_configured: boolean;
    port: number;
  };
}

export interface RegisterDevicePayload {
  device_id: string;
  fcm_token: string;
  app_version?: string;
  platform?: string;
}

export interface LinkUserPayload {
  device_id: string;
  user_id: number | null;
}

export interface ExchangeTokenPayload {
  code: string;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  error?: string;
  data?: T;
  device?: DeviceRegistration;
  devices?: DeviceRegistration[];
  access_token?: string;
  token_type?: string;
  scope?: string;
}
