import React, { useState, useEffect } from 'react';
import { isAuthenticated, getUser, logout, validateSession } from '../utils/auth';
import { Login } from './Login';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status on mount and validate with server
  useEffect(() => {
    const checkAuth = async () => {
      const authStatus = isAuthenticated();
      if (authStatus) {
        // Validate session with server
        const isValid = await validateSession();
        setIsLoggedIn(isValid);
      } else {
        setIsLoggedIn(false);
      }
      setIsLoading(false);
    };

    checkAuth();

    // Listen for storage events to detect login in other tabs
    const handleStorageChange = () => {
      checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Role-based access control
  if (allowedRoles && allowedRoles.length > 0) {
    const user = getUser();
    if (!user || !allowedRoles.includes(user.role)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">🚫</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
              <p className="text-gray-600 mb-6">
                You don't have permission to access this portal.
                {user && (
                  <span className="block mt-2 text-sm">
                    Your role: <span className="font-semibold">{user.role}</span>
                  </span>
                )}
              </p>
              <button
                onClick={() => { logout(); setIsLoggedIn(false); }}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};