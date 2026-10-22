import { useEffect, useState } from "react";
import type { Shortcut } from "../types";
import { loadFavicon } from "../lib/platform";

/**
 * The site icon (or its letter fallback).
 *
 * It lives in its own module because every surface that shows a site — the
 * desktop tiles, the sheet that opens a folder and the folder's own preview
 * — has to load the icon the same way.
 */
export function SiteIcon({ item }: { item: Shortcut }) {
  const [failed, setFailed] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    // A user-chosen icon wins over whatever the site publishes.
    if (item.iconDataUrl) {
      setFailed(false);
      setSrc(item.iconDataUrl);
      return;
    }
    setFailed(false);
    setSrc(null);
    void loadFavicon(item.url)
      .then((blob) => {
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item.url, item.iconDataUrl]);
  return src && !failed ? (
    <img
      className="site-icon"
      src={src}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="site-letter">
      {Array.from(item.name)[0]?.toUpperCase()}
    </span>
  );
}
