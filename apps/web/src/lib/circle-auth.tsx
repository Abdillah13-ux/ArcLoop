import { createContext, ReactNode, useContext, useMemo, useState } from "react";

const circleAuthSessionStorageKey = "arcloop.circleAuthSession";

export type CircleAuthSession = {
  mode: "circle";
  userToken: string;
  encryptionKey: string;
  refreshToken: string;
  userId: string | null;
  email: string | null;
  name: string | null;
};

export type AuthSession = CircleAuthSession;

type CircleAuthContextValue = {
  session: AuthSession | null;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
};

const CircleAuthContext = createContext<CircleAuthContextValue | null>(null);

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isCircleAuthSession(value: unknown): value is CircleAuthSession {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const session = value as Record<string, unknown>;

  return (
    session.mode === "circle" &&
    typeof session.userToken === "string" &&
    typeof session.encryptionKey === "string" &&
    typeof session.refreshToken === "string" &&
    isNullableString(session.userId) &&
    isNullableString(session.email) &&
    isNullableString(session.name)
  );
}

function clearStoredSession() {
  try {
    window.sessionStorage.removeItem(circleAuthSessionStorageKey);
  } catch {
    // Ignore storage access failures; auth state still updates in memory.
  }
}

function readStoredSession(): AuthSession | null {
  try {
    const storedSession = window.sessionStorage.getItem(circleAuthSessionStorageKey);

    if (!storedSession) {
      return null;
    }

    const parsedSession: unknown = JSON.parse(storedSession);

    if (isCircleAuthSession(parsedSession)) {
      return parsedSession;
    }
  } catch {
    // Corrupted or inaccessible storage should behave like a signed-out session.
  }

  clearStoredSession();
  return null;
}

function writeStoredSession(session: AuthSession) {
  try {
    window.sessionStorage.setItem(circleAuthSessionStorageKey, JSON.stringify(session));
  } catch {
    // Ignore storage access failures; auth state still updates in memory.
  }
}

export function CircleAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(() => readStoredSession());

  const value = useMemo(
    () => ({
      session,
      setSession: (nextSession: AuthSession) => {
        setSessionState(nextSession);
        writeStoredSession(nextSession);
      },
      clearSession: () => {
        setSessionState(null);
        clearStoredSession();
      }
    }),
    [session]
  );

  return <CircleAuthContext.Provider value={value}>{children}</CircleAuthContext.Provider>;
}

export function useCircleAuth() {
  const value = useContext(CircleAuthContext);
  if (!value) {
    throw new Error("useCircleAuth must be used within CircleAuthProvider.");
  }

  return value;
}
