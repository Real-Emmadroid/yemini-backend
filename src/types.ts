export interface User {
  id: number;
  email: string;
  name: string | null;
  github_connected?: boolean;
  github_connected_at?: string | null;
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
    admin_emails_configured?: boolean;
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

export interface LanguageEventPayload {
  device_id: string;
  language: string;
  action?: string;
}

export interface ExtensionInstallPayload {
  device_id: string;
  extension_id: string;
  extension_name?: string;
}

export interface ExtensionIcon {
  extension_id: string;
  icon_url: string;
  updated_at?: string;
}

export interface ExtensionIconsResponse {
  success: boolean;
  storage: string;
  count: number;
  icons: ExtensionIcon[];
}

export interface AdminDashboardData {
  success: boolean;
  storage: 'neon_postgres' | 'memory_fallback';
  generated_at: string;
  totals: {
    total_users: number;
    cloud_signed_in_users: number;
    total_installs: number;
    github_connected_users: number;
    active_now: number;
    active_24h: number;
  };
  top_languages: Array<{ language: string; count: number }>;
  top_extensions: Array<{ extension_id: string; extension_name: string | null; count: number }>;
}

export interface YeminiHealthResponse {
  status: string;
  service: string;
  timestamp: string;
  configured_providers_count: number;
  providers: {
    iloveapi: boolean;
    nutrient: boolean;
    cloudconvert: boolean;
    adobe: boolean;
  };
  fallback_order: string[];
}

export interface ApiResponse<T = any> {
  success?: boolean;
  storage?: 'neon_postgres' | 'memory_fallback';
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
