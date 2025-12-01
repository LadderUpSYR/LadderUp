import { useEffect, useState, useRef } from "react";

// 1. HARD ROUTE: Put your direct Cloud Run URL here
// In production, you might want to use process.env.REACT_APP_WS_URL
const CLOUD_RUN_WS_URL = "wss://websocket-service-929812005686.us-central1.run.app/ws/join";

export function useMatchmaking() {
  const [status, setStatus] = useState("idle");
  const [partners, setPartners] = useState([]);
  const [matchId, setMatchId] = useState(null);
  const wsRef = useRef(null);
  const isConnectingRef = useRef(false);

  const joinQueue = async () => {
    if (wsRef.current || isConnectingRef.current) return;

    isConnectingRef.current = true;
    setStatus("checking_session");

    // 2. GET TOKEN: Retrieve the token we saved during Login
    const token = localStorage.getItem("ws_token");

    if (!token) {
      console.error("No auth token found in storage");
      setStatus("no_logged_session_found");
      isConnectingRef.current = false;
      return;
    }

    try {
      // 3. DIRECT CONNECTION: Bypass Firebase Hosting completely
      console.log("Connecting to:", CLOUD_RUN_WS_URL);
      const socket = new WebSocket(CLOUD_RUN_WS_URL);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connected, sending auth...");
        
        // 4. AUTH HANDSHAKE: Send token immediately
        socket.send(JSON.stringify({
          type: "authenticate",
          token: token
        }));
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Received WS message:", data);

        if (data.error) {
          console.error("Server error:", data.error);
          setStatus("error");
          socket.close(); // Close if auth fails
        } 
        else if (data.status === "queued") {
          // This confirms the server accepted our auth token
          setStatus("queued");
          isConnectingRef.current = false;
        } 
        else if (data.status === "match_found") {
          setStatus("match_found");
          setPartners(data.partner ? [data.partner] : data.partners || []);
          setMatchId(data.match_id);
          
          setTimeout(() => {
            goToRoom(data.match_id);
          }, 1000);
        }
      };

      socket.onclose = (event) => {
        console.log("WebSocket disconnected", event.code, event.reason);
        setStatus((prev) => (prev === "match_found" ? prev : "disconnected"));
        wsRef.current = null;
        isConnectingRef.current = false;
      };

      socket.onerror = (err) => {
        console.error("WebSocket error", err);
        setStatus("error");
        isConnectingRef.current = false;
      };

    } catch (err) {
      console.error("Connection failed:", err);
      setStatus("error");
      isConnectingRef.current = false;
    }
  };

  const leaveQueue = () => {
    if (wsRef.current) {
      wsRef.current.close(1000);
      wsRef.current = null;
      setStatus("idle");
      setPartners([]);
    }
  };

  const goToRoom = (id) => {
    if (id) {
      window.location.pathname = `/match/${id}`;
    }
  };

  useEffect(() => {
    return () => leaveQueue();
  }, []);

  return { status, partners, joinQueue, leaveQueue };
}