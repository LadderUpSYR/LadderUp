/**
 * WebSocket URL Helper Utility
 * 
 * Determines the correct WebSocket URL based on the deployment environment.
 * - Development: ws://localhost:PORT
 * - Production: wss://domain (secure WebSocket)
 * 
 * Note: Unlike HTTP requests, WebSocket URLs cannot use relative paths.
 * This helper constructs the proper URL for both environments.
 */

/**
 * Get the appropriate WebSocket URL for the current environment
 * @param {string} endpoint - The WebSocket endpoint (e.g., '/ws/join', '/ws/practice', '/ws/room/matchId')
 * @param {number} port - Optional: The port for localhost development (default: 5001 for matchmaking, 8000 for practice)
 * @returns {string} The full WebSocket URL
 */
export const getWebSocketURL = (endpoint, port = null) => {
  // Development mode: localhost
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    // Determine port based on endpoint or use provided port
    let wsPort = port;
    if (!wsPort) {
      if (endpoint.includes("/ws/practice")) {
        wsPort = 8000; // Practice STT backend
      } else {
        wsPort = 5001; // Matchmaking backend
      }
    }
    return `ws://localhost:${wsPort}${endpoint}`;
  }

  // Production mode: use secure WebSocket (wss://)
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${endpoint}`;
};

export default getWebSocketURL;
