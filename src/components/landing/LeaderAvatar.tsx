"use client";

import { useMemo, useState } from "react";
import type { PublicLeader } from "./public-leader";
import styles from "./LeaderAvatar.module.css";

type LeaderAvatarProps = {
  leader: PublicLeader;
};

function safePhotoUrl(value: string | null): string | null {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function LeaderAvatar({ leader }: LeaderAvatarProps) {
  const sources = useMemo(() => {
    const localAvatar = leader.slug ? `/avatars/${encodeURIComponent(leader.slug)}.svg` : null;
    return [...new Set([localAvatar, safePhotoUrl(leader.photo_url)].filter((source): source is string => Boolean(source)))];
  }, [leader.photo_url, leader.slug]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const source = sources[sourceIndex];

  if (source) {
    return (
      <img
        alt={leader.name}
        className={styles.avatar}
        onError={() => setSourceIndex((current) => current + 1)}
        src={source}
      />
    );
  }

  return (
    <span className={styles.monogram} role="img" aria-label={leader.name}>
      <span aria-hidden="true">{initials(leader.name)}</span>
    </span>
  );
}
