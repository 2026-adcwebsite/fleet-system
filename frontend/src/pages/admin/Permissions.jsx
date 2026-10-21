import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPermissions, setPermission } from '../../api/users';
import { t } from '../../i18n';

const ACTIONS = [
  ['view', 'canView'],
  ['create', 'canCreate'],
  ['edit', 'canEdit'],
  ['delete', 'canDelete'],
  ['upload', 'canUpload'],
  ['export', 'canExport'],
];

// t() returns the key when a translation is missing: fall back to the raw name
function text(key, fallback) {
  const v = t(key);
  return v === key ? fallback : v;
}

// Returns a copy of the cached data with one flag changed
function withFlag(data, { roleId, moduleId, flag, value }) {
  const rows = data.permissions;
  const exists = rows.some((p) => p.roleId === roleId && p.moduleId === moduleId);
  const next = exists
    ? rows.map((p) => (p.roleId === roleId && p.moduleId === moduleId ? { ...p, [flag]: value } : p))
    : [...rows, { roleId, moduleId, canView: false, canCreate: false, canEdit: false, canDelete: false, canUpload: false, canExport: false, [flag]: value }];
  return { ...data, permissions: next };
}

export default function Permissions() {
  const qc = useQueryClient();
  const [banner, setBanner] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['permissions'], queryFn: getPermissions });

  // Optimistic: the checkbox changes at once, and goes back if the server refuses
  const toggle = useMutation({
    mutationKey: ['perm'],
    mutationFn: ({ roleId, moduleId, flag, value }) => setPermission(roleId, moduleId, { [flag]: value }),
    onMutate: async (vars) => {
      setBanner('');
      await qc.cancelQueries({ queryKey: ['permissions'] });
      const previous = qc.getQueryData(['permissions']);
      qc.setQueryData(['permissions'], (old) => withFlag(old, vars));
      return { previous };
    },
    onError: (err, vars, ctx) => {
      qc.setQueryData(['permissions'], ctx.previous);
      setBanner(err.message);
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: ['perm'] }) === 1) qc.invalidateQueries({ queryKey: ['permissions'] });
    },
  });

  if (isLoading) return <p className="text-slate-500">{t('app.loading')}</p>;
  if (error) return <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error.message}</p>;

  const find = (roleId, moduleId) => data.permissions.find((p) => p.roleId === roleId && p.moduleId === moduleId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('admin.permissions.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('admin.permissions.hint')}</p>
      </div>

      {banner && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{banner}</p>}

      {data.roles.map((role) => (
        <section key={role.id} className="overflow-x-auto rounded border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2 font-semibold">{text(`admin.permissions.roleName.${role.name}`, role.name)}</h2>
          <table className="w-full text-sm">
            <thead className="text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">{t('admin.permissions.module')}</th>
                {ACTIONS.map(([action]) => (
                  <th key={action} scope="col" className="px-3 py-2 text-center font-medium">{t(`admin.permissions.action.${action}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.modules.map((mod) => {
                const row = find(role.id, mod.id);
                const locked = role.name === 'admin' && mod.name === 'system'; // the server refuses changes here
                return (
                  <tr key={mod.id} className="border-t border-slate-100">
                    <th scope="row" className="px-4 py-2 text-left font-normal">{text(`admin.permissions.moduleName.${mod.name}`, mod.name)}</th>
                    {ACTIONS.map(([action, flag]) => (
                      <td key={action} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          disabled={locked}
                          checked={Boolean(row?.[flag])}
                          aria-label={`${role.name} · ${mod.name} · ${action}`}
                          onChange={(e) => toggle.mutate({ roleId: role.id, moduleId: mod.id, flag, value: e.target.checked })}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
