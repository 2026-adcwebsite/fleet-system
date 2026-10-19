import { useQuery } from '@tanstack/react-query';
import { listItems } from './lists';

// Loads a reference list once and caches it for 10 minutes.
// const { data: cities = [] } = useList('cities');
export function useList(resource) {
  return useQuery({
    queryKey: ['list', resource],
    queryFn: async () => (await listItems(resource)).items,
    staleTime: 10 * 60 * 1000,
  });
}

// Text shown in a dropdown for one item.
// Models: "make model" (model can be empty, e.g. "Skoda"). Others: name.
export function itemLabel(item) {
  if (!item) return '';
  if (item.make !== undefined) return [item.make, item.model].filter(Boolean).join(' ');
  return item.name;
}
