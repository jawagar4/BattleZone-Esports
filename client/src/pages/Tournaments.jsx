import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { unwrap } from '../services/api';
import useFetch from '../hooks/useFetch';
import useSocketEvent from '../hooks/useSocket';
import TournamentCard from '../components/TournamentCard';
import { CardSkeleton } from '../components/Loader';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { GAMES } from '../services/games';

const STATUSES = [['', 'All statuses'], ['registration_open', 'Registration open'], ['upcoming', 'Upcoming'], ['full', 'Full'], ['live', 'Live'], ['completed', 'Completed']];
const SORTS = [['date', 'Start date'], ['fee', 'Entry fee (low to high)'], ['prize', 'Prize pool (high to low)'], ['newest', 'Newest']];

export default function Tournaments() {
  const [sp, setSp] = useSearchParams();
  const q = { search: sp.get('search') || '', game: sp.get('game') || '', status: sp.get('status') || '', sort: sp.get('sort') || 'date', page: Number(sp.get('page') || 1) };
  const [search, setSearch] = useState(q.search);
  const set = (patch) => { const n = new URLSearchParams(sp); Object.entries({ page: 1, ...patch }).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setSp(n, { replace: true }); };

  // Debounce the search box so we don't query on every keystroke.
  useEffect(() => { const t = setTimeout(() => search !== q.search && set({ search }), 350); return () => clearTimeout(t); }, [search]); // eslint-disable-line

  const { data, loading, error, reload } = useFetch(async () => {
    const params = Object.fromEntries(Object.entries({ ...q, limit: 12 }).filter(([, v]) => v !== '' && v != null));
    const res = await api.get('/tournaments', { params });
    return { items: unwrap(res).items, meta: res.data.meta };
  }, [q.search, q.game, q.status, q.sort, q.page]);

  // Live slot/phase updates for the cards on screen.
  const onUpdate = useCallback(() => reload(true), [reload]);
  useSocketEvent('tournament:update', onUpdate);

  return (
    <div className="container bz-page">
      <h1 className="mb-1 mt-5">Tournaments</h1>
      <p className="text-muted">Find a lobby that fits your squad and budget.</p>
      <div className="bz-card mb-4">
        <div className="row g-2">
          <div className="col-12 col-md-4"><label className="visually-hidden" htmlFor="s">Search tournaments</label><input id="s" className="form-control" type="search" placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="col-6 col-md-2"><label className="visually-hidden" htmlFor="g">Game</label><select id="g" className="form-select" value={q.game} onChange={(e) => set({ game: e.target.value })}><option value="">All games</option>{GAMES.map((g) => <option key={g.name}>{g.name}</option>)}</select></div>
          <div className="col-6 col-md-3"><label className="visually-hidden" htmlFor="st">Status</label><select id="st" className="form-select" value={q.status} onChange={(e) => set({ status: e.target.value })}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="col-12 col-md-3"><label className="visually-hidden" htmlFor="so">Sort by</label><select id="so" className="form-select" value={q.sort} onChange={(e) => set({ sort: e.target.value })}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        </div>
      </div>
      {loading ? <CardSkeleton count={6} /> : error ? (
        <EmptyState icon="bi-wifi-off" title="Couldn't load tournaments" action={<button className="btn btn-ghost" onClick={() => reload()}>Try again</button>}>{error}</EmptyState>
      ) : data.items.length === 0 ? (
        <EmptyState icon="bi-search" title="No tournaments match" action={<button className="btn btn-ghost" onClick={() => { setSearch(''); setSp({}); }}>Clear filters</button>}>Try a different game or status.</EmptyState>
      ) : (
        <>
          <div className="row g-3">{data.items.map((t) => <div className="col-12 col-md-6 col-lg-4" key={t._id}><TournamentCard t={t} /></div>)}</div>
          <Pagination meta={data.meta} onPage={(page) => set({ page })} />
        </>
      )}
    </div>
  );
}
