import React, { useState, useEffect } from 'react';
import { useMatchmaking } from './useMatchmaking';
import { useDarkMode } from '../utils/useDarkMode';

const MatchmakingLandingPage = ({ onBack }) => {
  const { status, partners, matchId, joinQueue, leaveQueue } = useMatchmaking();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [queueStatus, setQueueStatus] = useState({
    queue_size: 0,
    estimated_wait_seconds: 10,
    estimated_wait_text: "10s"
  });
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [acceptTimer, setAcceptTimer] = useState(10);

  // Fetch queue status periodically
  useEffect(() => {
    const fetchQueueStatus = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/matchmaking/queue-status');
        if (response.ok) {
          const data = await response.json();
          setQueueStatus(data);
        }
      } catch (error) {
        console.error('Error fetching queue status:', error);
      }
    };

    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Show acceptance dialog when match is found
  useEffect(() => {
    if (status === 'match_found') {
      setShowAcceptDialog(true);
      setAcceptTimer(10);
    }
  }, [status]);

  // Countdown timer for acceptance
  useEffect(() => {
    if (showAcceptDialog && acceptTimer > 0) {
      const timer = setTimeout(() => {
        setAcceptTimer(acceptTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showAcceptDialog && acceptTimer === 0) {
      handleAcceptMatch();
    }
  }, [showAcceptDialog, acceptTimer]);

  const handleJoinQueue = () => {
    joinQueue();
  };

  const handleLeaveQueue = () => {
    leaveQueue();
    setShowAcceptDialog(false);
  };

  const handleAcceptMatch = () => {
    setShowAcceptDialog(false);
    // Redirect happens automatically from useMatchmaking hook
    if (matchId) {
      window.location.href = `http://localhost:8000/match/${matchId}`;
    }
  };

  const getStatusDisplay = () => {
    switch (status) {
      case 'idle':
        return {
          title: 'Ready to Match',
          description: 'Click below to enter the matchmaking queue',
          color: isDarkMode ? 'text-sky-blue' : 'text-sky-600'
        };
      case 'checking_session':
        return {
          title: 'Authenticating',
          description: 'Verifying your session...',
          color: 'text-yellow-500'
        };
      case 'connected':
        return {
          title: 'Connected',
          description: 'Joining matchmaking queue...',
          color: 'text-green-500'
        };
      case 'queued':
        return {
          title: 'In Queue',
          description: 'Searching for an opponent...',
          color: isDarkMode ? 'text-sky-blue' : 'text-sky-600'
        };
      case 'match_found':
        return {
          title: 'Match Found!',
          description: 'Preparing your match...',
          color: 'text-green-500'
        };
      case 'no_logged_session_found':
        return {
          title: 'Not Authenticated',
          description: 'Please log in to use matchmaking',
          color: 'text-red-500'
        };
      case 'error':
        return {
          title: 'Connection Error',
          description: 'Failed to connect to matchmaking service',
          color: 'text-red-500'
        };
      case 'disconnected':
        return {
          title: 'Disconnected',
          description: 'Connection to matchmaking lost',
          color: 'text-orange-500'
        };
      default:
        return {
          title: 'Ready',
          description: 'Click to start matchmaking',
          color: isDarkMode ? 'text-sky-blue' : 'text-sky-600'
        };
    }
  };

  const statusDisplay = getStatusDisplay();
  const isInQueue = status === 'queued' || status === 'connected';
  const canJoinQueue = status === 'idle' || status === 'disconnected';

  return (
    <div className={`min-h-screen relative transition-colors duration-500 ${
      isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      {/* Navigation */}
      <nav className={`shadow-lg border-b transition-colors duration-500 ${
        isDarkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={onBack}
                className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg transition-colors duration-200 text-sm sm:text-base ${
                  isDarkMode 
                    ? 'text-gray-300 hover:text-sky-blue hover:bg-gray-800' 
                    : 'text-gray-700 hover:text-sky-600 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h1 className={`text-lg sm:text-2xl font-bold transition-colors duration-500 ${
                isDarkMode ? 'text-sky-blue' : 'text-sky-600'
              }`}>LadderUp Matchmaking</h1>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative inline-flex items-center h-8 rounded-full w-16 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isDarkMode 
                  ? 'bg-sky-blue focus:ring-sky-blue' 
                  : 'bg-gray-300 focus:ring-sky-600'
              }`}
              aria-label="Toggle theme"
            >
              <span
                className={`inline-block w-6 h-6 transform transition-transform duration-300 ease-in-out rounded-full shadow-lg ${
                  isDarkMode 
                    ? 'translate-x-9 bg-gray-900' 
                    : 'translate-x-1 bg-white'
                }`}
              >
                <span className="flex items-center justify-center h-full">
                  {isDarkMode ? (
                    <svg className="w-4 h-4 text-sky-blue" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Column - Main Matchmaking Panel */}
          <div className={`rounded-xl shadow-2xl border p-8 relative overflow-hidden transition-colors duration-500 ${
            isDarkMode 
              ? 'bg-gradient-to-br from-gray-800 to-black border-gray-700' 
              : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
          }`}>
            {/* Status Indicator */}
            <div className="text-center mb-8">
              <div className={`mb-6 ${isInQueue ? 'animate-pulse' : ''}`}>
                <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center border-4 ${
                  statusDisplay.color
                } ${isDarkMode ? 'bg-gray-900 border-current' : 'bg-gray-100 border-current'}`}>
                  <div className={`w-16 h-16 rounded-full ${
                    isInQueue ? 'bg-current animate-pulse' : 'bg-current opacity-50'
                  }`}></div>
                </div>
              </div>
              <h2 className={`text-3xl font-bold mb-2 ${statusDisplay.color}`}>
                {statusDisplay.title}
              </h2>
              <p className={`text-lg transition-colors duration-500 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {statusDisplay.description}
              </p>
            </div>

            {/* Queue Information */}
            {canJoinQueue && (
              <div className={`mb-6 p-4 rounded-lg border transition-colors duration-500 ${
                isDarkMode 
                  ? 'bg-gray-900/50 border-gray-700' 
                  : 'bg-gray-100 border-gray-300'
              }`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-sm font-semibold transition-colors duration-500 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Players in Queue
                  </span>
                  <span className={`text-2xl font-bold ${
                    isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                  }`}>
                    {queueStatus.queue_size}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-sm font-semibold transition-colors duration-500 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Estimated Wait
                  </span>
                  <span className={`text-xl font-bold ${
                    isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                  }`}>
                    {queueStatus.estimated_wait_text}
                  </span>
                </div>
              </div>
            )}

            {/* Queue Progress Animation */}
            {isInQueue && (
              <div className="mb-6">
                <div className={`flex items-center justify-center space-x-2 mb-4 ${
                  isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                }`}>
                  <div className="w-3 h-3 rounded-full bg-current animate-pulse"></div>
                  <div className="w-3 h-3 rounded-full bg-current animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-3 h-3 rounded-full bg-current animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
                <p className={`text-center text-sm transition-colors duration-500 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Searching for opponent...
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-4">
              {canJoinQueue && status !== 'no_logged_session_found' && status !== 'error' && (
                <button
                  onClick={handleJoinQueue}
                  className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-sky-blue to-blue-400 text-black hover:shadow-sky-blue/50'
                      : 'bg-gradient-to-r from-sky-600 to-blue-500 text-white hover:shadow-sky-600/50'
                  }`}
                >
                  Enter Queue
                </button>
              )}

              {isInQueue && (
                <button
                  onClick={handleLeaveQueue}
                  className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition-all duration-300 border-2 ${
                    isDarkMode
                      ? 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
                      : 'border-red-600 text-red-600 hover:bg-red-600 hover:text-white'
                  }`}
                >
                  Leave Queue
                </button>
              )}

              {status === 'no_logged_session_found' && (
                <button
                  onClick={() => window.location.href = '/'}
                  className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition-all duration-300 ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-sky-blue to-blue-400 text-black'
                      : 'bg-gradient-to-r from-sky-600 to-blue-500 text-white'
                  }`}
                >
                  Go to Login
                </button>
              )}
            </div>

            {/* Tips Section */}
            <div className={`mt-8 p-4 rounded-lg border transition-colors duration-500 ${
              isDarkMode 
                ? 'bg-gray-900/30 border-gray-700' 
                : 'bg-blue-50 border-blue-200'
            }`}>
              <h3 className={`font-semibold mb-2 ${
                isDarkMode ? 'text-sky-blue' : 'text-sky-700'
              }`}>
                Quick Tips
              </h3>
              <ul className={`text-sm space-y-1 transition-colors duration-500 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-700'
              }`}>
                <li>• Stay on this page while in queue</li>
                <li>• Make sure you have a stable connection</li>
                <li>• Accept matches quickly to avoid penalties</li>
              </ul>
            </div>
          </div>

          {/* Right Column - Statistics & Info */}
          <div className="space-y-6">
            {/* Live Stats Card */}
            <div className={`rounded-xl shadow-lg border p-6 transition-colors duration-500 ${
              isDarkMode 
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' 
                : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
            }`}>
              <h3 className={`text-xl font-bold mb-4 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Live Statistics
              </h3>
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border transition-colors duration-500 ${
                  isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className={`text-sm mb-1 transition-colors duration-500 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Players in Queue
                  </div>
                  <div className={`text-3xl font-bold ${
                    isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                  }`}>
                    {queueStatus.queue_size}
                  </div>
                </div>
                <div className={`p-4 rounded-lg border transition-colors duration-500 ${
                  isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className={`text-sm mb-1 transition-colors duration-500 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Est. Wait Time
                  </div>
                  <div className={`text-3xl font-bold ${
                    isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                  }`}>
                    {queueStatus.estimated_wait_text}
                  </div>
                </div>
              </div>
            </div>

            {/* How It Works Card */}
            <div className={`rounded-xl shadow-lg border p-6 transition-colors duration-500 ${
              isDarkMode 
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' 
                : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
            }`}>
              <h3 className={`text-xl font-bold mb-4 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                How It Works
              </h3>
              <div className="space-y-3">
                {[
                  { step: 1, text: 'Click "Enter Queue" to start matchmaking' },
                  { step: 2, text: 'Wait while we find you an opponent' },
                  { step: 3, text: 'Accept the match when found' },
                  { step: 4, text: 'Practice your interview skills together!' }
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                      isDarkMode 
                        ? 'bg-sky-blue text-black' 
                        : 'bg-sky-600 text-white'
                    }`}>
                      {item.step}
                    </div>
                    <p className={`text-sm pt-1 transition-colors duration-500 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Features Card */}
            <div className={`rounded-xl shadow-lg border p-6 transition-colors duration-500 ${
              isDarkMode 
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' 
                : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
            }`}>
              <h3 className={`text-xl font-bold mb-4 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Features
              </h3>
              <div className="space-y-2">
                {[
                  'Fast matching algorithm',
                  'Skill-based pairing',
                  'Real-time communication',
                  'Track your progress'
                ].map((feature, index) => (
                  <div
                    key={index}
                    className={`text-sm transition-colors duration-500 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    • {feature}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Match Found Acceptance Modal */}
      {showAcceptDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl shadow-2xl border max-w-md w-full p-8 transform animate-scale-in ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <div className="text-center">
              <div className="mb-6">
                <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center border-4 ${
                  isDarkMode ? 'bg-green-500/20 border-green-500' : 'bg-green-100 border-green-500'
                } animate-pulse`}>
                  <div className="w-16 h-16 rounded-full bg-green-500"></div>
                </div>
              </div>
              <h2 className={`text-3xl font-bold mb-2 ${
                isDarkMode ? 'text-sky-blue' : 'text-sky-600'
              }`}>
                Match Found!
              </h2>
              <p className={`text-lg mb-6 transition-colors duration-500 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                We found you an opponent!
              </p>

              {partners.length > 0 && (
                <div className={`mb-6 p-4 rounded-lg border transition-colors duration-500 ${
                  isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                }`}>
                  <p className={`text-sm mb-2 transition-colors duration-500 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Your Opponent
                  </p>
                  <p className={`font-semibold transition-colors duration-500 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {partners[0]}
                  </p>
                </div>
              )}

              {/* Timer */}
              <div className="mb-6">
                <div className={`text-5xl font-bold mb-2 ${
                  acceptTimer <= 3 ? 'text-red-500 animate-pulse' : (isDarkMode ? 'text-sky-blue' : 'text-sky-600')
                }`}>
                  {acceptTimer}
                </div>
                <p className={`text-sm transition-colors duration-500 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Auto-accepting in {acceptTimer} seconds
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleAcceptMatch}
                  className={`w-full py-3 px-6 rounded-lg font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:shadow-green-500/50'
                      : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:shadow-green-600/50'
                  }`}
                >
                  Accept Match
                </button>
                <button
                  onClick={handleLeaveQueue}
                  className={`w-full py-3 px-6 rounded-lg font-bold text-lg transition-all duration-300 border-2 ${
                    isDarkMode
                      ? 'border-gray-600 text-gray-400 hover:bg-gray-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes scale-in {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-float {
          animation: float 10s ease-in-out infinite;
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default MatchmakingLandingPage;
