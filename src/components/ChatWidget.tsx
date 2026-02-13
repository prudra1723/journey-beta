// src/components/ChatWidget.tsx
import { useEffect, useMemo, useState } from "react";
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
}: {
  groupId: string;
  groupName?: string;
  canEditGroupName?: boolean;
  onGroupNameUpdated?: (name: string) => void;
}) {
  const session = getSession();
  const me: ChatUser | null = session
    ? { userId: session.userId, name: session.name }
    : null;

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(groupName ?? "");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const {
    messages,
    online,
    knownMembers,
    unreadCount,
    toast,
    setToast,
    sendMessage,
  } = useChatSync({ groupId, me, open });

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

  async function onSend() {
    const msg = text.trim();
    if (!msg || !me) return;
    setText("");
    await sendMessage({ text: msg });
  }

  return (
    <>
      {toast && <ChatToast text={toast} onClose={() => setToast(null)} />}

      <ChatFab
        unreadCount={unreadCount}
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />

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
                  <strong>{groupName ?? "Group Chat"}</strong>
                  {canEditGroupName && (
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
                {online.length} online • {offlineMembers.length} offline
              </span>
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

          {/* Members */}
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
            {(knownMembers ?? []).map((m) => {
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
            })}
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
              placeholder={me ? "Type a message..." : "Login to chat"}
              disabled={!me}
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
              disabled={!me || !text.trim()}
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
