import { useEffect, useState } from "react";
import { fetchProfileRemote, readProfileAvatar } from "../lib/profileDb";

function initials(name?: string) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "U";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "U";
}

export function UserAvatar({
  userId,
  name,
  size = 36,
  className = "",
}: {
  userId?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(() =>
    userId ? readProfileAvatar(userId) ?? null : null,
  );

  useEffect(() => {
    if (!userId) return;
    const cached = readProfileAvatar(userId);
    if (cached) {
      setSrc(cached);
      return;
    }
    let mounted = true;
    fetchProfileRemote(userId)
      .then((p) => {
        if (!mounted) return;
        setSrc(p.avatarDataUrl ?? null);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      mounted = false;
    };
  }, [userId]);

  const letter = initials(name ?? undefined);

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? "avatar"}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-yellow-200 border border-yellow-300 flex items-center justify-center font-extrabold text-gray-900 ${className}`}
      style={{ width: size, height: size }}
      aria-label={name ?? "avatar"}
    >
      {letter}
    </div>
  );
}
