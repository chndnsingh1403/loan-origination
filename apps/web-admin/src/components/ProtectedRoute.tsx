import React, { useState, useEffect } from 'react';
import { 
  isAuthenticated, 
  startSessionMonitoring, 
  stopSessionMonitoring, 
  extendSession,
  logout,
  getRemainingSessionTime,
  validateSessionWithServer,
  getUser
} from '../utils/auth';
import { Login } from './Login';
import { SessionManager } from './SessionManager';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Validate authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      // First do a quick local check
      const hasLocalAuth = isAuthenticated();
      
      if (!hasLocalAuth) {
        setIsLoggedIn(false);
        setIsLoading(false);
        return;
      }

      // Validate with server
      try {
        const { valid } = await validateSessionWithServer();
        
        if (!valid) {
          // Clear invalid tokens
          console.log('Session invalid, logging out');
          logout();
          setIsLoggedIn(false);
        } else {
          console.log('Session valid, user authenticated');
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.error('Auth validation error:', error);
        logout();
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Listen for storage events to detect login in other tabs
    const handleStorageChange = () => {
      const hasAuth = isAuthenticated();
      if (!hasAuth) {
        setIsLoggedIn(false);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Session management
  useEffect(() => {
    if (!isLoggedIn) return;

    const handleSessionExpired = () => {
      setIsLoggedIn(false);
      setShowSessionWarning(false);
    };

    const handleSessionWarning = (remaining: number) => {
      setTimeLeft(remaining);
      setShowSessionWarning(true);
    };

    // Start session monitoring when logged in
    startSessionMonitoring(handleSessionExpired, handleSessionWarning);

    // Add activity listeners
    const handleActivity = () => {
      extendSession();
      setShowSessionWarning(false);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      stopSessionMonitoring();
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [isLoggedIn]);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleExtendSession = () => {
    extendSession();
    setShowSessionWarning(false);
  };

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
    setShowSessionWarning(false);
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
                onClick={handleLogout}
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

  return (
    <SessionManager>
      {children}
      {/* Session Warning Modal */}
      {showSessionWarning && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center mb-4">
              <div className="h-6 w-6 text-amber-500 mr-3">⚠️</div>
              <h2 className="text-lg font-semibold text-gray-900">Session Expiring</h2>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-600 mb-3">
                Your session will expire due to inactivity. Would you like to continue your session?
              </p>
              
              <div className="flex items-center justify-center bg-gray-50 rounded-lg p-4">
                <span className="text-lg font-mono font-semibold text-red-600">
                  {Math.floor(timeLeft / 60000)}:{String(Math.floor((timeLeft % 60000) / 1000)).padStart(2, '0')}
                </span>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleExtendSession}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Continue Session
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </SessionManager>
  );;
};