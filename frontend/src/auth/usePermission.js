import { useCallback } from 'react';
import { useAuth } from './AuthContext';

// Maps the short action name to the flag the backend sends
const FLAG = {
  view: 'canView',
  create: 'canCreate',
  edit: 'canEdit',
  delete: 'canDelete',
  upload: 'canUpload',
  export: 'canExport',
};

// Returns a function: can('fleet', 'edit') -> true / false
// Use it when you need several checks in one component.
export function useCan() {
  const { permissions } = useAuth();
  return useCallback(
    (module, action) => Boolean(permissions?.[module]?.[FLAG[action]]),
    [permissions],
  );
}

// One check: usePermission('fleet', 'edit') -> true / false
export function usePermission(module, action) {
  return useCan()(module, action);
}
