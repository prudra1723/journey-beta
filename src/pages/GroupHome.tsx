import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import type { PlanDayKey, PlanItem } from "../lib/betaDb";
import { getSession, setLastGroupId } from "../lib/session";
import ChatWidget from "../components/ChatWidget";
import TimelineTab from "../components/TimeLineTab";
import MarketplaceTab from "../components/MarketplaceTab";
import logo from "../assets/logo.png";
import navIcon from "../assets/nav-icon.svg";
import sydneyBanner from "../assets/Sydney_Harbour_Banner.jpg";
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
  readOrderList,
  readTimelineImages,
  saveOrderList,
  saveTimelineImages,
  subscribeOrderList,
  updateMediaImage,
  updateGroupName,
  updatePlanItem,
  updateTimelinePost,
} from "../lib/appDb";
import { UserAvatar } from "../components/UserAvatar";
import { loadDb } from "../lib/db/storage";
import { fileToDataUrl } from "../features/chat/lib/chatUi";
import { uploadImageToR2 } from "../lib/r2Upload";
import { getKnownMembers, getOnlineMembers, type ChatUser } from "../lib/chatDb";
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
  addPlanCommentReply,
  deletePlanComment,
  pushPlanExtrasToRemote,
  syncPlanExtrasFromRemote,
} from "../lib/planExtrasDb";

import { HeaderDrawer } from "../features/group/components/HeaderDrawer";
import { DinnerMenuBox } from "../features/group/components/DinnerMenuBox";
import { FacilityNotesBox } from "../features/group/components/FacilityNotesBox";
import { EventNotesBox } from "../features/group/components/EventNotesBox";
import { readGroupHeaderImage } from "../lib/groupHeaderImage";

type TabKey = "timeline" | "plan" | "media" | "orders" | "marketplace";

type NotificationItem = {
  id: string;
  text: string;
  createdAt: number;
  createdBy: { userId: string; name: string };
  groupId?: string;
};

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

function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url);
}

function TabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={[
        "flex flex-col items-center justify-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-2xl border text-[9px] sm:text-xs font-semibold transition w-full",
        active
          ? "bg-blue-600 border-blue-600 text-white shadow-soft"
          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50",
      ].join(" ")}
    >
      <span className="text-base sm:text-xl">{icon}</span>
      <span className="leading-tight whitespace-nowrap">{label}</span>
    </button>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function MediaIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8" cy="10" r="2" />
      <path d="M21 17l-6-6-4 4-2-2-4 4" />
    </svg>
  );
}

function MarketplaceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7l1.5 13h14L20 7" />
      <path d="M6 7a6 6 0 0 1 12 0" />
      <path d="M9 13h6" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M3 4h2l2.4 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 1.9-1.4l2-6.4H7.2" />
    </svg>
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
    timelinePublic?: boolean;
  }>({});
  const [myRole, setMyRole] = useState<
    "host" | "admin" | "member" | "viewer"
  >("viewer");
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [groupError, setGroupError] = useState<string | null>(null);

  const session = getSession();
  const sessionUserId = session?.userId ?? null;
  const me = session ? { userId: session.userId, name: session.name } : null;
  const canManageGroup = myRole === "host" || myRole === "admin";
  const isViewer = myRole === "viewer";

  const UI_KEY = `journey_beta_group_ui_v1:${groupId}`;

  const [tab, setTab] = useState<TabKey>(() => {
    try {
      const raw = localStorage.getItem(UI_KEY);
      if (!raw) return "timeline";
      const parsed = JSON.parse(raw) as { tab?: TabKey };
      const next = parsed.tab ?? "timeline";
      return ["timeline", "plan", "media", "orders", "marketplace"].includes(
        next,
      )
        ? (next as TabKey)
        : "timeline";
    } catch {
      return "timeline";
    }
  });

  const [notifCount, setNotifCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState<NotificationItem[]>([]);
  const notifMenuRef = useRef<HTMLDivElement | null>(null);
  const notifLatestRef = useRef(0);
  const notifSeenRef = useRef(0);

  function setTabAndScroll(next: TabKey) {
    setTab(next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  useEffect(() => {
    if (isViewer && tab !== "timeline" && tab !== "marketplace") {
      setTab("timeline");
    }
  }, [isViewer, tab]);

  useEffect(() => {
    if (!groupId) return;
    setLastGroupId(groupId);
  }, [groupId]);


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
  const [timelineVersion, setTimelineVersion] = useState(0);
  void timelineVersion;

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
  const headerRef = useRef<HTMLDivElement | null>(null);
  const templateInputRef = useRef<HTMLInputElement | null>(null);
  const [customHeaderBg, setCustomHeaderBg] = useState<string | null>(() =>
    readGroupHeaderImage(groupId),
  );
  const headerBg = customHeaderBg ?? sydneyBanner;
  void headerBg;
  const autoRenamedRef = useRef(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [orderDraft, setOrderDraft] = useState("");
  const [orderCreated, setOrderCreated] = useState(false);
  const [orderItems, setOrderItems] = useState<
    { id: string; label: string; checked: boolean }[]
  >([]);
  const [orderLoaded, setOrderLoaded] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const orderSyncRef = useRef<string>("");

  useEffect(() => {
    let mounted = true;
    const loadOrders = async () => {
      if (!me) {
        if (mounted) {
          setOrderError("Login required to view the order list.");
          setOrderLoaded(true);
        }
        return;
      }
      try {
        const res = await readOrderList(groupId);
        if (!mounted) return;
        setOrderItems(res.items);
        setOrderCreated(res.created || res.items.length > 0);
        orderSyncRef.current = JSON.stringify({
          created: res.created || res.items.length > 0,
          items: res.items,
        });
        setOrderError(null);
      } catch (err) {
        const msg =
          (err as { message?: string })?.message ??
          "Could not load order list.";
        if (mounted) setOrderError(msg);
      } finally {
        if (mounted) setOrderLoaded(true);
      }
    };
    void loadOrders();
    return () => {
      mounted = false;
    };
  }, [groupId, me]);

  useEffect(() => {
    if (!orderLoaded || !me) return;
    const created = orderCreated || orderItems.length > 0;
    const payload = JSON.stringify({
      created,
      items: orderItems,
    });
    if (payload === orderSyncRef.current) return;
    const timer = window.setTimeout(() => {
      saveOrderList(groupId, orderItems, created, me.userId)
        .then(() => {
          orderSyncRef.current = payload;
        })
        .catch((err) => {
          const msg =
            (err as { message?: string })?.message ??
            "Could not save order list.";
          setOrderError(msg);
        });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [orderLoaded, orderItems, orderCreated, groupId, me]);

  useEffect(() => {
    if (!me) return;
    const unsubscribe = subscribeOrderList(groupId, async () => {
      try {
        const res = await readOrderList(groupId);
        setOrderItems(res.items);
        setOrderCreated(res.created || res.items.length > 0);
        orderSyncRef.current = JSON.stringify({
          created: res.created || res.items.length > 0,
          items: res.items,
        });
        setOrderError(null);
      } catch (err) {
        const msg =
          (err as { message?: string })?.message ??
          "Could not sync order list.";
        setOrderError(msg);
      }
    });
    return unsubscribe;
  }, [groupId, me]);

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
    Array<{
      id: string;
      dataUrl: string;
      createdAt: number;
      createdBy: { userId: string; name: string };
      source: "media" | "timeline";
      visibility?: "group" | "private" | "shared";
      comments?: Array<{
        id: string;
        text: string;
        createdAt: number;
        createdBy: { userId: string; name: string };
        replies?: Array<{
          id: string;
          text: string;
          createdAt: number;
          createdBy: { userId: string; name: string };
        }>;
      }>;
      postId?: string;
      postImages?: string[];
      imageIndex?: number;
    }>
  >([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaVisibility, setMediaVisibility] = useState<
    "group" | "private" | "shared"
  >("group");
  const [showForm, setShowForm] = useState(false);
  const [showPlanSettings, setShowPlanSettings] = useState(false);
  const planSettingsRef = useRef<HTMLDivElement | null>(null);
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0);
  const [mediaViewerZoom, setMediaViewerZoom] = useState(false);
  const [mediaMenuOpenId, setMediaMenuOpenId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [chatMode, setChatMode] = useState<"group" | "direct">("group");
  const [chatPeerId, setChatPeerId] = useState<string | null>(null);
  const [chatMembers, setChatMembers] = useState<ChatUser[]>([]);
  const [chatOnlineIds, setChatOnlineIds] = useState<Set<string>>(new Set());
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const mediaTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const mediaTouchDeltaRef = useRef<{ x: number; y: number } | null>(null);
  const mediaEditRef = useRef<HTMLInputElement | null>(null);
  const [mediaEditTarget, setMediaEditTarget] = useState<
    | {
        id: string;
        source: "media" | "timeline";
        postId?: string;
        postImages?: string[];
        imageIndex?: number;
        createdBy: { userId: string; name: string };
      }
    | null
  >(null);
  const timelineMigrateRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!mediaMenuOpenId) return;
    const handleClick = () => setMediaMenuOpenId(null);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMediaMenuOpenId(null);
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [mediaMenuOpenId]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-profile-menu]")) return;
      if (target.closest("[data-profile-menu-button]")) return;
      setProfileMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!chatMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-chat-menu]")) return;
      if (target.closest("[data-chat-menu-button]")) return;
      setChatMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChatMenuOpen(false);
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [chatMenuOpen]);

  useEffect(() => {
    if (!notifOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-notif-menu]")) return;
      if (target.closest("[data-notif-button]")) return;
      setNotifOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotifOpen(false);
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [notifOpen]);

  useEffect(() => {
    if (!chatMenuOpen || !groupId) return;
    let active = true;
    const loadMembers = async () => {
      try {
        const [members, online] = await Promise.all([
          getKnownMembers(groupId),
          getOnlineMembers(groupId),
        ]);
        if (!active) return;
        setChatMembers(members);
        setChatOnlineIds(new Set(online.map((m) => m.userId)));
      } catch {
        if (!active) return;
        setChatMembers([]);
        setChatOnlineIds(new Set());
      }
    };
    loadMembers();
    return () => {
      active = false;
    };
  }, [chatMenuOpen, groupId]);

  useEffect(() => {
    if (!session?.userId) return;
    if (typeof window === "undefined") return;
    const seenKey = `journey_beta_notifications_seen:${session.userId}`;
    const raw = localStorage.getItem(seenKey);
    const lastSeen = raw ? Number(raw) : 0;
    if (Number.isFinite(lastSeen)) {
      notifLatestRef.current = lastSeen;
      notifSeenRef.current = lastSeen;
    }

    let active = true;
    const loadNotifications = async () => {
      try {
        const posts = await getTimeline(undefined, { limit: 60 });
        if (!active) return;
        const latest = posts[0]?.createdAt ?? 0;
        notifLatestRef.current = Math.max(notifLatestRef.current, latest);
        const seen = notifSeenRef.current;
        const count = posts.filter(
          (p) =>
            p.createdAt > seen && p.createdBy?.userId !== session.userId,
        ).length;
        setNotifCount(count);
        const history = posts
          .filter((p) => p.createdBy?.userId !== session.userId)
          .slice(0, 20)
          .map((p) => ({
            id: p.id,
            text:
              p.text?.trim() ||
              (p.imageDataUrl ? "Shared a photo/video" : "New post"),
            createdAt: p.createdAt,
            createdBy: p.createdBy,
            groupId: p.groupId,
          }));
        setNotifItems(history);
      } catch {
        if (!active) return;
        setNotifCount(0);
      }
    };

    loadNotifications();
    const t = window.setInterval(loadNotifications, 15000);
    return () => {
      active = false;
      window.clearInterval(t);
    };
  }, [session?.userId]);

  useEffect(() => {
    if (!session?.userId) return;
    if (tab !== "timeline") return;
    if (typeof window === "undefined") return;
    const seenKey = `journey_beta_notifications_seen:${session.userId}`;
    const latest = notifLatestRef.current;
    if (latest > 0) {
      localStorage.setItem(seenKey, String(latest));
      notifSeenRef.current = latest;
      setNotifCount(0);
    }
  }, [tab, session?.userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    lastScrollYRef.current = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const current = window.scrollY;
        const diff = current - lastScrollYRef.current;
        if (current <= 8) {
          setHeaderHidden(false);
        } else if (diff > 6) {
          setHeaderHidden(true);
        } else if (diff < -6) {
          setHeaderHidden(false);
        }
        lastScrollYRef.current = current;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
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
  const [planReplyDrafts, setPlanReplyDrafts] = useState<
    Record<string, string>
  >({});
  const [planReplyOpen, setPlanReplyOpen] = useState<
    Record<string, boolean>
  >({});
  const [openPlanMenuId, setOpenPlanMenuId] = useState<string | null>(null);
  const [extrasVersion, setExtrasVersion] = useState(0);
  void extrasVersion;

  async function dataUrlToFile(dataUrl: string, name: string) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || "image/jpeg" });
  }

  async function migrateTimelineImages(
    postId: string,
    postOwnerId: string,
    urls: string[],
  ) {
    if (!me || me.userId !== postOwnerId) return;
    if (timelineMigrateRef.current[postId]) return;
    timelineMigrateRef.current[postId] = true;
    try {
      const uploaded: string[] = [];
      for (const url of urls) {
        if (url.startsWith("data:")) {
          const file = await dataUrlToFile(
            url,
            `timeline-${postId}-${Date.now()}.jpg`,
          );
          const remote = await uploadImageToR2(file, groupId);
          uploaded.push(remote);
        } else {
          uploaded.push(url);
        }
      }
      await saveTimelineImages(postId, uploaded);
      if (uploaded[0]) {
        await updateTimelinePost(postId, me.userId, { imageDataUrl: uploaded[0] });
      }
      setMediaVersion((v) => v + 1);
    } catch {
      // ignore migration errors
    }
  }

  async function shareMediaLink(url: string) {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Journey media", url });
        return;
      }
    } catch {
      // ignore share errors
    }
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied.");
    } catch {
      alert("Copy failed. Try again.");
    }
  }

  async function repostToTimeline(imageUrl: string) {
    if (!me) {
      alert("Login required to post.");
      return;
    }
    try {
      await addTimelinePost(groupId, {
        text: "",
        imageDataUrl: imageUrl,
        createdBy: { userId: me.userId, name: me.name },
      });
      setTimelineVersion((v) => v + 1);
      setMediaVersion((v) => v + 1);
    } catch {
      alert("Could not repost to timeline.");
    }
  }

  function openMediaViewer(index: number) {
    setMediaViewerIndex(index);
    setMediaViewerZoom(false);
    setMediaViewerOpen(true);
  }

  function closeMediaViewer() {
    setMediaViewerOpen(false);
    setMediaViewerZoom(false);
  }

  function mediaViewerPrev() {
    if (mediaItems.length === 0) return;
    setMediaViewerIndex((prev) =>
      prev === 0 ? mediaItems.length - 1 : prev - 1,
    );
  }

  function mediaViewerNext() {
    if (mediaItems.length === 0) return;
    setMediaViewerIndex((prev) =>
      prev === mediaItems.length - 1 ? 0 : prev + 1,
    );
  }

  function handleMediaTouchStart(e: React.TouchEvent) {
    if (mediaViewerZoom) return;
    const touch = e.touches[0];
    if (!touch) return;
    mediaTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
    mediaTouchDeltaRef.current = null;
  }

  function handleMediaTouchMove(e: React.TouchEvent) {
    if (mediaViewerZoom) return;
    const touch = e.touches[0];
    const start = mediaTouchStartRef.current;
    if (!touch || !start) return;
    mediaTouchDeltaRef.current = {
      x: touch.clientX - start.x,
      y: touch.clientY - start.y,
    };
  }

  function handleMediaTouchEnd() {
    if (mediaViewerZoom) return;
    const delta = mediaTouchDeltaRef.current;
    if (!delta) return;
    const threshold = 40;
    if (Math.abs(delta.x) > Math.abs(delta.y) && Math.abs(delta.x) > threshold) {
      if (delta.x > 0) mediaViewerPrev();
      else mediaViewerNext();
    }
    mediaTouchStartRef.current = null;
    mediaTouchDeltaRef.current = null;
  }

  function handleCardTiltMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rx = ((y / rect.height) - 0.5) * -10;
    const ry = ((x / rect.width) - 0.5) * 10;
    el.style.setProperty("--rx", `${rx}deg`);
    el.style.setProperty("--ry", `${ry}deg`);
  }

  function handleCardTiltLeave(e: React.MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

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
    if (!mediaViewerOpen) return;
    if (mediaViewerIndex >= mediaItems.length) {
      setMediaViewerIndex(0);
    }
  }, [mediaItems.length, mediaViewerIndex, mediaViewerOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = headerRef.current;
    if (!el) return;
    const update = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty(
        "--journey-header-h",
        `${h}px`,
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    if (!showPlanSettings) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (planSettingsRef.current?.contains(target)) return;
      setShowPlanSettings(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [showPlanSettings]);

  useEffect(() => {
    let mounted = true;
    async function loadMedia() {
      try {
        const [mediaList, timelineList, timelineImages] = await Promise.all([
          readMedia(groupId),
          getTimeline(groupId),
          readTimelineImages(groupId),
        ]);
        const localExtras = (() => {
          try {
            const raw = localStorage.getItem("journey_beta_timeline_extra_v1");
            if (!raw) return {};
            const parsed = JSON.parse(raw) as { postImages?: Record<string, string[]> };
            return parsed.postImages ?? {};
          } catch {
            return {};
          }
        })();

        const timelineGallery = timelineList.flatMap((post) => {
          const urls =
            timelineImages[post.id] ??
            localExtras[post.id] ??
            (post.imageDataUrl ? [post.imageDataUrl] : []);
          if (
            urls.length > 0 &&
            !timelineImages[post.id] &&
            !isViewer &&
            me?.userId === post.createdBy.userId
          ) {
            void migrateTimelineImages(post.id, post.createdBy.userId, urls);
          }
          if (urls.length === 0) return [];
          return urls.map((url, index) => ({
            id: `timeline:${post.id}:${index}`,
            dataUrl: url,
            createdAt: post.createdAt,
            createdBy: post.createdBy,
            source: "timeline" as const,
            postId: post.id,
            postImages: urls,
            imageIndex: index,
          }));
        });
        const mediaGallery = mediaList.map((item) => ({
          ...item,
          source: "media" as const,
        }));
        const combined = [...mediaGallery, ...timelineGallery].sort(
          (a, b) => b.createdAt - a.createdAt,
        );
        if (!mounted) return;
        setMediaItems(combined);
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
        ref={headerRef}
        className={[
          "journey-header fixed top-0 left-0 right-0 z-50 mx-[5px] mt-[5px] transition-transform duration-300",
          headerHidden ? "journey-header--hidden" : "",
        ].join(" ")}
      >
        <div className="mx-auto w-full max-w-6xl">
          <div className="journey-header-inner px-3 py-2 sm:px-4 sm:py-3 flex flex-col gap-2 rounded-3xl border border-gray-200 bg-white/95 shadow-soft">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setTabAndScroll("timeline")}
                  className="rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 shrink-0"
                  aria-label="Go to Home"
                  title="Home"
                >
                  <img
                    src={logo}
                    alt="logo"
                    className="journey-header-logo h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 object-contain"
                  />
                </button>
                <div className="min-w-0">
                  <div className="journey-header-title text-sm sm:text-base font-extrabold text-gray-900 truncate tracking-tight">
                    Journey • {group.name}
                  </div>
                  {me ? (
                    <div className="journey-header-subtitle text-[11px] text-gray-600 font-semibold truncate">
                      Signed in as {me.name}
                    </div>
                  ) : (
                    <div className="journey-header-subtitle text-[11px] text-gray-600 font-semibold truncate">
                      Login required to post
                    </div>
                  )}
                </div>
              </div>

              <div className="hidden sm:flex flex-1 px-2">
                <div className="relative w-full max-w-lg">
                  <input
                    type="text"
                    placeholder="Search posts or members"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    data-chat-menu-button
                    onClick={() => setChatMenuOpen((v) => !v)}
                    className="h-9 w-9 rounded-2xl border border-gray-200 bg-white text-lg hover:bg-gray-50"
                    title="Chat"
                    aria-label="Chat"
                  >
                    💬
                  </button>
                  {chatMenuOpen && (
                    <div
                      data-chat-menu
                      className="absolute right-0 mt-2 w-64 rounded-2xl border border-gray-200 bg-white shadow-soft overflow-hidden z-50"
                    >
                      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                        <div className="text-sm font-semibold text-gray-900">
                          Group members
                        </div>
                        <button
                          type="button"
                          className="h-7 w-7 rounded-xl border border-gray-200 bg-white text-xs hover:bg-gray-50"
                          title="Chat settings"
                          aria-label="Chat settings"
                          onClick={() => {
                            setChatMode("group");
                            setChatPeerId(null);
                            setChatOpen(true);
                            setChatMenuOpen(false);
                          }}
                        >
                          ⚙️
                        </button>
                      </div>
                      <div className="max-h-64 overflow-auto">
                        {chatMembers.length === 0 && (
                          <div className="px-3 py-2 text-xs text-gray-500">
                            No members yet.
                          </div>
                        )}
                        {chatMembers.map((member) => {
                          const isOnline = chatOnlineIds.has(member.userId);
                          const isSelf = member.userId === me?.userId;
                          return (
                            <button
                              key={member.userId}
                              type="button"
                              className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-gray-50"
                              onClick={() => {
                                if (isSelf) {
                                  setChatMode("group");
                                  setChatPeerId(null);
                                } else {
                                  setChatMode("direct");
                                  setChatPeerId(member.userId);
                                }
                                setChatOpen(true);
                                setChatMenuOpen(false);
                              }}
                            >
                              <UserAvatar
                                userId={member.userId}
                                name={member.name}
                                size={28}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate">
                                  {member.name}
                                  {isSelf ? " (You)" : ""}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  {isSelf
                                    ? "Group chat"
                                    : "Direct message"}
                                </div>
                              </div>
                              <span
                                className={[
                                  "h-2.5 w-2.5 rounded-full",
                                  isOnline ? "bg-emerald-500" : "bg-gray-300",
                                ].join(" ")}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    data-notif-button
                    className="relative h-9 w-9 rounded-2xl border border-gray-200 bg-white text-lg hover:bg-gray-50"
                    title="Notifications"
                    aria-label="Notifications"
                    onClick={() => {
                      setNotifOpen((v) => {
                        const next = !v;
                        if (next && session?.userId && typeof window !== "undefined") {
                          const seenKey = `journey_beta_notifications_seen:${session.userId}`;
                          const latest = notifLatestRef.current;
                          if (latest > 0) {
                            localStorage.setItem(seenKey, String(latest));
                            notifSeenRef.current = latest;
                          }
                          setNotifCount(0);
                        }
                        return next;
                      });
                    }}
                  >
                    🔔
                    {notifCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {notifCount > 99 ? "99+" : notifCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div
                      ref={notifMenuRef}
                      data-notif-menu
                      className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl border border-gray-200 bg-white shadow-soft overflow-hidden z-50"
                    >
                      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                        <div className="text-sm font-extrabold text-gray-900">
                          Notifications
                        </div>
                        <button
                          type="button"
                          className="text-xs font-semibold text-blue-700 hover:underline"
                          onClick={() => {
                            setNotifOpen(false);
                            setTabAndScroll("timeline");
                          }}
                        >
                          View timeline
                        </button>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifItems.length === 0 && (
                          <div className="px-3 py-4 text-sm text-gray-500">
                            No notifications yet.
                          </div>
                        )}
                        {notifItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="w-full text-left px-3 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                            onClick={() => {
                              setNotifOpen(false);
                              setTabAndScroll("timeline");
                            }}
                          >
                            <div className="text-sm font-semibold text-gray-900">
                              {item.createdBy?.name ?? "Someone"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(item.createdAt).toLocaleString()}
                            </div>
                            <div className="mt-1 text-sm text-gray-700 line-clamp-2">
                              {item.text}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    data-profile-menu-button
                    onClick={() => setProfileMenuOpen((v) => !v)}
                    className="h-9 w-9 rounded-full border border-gray-200 bg-white flex items-center justify-center overflow-hidden"
                    title="Profile menu"
                    aria-label="Profile menu"
                  >
                    {me ? (
                      <UserAvatar userId={me.userId} name={me.name} size={32} />
                    ) : (
                      <span className="text-sm">👤</span>
                    )}
                  </button>

                  {profileMenuOpen && (
                    <div
                      data-profile-menu
                      className="absolute right-0 mt-2 w-48 rounded-2xl border border-gray-200 bg-white shadow-soft overflow-hidden z-50"
                    >
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          setDrawerOpen(true);
                        }}
                      >
                        Open menu
                      </button>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm font-semibold text-gray-600 hover:bg-gray-50"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="sm:hidden">
              <input
                type="text"
                placeholder="Search posts or members"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="hidden sm:block">
              <div className="rounded-3xl border border-gray-200 bg-white/90 shadow-soft p-1 sm:p-2">
                <div
                  className={[
                    "grid gap-1 sm:gap-2",
                    isViewer ? "grid-cols-2" : "grid-cols-5",
                  ].join(" ")}
                >
                  <TabButton
                    active={tab === "timeline"}
                    onClick={() => setTabAndScroll("timeline")}
                    label="Home"
                    icon={<HomeIcon />}
                  />
                  {!isViewer && (
                    <>
                      <TabButton
                        active={tab === "plan"}
                        onClick={() => setTabAndScroll("plan")}
                        label="Plan"
                        icon={<CalendarIcon />}
                      />
                      <TabButton
                        active={tab === "orders"}
                        onClick={() => setTabAndScroll("orders")}
                        label="Orders"
                        icon={<CartIcon />}
                      />
                      <TabButton
                        active={tab === "media"}
                        onClick={() => setTabAndScroll("media")}
                        label="Media"
                        icon={<MediaIcon />}
                      />
                    </>
                  )}
                  <TabButton
                    active={tab === "marketplace"}
                    onClick={() => setTabAndScroll("marketplace")}
                    label="Market"
                    icon={<MarketplaceIcon />}
                  />
                </div>
              </div>
            </div>
          </div>
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

      <div className="journey-content">
        <main className="mx-auto w-[95%] max-w-6xl pt-5 pb-24 sm:pb-5 space-y-5">
        <div className={tab === "timeline" ? "-mt-3 sm:-mt-4" : "hidden"}>
          <TimelineTab
            groupId={groupId}
            onMediaRefresh={() => setMediaVersion((v) => v + 1)}
            canInteract={!isViewer}
            refreshKey={timelineVersion}
            publicFeed
          />
        </div>

        <div className={tab === "plan" ? "" : "hidden"}>
          <div className="space-y-4">
            <Card>
              <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-2xl border border-gray-200 bg-white flex items-center justify-center shadow-soft shrink-0">
                    <img
                      src={logo}
                      alt="Journey"
                      className="h-8 w-8 object-contain"
                    />
                  </div>
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
                  {canManageGroup && (
                    <div className="w-full sm:w-auto relative" ref={planSettingsRef}>
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
                        onClick={() => setShowPlanSettings((v) => !v)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2"
                        title="Plan settings"
                      >
                        <span className="text-lg">☰</span>
                        <span className="sm:hidden">Settings</span>
                      </Button>
                      {showPlanSettings && (
                        <div className="absolute right-0 mt-2 rounded-2xl border border-gray-200 bg-white shadow-soft p-2 space-y-2 w-full sm:w-64 z-10">
                          <Button
                            variant="ghost"
                            onClick={downloadPlanTemplate}
                            className="w-full justify-start"
                          >
                            Download template
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => templateInputRef.current?.click()}
                            className="w-full justify-start"
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
                            className="w-full justify-start"
                          >
                            Sync local → cloud
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={importLegacyLocalData}
                            className="w-full justify-start"
                          >
                            Import legacy local data
                          </Button>
                        </div>
                      )}
                    </div>
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
            <div>
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
                                    {(c.replies ?? []).length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        {c.replies!.map((r) => (
                                          <div
                                            key={r.id}
                                            className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-1 text-xs text-gray-700"
                                          >
                                            <span className="font-semibold">
                                              {r.by}
                                            </span>{" "}
                                            {r.text}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div className="mt-2 flex items-center gap-2">
                                      <button
                                        type="button"
                                        className="text-xs font-semibold text-blue-600 hover:underline"
                                        onClick={() =>
                                          setPlanReplyOpen((prev) => ({
                                            ...prev,
                                            [c.id]: !prev[c.id],
                                          }))
                                        }
                                      >
                                        Reply
                                      </button>
                                      {me?.name === c.by && (
                                        <button
                                          type="button"
                                          className="text-xs font-semibold text-red-600 hover:underline"
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
                                    {planReplyOpen[c.id] && (
                                      <div className="mt-2 flex items-center gap-2">
                                        <input
                                          value={planReplyDrafts[c.id] ?? ""}
                                          onChange={(e) =>
                                            setPlanReplyDrafts((prev) => ({
                                              ...prev,
                                              [c.id]: e.target.value,
                                            }))
                                          }
                                          placeholder="Write a reply…"
                                          className="flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                                        />
                                        <Button
                                          variant="primary"
                                          disabled={
                                            !me ||
                                            !(planReplyDrafts[c.id] ?? "").trim()
                                          }
                                          onClick={() => {
                                            if (!me) return;
                                            const t = (
                                              planReplyDrafts[c.id] ?? ""
                                            ).trim();
                                            if (!t) return;
                                            addPlanCommentReply(
                                              groupId,
                                              item.id,
                                              c.id,
                                              me.name,
                                              t,
                                              me.userId,
                                            );
                                            setPlanReplyDrafts((prev) => ({
                                              ...prev,
                                              [c.id]: "",
                                            }));
                                            setPlanReplyOpen((prev) => ({
                                              ...prev,
                                              [c.id]: false,
                                            }));
                                            setRefresh((x) => x + 1);
                                          }}
                                        >
                                          Send
                                        </Button>
                                      </div>
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
            </div>
          </div>
        </div>

        <div className={tab === "orders" ? "" : "hidden"}>
          <Card>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-lg font-extrabold text-gray-900 tracking-tight">
                      Order list
                    </div>
                    <p className="mt-1 text-gray-600">
                      Build a checklist for food, supplies, or tasks.
                    </p>
                {orderError && (
                  <div className="mt-2 text-xs font-semibold text-red-600">
                    {orderError}
                  </div>
                )}
                {!orderLoaded && !orderError && (
                  <div className="mt-2 text-xs font-semibold text-gray-500">
                    Loading order list…
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <input
                value={orderDraft}
                onChange={(e) => setOrderDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const text = orderDraft.trim();
                  if (!text) return;
                  setOrderItems((prev) => [
                    ...prev,
                    {
                      id: `order_${Date.now()}_${Math.random()
                        .toString(36)
                        .slice(2, 7)}`,
                      label: text,
                      checked: false,
                    },
                  ]);
                  setOrderDraft("");
                  setOrderCreated(true);
                }}
                placeholder="Add an item (e.g., snacks, water, tickets)"
                className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
              />
              <Button
                variant="orange"
                onClick={() => {
                  const text = orderDraft.trim();
                  if (!text) return;
                  setOrderItems((prev) => [
                    ...prev,
                    {
                      id: `order_${Date.now()}_${Math.random()
                        .toString(36)
                        .slice(2, 7)}`,
                      label: text,
                      checked: false,
                    },
                  ]);
                  setOrderDraft("");
                  setOrderCreated(true);
                }}
                className="w-full sm:w-auto"
              >
                Add item
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {orderItems.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                  No items yet. Add your first item above.
                </div>
              )}

              {orderItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3"
                >
                  <label className="flex items-center gap-3 text-sm font-semibold text-gray-900">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) =>
                        setOrderItems((prev) =>
                          prev.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, checked: e.target.checked }
                              : entry,
                          ),
                        )
                      }
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span
                      className={
                        item.checked
                          ? "text-gray-400 line-through"
                          : "text-gray-900"
                      }
                    >
                      {item.label}
                    </span>
                  </label>
                  <button
                    type="button"
                    className="text-xs font-semibold text-red-600 hover:underline"
                    onClick={() =>
                      setOrderItems((prev) =>
                        prev.filter((entry) => entry.id !== item.id),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

          </Card>
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
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    if (!me) return;
                    const files = Array.from(e.target.files ?? []);
                    if (files.length === 0) return;
                    for (const f of files) {
                      try {
                        const imageUrl = await uploadImageToR2(f, groupId);
                        await addMedia(
                          groupId,
                          imageUrl,
                          { userId: me.userId, name: me.name },
                          mediaVisibility,
                        );
                      } catch {
                        if (import.meta.env.DEV) {
                          try {
                            const dataUrl = f.type.startsWith("image/")
                              ? await fileToDataUrl(f, 1400, 0.86)
                              : URL.createObjectURL(f);
                            await addMedia(
                              groupId,
                              dataUrl,
                              { userId: me.userId, name: me.name },
                              mediaVisibility,
                            );
                          } catch {
                            alert("Could not upload this file.");
                          }
                        } else {
                          alert("Could not upload this file.");
                        }
                      }
                    }
                    if (mediaInputRef.current) mediaInputRef.current.value = "";
                    setMediaVersion((v) => v + 1);
                  }}
                />
                <input
                  ref={mediaEditRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !mediaEditTarget || !me) return;
                    try {
                      const imageUrl = await uploadImageToR2(file, groupId);
                      if (mediaEditTarget.source === "media") {
                        await updateMediaImage(
                          mediaEditTarget.id,
                          me.userId,
                          imageUrl,
                        );
                      } else if (
                        mediaEditTarget.postId &&
                        mediaEditTarget.postImages
                      ) {
                        const next = [...mediaEditTarget.postImages];
                        const idx = mediaEditTarget.imageIndex ?? 0;
                        next[idx] = imageUrl;
                        await saveTimelineImages(mediaEditTarget.postId, next);
                        if (idx === 0) {
                          await updateTimelinePost(
                            mediaEditTarget.postId,
                            me.userId,
                            { imageDataUrl: imageUrl },
                          );
                        }
                      }
                      setMediaVersion((v) => v + 1);
                    } catch {
                      alert("Could not update this image.");
                    } finally {
                      if (mediaEditRef.current) mediaEditRef.current.value = "";
                      setMediaEditTarget(null);
                    }
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

            <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {mediaItems.map((m, index) => {
                const canEdit = me?.userId === m.createdBy.userId;
                const canDelete = m.source === "media" && canEdit;
                return (
                  <div
                    key={m.id}
                    className="group rounded-3xl border border-gray-200 bg-white overflow-hidden shadow-soft flex flex-col media-card-tilt"
                    onMouseMove={handleCardTiltMove}
                    onMouseLeave={handleCardTiltLeave}
                  >
                    <div className="relative aspect-square bg-gray-50 overflow-hidden">
                      {isVideoUrl(m.dataUrl) ? (
                        <div className="relative h-full w-full">
                          <video
                            src={m.dataUrl}
                            className="h-full w-full object-cover media-card-image"
                            muted
                            playsInline
                            preload="metadata"
                          />
                          <button
                            type="button"
                            className="absolute inset-0 flex items-center justify-center bg-black/10 text-white text-4xl font-extrabold"
                            onClick={() => openMediaViewer(index)}
                            aria-label="Play video"
                          >
                            ▶
                          </button>
                        </div>
                      ) : (
                        <img
                          src={m.dataUrl}
                          alt="media"
                          className="h-full w-full object-cover cursor-zoom-in media-card-image"
                          loading="lazy"
                          onClick={() => openMediaViewer(index)}
                        />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3 text-[11px] text-white opacity-0 group-hover:opacity-100 transition">
                        <div className="font-semibold truncate">
                          {m.createdBy.name}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide">
                          {m.source === "timeline"
                            ? "Timeline"
                            : `Visibility: ${m.visibility}`}
                        </div>
                      </div>

                      <div className="absolute top-3 right-3">
                        <button
                          type="button"
                          className="h-9 w-9 rounded-full bg-white/90 text-gray-900 shadow-soft flex items-center justify-center text-lg font-bold opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMediaMenuOpenId((prev) =>
                              prev === m.id ? null : m.id,
                            );
                          }}
                          aria-label="Media actions"
                        >
                          ⋯
                        </button>

                        {mediaMenuOpenId === m.id && (
                          <div
                            className="absolute right-0 mt-2 w-52 rounded-2xl border border-gray-200 bg-white/95 shadow-soft backdrop-blur p-1 text-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="w-full rounded-xl px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-50"
                              onClick={() => {
                                setMediaMenuOpenId(null);
                                const a = document.createElement("a");
                                a.href = m.dataUrl;
                                a.download = "journey-media";
                                a.rel = "noopener";
                                a.click();
                              }}
                            >
                              Download
                            </button>
                            <button
                              type="button"
                              className="w-full rounded-xl px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-50"
                              onClick={() => {
                                setMediaMenuOpenId(null);
                                const w = window.open("", "_blank");
                                if (!w) return;
                                if (isVideoUrl(m.dataUrl)) {
                                  w.document.write(
                                    `<html><body style="margin:0;display:flex;align-items:center;justify-content:center;background:#000;"><video src="${m.dataUrl}" style="max-width:100%;max-height:100vh;" controls autoplay></video></body></html>`,
                                  );
                                } else {
                                  w.document.write(
                                    `<html><body style="margin:0;display:flex;align-items:center;justify-content:center;background:#000;"><img src="${m.dataUrl}" style="max-width:100%;max-height:100vh;"/></body></html>`,
                                  );
                                }
                                w.document.close();
                                w.focus();
                                w.print();
                              }}
                            >
                              Print
                            </button>
                            <button
                              type="button"
                              className="w-full rounded-xl px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-50"
                              onClick={() => {
                                setMediaMenuOpenId(null);
                                void shareMediaLink(m.dataUrl);
                              }}
                            >
                              Share
                            </button>
                            {!isViewer && m.source === "media" && (
                              <button
                                type="button"
                                className="w-full rounded-xl px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-50"
                                onClick={() => {
                                  setMediaMenuOpenId(null);
                                  void repostToTimeline(m.dataUrl);
                                }}
                              >
                                Repost to timeline
                              </button>
                            )}
                            {canEdit && (
                              <button
                                type="button"
                                className="w-full rounded-xl px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-50"
                                onClick={() => {
                                  setMediaMenuOpenId(null);
                                  setMediaEditTarget({
                                    id: m.id,
                                    source: m.source,
                                    postId: m.postId,
                                    postImages: m.postImages,
                                    imageIndex: m.imageIndex,
                                    createdBy: m.createdBy,
                                  });
                                  mediaEditRef.current?.click();
                                }}
                              >
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                className="w-full rounded-xl px-3 py-2 text-left font-semibold text-red-600 hover:bg-red-50"
                                onClick={async () => {
                                  setMediaMenuOpenId(null);
                                  await deleteMedia(groupId, m.id, me.userId);
                                  setMediaVersion((v) => v + 1);
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-3 pb-3 pt-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                        <span className="truncate font-semibold text-gray-900">
                          {m.createdBy.name}
                        </span>
                        <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
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

        <div className={tab === "marketplace" ? "" : "hidden"}>
          <MarketplaceTab
            me={me}
            uploadScope={me ? `band-${me.userId}` : "marketplace"}
          />
        </div>

        </main>

      </div>

      <div className="sm:hidden fixed bottom-[14px] left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-6xl">
        <div className="rounded-3xl border border-gray-200 bg-white/95 shadow-soft p-1">
          <div
            className={[
              "grid gap-1",
              isViewer ? "grid-cols-2" : "grid-cols-5",
            ].join(" ")}
          >
            <TabButton
              active={tab === "timeline"}
              onClick={() => setTabAndScroll("timeline")}
              label="Home"
              icon={<HomeIcon />}
            />
            {!isViewer && (
              <>
                <TabButton
                  active={tab === "plan"}
                  onClick={() => setTabAndScroll("plan")}
                  label="Plan"
                  icon={<CalendarIcon />}
                />
                <TabButton
                  active={tab === "orders"}
                  onClick={() => setTabAndScroll("orders")}
                  label="Orders"
                  icon={<CartIcon />}
                />
                <TabButton
                  active={tab === "media"}
                  onClick={() => setTabAndScroll("media")}
                  label="Media"
                  icon={<MediaIcon />}
                />
              </>
            )}
            <TabButton
              active={tab === "marketplace"}
              onClick={() => setTabAndScroll("marketplace")}
              label="Market"
              icon={<MarketplaceIcon />}
            />
          </div>
        </div>
      </div>

      <ChatWidget
        groupId={groupId}
        groupName={group.name}
        canEditGroupName={canManageGroup}
        onGroupNameUpdated={(name) =>
          setGroup((g) => (g ? { ...g, name } : g))
        }
        open={chatOpen}
        onToggle={setChatOpen}
        showFab={false}
        mode={chatMode}
        peerId={chatPeerId}
        onPeerChange={setChatPeerId}
      />

      {mediaViewerOpen && mediaItems[mediaViewerIndex] && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={closeMediaViewer}
        >
          <div
            className="relative max-w-[95vw] max-h-[90vh] w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleMediaTouchStart}
            onTouchMove={handleMediaTouchMove}
            onTouchEnd={handleMediaTouchEnd}
          >
            <div
              className={[
                "relative max-w-[95vw] max-h-[90vh] overflow-auto rounded-2xl media-viewer-pop",
                mediaViewerZoom ? "cursor-zoom-out" : "cursor-zoom-in",
              ].join(" ")}
            >
              {isVideoUrl(mediaItems[mediaViewerIndex].dataUrl) ? (
                <video
                  src={mediaItems[mediaViewerIndex].dataUrl}
                  className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain"
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <img
                  src={mediaItems[mediaViewerIndex].dataUrl}
                  alt="preview"
                  className={[
                    "max-h-[90vh] max-w-[95vw] object-contain transition-transform duration-200",
                    mediaViewerZoom ? "scale-150" : "scale-100",
                  ].join(" ")}
                  onClick={() => setMediaViewerZoom((v) => !v)}
                />
              )}
            </div>

            {mediaItems.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={mediaViewerPrev}
                  className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 text-gray-900 shadow-soft"
                  title="Previous"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={mediaViewerNext}
                  className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 text-gray-900 shadow-soft"
                  title="Next"
                >
                  ›
                </button>
              </>
            )}

            <button
              type="button"
              onClick={closeMediaViewer}
              className="absolute -top-3 -right-3 h-9 w-9 rounded-full bg-white text-gray-900 shadow-soft"
              title="Close"
            >
              ✕
            </button>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white">
              {mediaViewerIndex + 1} / {mediaItems.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
