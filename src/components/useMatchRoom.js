import { useEffect, useState, useRef, useCallback } from "react";

/**
 * Custom hook for managing WebSocket connection to a match room
 * Handles real-time communication including player status, questions, and timer
 */
export function useMatchRoom(matchId) {
  const [roomState, setRoomState] = useState({
    status: "connecting", // connecting, connected, waiting, active, completed, error
    playerUid: null,
    opponentUid: null,
    isReady: false,
    opponentReady: false,
    question: null,
    timeRemaining: null,
    matchDuration: null,
    error: null,
  });

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Connect to the match room WebSocket
  const connect = useCallback(() => {
    if (!matchId || wsRef.current) return;

    console.log(`Connecting to match room: ${matchId}`);
    const socket = new WebSocket(`ws://localhost:5001/ws/room/${matchId}`);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("Match room WebSocket connected");
      setRoomState((prev) => ({ ...prev, status: "connected" }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received room message:", data);

        switch (data.type) {
          case "connected":
            // Initial connection confirmation
            setRoomState((prev) => ({
              ...prev,
              status: data.status || "waiting",
              playerUid: data.player_uid,
              question: data.question || prev.question,
              timeRemaining: data.time_remaining || prev.timeRemaining,
            }));
            break;

          case "player_joined":
            console.log(`Player joined: ${data.player}`);
            setRoomState((prev) => ({
              ...prev,
              opponentUid: data.player,
            }));
            break;

          case "player_left":
            console.log(`Player left: ${data.player}`);
            // Could handle opponent disconnection here
            break;

          case "player_ready":
            console.log(`Player ready: ${data.player}`, data);
            setRoomState((prev) => {
              const updates = {
                ...prev,
              };

              // Check if it's the opponent who readied up
              if (data.player !== prev.playerUid) {
                updates.opponentReady = true;
              }

              // If both players are ready, update question and status
              if (data.both_ready) {
                updates.status = "active";
                if (data.question) {
                  updates.question = data.question;
                }
                if (data.match_duration_seconds) {
                  updates.matchDuration = data.match_duration_seconds;
                  updates.timeRemaining = data.match_duration_seconds;
                }
              }

              return updates;
            });
            break;

          case "time_update":
            setRoomState((prev) => ({
              ...prev,
              timeRemaining: data.time_remaining,
            }));
            break;

          case "time_warning":
            // Could show a visual warning
            console.log("Time warning:", data.message);
            break;

          case "match_time_expired":
            console.log("Match time expired");
            setRoomState((prev) => ({
              ...prev,
              status: "completed",
              timeRemaining: 0,
            }));
            break;

          case "error":
            console.error("Room error:", data.error);
            setRoomState((prev) => ({
              ...prev,
              status: "error",
              error: data.error,
            }));
            break;

          default:
            console.log("Unknown message type:", data.type);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.onclose = () => {
      console.log("Match room WebSocket disconnected");
      wsRef.current = null;

      setRoomState((prev) => {
        // Don't change status if match is completed
        if (prev.status === "completed") {
          return prev;
        }
        return { ...prev, status: "disconnected" };
      });

      // Attempt to reconnect after 3 seconds if not intentionally closed
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("Attempting to reconnect...");
        connect();
      }, 3000);
    };

    socket.onerror = (error) => {
      console.error("Match room WebSocket error:", error);
      setRoomState((prev) => ({
        ...prev,
        status: "error",
        error: "WebSocket connection error",
      }));
    };
  }, [matchId]);

  // Mark player as ready
  const markReady = useCallback(async () => {
    try {
      const response = await fetch(
        `http://localhost:5001/api/match/${matchId}/ready`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to mark ready");
      }

      const result = await response.json();
      console.log("Mark ready result:", result);

      // Update local ready status
      setRoomState((prev) => ({
        ...prev,
        isReady: true,
      }));

      return result;
    } catch (error) {
      console.error("Error marking ready:", error);
      setRoomState((prev) => ({
        ...prev,
        error: "Failed to mark ready",
      }));
      throw error;
    }
  }, [matchId]);

  // Send a message through the WebSocket
  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.error("WebSocket is not open. Cannot send message.");
    }
  }, []);

  // Disconnect from the room
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000); // Normal closure
      wsRef.current = null;
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    roomState,
    markReady,
    sendMessage,
    disconnect,
    reconnect: connect,
  };
}
