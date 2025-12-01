/**
 * WebSocket URL Helper Utility
 * 
 * Determines the correct WebSocket URL based on the deployment environment.
 * - Development: ws://localhost:PORT
 * - Production: wss://cloud-run-service-url (direct to Cloud Run, bypassing Firebase CDN)
 * 
 * Note: Firebase CDN does not support WebSocket connections, so we connect
 * directly to Cloud Run services in production.
 */

// Cloud Run service URLs for WebSocket connections (bypasses Firebase CDN)
const CLOUD_RUN_MATCHMAKING_URL = "wss://ladderup-ws-203399321498.us-east1.run.app";
const CLOUD_RUN_PRACTICE_URL = "wss://ladderup-practice-ws-203399321498.us-east1.run.app";

/**
 * Get the appropriate WebSocket URL for the current environment
 * @param {string} endpoint - The WebSocket endpoint (e.g., '/ws/join', '/ws/practice', '/ws/room/matchId')
 * @param {number} port - Optional: The port for localhost development (default: 5001 for matchmaking, 8001 for practice)
 * @returns {string} The full WebSocket URL
 */
export const getWebSocketURL = (endpoint, port = null) => {
  // Development mode: localhost
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    // Determine port based on endpoint or use provided port
    let wsPort = port;
    if (!wsPort) {
      if (endpoint.includes("/ws/practice")) {
        wsPort = 8001; // Practice STT WebSocket server
      } else {
        wsPort = 5001; // Matchmaking WebSocket server
      }
    }
    return `ws://localhost:${wsPort}${endpoint}`;
  }

  // Production mode: Connect directly to Cloud Run services (bypass Firebase CDN)
  // Firebase CDN does not support WebSocket protocol
  if (endpoint.includes("/ws/practice")) {
    return `${CLOUD_RUN_PRACTICE_URL}${endpoint}`;
  } else {
    // Matchmaking and match room WebSockets
    return `${CLOUD_RUN_MATCHMAKING_URL}${endpoint}`;
  }
};

export default getWebSocketURL;
