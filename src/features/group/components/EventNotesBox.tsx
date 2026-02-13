import { useEffect, useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import {
  addEventNote,
  addEventNoteReply,
  deleteEventNote,
  readEventNotes,
  syncPlanExtrasFromRemote,
} from "../../../lib/planExtrasDb";

export function EventNotesBox({
  groupId,
  itemId,
  me,
  version,
}: {
  groupId: string;
  itemId: string;
  me: { userId: string; name: string } | null;
  version?: number;
}) {
  const [hidden, setHidden] = useState(false);
  const [text, setText] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});

  const [state, setState] = useState(() => readEventNotes(groupId, itemId));

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        await syncPlanExtrasFromRemote(groupId, itemId);
      } catch {
        // ignore
      }
      if (mounted) setState(readEventNotes(groupId, itemId));
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [groupId, itemId, version]);

  function reload() {
    setState(readEventNotes(groupId, itemId));
  }

  if (hidden) return null;

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

      <div className="text-sm font-extrabold text-gray-900">📝 Notes</div>
      <div className="mt-1 text-xs text-gray-600 font-semibold">
        Name required (uses session name)
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a note…"
          className="flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
        />
        <Button
          variant="primary"
          disabled={!me}
          onClick={() => {
            if (!me) return;
            const t = text.trim();
            if (!t) return;
            addEventNote(groupId, itemId, me.name, t);
            setText("");
            reload();
          }}
        >
          Add
        </Button>
      </div>

      {!me && (
        <div className="mt-2 text-xs text-red-600 font-semibold">
          Login/session required to post notes.
        </div>
      )}

      {state.notes.length > 0 ? (
        <div className="mt-3 space-y-2">
          {state.notes.map((n) => (
            <div
              key={n.id}
              className="rounded-2xl border border-gray-200 bg-gray-50 p-2"
            >
              <div className="text-xs font-extrabold text-gray-900">{n.by}</div>
              <div className="text-sm text-gray-700 mt-1">{n.text}</div>
              {(n.replies ?? []).length > 0 && (
                <div className="mt-2 space-y-1">
                  {n.replies!.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                    >
                      <span className="font-semibold">{r.by}</span> {r.text}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                  onClick={() =>
                    setReplyOpen((prev) => ({ ...prev, [n.id]: !prev[n.id] }))
                  }
                >
                  Reply
                </button>
                <button
                  type="button"
                  className="text-xs font-extrabold text-red-600 hover:underline"
                  onClick={() => {
                    deleteEventNote(groupId, itemId, n.id);
                    reload();
                  }}
                >
                  Delete
                </button>
              </div>
              {replyOpen[n.id] && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={replyDrafts[n.id] ?? ""}
                    onChange={(e) =>
                      setReplyDrafts((prev) => ({
                        ...prev,
                        [n.id]: e.target.value,
                      }))
                    }
                    placeholder="Write a reply…"
                    className="flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                  />
                  <Button
                    variant="primary"
                    disabled={!me || !(replyDrafts[n.id] ?? "").trim()}
                    onClick={() => {
                      if (!me) return;
                      const t = (replyDrafts[n.id] ?? "").trim();
                      if (!t) return;
                      addEventNoteReply(groupId, itemId, n.id, me.name, t);
                      setReplyDrafts((prev) => ({ ...prev, [n.id]: "" }));
                      setReplyOpen((prev) => ({ ...prev, [n.id]: false }));
                      reload();
                    }}
                  >
                    Send
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-sm text-gray-600">No notes yet.</div>
      )}
    </Card>
  );
}
