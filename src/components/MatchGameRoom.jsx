import React, { useState, useEffect, useRef } from "react";
import { useMatchRoom } from "./useMatchRoom";
import { useAudioCapture } from "./useAudioCapture";
import { usePracticeVideoCapture } from "./usePracticeVideoCapture";

/**
 * MatchGameRoom Component
 * Displays the match room interface with:
 * - Waiting room (players ready up)
 * - Active match (question display, timer, audio recording, transcription)
 * - Match completion screen with detailed feedback
 * - Face tracking for attention scoring
 */
export default function MatchGameRoom({ matchId, onExit }) {
    console.log("=== MatchGameRoom MOUNTED ===");
  console.log("Match ID:", matchId);
  const { roomState, markReady, disconnect, wsRef, sendMessage } = useMatchRoom(matchId);
  const [isReadying, setIsReadying] = useState(false);
  const hasAutoReadied = useRef(false);  // Track if we've auto-readied
  const [videoEnabled, setVideoEnabled] = useState(false);
  
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

  // Start video and tracking when match becomes active
  useEffect(() => {
    if (roomState.status === "active" && prevStatusRef.current !== "active") {
      console.log("Match active - starting video tracking...");
      startVideo();
    }
    
    // When match ends, send attention metrics and stop tracking
    if (roomState.status === "completed" && prevStatusRef.current === "active") {
      console.log("Match completed - sending attention metrics...");
      const metrics = getTrackingMetrics();
      console.log("Attention metrics:", metrics);
      
      // Send attention data to server
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        sendMessage({
          type: "attention_metrics",
          metrics: {
            averageAttentionScore: metrics.averageAttentionScore,
            attentionPercentage: metrics.attentionPercentage,
            trackingDuration: metrics.trackingDuration
          }
        });
      }
      
      stopTracking();
      stopVideo();
    }
    
    prevStatusRef.current = roomState.status;
  }, [roomState.status, startVideo, stopVideo, startTracking, stopTracking, getTrackingMetrics, sendMessage, wsRef]);

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
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-700">Connecting to match room...</p>
        </div>
      </div>
    );
  }

  if (roomState.status === "error") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Connection Error
          </h2>
          <p className="text-gray-600 mb-6">
            {roomState.error || "Unable to connect to the match room."}
          </p>
          <button
            onClick={handleExit}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
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
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full mx-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Match Room
            </h1>
            <p className="text-gray-600">Match ID: {matchId}</p>
          </div>

          {/* Player Status Cards */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Current Player */}
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-6 text-white text-center">
              <div className="text-4xl mb-3">👤</div>
              <h3 className="font-semibold text-lg mb-2">You</h3>
              <div className="flex items-center justify-center space-x-2">
                {roomState.isReady ? (
                  <>
                    <span className="text-green-300">✓</span>
                    <span className="text-sm">Ready</span>
                  </>
                ) : (
                  <>
                    <span className="animate-pulse">⏳</span>
                    <span className="text-sm">Waiting...</span>
                  </>
                )}
              </div>
            </div>

            {/* Opponent */}
            <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-6 text-white text-center">
              <div className="text-4xl mb-3">👤</div>
              <h3 className="font-semibold text-lg mb-2">Opponent</h3>
              <div className="flex items-center justify-center space-x-2">
                {roomState.opponentReady ? (
                  <>
                    <span className="text-green-300">✓</span>
                    <span className="text-sm">Ready</span>
                  </>
                ) : (
                  <>
                    <span className="animate-pulse">⏳</span>
                    <span className="text-sm">Waiting...</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
            <p className="text-sm text-gray-700">
              <strong>Instructions:</strong> Click the "Ready" button when you're
              prepared to start. The match will begin once both players are ready.
            </p>
          </div>

          {/* Ready Button */}
          <div className="text-center mb-4">
            {!roomState.isReady ? (
              <button
                onClick={handleReady}
                disabled={isReadying}
                className={`px-8 py-4 text-xl font-semibold rounded-lg transition transform ${
                  isReadying
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-500 hover:bg-green-600 hover:scale-105 text-white shadow-lg"
                }`}
              >
                {isReadying ? "Marking Ready..." : "✓ I'm Ready"}
              </button>
            ) : (
              <div className="text-center">
                <div className="inline-block px-6 py-3 bg-green-100 text-green-800 rounded-lg">
                  <span className="font-semibold">✓ You're Ready!</span>
                  <p className="text-sm mt-1">Waiting for opponent...</p>
                </div>
              </div>
            )}
          </div>

          {/* Exit Button */}
          <div className="text-center">
            <button
              onClick={handleExit}
              className="text-gray-500 hover:text-gray-700 text-sm underline"
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
      <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        {/* Header with Timer */}
        <div className="bg-gray-800 border-b border-gray-700 p-3 sm:p-4 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <h2 className="text-base sm:text-xl font-bold">Interview Practice</h2>
              <span className="px-2 sm:px-3 py-1 bg-green-600 rounded-full text-xs sm:text-sm font-semibold">
                LIVE
              </span>
            </div>
            
            {/* Timer */}
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-mono font-bold tracking-wider">
                {formatTime(roomState.timeRemaining)}
              </div>
              <div className="text-xs text-gray-400 mt-1">Time Remaining</div>
            </div>

            <button
              onClick={handleExit}
              className="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs sm:text-sm font-semibold transition"
            >
              Exit Match
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
          {/* Question Section */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-2xl">
            <h3 className="text-xs sm:text-sm font-semibold text-blue-200 mb-2 uppercase tracking-wide">
              Interview Question
            </h3>
            <p className="text-lg sm:text-2xl font-semibold leading-relaxed">
              {roomState.question?.question || roomState.question?.text || "Loading question..."}
            </p>
          </div>

          {/* Video Toggle & Recording Controls */}
          <div className="mb-6 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={handleToggleVideo}
              className={`px-6 py-3 rounded-full font-semibold transition transform hover:scale-105 flex items-center space-x-2 ${
                videoEnabled
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-gray-600 hover:bg-gray-700"
              }`}
            >
              <span className="text-xl">{videoEnabled ? "📹" : "📷"}</span>
              <span>{videoEnabled ? "Video On" : "Enable Video"}</span>
            </button>

            <button
              onClick={toggleRecording}
              className={`px-8 py-4 rounded-full font-semibold text-lg transition transform hover:scale-105 flex items-center space-x-3 ${
                isRecording
                  ? "bg-red-600 hover:bg-red-700 animate-pulse"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              <span className="text-2xl">{isRecording ? "⏹" : "🎤"}</span>
              <span>{isRecording ? "Stop Recording" : "Start Recording"}</span>
            </button>
            
            {isRecording && (
              <span className="flex items-center space-x-2 text-red-400 animate-pulse">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span className="text-sm font-semibold">Recording...</span>
              </span>
            )}
          </div>

          {/* Video & Facial Tracking Section */}
          {videoEnabled && (
            <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Your Video Feed */}
              <div className="bg-gray-800 rounded-xl p-4 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-blue-300">Your Camera</h3>
                  {isTracking && (
                    <span className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      <span className="text-xs text-gray-400">Tracking</span>
                    </span>
                  )}
                </div>
                
                <div className="relative rounded-lg overflow-hidden border-2 border-gray-700">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="hidden"
                  />
                  <canvas
                    ref={canvasRef}
                    className="w-full h-auto"
                    style={{ maxHeight: '300px' }}
                  />
                  
                  {!isVideoReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                        <p className="text-white text-sm">Starting camera...</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Your Attention Metrics */}
                {isVideoReady && (
                  <div className="mt-3 bg-gray-900 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-400">Attention Score</div>
                        <div className="text-xs mt-1">
                          {currentAttention.isLookingAtCamera ? (
                            <span className="text-green-400">✓ Looking at camera</span>
                          ) : (
                            <span className="text-yellow-400">Looking {currentAttention.gazeDirection}</span>
                          )}
                        </div>
                      </div>
                      <div className={`text-3xl font-bold ${
                        currentAttention.attentionScore > 70 ? 'text-green-400' :
                        currentAttention.attentionScore > 50 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {currentAttention.attentionScore.toFixed(0)}
                        <span className="text-sm text-gray-500">/100</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Opponent's Metrics */}
              <div className="bg-gray-800 rounded-xl p-4 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-purple-300">Opponent's Attention</h3>
                  {opponentAttention.attentionScore > 0 && (
                    <span className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                      <span className="text-xs text-gray-400">Live</span>
                    </span>
                  )}
                </div>

                <div className="bg-gray-900 rounded-lg p-4 min-h-[150px] flex flex-col justify-center">
                  {opponentAttention.attentionScore > 0 ? (
                    <div className="text-center">
                      <div className="text-xs text-gray-400 mb-2">Attention Score</div>
                      <div className={`text-4xl font-bold ${
                        opponentAttention.attentionScore > 70 ? 'text-green-400' :
                        opponentAttention.attentionScore > 50 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {opponentAttention.attentionScore.toFixed(0)}
                        <span className="text-lg text-gray-500">/100</span>
                      </div>
                      <div className="text-sm mt-2">
                        {opponentAttention.isLookingAtCamera ? (
                          <span className="text-green-400">✓ Focused on camera</span>
                        ) : (
                          <span className="text-yellow-400">Looking {opponentAttention.gazeDirection}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500">
                      <div className="text-4xl mb-2">📹</div>
                      <p className="text-sm">Opponent's attention data will appear here</p>
                      <p className="text-xs mt-1">They need to enable video</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Video Error Display */}
          {videoError && (
            <div className="mb-6 bg-red-900 bg-opacity-50 border border-red-700 rounded-lg p-4">
              <p className="text-red-300">
                <strong>Video Error:</strong> {videoError}
              </p>
            </div>
          )}

          {/* Audio Error Display */}
          {audioError && (
            <div className="mb-6 bg-red-900 bg-opacity-50 border border-red-700 rounded-lg p-4">
              <p className="text-red-300">
                <strong>Audio Error:</strong> {audioError}
              </p>
            </div>
          )}

          {/* Transcription Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Your Transcription */}
            <div className="bg-gray-800 rounded-xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-blue-300">Your Answer</h3>
                <span className="flex items-center space-x-2">
                  {isRecording && (
                    <>
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      <span className="text-sm text-gray-300">Speaking</span>
                    </>
                  )}
                </span>
              </div>
              <div className="bg-gray-900 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                <p className="text-gray-300 leading-relaxed">
                  {roomState.playerTranscript || (
                    <span className="text-gray-500 italic">
                      Your transcription will appear here as you speak...
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Opponent's Transcription */}
            <div className="bg-gray-800 rounded-xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-purple-300">Opponent's Answer</h3>
                <span className="flex items-center space-x-2">
                  {roomState.opponentSpeaking && (
                    <>
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      <span className="text-sm text-gray-300">Speaking</span>
                    </>
                  )}
                </span>
              </div>
              <div className="bg-gray-900 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                <p className="text-gray-300 leading-relaxed">
                  {roomState.opponentTranscript || (
                    <span className="text-gray-500 italic">
                      Opponent's transcription will appear here...
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Tips Section */}
          <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-xl p-4 mb-6">
            <h4 className="font-semibold text-yellow-300 mb-2 flex items-center">
              💡 Tips
            </h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Click "Start Recording" to begin answering the question</li>
              <li>• Use the STAR method: Situation, Task, Action, Result</li>
              <li>• Keep your answer concise (aim for 1-2 minutes)</li>
              <li>• Speak clearly - your answer will be transcribed in real-time</li>
              <li>• Look at the camera - your attention score affects your grade!</li>
            </ul>
          </div>

          {/* Face Tracking / Attention Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Video Preview */}
            <div className="lg:col-span-2 bg-gray-800 rounded-xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-300 flex items-center">
                  <span className="mr-2">📹</span> Video Preview
                </h3>
                {isTracking && (
                  <span className="flex items-center space-x-2 text-green-400">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-sm">Tracking Active</span>
                  </span>
                )}
              </div>
              
              <div className="relative bg-gray-900 rounded-lg overflow-hidden">
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
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                      <p className="text-gray-400 text-sm">Initializing camera...</p>
                    </div>
                  </div>
                )}
                
                {videoError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="text-center p-4">
                      <div className="text-yellow-500 text-3xl mb-2">⚠️</div>
                      <p className="text-gray-400 text-sm">{videoError}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Attention Metrics */}
            <div className="bg-gray-800 rounded-xl p-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-300 mb-4 flex items-center">
                <span className="mr-2">👁️</span> Attention Score
              </h3>
              
              {/* Current Attention Score */}
              <div className="text-center mb-4">
                <div className={`text-5xl font-bold mb-1 ${
                  currentAttention.attentionScore > 70 ? 'text-green-400' :
                  currentAttention.attentionScore > 40 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {currentAttention.attentionScore.toFixed(0)}%
                </div>
                <div className="text-sm text-gray-400">
                  {currentAttention.isLookingAtCamera ? '✓ Looking at camera' : '✗ Look at camera'}
                </div>
              </div>

              {/* Attention Bar */}
              <div className="mb-4">
                <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
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
                  <span className="text-gray-400">Gaze Direction</span>
                  <span className="text-blue-400 font-mono">{currentAttention.gazeDirection}</span>
                </div>
              </div>

              {/* Tip */}
              <div className="mt-4 p-2 bg-gray-900 rounded-lg">
                <p className="text-xs text-gray-500 text-center">
                  💡 Maintaining eye contact improves your score!
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
      if (score >= 8) return "text-green-600";
      if (score >= 6) return "text-blue-600";
      if (score >= 4) return "text-yellow-600";
      return "text-red-600";
    };

    const getScoreBgColor = (score) => {
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
      <div className="min-h-screen w-full bg-gradient-to-br from-green-50 via-teal-50 to-blue-50 py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">
              {isWinner ? "�" : isTie ? "🤝" : "💪"}
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              Match Complete!
            </h2>
            <p className="text-gray-600">
              {isWinner 
                ? "Congratulations! You won this round!" 
                : isTie 
                ? "It's a tie! Great performance from both players!" 
                : "Good effort! Keep practicing to improve!"}
            </p>
          </div>

          {/* Score Comparison */}
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Score Comparison</h3>
            <div className="grid grid-cols-3 gap-4 items-center">
              {/* Your Score */}
              <div className={`text-center p-4 rounded-xl border-2 ${getScoreBgColor(playerScore)}`}>
                <div className="text-sm text-gray-600 mb-1">You</div>
                <div className={`text-4xl font-bold ${getScoreColor(playerScore)}`}>
                  {playerScore?.toFixed(1) || "N/A"}
                </div>
                <div className="text-xs text-gray-500">out of 10</div>
              </div>

              {/* VS */}
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-400">VS</div>
              </div>

              {/* Opponent Score */}
              <div className={`text-center p-4 rounded-xl border-2 ${getScoreBgColor(opponentScore)}`}>
                <div className="text-sm text-gray-600 mb-1">Opponent</div>
                <div className={`text-4xl font-bold ${getScoreColor(opponentScore)}`}>
                  {opponentScore?.toFixed(1) || "N/A"}
                </div>
                <div className="text-xs text-gray-500">out of 10</div>
              </div>
            </div>

            {/* Attention Score Display */}
            {(playerResult?.attentionScore !== undefined || opponentResult?.attentionScore !== undefined) && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-600 mb-3 text-center">👁️ Attention Scores</h4>
                <div className="grid grid-cols-3 gap-4 items-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-indigo-600">
                      {playerResult?.attentionScore?.toFixed(0) || "N/A"}%
                    </div>
                    <div className="text-xs text-gray-500">Your Focus</div>
                  </div>
                  <div></div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-indigo-600">
                      {opponentResult?.attentionScore?.toFixed(0) || "N/A"}%
                    </div>
                    <div className="text-xs text-gray-500">Opponent Focus</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Your Detailed Feedback */}
          {playerResult && playerResult.status !== "no_answer" && (
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
              <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center">
                <span className="mr-2">📝</span> Your Feedback
              </h3>
              
              {/* Overall Feedback */}
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <p className="text-gray-700 leading-relaxed">
                  {playerResult.feedback || "No feedback available"}
                </p>
              </div>

              {/* Strengths */}
              {playerResult.strengths && playerResult.strengths.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold text-green-700 mb-2 flex items-center">
                    <span className="mr-2">✅</span> Strengths
                  </h4>
                  <ul className="space-y-2">
                    {playerResult.strengths.map((strength, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-green-500 mr-2">•</span>
                        <span className="text-gray-700">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Areas for Improvement */}
              {playerResult.improvements && playerResult.improvements.length > 0 && (
                <div>
                  <h4 className="font-semibold text-orange-700 mb-2 flex items-center">
                    <span className="mr-2">💡</span> Areas for Improvement
                  </h4>
                  <ul className="space-y-2">
                    {playerResult.improvements.map((improvement, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-orange-500 mr-2">•</span>
                        <span className="text-gray-700">{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Word Count */}
              {playerResult.word_count && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <span className="text-sm text-gray-500">
                    Word count: {playerResult.word_count} words
                  </span>
                </div>
              )}
            </div>
          )}

          {/* No Answer Message */}
          {playerResult && playerResult.status === "no_answer" && (
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
              <div className="text-center text-gray-600">
                <div className="text-4xl mb-3">🎤</div>
                <p>No answer was recorded for your response.</p>
                <p className="text-sm mt-2">Make sure to click "Start Recording" and speak clearly during the match.</p>
              </div>
            </div>
          )}

          {/* Final Transcripts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2 flex items-center">
                <span className="mr-2">🗣️</span> Your Answer
              </h3>
              <div className="bg-blue-50 rounded-lg p-3 max-h-[200px] overflow-y-auto">
                <p className="text-sm text-gray-700">
                  {roomState.playerTranscript || "No transcription recorded"}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h3 className="font-semibold text-purple-800 mb-2 flex items-center">
                <span className="mr-2">🗣️</span> Opponent's Answer
              </h3>
              <div className="bg-purple-50 rounded-lg p-3 max-h-[200px] overflow-y-auto">
                <p className="text-sm text-gray-700">
                  {roomState.opponentTranscript || "No transcription recorded"}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="space-y-3">
              <button
                onClick={handleExit}
                className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
              >
                Return to Profile
              </button>
              <button
                onClick={() => {
                  window.location.href = "/matchmaking";
                }}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
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
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-yellow-100">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
          <div className="text-yellow-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Disconnected</h2>
          <p className="text-gray-600 mb-6">
            You've been disconnected from the match room. Attempting to reconnect...
          </p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-yellow-500 mx-auto mb-4"></div>
          <button
            onClick={handleExit}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
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