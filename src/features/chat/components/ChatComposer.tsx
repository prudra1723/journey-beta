// src/features/chat/components/ChatComposer.tsx
import { useMemo, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import type { ChatUser } from "../../../lib/chatDb";
import { fileToDataUrl, QUICK_EMOJIS } from "../lib/chatUi";
import { MentionSuggestions } from "./MentionSuggestions";

export function ChatComposer({
  me,
  memberNames,
  replyTo,
  onCancelReply,
  onSend,
}: {
  me: ChatUser | null;
  memberNames: string[];
  replyTo: { id: string; preview: string; name: string } | null;
  onCancelReply: () => void;
  onSend: (payload: {
    text: string;
    imageDataUrl?: string | null;
    poll?: { question: string; options: { id: string; text: string }[] } | null;
  }) => void;
}) {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Poll composer
  const [pollMode, setPollMode] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const canSend = useMemo(() => {
    if (!me) return false;
    const t = text.trim();
    const hasPoll =
      pollMode &&
      pollQuestion.trim() &&
      pollOptions.filter((x) => x.trim()).length >= 2;
    return Boolean(t || imagePreview || hasPoll);
  }, [me, text, imagePreview, pollMode, pollQuestion, pollOptions]);

  async function onPickImage(files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      const url = await fileToDataUrl(files[0], 1200, 0.82);
      setImagePreview(url);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      alert("Could not load image. Try a smaller photo.");
    }
  }

  function buildPollOrNull() {
    const ok =
      pollMode &&
      pollQuestion.trim() &&
      pollOptions.filter((x) => x.trim()).length >= 2;
    if (!ok) return null;

    return {
      question: pollQuestion.trim(),
      options: pollOptions
        .filter((x) => x.trim())
        .map((x) => ({
          id: `opt_${Math.random().toString(36).slice(2, 7)}`,
          text: x.trim(),
        })),
    };
  }

  function sendNow() {
    if (!me) return;

    onSend({
      text,
      imageDataUrl: imagePreview,
      poll: buildPollOrNull(),
    });

    setText("");
    setImagePreview(null);

    setPollMode(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
  }

  return (
    <div className="px-4 py-3 border-t border-gray-200 bg-white">
      {replyTo && (
        <div className="mb-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 flex items-center justify-between gap-2">
          <div className="text-xs text-gray-700 min-w-0">
            Replying to <span className="font-extrabold">{replyTo.name}</span>:{" "}
            <span className="font-semibold">{replyTo.preview}</span>
          </div>
          <button
            type="button"
            className="text-xs font-extrabold text-gray-700 hover:underline"
            onClick={onCancelReply}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-2">
        <button
          type="button"
          className={[
            "px-3 py-2 rounded-2xl border text-sm font-extrabold",
            pollMode
              ? "bg-yellow-200 border-yellow-300"
              : "bg-white border-gray-200 hover:bg-gray-50",
          ].join(" ")}
          onClick={() => setPollMode((v) => !v)}
        >
          📊 Poll
        </button>

        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPickImage(e.target.files)}
          />
          <button
            type="button"
            className="px-3 py-2 rounded-2xl border border-gray-200 bg-white text-sm font-extrabold hover:bg-gray-50"
            onClick={() => fileRef.current?.click()}
          >
            📷 Photo
          </button>
        </div>
      </div>

      {pollMode && (
        <div className="mb-2 rounded-2xl border border-gray-200 bg-gray-50 p-3 space-y-2">
          <input
            value={pollQuestion}
            onChange={(e) => setPollQuestion(e.target.value)}
            placeholder="Poll question"
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
          />

          {pollOptions.map((opt, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                value={opt}
                onChange={(e) => {
                  const next = [...pollOptions];
                  next[idx] = e.target.value;
                  setPollOptions(next);
                }}
                placeholder={`Option ${idx + 1}`}
                className="flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
              />
              <button
                type="button"
                className="w-10 h-10 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 font-extrabold"
                onClick={() => {
                  if (pollOptions.length <= 2) return;
                  setPollOptions((prev) => prev.filter((_, i) => i !== idx));
                }}
                title="Remove option"
              >
                ×
              </button>
            </div>
          ))}

          <button
            type="button"
            className="px-3 py-2 rounded-2xl border border-gray-200 bg-white text-sm font-extrabold hover:bg-gray-50"
            onClick={() => setPollOptions((p) => [...p, ""])}
          >
            + Add option
          </button>
        </div>
      )}

      {imagePreview && (
        <div className="mb-2 rounded-2xl border border-gray-200 bg-gray-50 p-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-extrabold text-gray-700">
              Photo ready
            </div>
            <button
              type="button"
              className="text-xs font-extrabold text-red-600 hover:underline"
              onClick={() => setImagePreview(null)}
            >
              Remove
            </button>
          </div>
          <img
            src={imagePreview}
            alt="preview"
            className="mt-2 w-full max-h-[140px] object-cover rounded-2xl"
          />
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Message… (use @name to tag)"
        className="w-full min-h-[70px] rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
      />

      <MentionSuggestions
        text={text}
        names={memberNames}
        onPick={(name) => {
          const at = text.lastIndexOf("@");
          const next = text.slice(0, at + 1) + name + " ";
          setText(next);
        }}
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex gap-2 flex-wrap">
          {QUICK_EMOJIS.slice(0, 4).map((emo) => (
            <button
              key={emo}
              type="button"
              className="px-3 py-2 rounded-2xl border border-gray-200 bg-white text-sm font-extrabold hover:bg-gray-50"
              onClick={() => setText((t) => t + emo)}
              title="Insert emoji"
            >
              {emo}
            </button>
          ))}
        </div>

        <Button variant="primary" onClick={sendNow} disabled={!canSend}>
          Send
        </Button>
      </div>

      {!me && (
        <div className="mt-2 text-xs text-red-600 font-semibold">
          Login/session required to chat.
        </div>
      )}
    </div>
  );
}
