// Enhanced authentication with database-based session management
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://172.27.128.1:8080';
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  organization_id: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  organization: {
    id: string;
    name: string;
    subdomain: string;
    branding: Record<string, any>;
    feature_flags: Record<string, any>;
  };
  sessionId?: string;
}

// Interface for session info from server
interface ServerSessionInfo {
  id: string;
  expiresAt: string;
  lastActivity: string;
}

interface MeResponse {
  user: User;
  session: ServerSessionInfo;
}

// Session monitoring variables
let sessionCheckInterval: NodeJS.Timeout | null = null;
let sessionWarningTimeout: NodeJS.Timeout | null = null;

// Clear all session timers
const clearSessionTimers = (): void => {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
  }
  if (sessionWarningTimeout) {
    clearTimeout(sessionWarningTimeout);
    sessionWarningTimeout = null;
  }
};

// Token management
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  clearSessionTimers();
};

// User management
export const getUser = (): User | null => {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
};

export const setUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  const token = getToken();
  const user = getUser();
  return !!(token && user);
};

// Validate session on page load
export const validateSession = async (): Promise<boolean> => {
  const token = getToken();
  if (!token) {
    clearAuth();
    return false;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/validate`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      clearAuth();
      return false;
    }
    
    return true;
  } catch (error) {
    clearAuth();
    return false;
  }
};

// Validate session with server
export const validateSessionWithServer = async (): Promise<{ valid: boolean; session?: ServerSessionInfo }> => {
  try {
    const response = await authenticatedFetch('/api/auth/me');
    if (response.ok) {
      const data: MeResponse = await response.json();
      return { valid: true, session: data.session };
    }
    return { valid: false };
  } catch (error) {
    console.error('Session validation error:', error);
    return { valid: false };
  }
};

// Get remaining session time from server
export const getRemainingSessionTime = async (): Promise<number> => {
  try {
    const { valid, session } = await validateSessionWithServer();
    if (valid && session) {
      const expiresAt = new Date(session.expiresAt).getTime();
      const now = Date.now();
      return Math.max(0, expiresAt - now);
    }
    return 0;
  } catch (error) {
    console.error('Error getting remaining session time:', error);
    return 0;
  }
};

// Session monitoring with server-side validation
export const startSessionMonitoring = (onSessionExpired?: () => void, onSessionWarning?: (timeLeft: number) => void): void => {
  clearSessionTimers();
  
  // Check session with server every 2 minutes
  sessionCheckInterval = setInterval(async () => {
    const { valid, session } = await validateSessionWithServer();
    
    if (!valid) {
      if (onSessionExpired) {
        onSessionExpired();
      } else {
        logout();
        window.location.reload();
      }
      return;
    }

    if (session) {
      const expiresAt = new Date(session.expiresAt).getTime();
      const now = Date.now();
      const remaining = expiresAt - now;
      const warningThreshold = 5 * 60 * 1000; // 5 minutes warning
      
      // Show warning when 5 minutes remain
      if (remaining <= warningThreshold && remaining > 0 && onSessionWarning) {
        onSessionWarning(remaining);
      }
    }
  }, 2 * 60 * 1000); // Check every 2 minutes
};

export const stopSessionMonitoring = (): void => {
  clearSessionTimers();
};

// Extend session on server
export const extendSession = async (): Promise<boolean> => {
  try {
    const response = await authenticatedFetch('/api/auth/extend-session', { method: 'POST' });
    return response.ok;
  } catch (error) {
    console.error('Failed to extend session:', error);
    return false;
  }
};

// API call with authentication
export const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = getToken();
  
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Use relative URL for development (to use Vite proxy), absolute URL for production
  const finalUrl = url.startsWith('/') ? url : `${API_BASE_URL}${url}`;

  return fetch(finalUrl, {
    ...options,
    headers: authHeaders,
    credentials: options.credentials ?? 'include',
  });
};

// Login function
export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  const data: AuthResponse = await response.json();
  
  // Store token and user data
  setToken(data.token);
  setUser(data.user);
  
  return data;
};

// Logout function
export const logout = async (): Promise<void> => {
  try {
    await authenticatedFetch('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    // Even if the API call fails, we should still clear local storage
    console.error('Logout API call failed:', error);
  } finally {
    removeToken();
  }
};

// Check if user has required role
export const hasRole = (requiredRoles: string[]): boolean => {
  const user = getUser();
  return user ? requiredRoles.includes(user.role) : false;
};

// Get user display name
export const getUserDisplayName = (): string => {
  const user = getUser();
  return user ? `${user.first_name} ${user.last_name}` : 'Unknown User';
};
