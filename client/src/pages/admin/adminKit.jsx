import { useState } from 'react';
import api, { unwrap } from '../../services/api';
import useFetch from '../../hooks/useFetch';

// Paginated, filterable admin list. `params` changes reset to page 1.
export function useAdminList(path, params = {}) {
  const [page, setPage] = useState(1);
  const key = JSON.stringify(params);
  const res = useFetch(async () => { const r = await api.get(path, { params: { ...params, page, limit: 15 } }); return { items: unwrap(r).items, meta: r.data.meta }; }, [path, key, page]);
  return { ...res, page, setPage, resetPage: () => setPage(1) };
}

export async function downloadCsv(path, params, name, toast) {
  try {
    const r = await api.get(path, { params, responseType: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(r.data); a.download = name; a.click(); URL.revokeObjectURL(a.href);
  } catch (e) { toast.fromError(e); }
}

export const PageHead = ({ title, children }) => <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><h1 className="h3 mb-0">{title}</h1><div className="d-flex gap-2 flex-wrap">{children}</div></div>;
