import { useEffect, useState, useRef, useCallback } from "react";

// 1. HARD ROUTE: Direct Cloud Run URL (Same as useMatchmaking)
const CLOUD_RUN_WS_URL = "wss://websocket-service-929812005686.us-central1.run.app";

/**
 * Custom hook for managing WebSocket connection to a match room
 */
export function useMatchRoom(matchId) {
  console.log("=== useMatchRoom HOOK CALLED ===");
  console.log("Match ID:", matchId);
  const [roomState, setRoomState] = useState({
    status: "connecting",
    playerUid: null,
    opponentUid: null,
    isReady: false,
    opponentReady: false,
    question: null,
    timeRemaining: null,
    matchDuration: null,
    error: null,
    playerTranscript: "",
    opponentTranscript: "",
    opponentSpeaking: false,
  });

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Connect to the match room WebSocket
  const connect = useCallback(() => {
    if (!matchId || wsRef.current) return;

    // 2. GET TOKEN
    const token = localStorage.getItem("ws_token");
    if (!token) {
        console.error("No auth token found");
        setRoomState(prev => ({ ...prev, status: 'error', error: "No authentication token" }));
        return;
    }

    // 3. DIRECT CONNECTION
    const wsUrl = `${CLOUD_RUN_WS_URL}/ws/room/${matchId}`;
    console.log(`Connecting to match room: ${wsUrl}`);
    
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("Match room WebSocket connected. Sending auth...");
      // 4. AUTH HANDSHAKE
      socket.send(JSON.stringify({
          type: "authenticate",
          token: token
      }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received room message:", data);

        switch (data.type) {
          case "connected":
            console.log(">>> Connected & Authenticated");
            setRoomState((prev) => ({
              ...prev,
              status: data.status || "waiting",
              playerUid: data.player_uid,
              // If the server says we are ready (auto-ready), trust it
              isReady: data.is_ready || false,
              question: data.question || prev.question,
              timeRemaining: data.time_remaining || prev.timeRemaining,
            }));
            break;

          case "player_joined":
            setRoomState((prev) => ({ ...prev, opponentUid: data.player }));
            break;

          case "player_left":
             // Handle opponent leaving
            break;

          case "player_ready":
            setRoomState((prev) => {
              const updates = { ...prev };
              
              // If the message says "player X is ready", update our local state
              if (data.player === prev.playerUid) {
                  updates.isReady = true;
              } else {
                  updates.opponentReady = true;
              }

              if (data.both_ready) {
                console.log("🎮 MATCH STARTING");
                updates.status = "active";
                if (data.question) updates.question = data.question;
                if (data.match_duration_seconds) {
                  updates.matchDuration = data.match_duration_seconds;
                  updates.timeRemaining = data.match_duration_seconds;
                }
              }
              return updates;
            });
            break;

          case "time_update":
            setRoomState((prev) => ({ ...prev, timeRemaining: data.time_remaining }));
            break;

          case "time_warning":
            console.log("Time warning:", data.message);
            break;
            
          case "match_ending":
             // Handle match ending / grading phase
             break;

          case "match_graded":
             // Handle final results
             setRoomState((prev) => ({ ...prev, status: "completed" }));
             break;

          case "transcription":
            setRoomState((prev) => {
              const isPlayerTranscript = data.player === prev.playerUid;
              return {
                ...prev,
                playerTranscript: isPlayerTranscript 
                  ? prev.playerTranscript + " " + data.text
                  : prev.playerTranscript,
                opponentTranscript: !isPlayerTranscript
                  ? prev.opponentTranscript + " " + data.text
                  : prev.opponentTranscript
              };
            });
            break;

          case "player_speaking":
            setRoomState((prev) => {
              if (data.player !== prev.playerUid) {
                return { ...prev, opponentSpeaking: data.speaking };
              }
              return prev;
            });
            break;

          case "facial_tracking":
            // Handle incoming facial tracking data from opponent
            // Note: This is handled separately in MatchGameRoom via useMatchVideoCapture
            // We just need to ensure the message is available for processing
            console.log(`Facial tracking from ${data.player}:`, data.attention?.attentionScore);
            break;

          case "error":
            console.error("Room error:", data.error);
            setRoomState((prev) => ({ ...prev, status: "error", error: data.error }));
            break;
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.onclose = (event) => {
      console.log("WS Closed", event.code, event.reason);
      wsRef.current = null;
      setRoomState((prev) => {
        if (prev.status === "completed") return prev;
        return { ...prev, status: "disconnected" };
      });

      // Only reconnect if not a normal closure (1000) or Policy Violation (1008 - Auth fail)
      if (event.code !== 1000 && event.code !== 1008) {
        reconnectTimeoutRef.current = setTimeout(() => {
            console.log("Reconnecting...");
            connect();
        }, 3000);
      }
    };

    socket.onerror = (error) => {
      console.error("WS Error", error);
      setRoomState((prev) => ({ ...prev, status: "error", error: "Connection error" }));
    };
  }, [matchId]);

  // Send a message through the WebSocket
  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // 5. UPDATE MARK READY: Use WebSocket instead of Fetch
  const markReady = useCallback(async () => {
    // We send a "ready" message over the socket.
    // The server will handle it and broadcast "player_ready" back to us.
    sendMessage({ type: "ready" });
    
    // Optimistically update state (optional, the server response will confirm it)
    setRoomState((prev) => ({ ...prev, isReady: true }));
  }, [sendMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (wsRef.current) {
      wsRef.current.close(1000);
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    roomState,
    markReady,
    sendMessage,
    disconnect,
    reconnect: connect,
    wsRef, 
  };
}