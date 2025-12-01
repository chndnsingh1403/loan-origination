import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, X } from 'lucide-react';
import { getRemainingSessionTime, extendSession, logout } from '../utils/auth';

interface SessionWarningModalProps {
  isOpen: boolean;
  timeLeft: number;
  onExtend: () => void;
  onLogout: () => void;
}

const SessionWarningModal: React.FC<SessionWarningModalProps> = ({
  isOpen,
  timeLeft,
  onExtend,
  onLogout
}) => {
  const [countdown, setCountdown] = useState(timeLeft);

  useEffect(() => {
    setCountdown(timeLeft);
  }, [timeLeft]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1000) {
          onLogout();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, onLogout]);

  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center mb-4">
          <AlertTriangle className="h-6 w-6 text-amber-500 mr-3" />
          <h2 className="text-lg font-semibold text-gray-900">Session Expiring</h2>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-3">
            Your session will expire due to inactivity. Would you like to continue your session?
          </p>
          
          <div className="flex items-center justify-center bg-gray-50 rounded-lg p-4">
            <Clock className="h-5 w-5 text-gray-500 mr-2" />
            <span className="text-lg font-mono font-semibold text-red-600">
              {formatTime(countdown)}
            </span>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={onExtend}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Continue Session
          </button>
          <button
            onClick={onLogout}
            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export const SessionManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    // Handle session warning
    const handleSessionWarning = (remaining: number) => {
      setTimeLeft(remaining);
      setShowWarning(true);
    };

    // Handle session expiration
    const handleSessionExpired = () => {
      setShowWarning(false);
      logout();
      window.location.reload();
    };

    // Start monitoring (this would be called in the ProtectedRoute component)
    // startSessionMonitoring(handleSessionExpired, handleSessionWarning);

    // Add activity listeners to extend session on user interaction
    const handleActivity = () => {
      extendSession();
      setShowWarning(false);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, []);

  const handleExtendSession = () => {
    extendSession();
    setShowWarning(false);
  };

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  return (
    <>
      {children}
      <SessionWarningModal
        isOpen={showWarning}
        timeLeft={timeLeft}
        onExtend={handleExtendSession}
        onLogout={handleLogout}
      />
    </>
  );
};

export default SessionManager;