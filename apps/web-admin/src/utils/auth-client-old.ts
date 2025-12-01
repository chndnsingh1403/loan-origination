// Authentication utilities for login/logout and token management with session management

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const SESSION_KEY = 'auth_session';
const LAST_ACTIVITY_KEY = 'auth_last_activity';

// Session configuration
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiration
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // Check activity every minute

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
}

export interface SessionData {
  tokenExpiry: number;
  loginTime: number;
  lastRefresh: number;
}

// Session state
let sessionCheckInterval: NodeJS.Timeout | null = null;
let sessionWarningTimeout: NodeJS.Timeout | null = null;

// Token management
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
  updateLastActivity();
};

export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  clearSessionTimers();
};

// Session management
export const getSessionData = (): SessionData | null => {
  const sessionData = localStorage.getItem(SESSION_KEY);
  return sessionData ? JSON.parse(sessionData) : null;
};

export const setSessionData = (sessionData: SessionData): void => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
};

export const updateLastActivity = (): void => {
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
};

export const getLastActivity = (): number => {
  const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
  return lastActivity ? parseInt(lastActivity) : Date.now();
};

export const isSessionExpired = (): boolean => {
  const sessionData = getSessionData();
  if (!sessionData) return true;
  
  const now = Date.now();
  const lastActivity = getLastActivity();
  
  // Check if session has exceeded timeout due to inactivity
  if (now - lastActivity > SESSION_TIMEOUT) {
    return true;
  }
  
  // Check if token has expired
  if (now > sessionData.tokenExpiry) {
    return true;
  }
  
  return false;
};

export const isTokenNearExpiry = (): boolean => {
  const sessionData = getSessionData();
  if (!sessionData) return true;
  
  const now = Date.now();
  return (sessionData.tokenExpiry - now) < TOKEN_REFRESH_THRESHOLD;
};

export const getRemainingSessionTime = (): number => {
  const lastActivity = getLastActivity();
  const elapsed = Date.now() - lastActivity;
  return Math.max(0, SESSION_TIMEOUT - elapsed);
};

export const clearSessionTimers = (): void => {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
  }
  if (sessionWarningTimeout) {
    clearTimeout(sessionWarningTimeout);
    sessionWarningTimeout = null;
  }
};

// User management
export const getUser = (): User | null => {
  const userData = localStorage.getItem(USER_KEY);
  return userData ? JSON.parse(userData) : null;
};

export const setUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  const token = getToken();
  const user = getUser();
  
  if (!token || !user) {
    return false;
  }
  
  // Check if session has expired
  if (isSessionExpired()) {
    // Auto logout if session expired
    logout();
    return false;
  }
  
  return true;
};

// Session monitoring
export const startSessionMonitoring = (onSessionExpired?: () => void, onSessionWarning?: (timeLeft: number) => void): void => {
  clearSessionTimers();
  
  // Monitor session activity every minute
  sessionCheckInterval = setInterval(() => {
    if (isSessionExpired()) {
      if (onSessionExpired) {
        onSessionExpired();
      } else {
        logout();
        window.location.reload();
      }
      return;
    }
    
    const remaining = getRemainingSessionTime();
    const warningThreshold = 5 * 60 * 1000; // 5 minutes warning
    
    // Show warning when 5 minutes remain
    if (remaining <= warningThreshold && remaining > 0 && onSessionWarning) {
      onSessionWarning(remaining);
    }
    
    // Auto-refresh token if near expiry
    if (isTokenNearExpiry()) {
      refreshToken().catch(console.error);
    }
  }, ACTIVITY_CHECK_INTERVAL);
};

export const stopSessionMonitoring = (): void => {
  clearSessionTimers();
};

export const extendSession = (): void => {
  updateLastActivity();
  
  // Reset any warning timeouts
  if (sessionWarningTimeout) {
    clearTimeout(sessionWarningTimeout);
    sessionWarningTimeout = null;
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

  // Update activity on API calls
  updateLastActivity();

  return fetch(finalUrl, {
    ...options,
    headers: authHeaders,
  });
};

// Token refresh functionality
export const refreshToken = async (): Promise<boolean> => {
  try {
    const currentToken = getToken();
    if (!currentToken) {
      return false;
    }

    // Note: This is a simplified token refresh. In a real app, you'd have a refresh token
    // For now, we'll extend the session by updating the session data
    const sessionData = getSessionData();
    if (sessionData) {
      const newSessionData: SessionData = {
        ...sessionData,
        tokenExpiry: Date.now() + (60 * 60 * 1000), // Extend by 1 hour
        lastRefresh: Date.now()
      };
      setSessionData(newSessionData);
      updateLastActivity();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
};

// Login function
export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
  
  // Initialize session data
  const now = Date.now();
  const sessionData: SessionData = {
    tokenExpiry: now + (60 * 60 * 1000), // 1 hour from now
    loginTime: now,
    lastRefresh: now
  };
  setSessionData(sessionData);
  updateLastActivity();
  
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