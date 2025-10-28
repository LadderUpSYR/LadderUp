import { useEffect, useState, useRef } from "react";

export function useMatchmaking(bucket = "bronze") {
  const [status, setStatus] = useState("idle");
  const [partners, setPartners] = useState([]);
  const [matchId, setMatchId] = useState(null);
  const wsRef = useRef(null); // store WebSocket across renders
  const isConnectingRef = useRef(false); // prevent double connections

  // Join matchmaking queue
  const joinQueue = async () => {
    if (wsRef.current || isConnectingRef.current) return; // already connected or connecting

    isConnectingRef.current = true;
    setStatus("checking_session");

    try {
      const res = await fetch("http://localhost:8000/api/auth/me", {
        credentials: "include", // send httponly cookie
      });

      if (!res.ok) {
        setStatus("no_logged_session_found");
        isConnectingRef.current = false;
        return;
      }

      const { user } = await res.json();
      console.log("Authenticated user:", user);
      if (!user) {
        setStatus("no_logged_session_found");
        isConnectingRef.current = false;
        return;
      }

      // Open WebSocket (cookie sent automatically)
      const socket = new WebSocket(`ws://localhost:5001/ws/join`);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connected");
        setStatus("connected");
        isConnectingRef.current = false;
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Received WS message:", data);

        if (data.error) {
          console.error("WebSocket error from server:", data.error);
          setStatus("error");
          alert(`Matchmaking error: ${data.error}`);
        } else if (data.status === "queued") {
          setStatus("queued");
        } else if (data.status === "match_found") {
          setStatus("match_found");
          setPartners(data.partner ? [data.partner] : data.partners || []);
          setMatchId(data.match_id);
          // Redirect to match room after short delay
          setTimeout(() => {
            goToRoom(data.match_id);
          }, 1000);
        }
      };

      socket.onclose = (event) => {
        console.log("WebSocket disconnected", event);
        console.log("Close code:", event.code, "Reason:", event.reason);
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
      console.error("Error checking session:", err);
      setStatus("error");
      isConnectingRef.current = false;
    }
  };

  // Leave matchmaking queue
  const leaveQueue = () => {
    if (wsRef.current) {
      wsRef.current.close(1000); // normal closure
      wsRef.current = null;
      setStatus("idle");
      setPartners([]);
    }
  };

  const goToRoom = (id) => {
    if (id) {
      try {
        // Redirect user to the match room using the frontend route
        window.location.pathname = `/match/${id}`;
      } catch (err) {
        console.error("Error redirecting to match room:", err);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => leaveQueue();
  }, []);

  return { status, partners, joinQueue, leaveQueue };
}
