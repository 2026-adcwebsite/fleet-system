import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import FormField from '../components/FormField';
import { t } from '../i18n';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.status === 429 ? t('errors.tooMany') : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded border border-slate-200 bg-white p-6"
      >
        <h1 className="text-xl font-semibold">{t('login.title')}</h1>

        {error && (
          <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <FormField
          label={t('login.email')}
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          label={t('login.password')}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          disabled={busy}
          className="w-full rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {busy ? t('login.submitting') : t('login.submit')}
        </button>
      </form>
    </div>
  );
}
