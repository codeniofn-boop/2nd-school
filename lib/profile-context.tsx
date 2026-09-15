"use client";

// Student profile (average + completed courses) shared across the app and
// persisted to localStorage. Backed by a tiny external store consumed via
// useSyncExternalStore: the server snapshot is the empty profile, so SSR and
// the hydration render always match, and React swaps in the stored profile
// right after hydration — no setState-in-effect needed.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const STORAGE_KEY = "admitpath.profile.v1";

interface ProfileState {
  average: number | null;
  courses: string[];
}

interface ProfileContextValue extends ProfileState {
  /** False until the persisted profile has been loaded on the client. */
  ready: boolean;
  setAverage: (n: number | null) => void;
  toggleCourse: (code: string) => void;
  clear: () => void;
}

const EMPTY: ProfileState = { average: null, courses: [] };

function readStoredProfile(): ProfileState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY;
    const obj = parsed as Record<string, unknown>;
    const average =
      typeof obj.average === "number" && Number.isFinite(obj.average) ? obj.average : null;
    const courses = Array.isArray(obj.courses)
      ? obj.courses.filter((c): c is string => typeof c === "string")
      : [];
    return { average, courses };
  } catch {
    return EMPTY;
  }
}

// ---- module-level store ----------------------------------------------------

let cached: ProfileState | null = null; // null until first client read
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ProfileState {
  if (cached === null) cached = readStoredProfile();
  return cached;
}

function update(fn: (s: ProfileState) => ProfileState): void {
  cached = fn(getSnapshot());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // Storage unavailable (private mode, quota) — profile still works in-memory.
  }
  listeners.forEach((l) => l());
}

// ---- context ---------------------------------------------------------------

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  // Server snapshot is false, client snapshot is true: flips right after
  // hydration, exactly when the real profile becomes visible.
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  const setAverage = useCallback((n: number | null) => {
    update((s) => ({ ...s, average: n }));
  }, []);

  const toggleCourse = useCallback((code: string) => {
    update((s) =>
      s.courses.includes(code)
        ? { ...s, courses: s.courses.filter((c) => c !== code) }
        : { ...s, courses: [...s.courses, code] }
    );
  }, []);

  const clear = useCallback(() => {
    update(() => EMPTY);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<ProfileContextValue>(
    () => ({ ...state, ready, setAverage, toggleCourse, clear }),
    [state, ready, setAverage, toggleCourse, clear]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside <ProfileProvider>");
  return ctx;
}
