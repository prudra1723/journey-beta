// src/features/chat/components/MentionSuggestions.tsx
export function MentionSuggestions({
  text,
  names,
  onPick,
}: {
  text: string;
  names: string[];
  onPick: (name: string) => void;
}) {
  const at = text.lastIndexOf("@");
  if (at < 0) return null;

  const tail = text.slice(at + 1);
  const q = tail.toLowerCase();
  const list = !tail
    ? names.slice(0, 6)
    : names.filter((n) => n.toLowerCase().startsWith(q)).slice(0, 6);

  if (list.length === 0) return null;

  return (
    <div className="mt-2 rounded-2xl border border-gray-200 bg-white shadow-soft overflow-hidden">
      {list.map((n) => (
        <button
          key={n}
          type="button"
          className="w-full text-left px-3 py-2 text-sm font-semibold hover:bg-gray-50"
          onClick={() => onPick(n)}
        >
          @{n}
        </button>
      ))}
    </div>
  );
}
