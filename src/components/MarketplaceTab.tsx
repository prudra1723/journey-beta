import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { UserAvatar } from "./UserAvatar";
import {
  addBandRequestMessage,
  createBandRequest,
  getBandProfiles,
  getBandRequestMessages,
  getBandRequestsIncoming,
  getBandRequestsOutgoing,
  getMyBandProfile,
  type BandBookingRequest,
  type BandProfile,
  type BandRequestMessage,
  updateBandRequestStatus,
  upsertBandProfile,
} from "../lib/appDb";
import { uploadImageToR2 } from "../lib/r2Upload";

type Me = { userId: string; name: string } | null;

function formatAvailability(list: string[]) {
  return list.filter(Boolean).slice(0, 3).join(" · ");
}

export default function MarketplaceTab({
  me,
  uploadScope,
}: {
  me: Me;
  uploadScope: string;
}) {
  const [profiles, setProfiles] = useState<BandProfile[]>([]);
  const [myProfile, setMyProfile] = useState<BandProfile | null>(null);
  const [incoming, setIncoming] = useState<BandBookingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<BandBookingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    bandType: "",
    description: "",
    location: "",
    coverRange: "",
    youtubeUrl: "",
    availabilityText: "",
    coverImageUrl: "",
  });
  const [coverBusy, setCoverBusy] = useState(false);

  const [requestBand, setRequestBand] = useState<BandProfile | null>(null);
  const [requestDate, setRequestDate] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);

  const [chatRequest, setChatRequest] = useState<BandBookingRequest | null>(
    null,
  );
  const [chatMessages, setChatMessages] = useState<BandRequestMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");

  const availabilityList = useMemo(() => {
    return draft.availabilityText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  }, [draft.availabilityText]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = await getBandProfiles();
        if (!active) return;
        setProfiles(list);
        if (me) {
          const mine = await getMyBandProfile(me.userId);
          if (!active) return;
          setMyProfile(mine);
          if (mine) {
            setDraft({
              name: mine.name,
              bandType: mine.bandType ?? "",
              description: mine.description ?? "",
              location: mine.location ?? "",
              coverRange: mine.coverRange ?? "",
              youtubeUrl: mine.youtubeUrl ?? "",
              availabilityText: (mine.availability ?? []).join("\n"),
              coverImageUrl: mine.coverImageUrl ?? "",
            });
          }
          const [incomingReq, outgoingReq] = await Promise.all([
            getBandRequestsIncoming(me.userId),
            getBandRequestsOutgoing(me.userId),
          ]);
          if (!active) return;
          setIncoming(incomingReq);
          setOutgoing(outgoingReq);
        }
      } catch (err) {
        if (!active) return;
        setError((err as { message?: string })?.message ?? "Load failed");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [me?.userId]);

  async function handleSaveProfile() {
    if (!me) return;
    if (!draft.name.trim()) {
      alert("Band name required.");
      return;
    }
    const saved = await upsertBandProfile(me.userId, {
      name: draft.name.trim(),
      bandType: draft.bandType.trim(),
      description: draft.description.trim(),
      location: draft.location.trim(),
      coverRange: draft.coverRange.trim(),
      youtubeUrl: draft.youtubeUrl.trim(),
      coverImageUrl: draft.coverImageUrl || null,
      availability: availabilityList,
    });
    setMyProfile(saved);
    setShowForm(false);
    const list = await getBandProfiles();
    setProfiles(list);
  }

  async function handleUploadCover(file: File) {
    if (!me) return;
    setCoverBusy(true);
    try {
      const url = await uploadImageToR2(file, uploadScope);
      setDraft((prev) => ({ ...prev, coverImageUrl: url }));
    } catch {
      alert("Could not upload cover image.");
    } finally {
      setCoverBusy(false);
    }
  }

  async function submitRequest() {
    if (!me || !requestBand) return;
    setRequestBusy(true);
    try {
      const req = await createBandRequest(requestBand.id, me.userId, {
        eventDate: requestDate || undefined,
        message: requestMessage.trim() || undefined,
      });
      setRequestBand(null);
      setRequestDate("");
      setRequestMessage("");
      const outgoingReq = await getBandRequestsOutgoing(me.userId);
      setOutgoing(outgoingReq);
      setChatRequest({
        ...req,
        band: {
          id: requestBand.id,
          name: requestBand.name,
          bandType: requestBand.bandType ?? null,
          location: requestBand.location ?? null,
          coverImageUrl: requestBand.coverImageUrl ?? null,
        },
      });
      const msgs = await getBandRequestMessages(req.id);
      setChatMessages(msgs);
    } catch {
      alert("Could not send request.");
    } finally {
      setRequestBusy(false);
    }
  }

  async function openChat(req: BandBookingRequest) {
    setChatRequest(req);
    const msgs = await getBandRequestMessages(req.id);
    setChatMessages(msgs);
  }

  async function sendChat() {
    if (!me || !chatRequest) return;
    const msg = chatDraft.trim();
    if (!msg) return;
    await addBandRequestMessage(chatRequest.id, me.userId, msg);
    const msgs = await getBandRequestMessages(chatRequest.id);
    setChatMessages(msgs);
    setChatDraft("");
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xl font-extrabold text-gray-900">
              Marketplace
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Discover bands, view portfolios, and request bookings. Contact
              details stay private until booking is confirmed.
            </p>
          </div>
          <div className="flex gap-2">
            {me ? (
              <Button
                variant="primary"
                onClick={() => setShowForm((v) => !v)}
              >
                {myProfile ? "Edit your band" : "List your band"}
              </Button>
            ) : (
              <div className="text-xs font-semibold text-gray-500">
                Login to list or request.
              </div>
            )}
          </div>
        </div>
      </Card>

      {showForm && (
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-600">
                Band name
              </label>
              <input
                value={draft.name}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, name: e.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                placeholder="Your band name"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Band type
              </label>
              <input
                value={draft.bandType}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, bandType: e.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                placeholder="Rock, Jazz, Wedding..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Location
              </label>
              <input
                value={draft.location}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, location: e.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                placeholder="City / Region"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Cover range
              </label>
              <input
                value={draft.coverRange}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, coverRange: e.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                placeholder="e.g. 50km"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">
                YouTube portfolio
              </label>
              <input
                value={draft.youtubeUrl}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, youtubeUrl: e.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                placeholder="https://youtube.com/..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Cover image
              </label>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUploadCover(file);
                  }}
                />
                {coverBusy && (
                  <span className="text-xs text-gray-500">Uploading...</span>
                )}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-600">
                Availability slots (one per line)
              </label>
              <textarea
                value={draft.availabilityText}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    availabilityText: e.target.value,
                  }))
                }
                className="mt-1 w-full min-h-[90px] rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                placeholder="Fri 7pm-10pm\nSat 5pm-9pm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-600">
                About
              </label>
              <textarea
                value={draft.description}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="mt-1 w-full min-h-[110px] rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                placeholder="Tell people about your band"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveProfile}>
              Save
            </Button>
          </div>
        </Card>
      )}

      {loading && (
        <Card>
          <div className="text-sm text-gray-600">Loading marketplace…</div>
        </Card>
      )}
      {error && (
        <Card>
          <div className="text-sm text-red-600">{error}</div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((band) => (
          <div
            key={band.id}
            className="rounded-3xl border border-gray-200 bg-white shadow-soft overflow-hidden flex flex-col"
          >
            <div className="h-40 bg-gray-100 overflow-hidden">
              {band.coverImageUrl ? (
                <img
                  src={band.coverImageUrl}
                  alt={band.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">
                  No cover image
                </div>
              )}
            </div>
            <div className="p-4 flex-1 flex flex-col gap-2">
              <div className="text-lg font-extrabold text-gray-900">
                {band.name}
              </div>
              <div className="text-xs text-gray-500">
                {band.bandType || "Band"} · {band.location || "Location TBA"}
              </div>
              {band.coverRange && (
                <div className="text-xs text-gray-500">
                  Cover range: {band.coverRange}
                </div>
              )}
              {band.availability && band.availability.length > 0 && (
                <div className="text-xs text-gray-600">
                  Availability: {formatAvailability(band.availability)}
                </div>
              )}
              {band.youtubeUrl && (
                <a
                  className="text-xs font-semibold text-blue-600 hover:underline"
                  href={band.youtubeUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View YouTube portfolio
                </a>
              )}
              <div className="mt-auto flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setRequestBand(band)}
                  disabled={!me}
                  className="w-full"
                >
                  Request booking
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {me && incoming.length > 0 && (
        <Card>
          <div className="text-lg font-extrabold text-gray-900">
            Incoming booking requests
          </div>
          <div className="mt-3 space-y-3">
            {incoming.map((req) => (
              <div
                key={req.id}
                className="rounded-2xl border border-gray-200 p-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-900">
                    {req.requesterName || "Requester"} · {req.band?.name}
                  </div>
                  <select
                    value={req.status}
                    onChange={async (e) => {
                      await updateBandRequestStatus(req.id, e.target.value);
                      const refreshed = await getBandRequestsIncoming(
                        me.userId,
                      );
                      setIncoming(refreshed);
                    }}
                    className="rounded-xl border border-gray-200 bg-white px-2 py-1 text-xs"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="declined">Declined</option>
                  </select>
                </div>
                {req.eventDate && (
                  <div className="text-xs text-gray-500">
                    Event: {req.eventDate}
                  </div>
                )}
                {req.message && (
                  <div className="text-sm text-gray-700">{req.message}</div>
                )}
                <Button variant="ghost" onClick={() => openChat(req)}>
                  Open chat
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {me && outgoing.length > 0 && (
        <Card>
          <div className="text-lg font-extrabold text-gray-900">
            Your booking requests
          </div>
          <div className="mt-3 space-y-3">
            {outgoing.map((req) => (
              <div
                key={req.id}
                className="rounded-2xl border border-gray-200 p-3 flex flex-col gap-2"
              >
                <div className="text-sm font-semibold text-gray-900">
                  {req.band?.name}
                </div>
                <div className="text-xs text-gray-500">
                  Status: {req.status}
                </div>
                <Button variant="ghost" onClick={() => openChat(req)}>
                  Open chat
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {requestBand &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setRequestBand(null)}
          >
            <div
              className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-soft"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-lg font-extrabold text-gray-900">
                Request booking · {requestBand.name}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Keep contact details private until booking is confirmed.
              </p>
              <div className="mt-3 space-y-2">
                <label className="text-xs font-semibold text-gray-600">
                  Event date
                </label>
                <input
                  type="date"
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-3">
                <label className="text-xs font-semibold text-gray-600">
                  Message
                </label>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  className="mt-1 w-full min-h-[120px] rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm"
                  placeholder="Share event details, budget, timing..."
                />
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => setRequestBand(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={requestBusy}
                  onClick={submitRequest}
                >
                  {requestBusy ? "Sending..." : "Send request"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {chatRequest &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setChatRequest(null)}
          >
            <div
              className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-soft"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="text-lg font-extrabold text-gray-900">
                  Booking chat
                </div>
                <button
                  type="button"
                  className="h-8 w-8 rounded-full border border-gray-200 bg-white text-sm"
                  onClick={() => setChatRequest(null)}
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Do not share personal contact details before confirmation.
              </p>
              <div className="mt-3 max-h-[280px] overflow-auto space-y-2 border border-gray-200 rounded-2xl p-3 bg-gray-50">
                {chatMessages.length === 0 && (
                  <div className="text-xs text-gray-500">
                    No messages yet.
                  </div>
                )}
                {chatMessages.map((m) => (
                  <div
                    key={m.id}
                    className={[
                      "rounded-2xl p-2 text-sm",
                      m.senderId === me?.userId
                        ? "bg-blue-100 ml-auto max-w-[80%]"
                        : "bg-white max-w-[80%]",
                    ].join(" ")}
                  >
                    <div className="text-[11px] text-gray-500 mb-1">
                      {m.senderName}
                    </div>
                    <div>{m.message}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <UserAvatar userId={me!.userId} name={me!.name} size={28} />
                <input
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm"
                />
                <Button variant="primary" onClick={sendChat}>
                  Send
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
