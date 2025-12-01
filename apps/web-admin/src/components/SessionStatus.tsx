import React, { useState, useEffect } from 'react';
import { getRemainingSessionTime } from '../utils/auth';

interface SessionStatusProps {
  className?: string;
}

export const SessionStatus: React.FC<SessionStatusProps> = ({ className = '' }) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateSessionStatus = async () => {
      const remaining = await getRemainingSessionTime();
      setTimeLeft(remaining);
      
      // Show indicator when less than 10 minutes remaining
      setIsVisible(remaining > 0 && remaining < 10 * 60 * 1000);
    };

    updateSessionStatus();
    const interval = setInterval(updateSessionStatus, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const getStatusColor = (ms: number): string => {
    if (ms < 2 * 60 * 1000) return 'text-red-600 bg-red-50'; // Less than 2 minutes
    if (ms < 5 * 60 * 1000) return 'text-amber-600 bg-amber-50'; // Less than 5 minutes
    return 'text-blue-600 bg-blue-50'; // More than 5 minutes
  };

  if (!isVisible || timeLeft === null || timeLeft <= 0) {
    return null;
  }

  return (
    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(timeLeft)} ${className}`}>
      <span className="w-2 h-2 bg-current rounded-full mr-1.5 animate-pulse"></span>
      Session: {formatTime(timeLeft)}
    </div>
  );
};

export default SessionStatus;