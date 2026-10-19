import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { changePassword } from "../api/auth";
import FormField from "../components/FormField";
import { t } from "../i18n";

export default function ChangePassword() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBanner("");

    // Check on the client first (same rules as the backend)
    const found = {};
    if (next.length < 10) found.next = t("changePassword.tooShort");
    if (next !== confirm) found.confirm = t("changePassword.mismatch");
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await changePassword(current, next);
      await refresh(); // mustChangePassword becomes false, the app unlocks
      navigate("/", { replace: true });
    } catch (err) {
      // 401 = wrong current password, 400 = rule broken (e.g. same as old)
      if (err.status === 400 || err.status === 401)
        setErrors({ current: err.message });
      else setBanner(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded border border-slate-200 bg-white p-6"
      >
        <h1 className="text-xl font-semibold">{t("changePassword.title")}</h1>

        {user.mustChangePassword && (
          <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
            {t("changePassword.forced")}
          </p>
        )}
        {banner && (
          <p
            role="alert"
            className="rounded bg-red-50 p-3 text-sm text-red-700"
          >
            {banner}
          </p>
        )}

        <FormField
          label={t("changePassword.current")}
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={errors.current}
        />
        <FormField
          label={t("changePassword.new")}
          type="password"
          autoComplete="new-password"
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={errors.next}
        />
        <FormField
          label={t("changePassword.confirm")}
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
        />

        <button
          disabled={busy}
          className="w-full rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {busy ? t("changePassword.submitting") : t("changePassword.submit")}
        </button>
      </form>

      <button
        onClick={logout}
        className="text-sm text-blue-700 hover:underline"
      >
        {t("changePassword.logout")}
      </button>
    </div>
  );
}
