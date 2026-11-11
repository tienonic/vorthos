"use client";
import { useSearchParams } from "next/navigation";
export function updateURL(
  values: Record<string, string | undefined>,
  replace = false,
) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  window.history[replace ? "replaceState" : "pushState"](null, "", url);
}
export function useURL() {
  return useSearchParams();
}
