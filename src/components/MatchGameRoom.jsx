import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMatchRoom } from "./useMatchRoom";
import { useAudioCapture } from "./useAudioCapture";
import { usePracticeVideoCapture } from "./usePracticeVideoCapture";
import { useDarkMode } from "../utils/useDarkMode";

/**
 * MatchGameRoom Component
 * Displays the match room interface with:
 * - Waiting room (players ready up)
 * - Active match (question display, timer, audio recording, transcription)
 * - Match completion screen with detailed feedback
 * - Face tracking for attention scoring
 * 
 * @param {string} matchId - The match room ID
 * @param {function} onExit - Callback when exiting the match
 * @param {object} _previewState - Optional: Mock state for UI preview/testing (bypasses hooks)
 */
export default function MatchGameRoom({ matchId, onExit, _previewState }) {
  // If preview state is provided, use it instead of real hooks
  const isPreview = !!_previewState;
  
  console.log("=== MatchGameRoom MOUNTED ===");
  console.log("Match ID:", matchId);
  console.log("Preview Mode:", isPreview);
  
  // Always call hooks (React rules), but pass null matchId in preview mode
  const hookResult = useMatchRoom(isPreview ? null : matchId);
  
  // Extract values - use mock functions in preview mode
  const markReady = isPreview ? () => Promise.resolve() : hookResult.markReady;
  const disconnect = isPreview ? () => {} : hookResult.disconnect;
  const wsRef = isPreview ? { current: null } : hookResult.wsRef;
  const sendMessage = isPreview ? () => {} : hookResult.sendMessage;
  
  // Use preview state or real hook state
  const roomState = isPreview ? _previewState : hookResult.roomState;
  const [isReadying, setIsReadying] = useState(false);
  const hasAutoReadied = useRef(false);  // Track if we've auto-readied
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  
  // Initialize audio capture with WebSocket ref from useMatchRoom
  const { isRecording, audioError, toggleRecording } = useAudioCapture(wsRef);
  
  // Initialize face tracking for attention scoring
  const {
    videoRef,
    canvasRef,
    isVideoReady,
    isTracking,
    videoError,
    currentAttention,
    startVideo,
    stopVideo,
    startTracking,
    stopTracking,
    getTrackingMetrics,
    resetTracking
  } = usePracticeVideoCapture();

  // Track previous status to detect status changes
  const prevStatusRef = useRef(null);

    useEffect(() => {
    console.log("=== Room State Changed ===");
    console.log("Status:", roomState.status);
    console.log("Is Ready:", roomState.isReady);
    console.log("Question:", roomState.question);
    const autoReady = async () => {
      // Only auto-ready once, when connected and not already ready
      if (
        !hasAutoReadied.current &&
        roomState.status === "connected" &&
        !roomState.isReady
      ) {
        hasAutoReadied.current = true;
        console.log("Auto-readying player...");
        try {
          await markReady();
        } catch (error) {
          console.error("Auto-ready failed:", error);
          hasAutoReadied.current = false; // Allow retry
        }
      }
    };

    autoReady();
  }, [roomState.status, roomState.isReady, markReady]);

  // Send attention metrics to server
  const sendAttentionMetrics = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const metrics = getTrackingMetrics();
      console.log("Sending attention metrics:", metrics);
      sendMessage({
        type: "attention_metrics",
        metrics: {
          averageAttentionScore: metrics.averageAttentionScore,
          attentionPercentage: metrics.attentionPercentage,
          trackingDuration: metrics.trackingDuration
        }
      });
    }
  }, [getTrackingMetrics, sendMessage, wsRef]);

  // Start video and tracking when match becomes active
  useEffect(() => {
    if (roomState.status === "active" && prevStatusRef.current !== "active") {
      console.log("Match active - starting video tracking...");
      startVideo();
    }
    
    // When match ends, stop tracking (metrics already sent)
    if (roomState.status === "completed" && prevStatusRef.current === "active") {
      console.log("Match completed - stopping tracking...");
      stopTracking();
      stopVideo();
    }
    
    prevStatusRef.current = roomState.status;
  }, [roomState.status, startVideo, stopVideo, startTracking, stopTracking]);

  // Send attention metrics periodically during active match
  useEffect(() => {
    if (roomState.status !== "active" || !isTracking) return;
    
    // Send metrics every 5 seconds during active match
    const intervalId = setInterval(() => {
      sendAttentionMetrics();
    }, 5000);
    
    // Also send immediately when tracking starts
    const timeoutId = setTimeout(() => {
      sendAttentionMetrics();
    }, 1000);
    
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [roomState.status, isTracking, sendAttentionMetrics]);

  // Send final attention metrics when time is running low
  useEffect(() => {
    const timeRemaining = roomState.timeRemaining;
    // Send metrics at 10, 5, and 1 second marks
    if (timeRemaining === 10 || timeRemaining === 5 || timeRemaining === 1) {
      console.log(`Time warning (${timeRemaining}s) - sending attention metrics...`);
      sendAttentionMetrics();
    }
  }, [roomState.timeRemaining, sendAttentionMetrics]);

  // Start tracking once video is ready
  useEffect(() => {
    if (isVideoReady && roomState.status === "active" && !isTracking) {
      console.log("Video ready - starting face tracking...");
      startTracking();
    }
  }, [isVideoReady, roomState.status, isTracking, startTracking]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleReady = async () => {
    setIsReadying(true);
    try {
      await markReady();
    } catch (error) {
      console.error("Failed to mark ready:", error);
    } finally {
      setIsReadying(false);
    }
  };

  const handleExit = () => {
    disconnect();
    if (onExit) {
      onExit();
    } else {
      // Default: go back to profile
      window.location.href = "/profile";
    }
  };

  // Connection/Error States
  if (roomState.status === "connecting") {
    return (
      <div className={`min-h-screen w-full flex items-center justify-center transition-colors duration-500 ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-16 w-16 border-b-4 mx-auto ${
            isDarkMode ? 'border-sky-blue' : 'border-sky-600'
          }`}></div>
          <p className={`mt-4 text-lg transition-colors duration-500 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>Connecting to match room...</p>
        </div>
      </div>
    );
  }

  if (roomState.status === "error") {
    return (
      <div className={`min-h-screen w-full flex items-center justify-center transition-colors duration-500 ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className={`rounded-2xl shadow-xl p-8 max-w-md text-center transition-colors duration-500 ${
          isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
        }`}>
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
            isDarkMode ? 'bg-red-900/30' : 'bg-red-100'
          }`}>
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className={`text-2xl font-bold mb-2 transition-colors duration-500 ${
            isDarkMode ? 'text-white' : 'text-gray-800'
          }`}>
            Connection Error
          </h2>
          <p className={`mb-6 transition-colors duration-500 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {roomState.error || "Unable to connect to the match room."}
          </p>
          <button
            onClick={handleExit}
            className={`px-6 py-2 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
              isDarkMode 
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Return to Profile
          </button>
        </div>
      </div>
    );
  }

  // Waiting Room (before match starts)
  if (roomState.status === "waiting" || roomState.status === "connected") {
    return (
      <div className={`min-h-screen w-full transition-colors duration-500 ${
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
                  onClick={handleExit}
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
                }`}>Match Room</h1>
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
        <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
          <div className="text-center mb-8">
            <p className={`text-sm transition-colors duration-500 ${
              isDarkMode ? 'text-gray-500' : 'text-gray-500'
            }`}>Match ID: {matchId}</p>
          </div>

          {/* Player Status Cards */}
          <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-8">
            {/* Current Player */}
            <div className={`rounded-2xl p-4 sm:p-6 text-center transition-all duration-300 shadow-xl ${
              isDarkMode 
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700' 
                : 'bg-gradient-to-br from-white to-gray-50 border border-gray-200'
            }`}>
              <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 rounded-full flex items-center justify-center ${
                isDarkMode ? 'bg-sky-blue/20' : 'bg-sky-100'
              }`}>
                <svg className={`w-6 h-6 sm:w-8 sm:h-8 ${isDarkMode ? 'text-sky-blue' : 'text-sky-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className={`font-semibold text-base sm:text-lg mb-2 ${
                isDarkMode ? 'text-white' : 'text-gray-800'
              }`}>You</h3>
              <div className="flex items-center justify-center space-x-2">
                {roomState.isReady ? (
                  <>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className={`text-sm ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>Ready</span>
                  </>
                ) : (
                  <>
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-t-transparent animate-spin ${
                      isDarkMode ? 'border-sky-blue' : 'border-sky-600'
                    }`}></div>
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Waiting...</span>
                  </>
                )}
              </div>
            </div>

            {/* Opponent */}
            <div className={`rounded-2xl p-4 sm:p-6 text-center transition-all duration-300 shadow-xl ${
              isDarkMode 
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700' 
                : 'bg-gradient-to-br from-white to-gray-50 border border-gray-200'
            }`}>
              <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 rounded-full flex items-center justify-center ${
                isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'
              }`}>
                <svg className={`w-6 h-6 sm:w-8 sm:h-8 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className={`font-semibold text-base sm:text-lg mb-2 ${
                isDarkMode ? 'text-white' : 'text-gray-800'
              }`}>Opponent</h3>
              <div className="flex items-center justify-center space-x-2">
                {roomState.opponentReady ? (
                  <>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className={`text-sm ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>Ready</span>
                  </>
                ) : (
                  <>
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-t-transparent animate-spin ${
                      isDarkMode ? 'border-purple-400' : 'border-purple-600'
                    }`}></div>
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Waiting...</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className={`rounded-xl p-4 mb-6 border-l-4 ${
            isDarkMode 
              ? 'bg-gray-800 border-sky-blue' 
              : 'bg-white border-sky-600 shadow-md'
          }`}>
            <div className="flex items-start gap-3">
              <svg className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isDarkMode ? 'text-sky-blue' : 'text-sky-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>Instructions:</strong> Click the "Ready" button when you're
                prepared to start. The match will begin once both players are ready.
              </p>
            </div>
          </div>

          {/* Ready Button */}
          <div className="text-center mb-4">
            {!roomState.isReady ? (
              <button
                onClick={handleReady}
                disabled={isReadying}
                className={`px-8 py-4 text-lg sm:text-xl font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg ${
                  isReadying
                    ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                    : isDarkMode
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  {isReadying ? (
                    <>
                      <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin border-white"></div>
                      Marking Ready...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      I'm Ready
                    </>
                  )}
                </span>
              </button>
            ) : (
              <div className="text-center">
                <div className={`inline-block px-6 py-3 rounded-lg ${
                  isDarkMode ? 'bg-green-900/30 border border-green-700' : 'bg-green-100 border border-green-300'
                }`}>
                  <span className={`font-semibold flex items-center gap-2 ${
                    isDarkMode ? 'text-green-400' : 'text-green-800'
                  }`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    You're Ready!
                  </span>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Waiting for opponent...</p>
                </div>
              </div>
            )}
          </div>

          {/* Exit Button */}
          <div className="text-center">
            <button
              onClick={handleExit}
              className={`text-sm underline transition-colors duration-200 ${
                isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Match
  if (roomState.status === "active") {
    return (
      <div className={`min-h-screen w-full transition-colors duration-500 ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        {/* Header with Timer */}
        <nav className={`shadow-lg border-b transition-colors duration-500 sticky top-0 z-10 ${
          isDarkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between h-auto sm:h-16 py-3 sm:py-0 gap-3 sm:gap-0">
              <div className="flex items-center space-x-2 sm:space-x-4">
                <h2 className={`text-base sm:text-xl font-bold transition-colors duration-500 ${
                  isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                }`}>Interview Match</h2>
                <span className="px-2 sm:px-3 py-1 bg-green-600 rounded-full text-xs sm:text-sm font-semibold text-white">
                  LIVE
                </span>
              </div>
              
              {/* Timer */}
              <div className="text-center">
                <div className={`text-2xl sm:text-3xl font-mono font-bold tracking-wider ${
                  isDarkMode ? 'text-white' : 'text-gray-800'
                }`}>
                  {formatTime(roomState.timeRemaining)}
                </div>
                <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Time Remaining</div>
              </div>

              <button
                onClick={handleExit}
                className="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs sm:text-sm font-semibold transition text-white"
              >
                Exit Match
              </button>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
          {/* Question Section */}
          <div className={`rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-xl ${
            isDarkMode 
              ? 'bg-gradient-to-r from-sky-900 to-blue-900 border border-sky-700' 
              : 'bg-gradient-to-r from-sky-500 to-blue-600'
          }`}>
            <h3 className={`text-xs sm:text-sm font-semibold mb-2 uppercase tracking-wide ${
              isDarkMode ? 'text-sky-300' : 'text-sky-100'
            }`}>
              Interview Question
            </h3>
            <p className="text-lg sm:text-2xl font-semibold leading-relaxed text-white">
              {roomState.question?.question || roomState.question?.text || "Loading question..."}
            </p>
          </div>

          {/* Recording Controls */}
          <div className="mb-6 flex items-center justify-center space-x-4">
            <button
              onClick={toggleRecording}
              className={`px-8 py-4 rounded-full font-semibold text-lg transition transform hover:scale-105 flex items-center space-x-3 ${
                isRecording
                  ? "bg-red-600 hover:bg-red-700 animate-pulse text-white"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              {isRecording ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
              <span>{isRecording ? "Stop Recording" : "Start Recording"}</span>
            </button>
            
            {isRecording && (
              <span className="flex items-center space-x-2 text-red-400 animate-pulse">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span className="text-sm font-semibold">Recording...</span>
              </span>
            )}
          </div>

          {/* Audio Error Display */}
          {audioError && (
            <div className={`mb-6 rounded-lg p-4 ${
              isDarkMode ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'
            }`}>
              <p className={isDarkMode ? 'text-red-300' : 'text-red-600'}>
                <strong>Audio Error:</strong> {audioError}
              </p>
            </div>
          )}

          {/* Transcription Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Your Transcription */}
            <div className={`rounded-xl p-6 shadow-xl transition-colors duration-500 ${
              isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-sky-blue' : 'text-sky-600'}`}>Your Answer</h3>
                <span className="flex items-center space-x-2">
                  {isRecording && (
                    <>
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Speaking</span>
                    </>
                  )}
                </span>
              </div>
              <div className={`rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto ${
                isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
              }`}>
                <p className={`leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {roomState.playerTranscript || (
                    <span className={`italic ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Your transcription will appear here as you speak...
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Opponent's Transcription */}
            <div className={`rounded-xl p-6 shadow-xl transition-colors duration-500 ${
              isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>Opponent's Answer</h3>
                <span className="flex items-center space-x-2">
                  {roomState.opponentSpeaking && (
                    <>
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Speaking</span>
                    </>
                  )}
                </span>
              </div>
              <div className={`rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto ${
                isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
              }`}>
                <p className={`leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {roomState.opponentTranscript || (
                    <span className={`italic ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Opponent's transcription will appear here...
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Tips Section */}
          <div className={`rounded-xl p-4 mb-6 ${
            isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200 shadow-md'
          }`}>
            <h4 className={`font-semibold mb-2 flex items-center gap-2 ${
              isDarkMode ? 'text-sky-blue' : 'text-sky-600'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Tips
            </h4>
            <ul className={`text-sm space-y-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <li className="flex items-start gap-2">
                <span className={isDarkMode ? 'text-sky-blue' : 'text-sky-600'}>•</span>
                Click "Start Recording" to begin answering the question
              </li>
              <li className="flex items-start gap-2">
                <span className={isDarkMode ? 'text-sky-blue' : 'text-sky-600'}>•</span>
                Use the STAR method: Situation, Task, Action, Result
              </li>
              <li className="flex items-start gap-2">
                <span className={isDarkMode ? 'text-sky-blue' : 'text-sky-600'}>•</span>
                Keep your answer concise (aim for 1-2 minutes)
              </li>
              <li className="flex items-start gap-2">
                <span className={isDarkMode ? 'text-sky-blue' : 'text-sky-600'}>•</span>
                Speak clearly - your answer will be transcribed in real-time
              </li>
              <li className="flex items-start gap-2">
                <span className={isDarkMode ? 'text-sky-blue' : 'text-sky-600'}>•</span>
                Look at the camera - your attention score affects your grade!
              </li>
            </ul>
          </div>

          {/* Face Tracking / Attention Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Video Preview */}
            <div className={`lg:col-span-2 rounded-xl p-4 shadow-xl transition-colors duration-500 ${
              isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-lg font-semibold flex items-center gap-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  <svg className={`w-5 h-5 ${isDarkMode ? 'text-sky-blue' : 'text-sky-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Video Preview
                </h3>
                {isTracking && (
                  <span className="flex items-center space-x-2 text-green-400">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-sm">Tracking Active</span>
                  </span>
                )}
              </div>
              
              <div className={`relative rounded-lg overflow-hidden ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="hidden"
                />
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto max-h-[300px] object-contain"
                />
                
                {!isVideoReady && (
                  <div className={`absolute inset-0 flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
                    <div className="text-center">
                      <div className={`animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2 ${
                        isDarkMode ? 'border-sky-blue' : 'border-sky-600'
                      }`}></div>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Initializing camera...</p>
                    </div>
                  </div>
                )}
                
                {videoError && (
                  <div className={`absolute inset-0 flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
                    <div className="text-center p-4">
                      <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${
                        isDarkMode ? 'bg-yellow-900/30' : 'bg-yellow-100'
                      }`}>
                        <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{videoError}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Attention Metrics */}
            <div className={`rounded-xl p-4 shadow-xl transition-colors duration-500 ${
              isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                <svg className={`w-5 h-5 ${isDarkMode ? 'text-sky-blue' : 'text-sky-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Attention Score
              </h3>
              
              {/* Current Attention Score */}
              <div className="text-center mb-4">
                <div className={`text-5xl font-bold mb-1 ${
                  currentAttention.attentionScore > 70 ? 'text-green-400' :
                  currentAttention.attentionScore > 40 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {currentAttention.attentionScore.toFixed(0)}%
                </div>
                <div className={`text-sm flex items-center justify-center gap-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {currentAttention.isLookingAtCamera ? (
                    <>
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Looking at camera
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Look at camera
                    </>
                  )}
                </div>
              </div>

              {/* Attention Bar */}
              <div className="mb-4">
                <div className={`w-full h-3 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div
                    className={`h-full transition-all duration-300 ${
                      currentAttention.attentionScore > 70 ? 'bg-green-500' :
                      currentAttention.attentionScore > 40 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${currentAttention.attentionScore}%` }}
                  />
                </div>
              </div>

              {/* Gaze Direction */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Gaze Direction</span>
                  <span className={`font-mono ${isDarkMode ? 'text-sky-blue' : 'text-sky-600'}`}>{currentAttention.gazeDirection}</span>
                </div>
              </div>

              {/* Tip */}
              <div className={`mt-4 p-2 rounded-lg ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <p className={`text-xs text-center flex items-center justify-center gap-1 ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Maintaining eye contact improves your score!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Match Completed
  if (roomState.status === "completed") {
    const playerResult = roomState.playerResult;
    const opponentResult = roomState.opponentResult;
    
    // Helper function to render score with color
    const getScoreColor = (score) => {
      if (score >= 8) return isDarkMode ? "text-green-400" : "text-green-600";
      if (score >= 6) return isDarkMode ? "text-sky-blue" : "text-blue-600";
      if (score >= 4) return isDarkMode ? "text-yellow-400" : "text-yellow-600";
      return isDarkMode ? "text-red-400" : "text-red-600";
    };

    const getScoreBgColor = (score) => {
      if (isDarkMode) {
        if (score >= 8) return "bg-green-900/30 border-green-700";
        if (score >= 6) return "bg-blue-900/30 border-blue-700";
        if (score >= 4) return "bg-yellow-900/30 border-yellow-700";
        return "bg-red-900/30 border-red-700";
      }
      if (score >= 8) return "bg-green-100 border-green-300";
      if (score >= 6) return "bg-blue-100 border-blue-300";
      if (score >= 4) return "bg-yellow-100 border-yellow-300";
      return "bg-red-100 border-red-300";
    };

    // Determine winner
    const playerScore = playerResult?.score || 0;
    const opponentScore = opponentResult?.score || 0;
    const isWinner = playerScore > opponentScore;
    const isTie = playerScore === opponentScore;

    return (
      <div className={`min-h-screen w-full transition-colors duration-500 ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        {/* Navigation */}
        <nav className={`shadow-lg border-b transition-colors duration-500 ${
          isDarkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <h1 className={`text-lg sm:text-2xl font-bold transition-colors duration-500 ${
                isDarkMode ? 'text-sky-blue' : 'text-sky-600'
              }`}>Match Complete</h1>
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

        <div className="max-w-5xl mx-auto py-8 px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
              isWinner 
                ? isDarkMode ? 'bg-green-900/30' : 'bg-green-100'
                : isTie 
                  ? isDarkMode ? 'bg-sky-900/30' : 'bg-sky-100'
                  : isDarkMode ? 'bg-purple-900/30' : 'bg-purple-100'
            }`}>
              {isWinner ? (
                <svg className={`w-10 h-10 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              ) : isTie ? (
                <svg className={`w-10 h-10 ${isDarkMode ? 'text-sky-blue' : 'text-sky-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              ) : (
                <svg className={`w-10 h-10 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
            </div>
            <h2 className={`text-3xl font-bold mb-2 transition-colors duration-500 ${
              isDarkMode ? 'text-white' : 'text-gray-800'
            }`}>
              Match Complete!
            </h2>
            <p className={`transition-colors duration-500 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {isWinner 
                ? "Congratulations! You won this round!" 
                : isTie 
                ? "It's a tie! Great performance from both players!" 
                : "Good effort! Keep practicing to improve!"}
            </p>
          </div>

          {/* Score Comparison */}
          <div className={`rounded-2xl shadow-xl p-6 mb-6 transition-colors duration-500 ${
            isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
          }`}>
            <h3 className={`text-xl font-bold mb-4 text-center transition-colors duration-500 ${
              isDarkMode ? 'text-white' : 'text-gray-800'
            }`}>Score Comparison</h3>
            <div className="grid grid-cols-3 gap-4 items-center">
              {/* Your Score */}
              <div className={`text-center p-4 rounded-xl border-2 ${getScoreBgColor(playerScore)}`}>
                <div className={`text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>You</div>
                <div className={`text-4xl font-bold ${getScoreColor(playerScore)}`}>
                  {playerScore?.toFixed(1) || "N/A"}
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>out of 10</div>
              </div>

              {/* VS */}
              <div className="text-center">
                <div className={`text-2xl font-bold ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>VS</div>
              </div>

              {/* Opponent Score */}
              <div className={`text-center p-4 rounded-xl border-2 ${getScoreBgColor(opponentScore)}`}>
                <div className={`text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Opponent</div>
                <div className={`text-4xl font-bold ${getScoreColor(opponentScore)}`}>
                  {opponentScore?.toFixed(1) || "N/A"}
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>out of 10</div>
              </div>
            </div>

            {/* Attention Score Display */}
            {(playerResult?.attentionScore !== undefined || opponentResult?.attentionScore !== undefined) && (
              <div className={`mt-6 pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <h4 className={`text-sm font-semibold mb-3 text-center flex items-center justify-center gap-2 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  <svg className={`w-4 h-4 ${isDarkMode ? 'text-sky-blue' : 'text-sky-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Attention Scores
                </h4>
                <div className="grid grid-cols-3 gap-4 items-center">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${isDarkMode ? 'text-sky-blue' : 'text-indigo-600'}`}>
                      {playerResult?.attentionScore?.toFixed(0) || "N/A"}%
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Your Focus</div>
                  </div>
                  <div></div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${isDarkMode ? 'text-sky-blue' : 'text-indigo-600'}`}>
                      {opponentResult?.attentionScore?.toFixed(0) || "N/A"}%
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Opponent Focus</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Your Detailed Feedback */}
          {playerResult && playerResult.status !== "no_answer" && (
            <div className={`rounded-2xl shadow-xl p-6 mb-6 transition-colors duration-500 ${
              isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${
                isDarkMode ? 'text-sky-blue' : 'text-blue-800'
              }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Your Feedback
              </h3>
              
              {/* Overall Feedback */}
              <div className={`rounded-lg p-4 mb-4 ${
                isDarkMode ? 'bg-gray-900' : 'bg-blue-50'
              }`}>
                <p className={`leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {playerResult.feedback || "No feedback available"}
                </p>
              </div>

              {/* Strengths */}
              {playerResult.strengths && playerResult.strengths.length > 0 && (
                <div className="mb-4">
                  <h4 className={`font-semibold mb-2 flex items-center gap-2 ${
                    isDarkMode ? 'text-green-400' : 'text-green-700'
                  }`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Strengths
                  </h4>
                  <ul className="space-y-2">
                    {playerResult.strengths.map((strength, index) => (
                      <li key={index} className="flex items-start">
                        <span className={`mr-2 ${isDarkMode ? 'text-green-400' : 'text-green-500'}`}>•</span>
                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Areas for Improvement */}
              {playerResult.improvements && playerResult.improvements.length > 0 && (
                <div>
                  <h4 className={`font-semibold mb-2 flex items-center gap-2 ${
                    isDarkMode ? 'text-orange-400' : 'text-orange-700'
                  }`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Areas for Improvement
                  </h4>
                  <ul className="space-y-2">
                    {playerResult.improvements.map((improvement, index) => (
                      <li key={index} className="flex items-start">
                        <span className={`mr-2 ${isDarkMode ? 'text-orange-400' : 'text-orange-500'}`}>•</span>
                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Word Count */}
              {playerResult.word_count && (
                <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    Word count: {playerResult.word_count} words
                  </span>
                </div>
              )}
            </div>
          )}

          {/* No Answer Message */}
          {playerResult && playerResult.status === "no_answer" && (
            <div className={`rounded-2xl shadow-xl p-6 mb-6 transition-colors duration-500 ${
              isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <div className={`text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <div className={`w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                }`}>
                  <svg className={`w-8 h-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <p>No answer was recorded for your response.</p>
                <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Make sure to click "Start Recording" and speak clearly during the match.</p>
              </div>
            </div>
          )}

          {/* Final Transcripts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className={`rounded-xl shadow-lg p-4 transition-colors duration-500 ${
              isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <h3 className={`font-semibold mb-2 flex items-center gap-2 ${
                isDarkMode ? 'text-sky-blue' : 'text-blue-800'
              }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Your Answer
              </h3>
              <div className={`rounded-lg p-3 max-h-[200px] overflow-y-auto ${
                isDarkMode ? 'bg-gray-900' : 'bg-blue-50'
              }`}>
                <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {roomState.playerTranscript || "No transcription recorded"}
                </p>
              </div>
            </div>
            <div className={`rounded-xl shadow-lg p-4 transition-colors duration-500 ${
              isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <h3 className={`font-semibold mb-2 flex items-center gap-2 ${
                isDarkMode ? 'text-purple-400' : 'text-purple-800'
              }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Opponent's Answer
              </h3>
              <div className={`rounded-lg p-3 max-h-[200px] overflow-y-auto ${
                isDarkMode ? 'bg-gray-900' : 'bg-purple-50'
              }`}>
                <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {roomState.opponentTranscript || "No transcription recorded"}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={`rounded-2xl shadow-xl p-6 transition-colors duration-500 ${
            isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
          }`}>
            <div className="space-y-3">
              <button
                onClick={handleExit}
                className={`w-full px-6 py-3 rounded-lg transition font-semibold ${
                  isDarkMode 
                    ? 'bg-sky-blue text-gray-900 hover:bg-sky-400' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                Return to Profile
              </button>
              <button
                onClick={() => {
                  window.location.href = "/matchmaking";
                }}
                className={`w-full px-6 py-3 rounded-lg transition font-semibold ${
                  isDarkMode 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                Find Another Match
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Disconnected state
  if (roomState.status === "disconnected") {
    return (
      <div className={`min-h-screen w-full flex items-center justify-center transition-colors duration-500 ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className={`rounded-2xl shadow-xl p-8 max-w-md text-center transition-colors duration-500 ${
          isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
        }`}>
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
            isDarkMode ? 'bg-yellow-900/30' : 'bg-yellow-100'
          }`}>
            <svg className={`w-8 h-8 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className={`text-2xl font-bold mb-2 transition-colors duration-500 ${
            isDarkMode ? 'text-white' : 'text-gray-800'
          }`}>Disconnected</h2>
          <p className={`mb-6 transition-colors duration-500 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            You've been disconnected from the match room. Attempting to reconnect...
          </p>
          <div className={`animate-spin rounded-full h-12 w-12 border-b-4 mx-auto mb-4 ${
            isDarkMode ? 'border-sky-blue' : 'border-yellow-500'
          }`}></div>
          <button
            onClick={handleExit}
            className={`px-6 py-2 rounded-lg transition font-semibold ${
              isDarkMode 
                ? 'bg-gray-700 text-white hover:bg-gray-600' 
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
          >
            Return to Profile
          </button>
        </div>
      </div>
    );
  }

  // Default fallback
  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <p>Unknown room state: {roomState.status}</p>
    </div>
  );
}