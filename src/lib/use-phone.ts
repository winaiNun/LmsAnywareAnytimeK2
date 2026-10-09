"use client";

import { useEffect, useState } from "react";

/** True on phones/tablets (touch is the primary input). null until known, so server HTML never flashes phone-only UI. */
export function usePhone(): boolean | null {
  const [phone, setPhone] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse) and (hover: none)");
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return phone;
}

const KEY = "lms.device";
export type StoredDevice = { token: string; name: string };

export function readDevice(): StoredDevice | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && /^[0-9a-f]{64}$/.test(v.token) ? { token: v.token, name: String(v.name ?? "") } : null;
  } catch {
    return null;
  }
}
export const saveDevice = (d: StoredDevice) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };
export const forgetDevice = () => { try { localStorage.removeItem(KEY); } catch {} };
