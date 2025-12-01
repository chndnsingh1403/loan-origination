// Authentication utilities for login/logout and token management

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://127.0.0.1:8080';
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
}

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
};

// User management
export const getUser = (): User | null => {
  const userData = localStorage.getItem(USER_KEY);
  return userData ? JSON.parse(userData) : null;
};

export const setUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

// Clear all auth data
export const clearAuth = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
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

  return fetch(`${API_BASE_URL}${url}`, {
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
