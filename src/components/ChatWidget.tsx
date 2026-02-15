// src/components/ChatWidget.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { getSession } from "../lib/session";
import type { ChatUser } from "../lib/chatDb";
import { updateGroupName } from "../lib/appDb";

import { ChatFab } from "../features/chat/components/ChatFab";
import { ChatToast } from "../features/chat/components/ChatToast";
import { useChatSync } from "../features/chat/hooks/useChatSync";
import { UserAvatar } from "./UserAvatar";

export default function ChatWidget({
  groupId,
  groupName,
  canEditGroupName = false,
  onGroupNameUpdated,
  open: controlledOpen,
  onToggle,
  mode: modeProp = "group",
  peerId,
  onPeerChange,
  onCreateGroup,
  showFab = true,
}: {
  groupId: string;
  groupName?: string;
  canEditGroupName?: boolean;
  onGroupNameUpdated?: (name: string) => void;
  open?: boolean;
  onToggle?: (next: boolean) => void;
  mode?: "group" | "direct";
  peerId?: string | null;
  onPeerChange?: (peerId: string | null) => void;
  onCreateGroup?: () => void;
  showFab?: boolean;
}) {
  const session = getSession();
  const me: ChatUser | null = session
    ? { userId: session.userId, name: session.name }
    : null;

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(open) : next;
    if (controlledOpen !== undefined) {
      onToggle?.(value);
    } else {
      setInternalOpen(value);
    }
  };
  const [text, setText] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(groupName ?? "");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const mode = modeProp ?? "group";
  const {
    messages,
    online,
    knownMembers,
    unreadCount,
    toast,
    setToast,
    sendMessage,
  } = useChatSync({ groupId, me, open, mode, peerId });

  useEffect(() => {
    if (!editingName) setNameDraft(groupName ?? "");
  }, [groupName, editingName]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      document.body.classList.add("chat-open");
    } else {
      document.body.classList.remove("chat-open");
    }
    return () => {
      document.body.classList.remove("chat-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, [open, messages.length]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-chat-settings-menu]")) return;
      if (target.closest("[data-chat-settings-button]")) return;
      setSettingsOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [settingsOpen]);

  async function saveGroupName() {
    const next = nameDraft.trim();
    if (!next) {
      setNameError("Name required");
      return;
    }
    setNameError(null);
    setNameBusy(true);
    try {
      await updateGroupName(groupId, next);
      onGroupNameUpdated?.(next);
      setEditingName(false);
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ?? "Could not update name.";
      setNameError(msg);
    } finally {
      setNameBusy(false);
    }
  }

  const onlineIds = useMemo(
    () => new Set(online.map((u) => u.userId)),
    [online],
  );

  const offlineMembers = useMemo(() => {
    return (knownMembers ?? []).filter((m) => !onlineIds.has(m.userId));
  }, [knownMembers, onlineIds]);

  const selectableMembers = useMemo(() => {
    const list = knownMembers ?? [];
    return list.filter((m) => m.userId !== me?.userId);
  }, [knownMembers, me?.userId]);

  const selectedPeer = useMemo(() => {
    if (!peerId) return null;
    return (knownMembers ?? []).find((m) => m.userId === peerId) ?? null;
  }, [knownMembers, peerId]);

  const directStatus = selectedPeer
    ? onlineIds.has(selectedPeer.userId)
      ? "Online"
      : "Offline"
    : "Pick a member";

  async function onSend() {
    const msg = text.trim();
    if (!msg || !me) return;
    setText("");
    await sendMessage({ text: msg });
  }

  return (
    <>
      {toast && <ChatToast text={toast} onClose={() => setToast(null)} />}

      {showFab && (
        <ChatFab
          unreadCount={unreadCount}
          open={open}
          onToggle={() => setOpen((v) => !v)}
        />
      )}

      {open && (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 88,
            width: 360,
            maxWidth: "calc(100vw - 32px)",
            height: 520,
            maxHeight: "calc(100vh - 140px)",
            background: "white",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: 12,
              borderBottom: "1px solid rgba(0,0,0,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {editingName ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="Group name"
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.15)",
                      fontSize: 12,
                    }}
                  />
                  <button
                    onClick={saveGroupName}
                    disabled={nameBusy}
                    style={{
                      border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: 10,
                      padding: "6px 10px",
                      background: "#2563eb",
                      color: "white",
                      fontSize: 12,
                      cursor: "pointer",
                      opacity: nameBusy ? 0.6 : 1,
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingName(false);
                      setNameError(null);
                    }}
                    disabled={nameBusy}
                    style={{
                      border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: 10,
                      padding: "6px 10px",
                      background: "white",
                      fontSize: 12,
                      cursor: "pointer",
                      opacity: nameBusy ? 0.6 : 1,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <strong>
                    {mode === "direct"
                      ? selectedPeer
                        ? `Direct • ${selectedPeer.name}`
                        : "Direct Chat"
                      : groupName ?? "Group Chat"}
                  </strong>
                  {mode === "group" && canEditGroupName && (
                    <button
                      onClick={() => {
                        setEditingName(true);
                        setNameError(null);
                      }}
                      style={{
                        border: "1px solid rgba(0,0,0,0.12)",
                        borderRadius: 999,
                        padding: "2px 8px",
                        fontSize: 11,
                        background: "white",
                        cursor: "pointer",
                      }}
                      title="Edit group name"
                    >
                      ✎
                    </button>
                  )}
                </div>
              )}
              {nameError && (
                <span style={{ fontSize: 11, color: "#b91c1c" }}>
                  {nameError}
                </span>
              )}
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                {mode === "direct"
                  ? directStatus
                  : `${online.length} online • ${offlineMembers.length} offline`}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  data-chat-settings-button
                  onClick={() => setSettingsOpen((v) => !v)}
                  style={{
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "white",
                    borderRadius: 10,
                    fontSize: 14,
                    padding: "6px 8px",
                    cursor: "pointer",
                  }}
                  aria-label="Chat settings"
                  title="Chat settings"
                >
                  ⚙️
                </button>
                {settingsOpen && (
                  <div
                    data-chat-settings-menu
                    style={{
                      position: "absolute",
                      right: 0,
                      marginTop: 8,
                      width: 220,
                      borderRadius: 14,
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: "white",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                      overflow: "hidden",
                      zIndex: 50,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsOpen(false);
                        if (onCreateGroup) onCreateGroup();
                        else if (typeof window !== "undefined") {
                          window.location.href = "/dashboard";
                        }
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        fontSize: 12,
                        fontWeight: 700,
                        border: "none",
                        background: "white",
                        cursor: "pointer",
                      }}
                    >
                      Create new group
                      <div style={{ fontSize: 11, opacity: 0.6 }}>
                        Go to dashboard
                      </div>
                    </button>
                    <div
                      style={{
                        padding: "8px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "rgba(0,0,0,0.55)",
                        borderTop: "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      Members
                    </div>
                    <div style={{ maxHeight: 180, overflowY: "auto" }}>
                      {(knownMembers ?? []).map((m) => {
                        const isOnline = onlineIds.has(m.userId);
                        return (
                          <div
                            key={m.userId}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "8px 12px",
                              fontSize: 12,
                            }}
                          >
                            <UserAvatar
                              userId={m.userId}
                              name={m.name}
                              size={22}
                            />
                            <span style={{ flex: 1 }}>{m.name}</span>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 999,
                                background: isOnline ? "green" : "gray",
                                opacity: 0.8,
                              }}
                            />
                          </div>
                        );
                      })}
                      {(!knownMembers || knownMembers.length === 0) && (
                        <div
                          style={{
                            padding: "8px 12px",
                            fontSize: 12,
                            opacity: 0.6,
                          }}
                        >
                          No members yet.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 18,
                  cursor: "pointer",
                  opacity: 0.7,
                }}
                aria-label="Close chat"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Members / Direct picks */}
          <div
            style={{
              padding: 10,
              borderBottom: "1px solid rgba(0,0,0,0.08)",
              display: "flex",
              gap: 8,
              overflowX: "auto",
              alignItems: "center",
            }}
          >
            {mode === "direct" ? (
              selectableMembers.length ? (
                selectableMembers.map((m) => {
                  const isActive = peerId === m.userId;
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => onPeerChange?.(m.userId)}
                      title={`Message ${m.name}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: isActive
                          ? "1px solid rgba(37,99,235,0.65)"
                          : "1px solid rgba(0,0,0,0.10)",
                        whiteSpace: "nowrap",
                        background: isActive
                          ? "rgba(37,99,235,0.12)"
                          : "rgba(0,0,0,0.03)",
                        cursor: "pointer",
                      }}
                    >
                      <UserAvatar userId={m.userId} name={m.name} size={26} />
                      <span style={{ fontSize: 12 }}>{m.name}</span>
                    </button>
                  );
                })
              ) : (
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  No other members yet.
                </span>
              )
            ) : (
              (knownMembers ?? []).map((m) => {
                const isOnline = onlineIds.has(m.userId);
                return (
                  <div
                    key={m.userId}
                    title={`${m.name} • ${isOnline ? "Online" : "Offline"}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(0,0,0,0.10)",
                      whiteSpace: "nowrap",
                      background: isOnline
                        ? "rgba(0,200,0,0.08)"
                        : "rgba(0,0,0,0.03)",
                    }}
                  >
                    <UserAvatar userId={m.userId} name={m.name} size={26} />
                    <span style={{ fontSize: 12 }}>{m.name}</span>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: isOnline ? "green" : "gray",
                        opacity: 0.8,
                      }}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              background: "rgba(0,0,0,0.02)",
            }}
          >
            {messages.map((m) => {
              const mine = me && m.createdBy.userId === me.userId;
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: mine ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    background: mine ? "rgba(0,120,255,0.12)" : "white",
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 14,
                    padding: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.75,
                      marginBottom: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <UserAvatar
                      userId={m.createdBy.userId}
                      name={m.createdBy.name}
                      size={18}
                    />
                    <strong>{m.createdBy.name}</strong>
                    <span style={{ marginLeft: 6 }}>
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {m.text && (
                    <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                  )}

                  {/* Reactions removed */}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: 10,
              borderTop: "1px solid rgba(0,0,0,0.08)",
              display: "flex",
              gap: 8,
              background: "white",
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                !me
                  ? "Login to chat"
                  : mode === "direct" && !peerId
                    ? "Select a member to message"
                    : "Type a message..."
              }
              disabled={!me || (mode === "direct" && !peerId)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSend();
              }}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                outline: "none",
              }}
            />
            <button
              onClick={onSend}
              disabled={!me || !text.trim() || (mode === "direct" && !peerId)}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "none",
                cursor: me && text.trim() ? "pointer" : "not-allowed",
                opacity: me && text.trim() ? 1 : 0.5,
                background: "rgba(0,120,255,0.9)",
                color: "white",
                fontWeight: 600,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
