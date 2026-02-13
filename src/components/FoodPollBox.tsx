import { useEffect, useState } from "react";
import {
  type FoodOption,
  type FoodPoll,
  type MealType,
  computeWinner,
  countVotes,
  formatDeadline,
  fromDatetimeLocalValue,
  loadFoodPoll,
  saveFoodPoll,
  toDatetimeLocalValue,
} from "../lib/foodPollDb";

export function FoodPollBox({
  groupId,
  itemId,
  me,
  onChanged,
}: {
  groupId: string;
  itemId: string;
  me: { userId: string; name: string } | null;
  onChanged: () => void;
}) {
  const [poll, setPoll] = useState<FoodPoll>(() =>
    loadFoodPoll(groupId, itemId),
  );
  const [newOption, setNewOption] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => {
      const fresh = loadFoodPoll(groupId, itemId);
      const nextNow = Date.now();
      if (!fresh.approvedOptionId && nextNow >= fresh.closesAt) {
        const winner = computeWinner(fresh);
        if (winner) {
          fresh.approvedOptionId = winner;
          saveFoodPoll(groupId, itemId, fresh);
        }
      }
      setPoll(fresh);
      setNow(nextNow);
    };

    tick();
    const t = window.setInterval(tick, 10_000);
    return () => window.clearInterval(t);
  }, [groupId, itemId]);

  const locked = !!poll.approvedOptionId || now >= poll.closesAt;
  const myVote = me ? poll.votes[me.userId] : undefined;

  const approvedLabel = poll.approvedOptionId
    ? (poll.options.find((o) => o.id === poll.approvedOptionId)?.label ??
      "Approved")
    : null;

  function update(next: FoodPoll) {
    setPoll(next);
    saveFoodPoll(groupId, itemId, next);
    onChanged();
  }

  function addMenuItem() {
    const label = newOption.trim();
    if (!label || locked) return;

    const opt: FoodOption = {
      id: `opt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      label,
      createdAt: Date.now(),
    };
    update({ ...poll, options: [...poll.options, opt] });
    setNewOption("");
  }

  function removeMenuItem(optionId: string) {
    if (locked) return;
    const options = poll.options.filter((o) => o.id !== optionId);
    const votes: Record<string, string> = {};
    for (const [uid, oid] of Object.entries(poll.votes)) {
      if (oid !== optionId) votes[uid] = oid;
    }
    update({ ...poll, options, votes });
  }

  function vote(optionId: string) {
    if (!me || locked) return;
    update({ ...poll, votes: { ...poll.votes, [me.userId]: optionId } });
  }

  function approveNow() {
    if (poll.approvedOptionId) return;
    const winner = computeWinner(poll);
    if (!winner) return;
    update({ ...poll, approvedOptionId: winner });
  }

  return (
    <>
      <div className="text-xs text-gray-600">
        Deadline:{" "}
        <span className="font-semibold">{formatDeadline(poll.closesAt)}</span>
        {approvedLabel ? (
          <span className="ml-2 inline-flex items-center rounded-xl bg-green-50 border border-green-100 px-2 py-0.5 text-green-700 font-bold">
            ✅ Approved
          </span>
        ) : locked ? (
          <span className="ml-2 inline-flex items-center rounded-xl bg-white border border-gray-200 px-2 py-0.5 text-gray-600 font-bold">
            Locked
          </span>
        ) : (
          <button
            type="button"
            onClick={approveNow}
            className="ml-2 text-xs font-bold text-blue-700 hover:underline"
            title="Approve winner now"
          >
            Approve now
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["breakfast", "lunch", "dinner", "other"] as MealType[]).map((m) => (
          <button
            key={m}
            type="button"
            disabled={locked}
            onClick={() => update({ ...poll, mealType: m })}
            className={[
              "px-3 py-2 rounded-2xl border text-sm font-semibold transition",
              poll.mealType === m
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50",
              locked ? "opacity-70 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {m === "breakfast"
              ? "🥞 Breakfast"
              : m === "lunch"
                ? "🍛 Lunch"
                : m === "dinner"
                  ? "🍲 Dinner"
                  : "🍴 Other"}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <label className="text-xs font-bold text-gray-700">Deadline time</label>
        <div className="mt-2 flex flex-wrap gap-2 items-center">
          <input
            type="datetime-local"
            disabled={locked}
            value={toDatetimeLocalValue(poll.closesAt)}
            onChange={(e) =>
              update({
                ...poll,
                closesAt: fromDatetimeLocalValue(e.target.value),
              })
            }
            className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100"
          />
          <button
            type="button"
            disabled={locked}
            onClick={() =>
              update({ ...poll, closesAt: Date.now() + 15 * 60 * 1000 })
            }
            className="px-3 py-2 rounded-2xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 disabled:bg-gray-100"
          >
            +15m
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() =>
              update({ ...poll, closesAt: Date.now() + 30 * 60 * 1000 })
            }
            className="px-3 py-2 rounded-2xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 disabled:bg-gray-100"
          >
            +30m
          </button>
        </div>
      </div>

      {approvedLabel && (
        <div className="mt-3 rounded-2xl border border-green-200 bg-green-50 p-3">
          <div className="text-sm font-extrabold text-green-800">Winner</div>
          <div className="mt-1 text-sm font-semibold text-green-800">
            {approvedLabel}
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {poll.options.map((o) => {
          const c = countVotes(poll, o.id);
          const mine = myVote === o.id;

          return (
            <div
              key={o.id}
              className="rounded-2xl border border-gray-200 bg-white px-3 py-2 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {o.label}
                </div>
                <div className="text-xs text-gray-500">{c} vote(s)</div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={!me || locked}
                  onClick={() => vote(o.id)}
                  className={[
                    "px-3 py-2 rounded-2xl border text-sm font-semibold transition",
                    mine
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50",
                    !me || locked ? "opacity-70 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {mine ? "Voted" : "Vote"}
                </button>

                <button
                  type="button"
                  disabled={locked}
                  onClick={() => removeMenuItem(o.id)}
                  className="w-10 h-10 rounded-2xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-center"
                  title="Remove menu item"
                >
                  🗑
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={newOption}
          disabled={locked}
          onChange={(e) => setNewOption(e.target.value)}
          placeholder="Add menu item"
          className="flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addMenuItem();
            }
          }}
        />
        <button
          type="button"
          disabled={locked || !newOption.trim()}
          onClick={addMenuItem}
          className="px-3 py-2 rounded-2xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      {!me && (
        <div className="mt-2 text-xs text-red-600 font-semibold">
          Login/session required to vote.
        </div>
      )}
    </>
  );
}
