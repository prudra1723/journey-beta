// src/features/group/components/PlanSection.tsx
import { useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import type { PlanDayKey, PlanItem } from "../../../lib/betaDb";
import {
  addPlanItem,
  deletePlanItem,
  getPlan,
  updatePlanItem,
} from "../../../lib/appDb";
import { PlanCardActions } from "./PlanCardActions";
import { FacilityNotesBox } from "./FacilityNotesBox";
import { DinnerMenuBox } from "./DinnerMenuBox";

const dayMeta: { key: PlanDayKey; label: string; title: string }[] = [
  { key: "mon", label: "Mon", title: "Monday" },
  { key: "tue", label: "Tue", title: "Tuesday" },
  { key: "wed", label: "Wed", title: "Wednesday" },
  { key: "thu", label: "Thu", title: "Thursday" },
  { key: "fri", label: "Fri", title: "Friday" },
  { key: "sat", label: "Sat", title: "Saturday" },
  { key: "sun", label: "Sun", title: "Sunday" },
];

function isPandeyNiwasDinner(item: PlanItem) {
  const t = `${item.title} ${item.note ?? ""}`.toLowerCase();
  return t.includes("pandey niwas") || t.includes("dinner");
}

export function PlanSection({
  groupId,
  me,
}: {
  groupId: string;
  me: { userId: string; name: string } | null;
}) {
  const [activeDay, setActiveDay] = useState<PlanDayKey>("mon");
  const [editing, setEditing] = useState<PlanItem | null>(null);
  const [openForm, setOpenForm] = useState(false);

  const [form, setForm] = useState({
    day: activeDay,
    startTime: "09:00",
    endTime: "",
    title: "",
    note: "",
    mapUrl: "",
  });

  const [all, setAll] = useState<PlanItem[]>([]);
  const items = useMemo(
    () => all.filter((x) => x.day === activeDay),
    [all, activeDay],
  );

  useEffect(() => {
    let mounted = true;
    async function load() {
      const list = await getPlan(groupId);
      if (!mounted) return;
      setAll(list);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [groupId]);

  function openAdd() {
    setEditing(null);
    setForm({
      day: activeDay,
      startTime: "09:00",
      endTime: "",
      title: "",
      note: "",
      mapUrl: "",
    });
    setOpenForm(true);
  }

  function openEdit(item: PlanItem) {
    setEditing(item);
    setForm({
      day: item.day,
      startTime: item.startTime,
      endTime: item.endTime ?? "",
      title: item.title,
      note: item.note ?? "",
      mapUrl: item.mapUrl ?? "",
    });
    setOpenForm(true);
  }

  async function save() {
    if (!me) {
      alert("Login/session required.");
      return;
    }
    if (!form.title.trim() || !form.startTime.trim()) return;

    if (!editing) {
      await addPlanItem(groupId, {
        day: form.day,
        startTime: form.startTime,
        endTime: form.endTime.trim() ? form.endTime.trim() : undefined,
        title: form.title.trim(),
        note: form.note.trim() ? form.note.trim() : undefined,
        mapUrl: form.mapUrl.trim() ? form.mapUrl.trim() : undefined,
        createdBy: { userId: me.userId, name: me.name },
      });
    } else {
      await updatePlanItem(groupId, editing.id, {
        day: form.day,
        startTime: form.startTime,
        endTime: form.endTime.trim() ? form.endTime.trim() : undefined,
        title: form.title.trim(),
        note: form.note.trim() ? form.note.trim() : undefined,
        mapUrl: form.mapUrl.trim() ? form.mapUrl.trim() : undefined,
      });
    }

    setOpenForm(false);
    setEditing(null);
    const list = await getPlan(groupId);
    setAll(list);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-lg font-extrabold text-gray-900">
              Trip Plan • {dayMeta.find((d) => d.key === activeDay)?.title}
            </div>
            <div className="mt-1 text-sm text-gray-600">
              Cards + Add/Remove + Menu dropdown + Facility notes (saved
              forever).
            </div>
          </div>

          <Button variant="orange" onClick={openAdd}>
            + Add
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {dayMeta.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setActiveDay(d.key)}
              className={[
                "px-4 py-2 rounded-2xl border text-sm font-semibold transition",
                activeDay === d.key
                  ? "bg-blue-600 text-white border-blue-600 shadow-soft"
                  : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50 shadow-soft",
              ].join(" ")}
            >
              {d.label}
            </button>
          ))}
        </div>
      </Card>

      {openForm && (
        <Card>
          <div className="flex items-start justify-between gap-2">
            <div className="text-lg font-extrabold text-gray-900">
              {editing ? "Edit item" : "Add item"}
            </div>
            <Button variant="ghost" onClick={() => setOpenForm(false)}>
              Close
            </Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-gray-900">Day</label>
              <select
                value={form.day}
                onChange={(e) =>
                  setForm((f) => ({ ...f, day: e.target.value as PlanDayKey }))
                }
                className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
              >
                {dayMeta.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-gray-900">
                  Start
                </label>
                <input
                  value={form.startTime}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startTime: e.target.value }))
                  }
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-900">
                  End
                </label>
                <input
                  value={form.endTime}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endTime: e.target.value }))
                  }
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-gray-900">
                Title
              </label>
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="e.g. Dinner at Pandey Niwas"
                className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-gray-900">
                Note
              </label>
              <input
                value={form.note}
                onChange={(e) =>
                  setForm((f) => ({ ...f, note: e.target.value }))
                }
                className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-gray-900">
                Map URL
              </label>
              <input
                value={form.mapUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mapUrl: e.target.value }))
                }
                placeholder="https://maps.google.com/?q=..."
                className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
              />
            </div>
          </div>

          <div className="mt-4">
            <Button variant="primary" onClick={save}>
              {editing ? "Save changes" : "Add"}
            </Button>
          </div>
        </Card>
      )}

      {/* Cards list */}
      {items.length === 0 ? (
        <Card>
          <div className="text-gray-700 font-semibold">
            No plan items for this day.
          </div>
        </Card>
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-gray-600 font-semibold">
                  {item.startTime}
                  {item.endTime ? ` – ${item.endTime}` : ""}
                </div>
                <div className="mt-1 text-lg font-extrabold text-gray-900">
                  {item.title}
                </div>
                {item.note && (
                  <div className="mt-1 text-sm text-gray-700">{item.note}</div>
                )}
                <div className="mt-2 text-xs text-gray-500">
                  Added by{" "}
                  <span className="font-semibold">{item.createdBy.name}</span>
                </div>

                {/* ✅ Bring back Pandey Niwas dropdown menu */}
                {isPandeyNiwasDinner(item) && (
                  <DinnerMenuBox
                    groupId={groupId}
                    itemId={item.id}
                    me={me}
                    show
                  />
                )}

                {/* ✅ Facility notes back */}
                <FacilityNotesBox
                  groupId={groupId}
                  itemId={item.id}
                  me={me}
                />
              </div>

              <div className="shrink-0">
                <PlanCardActions
                  mapUrl={item.mapUrl}
                  onEdit={() => openEdit(item)}
                  onDelete={async () => {
                    await deletePlanItem(groupId, item.id);
                    const list = await getPlan(groupId);
                    setAll(list);
                  }}
                />
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
