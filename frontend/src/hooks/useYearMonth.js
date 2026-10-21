import { useSearchParams } from 'react-router-dom';
import { currentYearMonth } from '../utils/months';

// The selected month lives in the URL (?ym=202610), so tabs share it and links keep it.
export function useYearMonth() {
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get('ym'));
  const valid = Number.isInteger(raw) && raw >= 190001 && raw % 100 >= 1 && raw % 100 <= 12;
  const ym = valid ? raw : currentYearMonth();

  const setYm = (next) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('ym', String(next));
        return p;
      },
      { replace: true },
    );

  return [ym, setYm];
}
