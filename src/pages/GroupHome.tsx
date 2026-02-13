import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import type { PlanDayKey, PlanItem } from "../lib/betaDb";
import { getSession } from "../lib/session";
import ChatWidget from "../components/ChatWidget";
import TimelineTab from "../components/TimeLineTab";
import logo from "../assets/logo.png";
import navIcon from "../assets/nav-icon.svg";
import defaultHeaderImage from "../assets/header1.jpg";
import {
  addMedia,
  addPlanItem,
  addTimelinePost,
  deleteMedia,
  deletePlanItem,
  getGroup,
  getGroupMeta,
  getMyRole,
  getPlan,
  getTimeline,
  readMedia,
  updateGroupName,
  updatePlanItem,
} from "../lib/appDb";
import { UserAvatar } from "../components/UserAvatar";
import { loadDb } from "../lib/db/storage";
import { fileToDataUrl } from "../features/chat/lib/chatUi";
import {
  readAbout,
  readMenuText,
  readPlanComments,
  readSubItems,
  setAbout,
  saveFacilityBasics,
  setSubItems,
  setMenuItems,
  addPlanComment,
  deletePlanComment,
  pushPlanExtrasToRemote,
  syncPlanExtrasFromRemote,
} from "../lib/planExtrasDb";

import { HeaderDrawer } from "../features/group/components/HeaderDrawer";
import { DinnerMenuBox } from "../features/group/components/DinnerMenuBox";
import { FacilityNotesBox } from "../features/group/components/FacilityNotesBox";
import { EventNotesBox } from "../features/group/components/EventNotesBox";
import { readGroupHeaderImage } from "../lib/groupHeaderImage";

type TabKey = "timeline" | "plan" | "media";

const ABOUT_OPTIONS = [
  { value: "", label: "Select type" },
  { value: "travel", label: "Travel" },
  { value: "food", label: "Food" },
  { value: "stay", label: "Stay" },
  { value: "activity", label: "Activity" },
  { value: "shopping", label: "Shopping" },
  { value: "other", label: "Other" },
] as const;

const TARGET_GROUP_NAME = "Queensland Toli to sydney Trip 2026";

function TabPill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 sm:px-4 py-2 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-semibold transition",
        active
          ? "bg-yellow-200 border-yellow-300 text-gray-900 shadow-sm"
          : "bg-white border-gray-200 text-gray-900 hover:bg-gray-50 shadow-sm",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

const dayMeta: { key: PlanDayKey; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function dayKeyFromDate(value: string): PlanDayKey | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getDay();
  if (day === 0) return "sun";
  if (day === 1) return "mon";
  if (day === 2) return "tue";
  if (day === 3) return "wed";
  if (day === 4) return "thu";
  if (day === 5) return "fri";
  return "sat";
}

function dayTitle(d: PlanDayKey) {
  if (d === "mon") return "Monday";
  if (d === "tue") return "Tuesday";
  if (d === "wed") return "Wednesday";
  if (d === "thu") return "Thursday";
  if (d === "fri") return "Friday";
  if (d === "sat") return "Saturday";
  return "Sunday";
}

// decide when to show Pandey Niwas dinner menu (you can adjust)
function shouldShowDinner(item: PlanItem) {
  const t = `${item.title} ${item.note ?? ""}`.toLowerCase();
  return t.includes("dinner") || t.includes("pandey niwas");
}

const EXPLORE_OPTIONS = [
  { value: "cafe", label: "Cafe" },
  { value: "restaurant", label: "Restaurants" },
  { value: "lunch", label: "Lunch" },
  { value: "hotel", label: "Hotels" },
  { value: "tourism", label: "Things to do" },
  { value: "transport", label: "Public transport" },
  { value: "parking", label: "Parking" },
  { value: "pharmacy", label: "Chemists" },
  { value: "atm", label: "ATM" },
  { value: "area", label: "About area" },
] as const;

const CSV_TEMPLATE = [
  "day,about_day,day_note,wifi,parking,start_time,end_time,title,food_menu,map_links,notes",
  'wed,food,"Arrival 04/03/2026 · Password: PandeyNiwas",PandeyNiwas Guest,,18:30,20:00,"Dinner – Pandey Niwas","Dhindo set with local rooster | Thakali khana set with mutton | Newari khaja set | Fruit salad","https://maps.google.com/?q=95+Lacerta+Rd+Austral+NSW+2179","Dinner Menu Voting"',
  'wed,food,Arrival 04/03/2026,PandeyNiwas Guest,,21:00,,"Rest & Sleep",,,"Early night (big days coming)"',
  'thu,travel,City & Manly Day,,,08:30,,Leave Home,,https://maps.google.com/?q=Circular+Quay+Sydney+NSW+2000,"Destination – Circular Quay"',
  'thu,travel,City & Manly Day,,,09:00,09:30,"Arrive Circular Quay",,https://maps.google.com/?q=Circular+Quay+Sydney+NSW+2000,"Coffee / Photos / Tickets"',
  'thu,travel,City & Manly Day,,,09:45,10:15,"Ferry: Circular Quay → Manly",,https://transportnsw.info/routes/ferry,"Ferry timetable"',
  'thu,travel,City & Manly Day,,,10:15,12:30,"Manly Beach Walk",,https://maps.google.com/?q=Manly+Beach+NSW,',
  'thu,travel,City & Manly Day,,,10:30,12:30,"Explore The Corso",,https://maps.google.com/?q=The+Corso+Manly,',
  'thu,travel,City & Manly Day,,,12:30,13:30,"Lunch at Manly","Beer next to the beach | Seafood platter 🐟","https://maps.google.com/?q=Manly+NSW","Menu idea"',
  'thu,travel,City & Manly Day,,,14:00,14:30,"Ferry Return: Manly → Circular Quay",,https://transportnsw.info/routes/ferry,',
  'thu,travel,City & Manly Day,,,14:45,15:30,"Opera House Walk",,https://maps.google.com/?q=Sydney+Opera+House,',
  'thu,travel,City & Manly Day,,,15:00,15:30,"Harbour Bridge Views",,https://maps.google.com/?q=Sydney+Harbour+Bridge,',
  'thu,travel,City & Manly Day,,,15:30,16:15,"Travel to Darling Harbour",,https://maps.google.com/?q=Darling+Harbour+Sydney,',
  'thu,travel,City & Manly Day,,,16:15,17:45,"Sea Life Aquarium",,https://maps.google.com/?q=Sea+Life+Sydney+Aquarium,"Optional – Choose ONE"',
  'thu,travel,City & Manly Day,,,16:15,17:45,"Madame Tussauds",,https://maps.google.com/?q=Madame+Tussauds+Sydney,"Optional – Choose ONE"',
  'thu,travel,City & Manly Day,,,18:00,19:00,"Momo’s Hub – Dinner",,https://maps.google.com/?q=Momos+Hub+Sydney,',
  'thu,travel,City & Manly Day,,,19:00,20:00,"Travel Back Home",,,"Night – Rest"',
  'fri,travel,Blue Mountains (Travel + Relax),,,12:00,,"Leave Sydney → Blue Mountains",,https://maps.google.com/?q=Blue+Mountains+NSW,',
  'fri,travel,Blue Mountains (Travel + Relax),,,15:00,17:00,"Short Walks / Views / Relax",,,""',
  'fri,travel,Blue Mountains (Travel + Relax),,,18:00,22:00,"BBQ Night 🔥 + Rakshi Night 🍶","Lamb | Chicken | Pork | Beer | Hard Drinks | Wine",,"Karaoke + Dance Party"',
  'fri,travel,Blue Mountains (Travel + Relax),,,22:00,,"Sleep at Hotel",,,"Night – Sleep at Hotel"',
  'sat,activity,Blue Mountains Tour,,,09:30,10:30,"Echo Point / Three Sisters",,https://maps.google.com/?q=Echo+Point+Three+Sisters,',
  'sat,activity,Blue Mountains Tour,,,11:00,13:30,"Scenic World",,https://maps.google.com/?q=Scenic+World+Katoomba,',
  'sat,activity,Blue Mountains Tour,,,13:30,14:30,"Lunch – Leura / Katoomba",,https://maps.google.com/?q=Leura+Village,',
  'sat,activity,Blue Mountains Tour,,,16:30,17:30,"Wentworth Falls",,https://maps.google.com/?q=Wentworth+Falls+NSW,',
  'sat,activity,Blue Mountains Tour,,,18:30,,"Dinner",,,"Evening"',
  'sat,activity,Blue Mountains Tour,,,19:30,,"Light Rakshi Party 🍶",,,"Evening"',
  'sat,activity,Blue Mountains Tour,,,20:30,,"Karaoke & Dance",,,"Evening"',
  'sat,activity,Blue Mountains Tour,,,22:00,,"Rest",,,"Rest"',
  'sun,travel,South Coast Day Trip,,,08:00,,"Leave → Helensburgh",,https://maps.google.com/?q=Helensburgh+NSW,',
  'sun,travel,South Coast Day Trip,,,11:00,,"Sea Cliff Bridge",,https://maps.google.com/?q=Sea+Cliff+Bridge,',
  'sun,travel,South Coast Day Trip,,,12:30,,"Lunch – Kiama",,https://maps.google.com/?q=Kiama+NSW,',
  'sun,travel,South Coast Day Trip,,,13:30,,"Kiama Blowhole",,https://maps.google.com/?q=Kiama+Blowhole,',
  'sun,travel,South Coast Day Trip,,,15:30,,"Nan Tien Temple",,https://maps.google.com/?q=Nan+Tien+Temple,',
  'sun,travel,South Coast Day Trip,,,19:00,,"Nice Dinner / Momo 😄",,,"Trip Complete 🎉 · We will plan another trip again! ✈️"',
].join("\n");

function parseDayKey(value: string): PlanDayKey | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v.includes("-") && v.length >= 8) {
    const key = dayKeyFromDate(v);
    if (key) return key;
  }
  if (v.startsWith("mon")) return "mon";
  if (v.startsWith("tue")) return "tue";
  if (v.startsWith("wed")) return "wed";
  if (v.startsWith("thu")) return "thu";
  if (v.startsWith("fri")) return "fri";
  if (v.startsWith("sat")) return "sat";
  if (v.startsWith("sun")) return "sun";
  return null;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (ch === "," || ch === "\n" || ch === "\r")) {
      row.push(cell);
      cell = "";
      if (ch === "\n" || (ch === "\r" && next !== "\n")) {
        if (row.some((v) => v.trim().length > 0)) rows.push(row);
        row = [];
      }
      continue;
    }

    cell += ch;
  }

  row.push(cell);
  if (row.some((v) => v.trim().length > 0)) rows.push(row);
  return rows;
}

function exploreQuery(kind: (typeof EXPLORE_OPTIONS)[number]["value"]) {
  if (kind === "cafe") return "cafe";
  if (kind === "restaurant") return "restaurants";
  if (kind === "lunch") return "lunch restaurant";
  if (kind === "hotel") return "hotels";
  if (kind === "tourism") return "things to do";
  if (kind === "transport") return "public transport";
  if (kind === "parking") return "parking";
  if (kind === "pharmacy") return "pharmacy";
  if (kind === "atm") return "atm";
  return "things to do";
}

function extractLocationFromMapUrl(mapUrl: string) {
  try {
    const url = new URL(mapUrl);
    const q =
      url.searchParams.get("q") ??
      url.searchParams.get("query") ??
      url.searchParams.get("destination");
    if (q) return q;
    const match = url.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) return `${match[1]},${match[2]}`;
  } catch {
    // ignore
  }
  return mapUrl;
}

function parseMapUrls(mapUrl?: string | null) {
  if (!mapUrl) return [];
  const raw = mapUrl.replace(/\r/g, "").trim();
  if (!raw) return [];
  const byPipeOrNewline = raw
    .split(/\n|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byPipeOrNewline.length > 1) return byPipeOrNewline;
  const httpCount = (raw.match(/https?:\/\//g) ?? []).length;
  if (httpCount > 1) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [raw];
}

export function GroupHome({
  groupId,
  onBack,
}: {
  groupId: string;
  onBack: () => void;
}) {
  const [group, setGroup] = useState<{
    id: string;
    name: string;
    code: string;
  } | null>(null);
  const [groupMeta, setGroupMeta] = useState<{
    groupType?: string;
    description?: string;
    eventDate?: string;
  }>({});
  const [myRole, setMyRole] = useState<"host" | "admin" | "member">("member");
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [groupError, setGroupError] = useState<string | null>(null);

  const session = getSession();
  const sessionUserId = session?.userId ?? null;
  const me = session ? { userId: session.userId, name: session.name } : null;

  const UI_KEY = `journey_beta_group_ui_v1:${groupId}`;

  const [tab, setTab] = useState<TabKey>(() => {
    try {
      const raw = localStorage.getItem(UI_KEY);
      if (!raw) return "timeline";
      const parsed = JSON.parse(raw) as { tab?: TabKey };
      return parsed.tab ?? "timeline";
    } catch {
      return "timeline";
    }
  });

  const [activeDay, setActiveDay] = useState<PlanDayKey>(() => {
    try {
      const raw = localStorage.getItem(UI_KEY);
      if (!raw) return "mon";
      const parsed = JSON.parse(raw) as { activeDay?: PlanDayKey };
      return parsed.activeDay ?? "mon";
    } catch {
      return "mon";
    }
  });

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(UI_KEY);
      if (!raw) return "";
      const parsed = JSON.parse(raw) as { selectedDate?: string };
      return parsed.selectedDate ?? "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        UI_KEY,
        JSON.stringify({ tab, activeDay, selectedDate }),
      );
    } catch {
      // ignore
    }
  }, [UI_KEY, tab, activeDay, selectedDate]);

  const [refresh, setRefresh] = useState(0);
  void refresh;

  const [metaVersion, setMetaVersion] = useState(0);
  void metaVersion;

  const groupTypeLabel = useMemo(() => {
    const t = groupMeta.groupType?.trim();
    if (!t) return "Tour / Trip";
    if (t === "birthday") return "Birthday Party";
    if (t === "baby_shower") return "Baby Shower";
    if (t === "event") return "Event";
    if (t === "other") return "Other";
    if (t === "tour") return "Tour / Trip";
    return t;
  }, [groupMeta.groupType]);

  // ✅ Drawer open/close (fixes your alert issue)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mediaVersion, setMediaVersion] = useState(0);
  void mediaVersion;
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const templateInputRef = useRef<HTMLInputElement | null>(null);
  const [customHeaderBg, setCustomHeaderBg] = useState<string | null>(() =>
    readGroupHeaderImage(groupId),
  );
  const headerBg = customHeaderBg ?? defaultHeaderImage;
  const autoRenamedRef = useRef(false);

  const [editingId, setEditingId] = useState<string | null>(null);

  function makeSubItem(overrides?: Partial<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    foodMenu: string;
    mapUrl: string;
    note: string;
  }>) {
    return {
      id: overrides?.id ?? `sub_${Math.random().toString(36).slice(2, 9)}`,
      title: overrides?.title ?? "",
      startTime: overrides?.startTime ?? "09:00",
      endTime: overrides?.endTime ?? "",
      foodMenu: overrides?.foodMenu ?? "",
      mapUrl: overrides?.mapUrl ?? "",
      note: overrides?.note ?? "",
    };
  }

  const [form, setForm] = useState<{
    day: PlanDayKey;
    about: string;
    note: string;
    subItems: Array<{
      id: string;
      title: string;
      startTime: string;
      endTime: string;
      foodMenu: string;
      mapUrl: string;
      note: string;
    }>;
  }>({
    day: activeDay,
    about: "",
    note: "",
    subItems: [makeSubItem()],
  });

  function handleActiveDayChange(day: PlanDayKey) {
    setActiveDay(day);
    setForm((f) => ({ ...f, day }));
  }

  const [planAll, setPlanAll] = useState<PlanItem[]>([]);
  const planForDay = planAll.filter((x) => x.day === activeDay);
  const [planError, setPlanError] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<
    {
      id: string;
      dataUrl: string;
      visibility: "group" | "private" | "shared";
      createdBy: { userId: string; name: string };
    }[]
  >([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaVisibility, setMediaVisibility] = useState<
    "group" | "private" | "shared"
  >("group");
  const [showForm, setShowForm] = useState(false);
  const [exploreTypeBySub, setExploreTypeBySub] = useState<
    Record<string, (typeof EXPLORE_OPTIONS)[number]["value"]>
  >({});
  const [activeMapIndexBySub, setActiveMapIndexBySub] = useState<
    Record<string, number>
  >({});
  const [planCommentDrafts, setPlanCommentDrafts] = useState<
    Record<string, string>
  >({});
  const [planCommentImageDrafts, setPlanCommentImageDrafts] = useState<
    Record<string, string | null>
  >({});
  const [openPlanMenuId, setOpenPlanMenuId] = useState<string | null>(null);
  const [extrasVersion, setExtrasVersion] = useState(0);
  void extrasVersion;

  useEffect(() => {
    let mounted = true;
    async function loadGroup() {
      setLoadingGroup(true);
      setGroupError(null);
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(new Error("Group load timed out. Check your network.")),
            15000,
          ),
        );
        const [g, meta] = await Promise.race([
          Promise.all([getGroup(groupId), getGroupMeta(groupId)]),
          timeout,
        ]);
        if (!mounted) return;
        setGroup(g ? { id: g.id, name: g.name, code: g.code } : null);
        setGroupMeta(meta);
        if (session) {
          const role = await getMyRole(groupId, session.userId);
          if (mounted) setMyRole(role);
          if (
            !autoRenamedRef.current &&
            g &&
            role !== "member" &&
            g.name !== TARGET_GROUP_NAME
          ) {
            autoRenamedRef.current = true;
            try {
              await updateGroupName(groupId, TARGET_GROUP_NAME);
              if (mounted) {
                setGroup({
                  id: g.id,
                  name: TARGET_GROUP_NAME,
                  code: g.code,
                });
              }
            } catch {
              // ignore rename errors
            }
          }
        }
      } catch (err) {
        const msg =
          (err as { message?: string })?.message ??
          "Could not load this group.";
        if (mounted) setGroupError(msg);
      } finally {
        if (mounted) setLoadingGroup(false);
      }
    }
    void loadGroup();
    return () => {
      mounted = false;
    };
  }, [groupId, metaVersion, sessionUserId]);

  useEffect(() => {
    setCustomHeaderBg(readGroupHeaderImage(groupId));
  }, [groupId]);

  useEffect(() => {
    let mounted = true;
    async function loadPlan() {
      try {
        const list = await getPlan(groupId);
        if (!mounted) return;
        setPlanAll(list);
        setPlanError(null);
      } catch (err) {
        const msg =
          (err as { message?: string })?.message ??
          "Could not load plan items.";
        if (mounted) setPlanError(msg);
      }
    }
    void loadPlan();
    return () => {
      mounted = false;
    };
  }, [groupId, refresh]);

  useEffect(() => {
    if (planAll.length === 0) return;
    let mounted = true;
    const syncAll = async () => {
      try {
        await Promise.all(
          planAll.map((item) =>
            syncPlanExtrasFromRemote(groupId, item.id).catch(() => null),
          ),
        );
      } finally {
        if (mounted) setExtrasVersion((v) => v + 1);
      }
    };
    void syncAll();
    return () => {
      mounted = false;
    };
  }, [groupId, planAll]);

  useEffect(() => {
    if (planAll.length === 0) return;
    const hasActive = planAll.some((item) => item.day === activeDay);
    if (hasActive) return;
    const next = dayMeta.find((d) =>
      planAll.some((item) => item.day === d.key),
    );
    if (next) handleActiveDayChange(next.key);
  }, [planAll, activeDay]);

  useEffect(() => {
    let mounted = true;
    async function loadMedia() {
      try {
        const list = await readMedia(groupId);
        if (!mounted) return;
        setMediaItems(list);
        setMediaError(null);
      } catch (err) {
        const msg =
          (err as { message?: string })?.message ??
          "Could not load media.";
        if (mounted) setMediaError(msg);
      }
    }
    void loadMedia();
    return () => {
      mounted = false;
    };
  }, [groupId, mediaVersion]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenPlanMenuId(null);
    }

    function onMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-plan-menu]")) return;
      if (target.closest("[data-plan-menu-button]")) return;
      setOpenPlanMenuId(null);
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  if (loadingGroup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50">
        <div className="mx-auto w-[95%] max-w-5xl py-6">
          <Card>{groupError ? groupError : "Loading group…"}</Card>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50">
        <div className="mx-auto w-[95%] max-w-5xl py-6">
          <Card>
            <div className="text-xl font-extrabold text-gray-900">
              {groupError ? "Could not load group" : "Group not found"}
            </div>
            {groupError && (
              <div className="mt-2 text-sm text-gray-600">{groupError}</div>
            )}
            <Button className="mt-4" onClick={onBack}>
              Back
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  function openAdd() {
    setEditingId(null);
    setShowForm(true);
    setForm({
      day: activeDay,
      about: "",
      note: "",
      subItems: [makeSubItem()],
    });
  }

  function openEdit(item: PlanItem) {
    setOpenPlanMenuId(null);
    setEditingId(item.id);
    setShowForm(true);
    const about = readAbout(groupId, item.id);
    const subItems = readSubItems(groupId, item.id);
    setForm({
      day: item.day,
      about,
      note: item.note ?? "",
      subItems:
        subItems.length > 0
          ? subItems.map((s) =>
              makeSubItem({
                id: s.id,
                title: s.title,
                startTime: s.startTime,
                endTime: s.endTime ?? "",
                foodMenu: s.foodMenu ?? "",
                mapUrl: s.mapUrl ?? "",
                note: s.note ?? "",
              }),
            )
          : [
              makeSubItem({
                title: item.title,
                startTime: item.startTime,
                endTime: item.endTime ?? "",
                mapUrl: item.mapUrl ?? "",
              }),
            ],
    });
  }

  async function savePlan(opts?: { keepOpen?: boolean }) {
    if (!session) return;
    const about = form.about.trim();
    const cleanedSubItems = form.subItems
      .map((s) => ({
        id: s.id,
        title: s.title.trim(),
        startTime: s.startTime.trim(),
        endTime: s.endTime.trim(),
        foodMenu: s.foodMenu.trim(),
        mapUrl: s.mapUrl.trim(),
        note: s.note.trim(),
      }))
      .filter(
        (s) =>
          s.title ||
          s.startTime ||
          s.endTime ||
          s.foodMenu ||
          s.mapUrl ||
          s.note,
      );

    const validSubItems = cleanedSubItems.filter(
      (s) => s.title && s.startTime,
    );

    if (validSubItems.length === 0) return;

    const primary = validSubItems[0];

    const aggregatedMenuText = validSubItems
      .map((s) => s.foodMenu)
      .filter(Boolean)
      .join(", ");
    const menuItems = aggregatedMenuText
      ? aggregatedMenuText.split(",").map((x) => x.trim()).filter(Boolean)
      : [];

    if (!editingId) {
      const created = await addPlanItem(groupId, {
        day: form.day,
        startTime: primary.startTime,
        endTime: primary.endTime ? primary.endTime : undefined,
        title: primary.title,
        note: form.note.trim() ? form.note.trim() : undefined,
        mapUrl: primary.mapUrl ? primary.mapUrl : undefined,
        createdBy: { userId: session.userId, name: session.name },
      });
      const id = (created as { id?: string } | null)?.id;
      if (id) {
        setAbout(groupId, id, about);
        setSubItems(
          groupId,
          id,
          validSubItems.map((s) => ({
            id: s.id,
            title: s.title,
            startTime: s.startTime,
            endTime: s.endTime || undefined,
            foodMenu: s.foodMenu || undefined,
            mapUrl: s.mapUrl || undefined,
            note: s.note || undefined,
            createdAt: Date.now(),
          })),
        );
        if (menuItems.length > 0) {
          setMenuItems(groupId, id, menuItems, aggregatedMenuText);
        }
      }
    } else {
      await updatePlanItem(groupId, editingId, {
        day: form.day,
        startTime: primary.startTime,
        endTime: primary.endTime ? primary.endTime : undefined,
        title: primary.title,
        note: form.note.trim() ? form.note.trim() : undefined,
        mapUrl: primary.mapUrl ? primary.mapUrl : undefined,
      });
      setAbout(groupId, editingId, about);
      setSubItems(
        groupId,
        editingId,
        validSubItems.map((s) => ({
          id: s.id,
          title: s.title,
          startTime: s.startTime,
          endTime: s.endTime || undefined,
          foodMenu: s.foodMenu || undefined,
          mapUrl: s.mapUrl || undefined,
          note: s.note || undefined,
          createdAt: Date.now(),
        })),
      );
      if (menuItems.length > 0) {
        setMenuItems(groupId, editingId, menuItems, aggregatedMenuText);
      }
    }

    setEditingId(null);
    const keepOpen = opts?.keepOpen === true && !editingId;
    if (keepOpen) {
      setForm({
        day: activeDay,
        about: form.about,
        note: "",
        subItems: [makeSubItem({ startTime: primary.startTime })],
      });
      setShowForm(true);
    } else {
      setShowForm(false);
    }
    setRefresh((x) => x + 1);
  }

  function openStart(mapUrl: string) {
    const destination = extractLocationFromMapUrl(mapUrl);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      destination,
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openExplore(mapUrl: string, kind: (typeof EXPLORE_OPTIONS)[number]["value"]) {
    const location = extractLocationFromMapUrl(mapUrl);
    const query = `${exploreQuery(kind)} near ${location}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      query,
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function downloadPlanTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "journey-plan-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function uploadPlanTemplate(file: File) {
    if (!session) return;
    const ok = confirm(
      "This will replace the current plan with the uploaded template. Continue?",
    );
    if (!ok) return;

    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      alert("Template is empty.");
      return;
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const hasHeader = header.some((h) =>
      ["day", "day_key", "day_name", "date"].includes(h),
    );

    const fallbackOrder = [
      "day",
      "about_day",
      "day_note",
      "wifi",
      "parking",
      "start_time",
      "end_time",
      "title",
      "food_menu",
      "map_links",
      "notes",
    ];

    const getValue = (
      row: string[],
      keys: string[],
      fallbackName: string,
    ) => {
      const idx = hasHeader
        ? header.findIndex((h) => keys.includes(h))
        : fallbackOrder.indexOf(fallbackName);
      return idx >= 0 ? row[idx] ?? "" : "";
    };

    type SeedDay = {
      about?: string;
      note?: string;
      facility?: { wifi: string; parking: string };
      subItems: Array<{
        title: string;
        startTime: string;
        endTime: string;
        foodMenu: string;
        mapUrl: string;
        note: string;
      }>;
    };

    const grouped = new Map<PlanDayKey, SeedDay>();

    for (let i = hasHeader ? 1 : 0; i < rows.length; i += 1) {
      const row = rows[i];
      const dayRaw = getValue(
        row,
        ["day", "day_key", "day_name", "date"],
        "day",
      );
      const dayKey = parseDayKey(dayRaw);
      if (!dayKey) continue;

      const about = getValue(row, ["about_day", "about"], "about_day").trim();
      const dayNote = getValue(
        row,
        ["day_note", "note_day", "day_notes"],
        "day_note",
      ).trim();
      const wifi = getValue(row, ["wifi"], "wifi").trim();
      const parking = getValue(row, ["parking"], "parking").trim();
      const startTime = getValue(
        row,
        ["start_time", "start"],
        "start_time",
      ).trim();
      const endTime = getValue(row, ["end_time", "end"], "end_time").trim();
      const title = getValue(row, ["title"], "title").trim();
      const foodMenuRaw = getValue(
        row,
        ["food_menu", "menu"],
        "food_menu",
      ).trim();
      const mapLinksRaw = getValue(
        row,
        ["map_links", "map_url", "maps"],
        "map_links",
      ).trim();
      const note = getValue(row, ["notes", "item_note"], "notes").trim();

      const foodMenu = foodMenuRaw.replace(/\|/g, ",");
      const mapUrl = mapLinksRaw
        ? mapLinksRaw
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean)
            .join("\n")
        : "";

      const entry = grouped.get(dayKey) ?? {
        subItems: [],
      };

      if (about) entry.about = about;
      if (dayNote) entry.note = dayNote;
      if (wifi || parking) {
        entry.facility = {
          wifi: wifi || entry.facility?.wifi || "",
          parking: parking || entry.facility?.parking || "",
        };
      }

      if (title || startTime || endTime || foodMenu || mapUrl || note) {
        entry.subItems.push({
          title,
          startTime,
          endTime,
          foodMenu,
          mapUrl,
          note,
        });
      }

      grouped.set(dayKey, entry);
    }

    if (grouped.size === 0) {
      alert("No valid rows found. Check the day column.");
      return;
    }

    try {
      for (const existing of planAll) {
        await deletePlanItem(groupId, existing.id);
      }

      for (const day of dayMeta.map((d) => d.key)) {
        const entry = grouped.get(day);
        if (!entry) continue;

        const validSubItems = entry.subItems.filter(
          (s) => s.title && s.startTime,
        );
        if (validSubItems.length === 0) continue;
        const primary = validSubItems[0];

        const created = await addPlanItem(groupId, {
          day,
          startTime: primary.startTime,
          endTime: primary.endTime ? primary.endTime : undefined,
          title: primary.title,
          note: entry.note ? entry.note : undefined,
          mapUrl: primary.mapUrl ? primary.mapUrl : undefined,
          createdBy: { userId: session.userId, name: session.name },
        });

        const id = (created as { id?: string } | null)?.id;
        if (!id) continue;

        setAbout(groupId, id, entry.about ?? "");
        setSubItems(
          groupId,
          id,
          validSubItems.map((s) => ({
            id: `sub_${Math.random().toString(36).slice(2, 9)}`,
            title: s.title,
            startTime: s.startTime,
            endTime: s.endTime || undefined,
            foodMenu: s.foodMenu || undefined,
            mapUrl: s.mapUrl || undefined,
            note: s.note || undefined,
            createdAt: Date.now(),
          })),
        );

        if (entry.facility) {
          saveFacilityBasics(groupId, id, entry.facility);
        }

        const aggregatedMenuText = validSubItems
          .map((s) => s.foodMenu)
          .filter(Boolean)
          .join(", ");
        const menuItems = aggregatedMenuText
          ? aggregatedMenuText.split(",").map((x) => x.trim()).filter(Boolean)
          : [];
        if (menuItems.length > 0) {
          setMenuItems(groupId, id, menuItems, aggregatedMenuText);
        }
      }

      const firstDay =
        dayMeta.map((d) => d.key).find((d) => grouped.has(d)) ?? "mon";
      setActiveDay(firstDay);
      setSelectedDate("");
      setRefresh((x) => x + 1);
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ??
        "Could not load the plan template.";
      alert(msg);
    }
  }

  async function importLegacyLocalData() {
    if (!session) return;
    const db = loadDb();
    const codeKey = group?.code?.trim().toUpperCase();
    const localGroup =
      db.groups.find(
        (g) => g.code?.trim().toUpperCase() === codeKey,
      ) ?? db.groups.find((g) => g.id === groupId);
    const localGroupId = localGroup?.id ?? groupId;

    const localPlans = db.plans?.[localGroupId] ?? [];
    const localPosts = db.posts?.filter((p) => p.groupId === localGroupId) ?? [];

    if (localPlans.length === 0 && localPosts.length === 0) {
      alert("No legacy local data found for this group.");
      return;
    }

    const ok = confirm(
      `Import ${localPlans.length} plan items and ${localPosts.length} timeline posts to cloud?`,
    );
    if (!ok) return;

    const existingPlanKey = new Set(
      planAll.map((p) => `${p.day}|${p.startTime}|${p.title}`),
    );

    for (const p of localPlans) {
      const key = `${p.day}|${p.startTime}|${p.title}`;
      if (existingPlanKey.has(key)) continue;
      await addPlanItem(groupId, {
        day: p.day,
        startTime: p.startTime,
        endTime: p.endTime ?? undefined,
        title: p.title,
        note: p.note ?? undefined,
        mapUrl: p.mapUrl ?? undefined,
        createdBy: { userId: session.userId, name: session.name },
      });
    }

    const existingPosts = await getTimeline(groupId);
    const existingPostKey = new Set(
      existingPosts.map((p) => `${p.text ?? ""}|${p.imageDataUrl ?? ""}`),
    );

    for (const post of localPosts) {
      const key = `${post.text ?? ""}|${post.imageDataUrl ?? ""}`;
      if (existingPostKey.has(key)) continue;
      await addTimelinePost(groupId, {
        text: post.text ?? "",
        imageDataUrl: post.imageDataUrl ?? undefined,
        createdBy: { userId: session.userId, name: session.name },
      });
    }

    setRefresh((x) => x + 1);
    alert("Legacy local data imported to cloud.");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50">
      {/* Header */}
      <div
        className={[
          "journey-header sticky top-[5px] z-50 border-b border-gray-200 mx-[5px] my-[5px] overflow-hidden",
          headerBg ? "bg-white/40" : "bg-white/90",
        ].join(" ")}
        style={
          headerBg
            ? {
                backgroundImage: `url(${headerBg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {headerBg && (
          <div className="absolute inset-0 bg-white/25" aria-hidden="true" />
        )}
        <div className="journey-header-inner relative mx-auto w-full max-w-6xl px-[5px] py-[5px] flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logo}
              alt="logo"
              className="journey-header-logo h-42 w-42 sm:h-48 sm:w-48 object-contain"
            />
            <div className="min-w-0">
              <div className="journey-header-title text-sm font-extrabold text-gray-900 truncate tracking-tight">
                Journey • {group.name}
              </div>
              {me ? (
                <div className="journey-header-subtitle text-xs text-gray-600 font-semibold flex items-center gap-2 truncate">
                  <UserAvatar userId={me.userId} name={me.name} size={20} />
                  <span className="truncate">Signed in as {me.name}</span>
                </div>
              ) : (
                <div className="journey-header-subtitle text-xs text-gray-600 font-semibold truncate">
                  Login required to post notes
                </div>
              )}
            </div>
          </div>

          {/* ✅ Real profile button opens drawer */}
          <button
            type="button"
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-extrabold hover:bg-gray-50 w-full sm:w-auto"
            onClick={() => setDrawerOpen(true)}
            title="Profile / Group Menu"
          >
            👤 Profile
          </button>
        </div>
      </div>

      {/* ✅ Drawer */}
      <HeaderDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        groupId={groupId}
        groupName={group.name}
        groupCode={group.code}
        myRole={myRole}
        me={me}
        onMetaChange={() => setMetaVersion((v) => v + 1)}
        onHeaderImageChange={(next) => setCustomHeaderBg(next)}
      />

      {/* Tabs */}
      <div className="mx-auto w-[95%] max-w-6xl pt-3">
        <div className="flex flex-wrap gap-2">
          <TabPill active={tab === "plan"} onClick={() => setTab("plan")}>
            Plan
          </TabPill>
          <TabPill
            active={tab === "timeline"}
            onClick={() => setTab("timeline")}
          >
            Timeline
          </TabPill>
          <TabPill active={tab === "media"} onClick={() => setTab("media")}>
            Media
          </TabPill>
        </div>
      </div>

      <main className="mx-auto w-[95%] max-w-6xl py-6 space-y-6">
        <div className={tab === "timeline" ? "" : "hidden"}>
          <TimelineTab groupId={groupId} />
        </div>

        <div className={tab === "plan" ? "" : "hidden"}>
          <>
            <Card>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <div className="text-xl font-extrabold text-gray-900 tracking-tight">
                    Trip Plan • {dayTitle(activeDay)}
                  </div>
                  <p className="mt-1 text-gray-600">
                    {groupTypeLabel} plan with Dinner • Facilities • Notes.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="text-xs font-semibold text-gray-600">
                      Pick date
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSelectedDate(v);
                        const key = dayKeyFromDate(v);
                        if (key) handleActiveDayChange(key);
                      }}
                      className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                    />
                    {selectedDate && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-blue-600 hover:underline"
                        onClick={() => setSelectedDate("")}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  {!showForm && (
                    <Button
                      variant="orange"
                      onClick={openAdd}
                      className="w-full sm:w-auto"
                    >
                      + Add item
                    </Button>
                  )}
                  {myRole !== "member" && (
                    <>
                      <input
                        ref={templateInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          void uploadPlanTemplate(file);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        variant="ghost"
                        onClick={downloadPlanTemplate}
                        className="w-full sm:w-auto"
                      >
                        Download template
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => templateInputRef.current?.click()}
                        className="w-full sm:w-auto"
                      >
                        Upload CSV
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          if (!planAll.length) return;
                          try {
                            await Promise.all(
                              planAll.map((item) =>
                                pushPlanExtrasToRemote(groupId, item.id),
                              ),
                            );
                            setExtrasVersion((v) => v + 1);
                            alert("Synced local plan data to cloud.");
                          } catch (err) {
                            const msg =
                              (err as { message?: string })?.message ??
                              "Sync failed.";
                            alert(msg);
                          }
                        }}
                        className="w-full sm:w-auto"
                      >
                        Sync local → cloud
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={importLegacyLocalData}
                        className="w-full sm:w-auto"
                      >
                        Import legacy local data
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(planAll.length > 0
                  ? dayMeta.filter((d) =>
                      planAll.some((item) => item.day === d.key),
                    )
                  : dayMeta.filter((d) => d.key === activeDay)
                ).map((d) => (
                  <button
                    type="button"
                    key={d.key}
                    onClick={() => handleActiveDayChange(d.key)}
                    className={[
                      "px-3 sm:px-4 py-2 rounded-full border text-xs sm:text-sm font-semibold transition",
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

            {/* Add/Edit form */}
            {showForm && (
              <Card>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-extrabold text-gray-900">
                      {editingId ? "Edit item" : "Add new item"}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Time + title required. Map link optional.
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditingId(null);
                      setShowForm(false);
                    }}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-900">
                    Day
                  </label>
                  <select
                    value={form.day}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        day: e.target.value as PlanDayKey,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
                  >
                    {dayMeta.map((d) => (
                      <option key={d.key} value={d.key}>
                        {dayTitle(d.key)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-900">
                    About this day
                  </label>
                  <select
                    value={form.about}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, about: e.target.value }))
                    }
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
                  >
                    {ABOUT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label className="text-sm font-semibold text-gray-900">
                      Activities / Destinations
                    </label>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          subItems: [...f.subItems, makeSubItem()],
                        }))
                      }
                      className="w-full sm:w-auto"
                    >
                      + Add activity
                    </Button>
                  </div>

                  <div className="mt-3 space-y-3">
                    {form.subItems.map((sub, idx) => (
                      <div
                        key={sub.id}
                        className="rounded-2xl border border-gray-200 bg-white p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-gray-600">
                            Item {idx + 1}
                          </div>
                          {form.subItems.length > 1 && (
                            <button
                              type="button"
                              className="text-xs font-semibold text-red-600 hover:underline"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  subItems: f.subItems.filter(
                                    (s) => s.id !== sub.id,
                                  ),
                                }))
                              }
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <label className="text-sm font-semibold text-gray-900">
                              Title
                            </label>
                            <input
                              value={sub.title}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  subItems: f.subItems.map((s) =>
                                    s.id === sub.id
                                      ? { ...s, title: e.target.value }
                                      : s,
                                  ),
                                }))
                              }
                              placeholder="e.g., Lunch at Pandey Niwas"
                              className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-semibold text-gray-900">
                              Start
                            </label>
                            <input
                              value={sub.startTime}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  subItems: f.subItems.map((s) =>
                                    s.id === sub.id
                                      ? { ...s, startTime: e.target.value }
                                      : s,
                                  ),
                                }))
                              }
                              placeholder="09:00"
                              className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-gray-900">
                              End (optional)
                            </label>
                            <input
                              value={sub.endTime}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  subItems: f.subItems.map((s) =>
                                    s.id === sub.id
                                      ? { ...s, endTime: e.target.value }
                                      : s,
                                  ),
                                }))
                              }
                              placeholder="10:30"
                              className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-sm font-semibold text-gray-900">
                              Food menu (comma-separated)
                            </label>
                            <input
                              value={sub.foodMenu}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  subItems: f.subItems.map((s) =>
                                    s.id === sub.id
                                      ? { ...s, foodMenu: e.target.value }
                                      : s,
                                  ),
                                }))
                              }
                              placeholder="e.g., Dhindo Set, Dalbhat, Fruit Salad"
                              className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-sm font-semibold text-gray-900">
                              Google Maps link(s)
                            </label>
                            <input
                              value={sub.mapUrl}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  subItems: f.subItems.map((s) =>
                                    s.id === sub.id
                                      ? { ...s, mapUrl: e.target.value }
                                      : s,
                                  ),
                                }))
                              }
                              placeholder="Paste one or more links (use | or new line)"
                              className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-sm font-semibold text-gray-900">
                              Notes (optional)
                            </label>
                            <input
                              value={sub.note}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  subItems: f.subItems.map((s) =>
                                    s.id === sub.id
                                      ? { ...s, note: e.target.value }
                                      : s,
                                  ),
                                }))
                              }
                              placeholder="tickets / what to bring / reminders..."
                              className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-gray-900">
                    Notes to users (optional)
                  </label>
                  <input
                    value={form.note}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, note: e.target.value }))
                    }
                    placeholder="General notes for everyone..."
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
                  />
                </div>
              </div>

                <div className="mt-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="primary"
                    onClick={() => savePlan()}
                    disabled={!session}
                  >
                    {editingId ? "Save changes" : "Add item"}
                  </Button>
                  {!editingId && (
                    <Button
                      variant="ghost"
                      onClick={() => savePlan({ keepOpen: true })}
                      disabled={!session}
                    >
                      Add another
                    </Button>
                  )}
                </div>
                {!session && (
                  <div className="mt-2 text-xs font-semibold text-red-600">
                    Login/session required to add/edit plan items.
                  </div>
                )}
                </div>
              </Card>
            )}

            {/* Schedule list */}
            <Card>
              <div className="text-lg font-extrabold text-gray-900">
                Schedule • {dayTitle(activeDay)}
              </div>

              {planForDay.length === 0 ? (
                <p className="mt-2 text-gray-600">
                  {planError ? planError : "No items yet for this day."}
                </p>
              ) : (
                <div className="mt-4 space-y-5">
                  {planForDay.map((item) => {
                    const about = readAbout(groupId, item.id);
                    const menuText = readMenuText(groupId, item.id);
                    const subItems = readSubItems(groupId, item.id);
                    const displaySubItems =
                      subItems.length > 0
                        ? subItems
                        : [
                            {
                              id: `fallback_${item.id}`,
                              title: item.title,
                              startTime: item.startTime,
                              endTime: item.endTime ?? "",
                              foodMenu: "",
                              mapUrl: item.mapUrl ?? "",
                              note: item.note ?? "",
                            },
                          ];
                    const showMenu =
                      !!menuText ||
                      displaySubItems.some((s) =>
                        `${s.title} ${s.note ?? ""}`.toLowerCase().includes(
                          "dinner",
                        ),
                      ) ||
                      shouldShowDinner(item);
                    const aboutLabel =
                      ABOUT_OPTIONS.find((o) => o.value === about)?.label ??
                      about;
                    const comments = readPlanComments(groupId, item.id);
                    const imageDraft = planCommentImageDrafts[item.id] ?? null;

                    return (
                      <div
                        key={item.id}
                        className="rounded-3xl border border-gray-200 bg-white/95 shadow-soft p-5"
                      >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 w-full">
                          <div className="text-base font-extrabold text-gray-900 tracking-tight">
                            Day plan
                          </div>

                          {about && (
                            <div className="mt-2 inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                              {aboutLabel || "About"}
                            </div>
                          )}

                          {item.note && (
                            <div className="mt-1 text-gray-600">
                              {item.note}
                            </div>
                          )}

                          <div className="mt-2 text-xs text-gray-500">
                            Added by{" "}
                            <span className="font-semibold">
                              {item.createdBy.name}
                            </span>
                          </div>

                          <div className="mt-4 space-y-3">
                            {displaySubItems.map((sub, idx) => {
                              const mapUrls = parseMapUrls(sub.mapUrl);
                              const subKey = `${item.id}:${sub.id}`;
                              const activeIdx = activeMapIndexBySub[subKey] ?? 0;
                              const activeMapUrl =
                                mapUrls[activeIdx] ?? mapUrls[0] ?? "";
                              const exploreType =
                                exploreTypeBySub[subKey] ?? "cafe";

                              return (
                                <div
                                  key={sub.id}
                                  className="rounded-2xl border border-gray-200 bg-white p-3"
                                >
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                      <div className="text-sm text-gray-600 font-semibold">
                                        {sub.startTime}
                                        {sub.endTime ? ` – ${sub.endTime}` : ""}
                                      </div>
                                      <div className="mt-1 text-base font-extrabold text-gray-900">
                                        {sub.title || `Item ${idx + 1}`}
                                      </div>
                                      {sub.note && (
                                        <div className="mt-1 text-sm text-gray-600">
                                          {sub.note}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                                      {mapUrls.length > 0 && (
                                        <>
                                          {mapUrls.length > 1 && (
                                            <select
                                              value={String(activeIdx)}
                                              onChange={(e) =>
                                                setActiveMapIndexBySub((prev) => ({
                                                  ...prev,
                                                  [subKey]: Number(e.target.value),
                                                }))
                                              }
                                              className="h-10 w-full sm:w-auto rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold"
                                              title="Choose destination"
                                            >
                                              {mapUrls.map((_, mIdx) => (
                                                <option
                                                  key={mIdx}
                                                  value={String(mIdx)}
                                                >
                                                  Destination {mIdx + 1}
                                                </option>
                                              ))}
                                            </select>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              activeMapUrl &&
                                              openStart(activeMapUrl)
                                            }
                                            className="h-12 rounded-2xl border border-gray-200 bg-white flex items-center justify-center gap-2 px-3 hover:bg-gray-50 self-start sm:self-auto"
                                            title="Start navigation"
                                            aria-label="Start navigation"
                                          >
                                            <span className="text-sm font-bold text-gray-900">
                                              Map
                                            </span>
                                            <img
                                              src={navIcon}
                                              alt=""
                                              className="h-7 w-7 object-contain"
                                              aria-hidden="true"
                                            />
                                          </button>

                                          <select
                                            value={exploreType}
                                            onChange={(e) => {
                                              const v = e.target
                                                .value as (typeof EXPLORE_OPTIONS)[number]["value"];
                                              setExploreTypeBySub((prev) => ({
                                                ...prev,
                                                [subKey]: v,
                                              }));
                                              if (activeMapUrl)
                                                openExplore(activeMapUrl, v);
                                            }}
                                            className="h-10 w-full sm:w-auto rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold"
                                            title="Explore nearby"
                                          >
                                            {EXPLORE_OPTIONS.map((opt) => (
                                              <option
                                                key={opt.value}
                                                value={opt.value}
                                              >
                                                {opt.label}
                                              </option>
                                            ))}
                                          </select>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* ✅ 3 cards layout (responsive) */}
                          <div className="mt-4 grid gap-4 md:grid-cols-3">
                            <DinnerMenuBox
                              groupId={groupId}
                              itemId={item.id}
                              titleHint={item.title}
                              me={me}
                              show={showMenu}
                              version={extrasVersion}
                            />

                            <FacilityNotesBox
                              groupId={groupId}
                              itemId={item.id}
                              me={me}
                              version={extrasVersion}
                            />

                            <EventNotesBox
                              groupId={groupId}
                              itemId={item.id}
                              me={me}
                              version={extrasVersion}
                            />
                          </div>

                          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <div className="text-sm font-extrabold text-gray-900">
                              Comments
                            </div>
                            {comments.length === 0 ? (
                              <div className="mt-2 text-sm text-gray-500">
                                No comments yet.
                              </div>
                            ) : (
                              <div className="mt-3 space-y-2">
                                {comments.map((c) => (
                                  <div
                                    key={c.id}
                                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                                  >
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                      <UserAvatar
                                        userId={c.byId}
                                        name={c.by}
                                        size={20}
                                      />
                                      <span>
                                        {c.by} ·{" "}
                                        {new Date(
                                          c.createdAt,
                                        ).toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-gray-800">
                                      {c.text}
                                    </div>
                                    {c.imageDataUrl && (
                                      <div className="mt-2 overflow-hidden rounded-2xl border border-gray-200">
                                        <img
                                          src={c.imageDataUrl}
                                          alt="comment"
                                          className="w-full max-h-[260px] object-cover"
                                          loading="lazy"
                                        />
                                      </div>
                                    )}
                                    {me?.name === c.by && (
                                      <button
                                        type="button"
                                        className="mt-1 text-xs font-semibold text-red-600 hover:underline"
                                        onClick={() => {
                                          deletePlanComment(
                                            groupId,
                                            item.id,
                                            c.id,
                                          );
                                          setRefresh((x) => x + 1);
                                        }}
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {imageDraft && (
                              <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-xs font-semibold text-gray-600">
                                    Image preview
                                  </div>
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-red-600 hover:underline"
                                    onClick={() =>
                                      setPlanCommentImageDrafts((prev) => ({
                                        ...prev,
                                        [item.id]: null,
                                      }))
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div className="mt-2 overflow-hidden rounded-2xl border border-gray-200">
                                  <img
                                    src={imageDraft}
                                    alt="comment preview"
                                    className="w-full max-h-[260px] object-cover"
                                  />
                                </div>
                              </div>
                            )}

                            <div className="mt-3 flex flex-col sm:flex-row gap-2">
                              <input
                                value={planCommentDrafts[item.id] ?? ""}
                                onChange={(e) =>
                                  setPlanCommentDrafts((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                                placeholder="Write a comment…"
                                className="w-full flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                              />
                              <input
                                id={`plan-comment-image-${item.id}`}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    const dataUrl = await fileToDataUrl(
                                      file,
                                      1200,
                                      0.86,
                                    );
                                    setPlanCommentImageDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: dataUrl,
                                    }));
                                  } catch {
                                    alert("Could not load image.");
                                  } finally {
                                    e.target.value = "";
                                  }
                                }}
                              />
                              <label
                                htmlFor={`plan-comment-image-${item.id}`}
                                className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-gray-50 cursor-pointer"
                              >
                                Add photo
                              </label>
                              <Button
                                variant="primary"
                                disabled={
                                  !me ||
                                  !(planCommentDrafts[item.id] ?? "").trim()
                                }
                                onClick={() => {
                                  if (!me) return;
                                  const text = (
                                    planCommentDrafts[item.id] ?? ""
                                  ).trim();
                                  if (!text) return;
                                  const image =
                                    planCommentImageDrafts[item.id] ?? undefined;
                                  addPlanComment(
                                    groupId,
                                    item.id,
                                    me.name,
                                    text,
                                    image ?? undefined,
                                    me.userId,
                                  );
                                  setPlanCommentDrafts((prev) => ({
                                    ...prev,
                                    [item.id]: "",
                                  }));
                                  setPlanCommentImageDrafts((prev) => ({
                                    ...prev,
                                    [item.id]: null,
                                  }));
                                  setRefresh((x) => x + 1);
                                }}
                                className="w-full sm:w-auto"
                              >
                                Comment
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full lg:w-auto lg:justify-end">
                          <div className="relative self-end sm:self-auto">
                            <button
                              type="button"
                              data-plan-menu-button
                              onClick={() =>
                                setOpenPlanMenuId((prev) =>
                                  prev === item.id ? null : item.id,
                                )
                              }
                              className="h-9 w-9 rounded-xl border border-gray-200 bg-white text-lg font-semibold hover:bg-gray-50"
                              aria-label="Plan actions"
                              title="Plan actions"
                            >
                              ⋯
                            </button>
                            {openPlanMenuId === item.id && (
                              <div
                                data-plan-menu
                                className="absolute right-0 mt-2 w-36 rounded-2xl border border-gray-200 bg-white shadow-soft overflow-hidden z-10"
                              >
                                <button
                                  type="button"
                                  className="w-full px-3 py-2 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
                                  onClick={() => openEdit(item)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="w-full px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                                  onClick={async () => {
                                    setOpenPlanMenuId(null);
                                    await deletePlanItem(groupId, item.id);
                                    setRefresh((x) => x + 1);
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </>
        </div>

        <div className={tab === "media" ? "" : "hidden"}>
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-lg font-extrabold text-gray-900 tracking-tight">
                  Media
                </div>
                <p className="mt-1 text-gray-600">
                  {groupTypeLabel} memories live here. Uploads are stored in the
                  database for now.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                <select
                  value={mediaVisibility}
                  onChange={(e) =>
                    setMediaVisibility(
                      e.target.value as "group" | "private" | "shared",
                    )
                  }
                  className="h-10 w-full sm:w-auto rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold"
                  title="Who can see"
                >
                  <option value="group">Group only</option>
                  <option value="private">Only me</option>
                  <option value="shared">Shared</option>
                </select>
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    if (!me) return;
                    const files = Array.from(e.target.files ?? []);
                    if (files.length === 0) return;
                    for (const f of files) {
                      try {
                        const dataUrl = await fileToDataUrl(f, 1400, 0.86);
                        await addMedia(
                          groupId,
                          dataUrl,
                          { userId: me.userId, name: me.name },
                          mediaVisibility,
                        );
                      } catch {
                        // ignore bad images
                      }
                    }
                    if (mediaInputRef.current) mediaInputRef.current.value = "";
                    setMediaVersion((v) => v + 1);
                  }}
                />
                <Button
                  variant="primary"
                  disabled={!me}
                  onClick={() => mediaInputRef.current?.click()}
                  className="w-full sm:w-auto"
                >
                  Upload
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {mediaItems.map((m) => {
                const canDelete = me?.userId === m.createdBy.userId;
                return (
                  <div
                    key={m.id}
                    className="relative group aspect-square rounded-3xl border border-gray-200 bg-gray-50 overflow-hidden"
                  >
                    <img
                      src={m.dataUrl}
                      alt="media"
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-xs text-white opacity-0 group-hover:opacity-100 transition">
                      <div className="font-semibold truncate">
                        {m.createdBy.name}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide">
                        {m.visibility}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canDelete}
                      onClick={async () => {
                        if (!canDelete) return;
                        await deleteMedia(groupId, m.id, me.userId);
                        setMediaVersion((v) => v + 1);
                      }}
                      className="absolute top-2 right-2 rounded-full bg-white/90 text-gray-900 px-2 py-1 text-xs font-bold opacity-0 group-hover:opacity-100 transition disabled:opacity-40"
                      title={
                        canDelete ? "Delete media" : "Only owner can delete"
                      }
                    >
                      Delete
                    </button>
                  </div>
                );
              })}

              {mediaItems.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                  {mediaError
                    ? mediaError
                    : "No media yet. Upload photos to start the gallery."}
                </div>
              )}
            </div>

            {!me && (
              <div className="mt-3 text-xs font-semibold text-red-600">
                Login/session required to upload.
              </div>
            )}
          </Card>
        </div>
      </main>

      <footer className="mx-auto w-[95%] max-w-6xl pb-6 text-center text-xs text-gray-600">
        Design by Nexus Tech Group Sydney · Phone no +61430060860 · Copyright ©
        2026
      </footer>

      <ChatWidget
        groupId={groupId}
        groupName={group.name}
        canEditGroupName={myRole !== "member"}
        onGroupNameUpdated={(name) =>
          setGroup((g) => (g ? { ...g, name } : g))
        }
      />
    </div>
  );
}
