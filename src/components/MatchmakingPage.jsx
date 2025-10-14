import { useMatchmaking } from "./useMatchmaking";

export default function MatchmakingPage() {
  const { status, partners, joinQueue, leaveQueue } = useMatchmaking();

  return (
    <div>
      <p>Status: {status}</p>
      <p>Partner: {partners.join(", ")}</p>
      <button onClick={joinQueue} disabled={status !== "idle" && status !== "disconnected"}>
        Join Queue
      </button>
      <button onClick={leaveQueue} disabled={status === "idle" || status === "disconnected"}>
        Leave Queue
      </button>
    </div>
  );
}
