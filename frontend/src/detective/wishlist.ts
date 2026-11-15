// "Want to go" list: park codes saved from the trip planner, shown in the passport.
import { useEffect, useState } from "react";

const KEY = "wishlist";
const EVENT = "wishlist-change";

export function loadWishlist(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function toggleWish(code: string): string[] {
  const now = loadWishlist();
  const next = now.includes(code) ? now.filter((c) => c !== code) : [...now, code];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
  return next;
}

/** The list, kept in sync across every component that shows it. */
export function useWishlist(): [string[], (code: string) => void] {
  const [list, setList] = useState(loadWishlist);
  useEffect(() => {
    const on = () => setList(loadWishlist());
    window.addEventListener(EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return [list, (code) => setList(toggleWish(code))];
}
