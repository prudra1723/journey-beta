import { useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import {
  addMenuItem,
  clearMenuVotingDeadline,
  readDinner,
  removeMenuItem,
  syncPlanExtrasFromRemote,
  setMenuVotingDeadline,
  voteMenuItem,
} from "../../../lib/planExtrasDb";

function timeLeft(closesAt: number | undefined, now: number) {
  if (!closesAt) return null;
  const ms = closesAt - now;
  if (ms <= 0) return "Voting closed";
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m} min left`;
  const h = Math.ceil(m / 60);
  return `${h} hr left`;
}

export function DinnerMenuBox({
  groupId,
  itemId,
  titleHint,
  me,
  show,
  version,
}: {
  groupId: string;
  itemId: string;
  titleHint?: string;
  me: { userId: string; name: string } | null;
  show: boolean;
  version?: number;
}) {
  const [hidden, setHidden] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [mins, setMins] = useState("60");
  const [now, setNow] = useState(() => Date.now());

  const [state, setState] = useState(() => readDinner(groupId, itemId));

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        await syncPlanExtrasFromRemote(groupId, itemId);
      } catch {
        // ignore
      }
      if (mounted) setState(readDinner(groupId, itemId));
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [groupId, itemId, version]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  function reload() {
    setState(readDinner(groupId, itemId));
  }
  const myVote = me ? state.votesByUser[me.userId] : undefined;

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const id of Object.values(state.votesByUser)) {
      map[id] = (map[id] ?? 0) + 1;
    }
    return map;
  }, [state.votesByUser]);

  // If not relevant, don’t show (but still works if you want always-on)
  if (!show && !titleHint?.toLowerCase().includes("dinner")) return null;
  if (hidden) return null;

  const votingStatus = timeLeft(state.closesAt, now);

  return (
    <Card className="relative">
      {/* X close */}
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="absolute top-3 right-3 w-9 h-9 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 font-extrabold"
        title="Close"
      >
        ×
      </button>

      <div className="text-sm font-extrabold text-gray-900">🍽️ Dinner Menu</div>
      <div className="mt-1 text-xs text-gray-600 font-semibold">
        {votingStatus ? votingStatus : "Custom menu + voting"}
      </div>

      {/* vote list */}
      <div className="mt-3 space-y-2">
        {state.items.map((it) => {
          const c = counts[it.id] ?? 0;
          const chosen = myVote === it.id;

          const votingClosed = !!state.closesAt && now > state.closesAt;

          return (
            <div key={it.id} className="flex gap-2 items-stretch">
              <button
                type="button"
                disabled={!me || !!votingClosed}
                className={[
                  "flex-1 text-left rounded-2xl border px-3 py-2 text-sm font-semibold transition",
                  chosen
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-200 text-gray-900 hover:bg-gray-50",
                  !me || votingClosed ? "opacity-70 cursor-not-allowed" : "",
                ].join(" ")}
                onClick={() => {
                  if (!me) return;
                  voteMenuItem(groupId, itemId, me.userId, it.id);
                  reload();
                }}
                title={
                  !me
                    ? "Login required"
                    : votingClosed
                      ? "Voting closed"
                      : "Vote"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{it.text}</span>
                  <span
                    className={[
                      "text-xs font-extrabold",
                      chosen ? "text-white/90" : "text-gray-600",
                    ].join(" ")}
                  >
                    {c}
                  </span>
                </div>
              </button>

              {/* remove custom item */}
              <button
                type="button"
                className="w-11 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 font-extrabold"
                onClick={() => {
                  removeMenuItem(groupId, itemId, it.id);
                  reload();
                }}
                title="Remove item"
              >
                −
              </button>
            </div>
          );
        })}
      </div>

      {/* add new menu item */}
      <div className="mt-3 flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add new dish..."
          className="flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
        />
        <Button
          variant="primary"
          onClick={() => {
            const t = newItem.trim();
            if (!t) return;
            addMenuItem(groupId, itemId, t);
            setNewItem("");
            reload();
          }}
        >
          + Add
        </Button>
      </div>

      {/* voting deadline */}
      <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
        <div className="text-xs font-extrabold text-gray-900">
          Voting time (optional)
        </div>

        <div className="mt-2 flex items-center gap-2">
          <input
            value={mins}
            onChange={(e) => setMins(e.target.value)}
            className="w-24 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
            placeholder="60"
          />
          <div className="text-sm font-semibold text-gray-700">minutes</div>

          <Button
            variant="orange"
            onClick={() => {
              const n = Number(mins);
              if (!Number.isFinite(n) || n <= 0) return;
              setMenuVotingDeadline(groupId, itemId, n);
              reload();
            }}
          >
            Set
          </Button>

          <button
            type="button"
            className="ml-auto text-xs font-extrabold text-blue-700 hover:underline"
            onClick={() => {
              clearMenuVotingDeadline(groupId, itemId);
              reload();
            }}
          >
            Clear
          </button>
        </div>

        {!me && (
          <div className="mt-2 text-xs text-red-600 font-semibold">
            Login/session required to vote.
          </div>
        )}
      </div>
    </Card>
  );
}
