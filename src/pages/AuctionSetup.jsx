import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import * as auctionService from '../services/auctionService';
import PlayerPoolManager from '../components/auction/PlayerPoolManager';

const DEFAULT_INCREMENTS = [1000, 2000, 3000, 5000, 10000];

export default function AuctionSetup() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [budget, setBudget] = useState(5000);
  const [increments, setIncrements] = useState(DEFAULT_INCREMENTS);
  const [newIncrement, setNewIncrement] = useState('');

  const [appUsers, setAppUsers] = useState([]);
  const [auctionTeams, setAuctionTeams] = useState([]); // saved auction_teams rows
  const [poolPlayers, setPoolPlayers] = useState([]);
  const [auctionId, setAuctionId] = useState(id ?? null);

  // Each slot: { name: string, captainId: string }
  const [teamSelections, setTeamSelections] = useState([
    { name: '', captainId: '' },
    { name: '', captainId: '' },
  ]);

  const [saving, setSaving] = useState(false);
  const [savingTeams, setSavingTeams] = useState(false);
  const [starting, setStarting] = useState(false);
  const [tab, setTab] = useState('basics');

  useEffect(() => {
    supabase.from('app_users').select('id, full_name, email, role').then(({ data }) => {
      setAppUsers(data ?? []);
    });
    if (id) {
      Promise.all([
        auctionService.getAuction(id),
        auctionService.listAuctionTeams(id),
        auctionService.listAuctionPlayers(id),
      ]).then(([auction, at, ap]) => {
        setName(auction.name);
        setBudget(auction.budget_per_team);
        setIncrements(auction.bid_increments ?? DEFAULT_INCREMENTS);
        setAuctionTeams(at);
        setPoolPlayers(ap);
        // Populate team name inputs from saved rows
        if (at.length > 0) {
          setTeamSelections(at.map(t => ({ name: t.name ?? '', captainId: t.captain_id ?? '' })));
        }
      });
    }
  }, [id]);

  async function saveDraft() {
    if (!name.trim()) { toast.error('Enter auction name'); return; }
    setSaving(true);
    try {
      if (!auctionId) {
        const a = await auctionService.createAuction({ name, budget_per_team: budget, bid_increments: increments });
        setAuctionId(a.id);
        toast.success('Auction created');
        navigate(`/auctions/new/${a.id}`, { replace: true });
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveTeams() {
    if (!auctionId) { toast.error('Save basics first'); return; }
    const validSlots = teamSelections.filter(s => s.name.trim());
    if (validSlots.length < 2) { toast.error('Enter at least 2 team names'); return; }

    // Check for duplicate names
    const names = validSlots.map(s => s.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) { toast.error('Team names must be unique'); return; }

    setSavingTeams(true);
    try {
      const added = [];
      for (const sel of validSlots) {
        // Skip teams that are already saved (match by name)
        const existing = auctionTeams.find(t => t.name?.toLowerCase() === sel.name.trim().toLowerCase());
        if (!existing) {
          const t = await auctionService.addAuctionTeam(auctionId, sel.name.trim(), sel.captainId || null);
          added.push(t);
        }
      }
      if (added.length) {
        setAuctionTeams(prev => [...prev, ...added]);
        toast.success(`${added.length} team${added.length > 1 ? 's' : ''} saved`);
      } else {
        toast.success('Teams up to date');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingTeams(false);
    }
  }

  async function handleStart() {
    if (!auctionId) return;
    if (poolPlayers.filter(p => p.status === 'pool').length === 0) {
      toast.error('Add at least one player to the pool');
      return;
    }
    if (auctionTeams.length < 2) {
      toast.error('Save at least 2 teams first');
      return;
    }
    setStarting(true);
    try {
      await auctionService.updateAuctionStatus(auctionId, 'live');
      navigate(`/auctions/${auctionId}`, { replace: true });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="p-4 pb-24 space-y-4 page-transition">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/auctions')} className="p-2 rounded-xl bg-ink-100 dark:bg-white/10">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-ink-900 dark:text-white flex-1">
          {id ? 'Edit Auction' : 'New Auction'}
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-ink-100 dark:bg-white/10 rounded-xl p-1">
        {['basics', 'teams', 'pool'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold capitalize transition-colors ${tab === t ? 'bg-white dark:bg-ink-800 shadow text-ink-900 dark:text-white' : 'text-ink-500'}`}>
            {t === 'pool' ? 'Player Pool' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Basics ── */}
      {tab === 'basics' && (
        <div className="card px-4 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Auction Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. IPL Mega Auction 2026"
              className="w-full rounded-xl border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Budget per Team (₹)</label>
            <input type="number" min={0} value={budget} onChange={e => setBudget(Number(e.target.value))}
              className="w-full rounded-xl border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 tabular-nums" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Bid Increments (₹)</label>
            <div className="flex flex-wrap gap-1.5">
              {increments.map((inc, i) => (
                <span key={i} className="flex items-center gap-1 bg-ink-100 dark:bg-white/10 rounded-full px-2.5 py-1 text-sm">
                  ₹{inc}
                  <button onClick={() => setIncrements(prev => prev.filter((_, j) => j !== i))} className="text-ink-400 hover:text-red-500">
                    <X size={12} />
                  </button>
                </span>
              ))}
              <div className="flex gap-1">
                <input type="number" value={newIncrement} onChange={e => setNewIncrement(e.target.value)}
                  placeholder="Custom"
                  className="w-20 px-2 py-1 rounded-lg border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-800 text-xs focus:outline-none" />
                <button
                  onClick={() => {
                    const v = Number(newIncrement);
                    if (v > 0 && !increments.includes(v)) setIncrements(prev => [...prev, v].sort((a, b) => a - b));
                    setNewIncrement('');
                  }}
                  className="p-1.5 rounded-lg bg-brand-green text-white">
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>

          <button onClick={saveDraft} disabled={saving} className="w-full btn-primary py-3 disabled:opacity-40">
            {saving ? 'Saving…' : auctionId ? 'Saved ✓' : 'Save & Continue'}
          </button>
        </div>
      )}

      {/* ── Teams — just enter team names, no registry required ── */}
      {tab === 'teams' && (
        <div className="card px-4 py-4 space-y-4">
          <p className="text-xs text-ink-400">
            Enter the names of the bidding teams. These are standalone auction teams — players are not pre-assigned to any team.
          </p>

          {teamSelections.map((sel, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Team {i + 1}</p>
                {teamSelections.length > 2 && (
                  <button
                    onClick={() => setTeamSelections(prev => prev.filter((_, j) => j !== i))}
                    className="text-ink-300 hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <input
                value={sel.name}
                onChange={e => setTeamSelections(prev => prev.map((s, j) => j === i ? { ...s, name: e.target.value } : s))}
                placeholder={`Team name (e.g. ${i === 0 ? 'Super Kings' : 'Back Street Boyz'})`}
                className="w-full rounded-xl border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              />
              {/* Captain — optional app user who can bid for this team */}
              <select
                value={sel.captainId}
                onChange={e => setTeamSelections(prev => prev.map((s, j) => j === i ? { ...s, captainId: e.target.value } : s))}
                className="w-full rounded-xl border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              >
                <option value="">Select captain (optional)…</option>
                {appUsers
                  .filter(u => !teamSelections.some((s, j) => j !== i && s.captainId === u.id))
                  .map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
              </select>
            </div>
          ))}

          <button
            onClick={() => setTeamSelections(prev => [...prev, { name: '', captainId: '' }])}
            className="flex items-center gap-1.5 text-brand-green text-sm font-semibold"
          >
            <Plus size={14} /> Add Team
          </button>

          {/* Show already-saved teams */}
          {auctionTeams.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-ink-400 uppercase tracking-wider font-semibold">Saved Teams</p>
              {auctionTeams.map(t => (
                <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-500/10">
                  <span className="text-sm font-semibold text-ink-900 dark:text-white flex-1">{t.name}</span>
                  <span className="text-xs text-ink-400 tabular-nums">₹{t.budget_remaining?.toLocaleString()} purse</span>
                </div>
              ))}
            </div>
          )}

          <button onClick={saveTeams} disabled={savingTeams} className="w-full btn-primary py-3 disabled:opacity-60">
            {savingTeams ? 'Saving…' : 'Save Teams'}
          </button>
        </div>
      )}

      {/* ── Player Pool ── */}
      {tab === 'pool' && (
        <div className="card px-4 py-4">
          {auctionId ? (
            <PlayerPoolManager
              auctionId={auctionId}
              poolPlayers={poolPlayers.filter(p => p.status === 'pool')}
              onPoolChange={() => {
                auctionService.listAuctionPlayers(auctionId).then(setPoolPlayers);
              }}
            />
          ) : (
            <p className="text-sm text-ink-400 text-center py-6">Save auction basics first</p>
          )}
        </div>
      )}

      {/* Start Auction footer */}
      {auctionId && (
        <button
          onClick={handleStart}
          disabled={starting}
          className="fixed bottom-20 left-4 right-4 py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-brand-green to-brand-teal shadow-lg disabled:opacity-50 text-base"
        >
          {starting ? 'Starting…' : '🎉 Start Auction'}
        </button>
      )}
    </div>
  );
}
