import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as authApi from "../api/auth";
import { setApiHandlers } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true); // true while checking for an existing session

  const loadPermissions = useCallback(async () => {
    const data = await authApi.getMyPermissions();
    setPermissions(data.permissions || {});
  }, []);

  // On app start: is there already a logged-in session (cookie)?
  useEffect(() => {
    (async () => {
      try {
        const { user } = await authApi.getMe();
        await loadPermissions();
        setUser(user);
      } catch {
        // not logged in
      } finally {
        setLoading(false);
      }
    })();
  }, [loadPermissions]);

  // 401 anywhere -> logged out. 403 MUST_CHANGE_PASSWORD -> lock the user.
  useEffect(() => {
    setApiHandlers({
      onUnauthorized: () => {
        setUser(null);
        setPermissions({});
        qc.clear();
      },
      onMustChangePassword: () =>
        setUser((u) => (u ? { ...u, mustChangePassword: true } : u)),
    });
  }, [qc]);

  const login = useCallback(
    async (email, password) => {
      const { user } = await authApi.login(email, password);
      await loadPermissions();
      setUser(user);
      return user;
    },
    [loadPermissions],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setPermissions({});
      qc.clear();
    }
  }, [qc]);

  // Reload user + permissions (used after a password change)
  const refresh = useCallback(async () => {
    const { user } = await authApi.getMe();
    await loadPermissions();
    setUser(user);
  }, [loadPermissions]);

  const value = useMemo(
    () => ({ user, permissions, loading, login, logout, refresh }),
    [user, permissions, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
