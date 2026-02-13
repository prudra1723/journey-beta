import type { PlanDayKey, PlanItem } from "./betaDb";

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeICS(s: string) {
  return s
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function toICSDateLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

export function downloadPlanAsIcs(
  groupName: string,
  groupId: string,
  planAll: PlanItem[],
) {
  const now = new Date();
  const dayIndex: Record<PlanDayKey, number> = {
    mon: 0,
    tue: 1,
    wed: 2,
    thu: 3,
    fri: 4,
    sat: 5,
    sun: 6,
  };
  const base = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );

  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Journey//Group Plan//EN");
  lines.push("CALSCALE:GREGORIAN");

  for (const item of planAll) {
    const di = dayIndex[item.day] ?? 0;
    const [sh, sm] = item.startTime.split(":").map((x: string) => Number(x));
    const start = new Date(base);
    start.setDate(base.getDate() + di);
    start.setHours(
      Number.isFinite(sh) ? sh : 9,
      Number.isFinite(sm) ? sm : 0,
      0,
    );

    const end = new Date(start);
    if (item.endTime) {
      const [eh, em] = item.endTime.split(":").map((x: string) => Number(x));
      end.setHours(
        Number.isFinite(eh) ? eh : start.getHours(),
        Number.isFinite(em) ? em : start.getMinutes(),
        0,
      );
    } else {
      end.setMinutes(end.getMinutes() + 60);
    }

    const uid = `${groupId}-${item.id}@journey-beta`;
    const dtstamp = toICSDateLocal(new Date());

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeICS(uid)}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${toICSDateLocal(start)}`);
    lines.push(`DTEND:${toICSDateLocal(end)}`);
    lines.push(`SUMMARY:${escapeICS(item.title)}`);

    const desc = [
      item.note ? `Note: ${item.note}` : "",
      item.mapUrl ? `Map: ${item.mapUrl}` : "",
      `Added by: ${item.createdBy.name}`,
    ]
      .filter(Boolean)
      .join("\\n");

    if (desc) lines.push(`DESCRIPTION:${escapeICS(desc)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  downloadTextFile(
    `${groupName.replaceAll(" ", "_")}_plan.ics`,
    lines.join("\r\n"),
    "text/calendar",
  );
}
