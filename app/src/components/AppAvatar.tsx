/**
 * A small app "icon". When the OS can give us the app's real icon (resolved
 * from its stored executable / bundle path) we render that; otherwise we fall
 * back to a deterministic colored chip with the first letter of the app name.
 *
 * Real icons are fetched once per app key and cached for the session (a shared
 * promise cache), so a list of rows doesn't refetch or repaint the same icon.
 */

import { useEffect, useState } from "react";
import { getAppIcon } from "../lib/api";

const CHIP_COLORS = [
  "#2DD4BF",
  "#0EA5A0",
  "#34D399",
  "#F59E0B",
  "#F87171",
  "#8B5CF6",
  "#60A5FA",
  "#F472B6",
];

function hashColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return CHIP_COLORS[h % CHIP_COLORS.length];
}

// appKey -> data URL ("" means "no real icon, use the letter"). Shared so each
// icon is fetched and painted at most once per session.
const iconCache = new Map<string, Promise<string>>();

function loadIcon(appKey: string): Promise<string> {
  const cached = iconCache.get(appKey);
  if (cached) return cached;
  const p = getAppIcon(appKey)
    .then((icon) => {
      if (!icon || icon.width <= 0 || icon.height <= 0) return "";
      const canvas = document.createElement("canvas");
      canvas.width = icon.width;
      canvas.height = icon.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";
      const img = ctx.createImageData(icon.width, icon.height);
      img.data.set(new Uint8ClampedArray(icon.rgba));
      ctx.putImageData(img, 0, 0);
      return canvas.toDataURL("image/png");
    })
    .catch(() => "");
  iconCache.set(appKey, p);
  return p;
}

export function AppAvatar({
  name,
  appKey,
  size = 24,
}: {
  name: string;
  appKey: string;
  size?: number;
}) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    let alive = true;
    loadIcon(appKey)
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [appKey]);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        width={size}
        height={size}
        className="inline-block shrink-0 rounded-md object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  const letter = (name.trim()[0] ?? "?").toUpperCase();
  const bg = hashColor(appKey || name);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-md font-medium text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        fontSize: Math.round(size * 0.5),
      }}
    >
      {letter}
    </span>
  );
}
