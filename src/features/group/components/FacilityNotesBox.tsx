import { useEffect, useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import {
  addFacilityNote,
  deleteFacilityNote,
  readFacility,
  saveFacilityBasics,
  syncPlanExtrasFromRemote,
} from "../../../lib/planExtrasDb";

export function FacilityNotesBox({
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
  const [note, setNote] = useState("");

  const [state, setState] = useState(() => readFacility(groupId, itemId));

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        await syncPlanExtrasFromRemote(groupId, itemId);
      } catch {
        // ignore
      }
      if (mounted) setState(readFacility(groupId, itemId));
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [groupId, itemId, version]);

  function reload() {
    setState(readFacility(groupId, itemId));
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

      <div className="text-sm font-extrabold text-gray-900">🏨 Facilities</div>
      <div className="mt-1 text-xs text-gray-600 font-semibold">
        Wi-Fi, parking, accommodation info
      </div>

      <div className="mt-3 grid gap-2">
        <div>
          <div className="text-xs font-extrabold text-gray-900">Wi-Fi</div>
          <input
            defaultValue={state.wifi}
            placeholder="Wi-Fi name / password..."
            className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
            onBlur={(e) => {
              saveFacilityBasics(groupId, itemId, { wifi: e.target.value });
              reload();
            }}
          />
        </div>

        <div>
          <div className="text-xs font-extrabold text-gray-900">Parking</div>
          <input
            defaultValue={state.parking}
            placeholder="Parking rules / spot / ticket..."
            className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
            onBlur={(e) => {
              saveFacilityBasics(groupId, itemId, { parking: e.target.value });
              reload();
            }}
          />
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
        <div className="text-xs font-extrabold text-gray-900">
          Extra facility notes
        </div>

        <div className="mt-2 flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., Check-in 2PM, lift on left..."
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
          />
          <Button
            variant="primary"
            disabled={!me}
            onClick={() => {
              if (!me) return;
              const t = note.trim();
              if (!t) return;
              addFacilityNote(groupId, itemId, me.name, t);
              setNote("");
              reload();
            }}
          >
            Add
          </Button>
        </div>

        {!me && (
          <div className="mt-2 text-xs text-red-600 font-semibold">
            Login/session required to add notes.
          </div>
        )}

        {state.notes.length > 0 && (
          <div className="mt-3 space-y-2">
            {state.notes.map((n) => (
              <div
                key={n.id}
                className="rounded-2xl border border-gray-200 bg-white p-2"
              >
                <div className="text-xs font-extrabold text-gray-900">
                  {n.by}
                </div>
                <div className="text-sm text-gray-700 mt-1">{n.text}</div>
                <button
                  type="button"
                  className="mt-2 text-xs font-extrabold text-red-600 hover:underline"
                  onClick={() => {
                    deleteFacilityNote(groupId, itemId, n.id);
                    reload();
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
