// Shareable state lives in the URL hash: "#night=CA.NS.SM&event=slow-meridian".
import { PROGRAMME, performanceById } from "./programme";

export interface SharedState {
  saved: string[];
  event: string | null;
}

export function encodeState(state: SharedState): string {
  const parts: string[] = [];
  const codes = state.saved
    .map((id) => performanceById(id)?.code)
    .filter((c): c is string => Boolean(c));
  if (codes.length) parts.push(`night=${codes.join(".")}`);
  if (state.event && performanceById(state.event)) parts.push(`event=${state.event}`);
  return parts.length ? `#${parts.join("&")}` : "";
}

export function decodeState(hash: string): SharedState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const saved: string[] = [];
  for (const code of (params.get("night") ?? "").split(".")) {
    const p = PROGRAMME.find((q) => q.code === code.toUpperCase());
    if (p && !saved.includes(p.id)) saved.push(p.id);
  }
  const event = params.get("event");
  return { saved, event: event && performanceById(event) ? event : null };
}
