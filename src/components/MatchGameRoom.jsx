import React, { useState, useEffect, useRef } from "react";
import { useMatchRoom } from "./useMatchRoom";
import { useAudioCapture } from "./useAudioCapture";

/**
 * MatchGameRoom Component
 * Displays the match room interface with:
 * - Waiting room (players ready up)
 * - Active match (question display, timer, audio recording, transcription)
 * - Match completion screen
 */
export default function MatchGameRoom({ matchId, onExit }) {
    console.log("=== MatchGameRoom MOUNTED ===");
  console.log("Match ID:", matchId);
  const { roomState, markReady, disconnect, wsRef } = useMatchRoom(matchId);
  const [isReadying, setIsReadying] = useState(false);
  const hasAutoReadied = useRef(false);  // Track if we've auto-readied
  
  // Initialize audio capture with WebSocket ref from useMatchRoom
  const { isRecording, audioError, toggleRecording } = useAudioCapture(wsRef);

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
        <div className="bg-gray-800 border-b border-gray-700 p-4 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-bold">Interview Practice</h2>
              <span className="px-3 py-1 bg-green-600 rounded-full text-sm font-semibold">
                LIVE
              </span>
            </div>
            
            {/* Timer */}
            <div className="text-center">
              <div className="text-3xl font-mono font-bold tracking-wider">
                {formatTime(roomState.timeRemaining)}
              </div>
              <div className="text-xs text-gray-400 mt-1">Time Remaining</div>
            </div>

            <button
              onClick={handleExit}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition"
            >
              Exit Match
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto p-6">
          {/* Question Section */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 mb-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-blue-200 mb-2 uppercase tracking-wide">
              Interview Question
            </h3>
            <p className="text-2xl font-semibold leading-relaxed">
              {roomState.question?.question || roomState.question?.text || "Loading question..."}
            </p>
          </div>

          {/* Recording Controls */}
          <div className="mb-6 flex items-center justify-center space-x-4">
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
          <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-xl p-4">
            <h4 className="font-semibold text-yellow-300 mb-2 flex items-center">
              <span className="mr-2">💡</span>
              Tips
            </h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Click "Start Recording" to begin answering the question</li>
              <li>• Use the STAR method: Situation, Task, Action, Result</li>
              <li>• Keep your answer concise (aim for 1-2 minutes)</li>
              <li>• Speak clearly - your answer will be transcribed in real-time</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Match Completed
  if (roomState.status === "completed") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-green-50 to-teal-100">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full mx-4">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              Match Complete!
            </h2>
            <p className="text-gray-600 mb-6">
              Great job! You've completed your interview practice session.
            </p>
          </div>

          {/* Final Transcripts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">Your Answer</h3>
              <div className="bg-white rounded p-3 max-h-[200px] overflow-y-auto">
                <p className="text-sm text-gray-700">
                  {roomState.playerTranscript || "No transcription recorded"}
                </p>
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="font-semibold text-purple-800 mb-2">Opponent's Answer</h3>
              <div className="bg-white rounded p-3 max-h-[200px] overflow-y-auto">
                <p className="text-sm text-gray-700">
                  {roomState.opponentTranscript || "No transcription recorded"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 text-center">
              Detailed feedback and analytics will be available in a future update.
            </p>
          </div>

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