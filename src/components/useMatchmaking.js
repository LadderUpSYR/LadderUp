import { useEffect, useState, useRef } from "react";

export function useMatchmaking(bucket = "bronze") {
  const [status, setStatus] = useState("idle");
  const [partners, setPartners] = useState([]);
    const [matchId, setMatchId] = useState(null);
  const wsRef = useRef(null); // store WebSocket across renders

  // Join matchmaking queue
  const joinQueue = async () => {
    if (wsRef.current) return; // already connected

    setStatus("checking_session");

    try {
      const res = await fetch("http://localhost:8000/api/auth/me", {
        credentials: "include", // send httponly cookie
      });

      if (!res.ok) {
        setStatus("no_logged_session_found");
        return;
      }

      const { user } = await res.json();
      console.log("Authenticated user:", user);
      if (!user) {
        setStatus("no_logged_session_found");
        return;
      }

      // Open WebSocket (cookie sent automatically)
      const socket = new WebSocket(`ws://localhost:5000/ws/join`);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connected");
        setStatus("connected");
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Received WS message:", data);

        if (data.status === "queued") setStatus("queued");
        else if (data.status === "match_found") {
          setStatus("match_found");
          setPartners(data.partner ? [data.partner] : data.partners || []);
          setMatchId(data.match_id);
            // Redirect to match room after short delay
            setTimeout(() => {
              goToRoom(data.match_id);
            }, 1000);
        } else if (data.error) setStatus("error");
      };

      socket.onclose = () => {
        console.log("WebSocket disconnected");
        setStatus((prev) => (prev === "match_found" ? prev : "disconnected"));
        wsRef.current = null;
      };

      socket.onerror = (err) => {
        console.error("WebSocket error", err);
        setStatus("error");
      };
    } catch (err) {
      console.error("Error checking session:", err);
      setStatus("error");
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
        // Redirect user to the match room
        window.location.href = `http://localhost:8000/match/${id}`;
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
