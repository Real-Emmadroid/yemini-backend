export interface User {
  id: number;
  email: string;
  name: string | null;
  created_at: string;
  updated_at?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user: User;
  token: string;
  error?: string;
}

export interface Project {
  id: number;
  user_id: number;
  project_id: string;
  name: string;
  data: any;
  created_at: string;
  updated_at: string;
}

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
    jwt_configured?: boolean;
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
  user_id?: number | null;
}

export interface SaveProjectPayload {
  project_id: string;
  name: string;
  data?: any;
}

export interface ExchangeTokenPayload {
  code: string;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  error?: string;
  data?: T;
  user?: User;
  token?: string;
  device?: DeviceRegistration;
  devices?: DeviceRegistration[];
  project?: Project;
  projects?: Project[];
  access_token?: string;
  token_type?: string;
  scope?: string;
}
