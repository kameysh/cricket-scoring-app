import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import * as auctionService from '../services/auctionService';
import * as teamService from '../services/teamService';
import * as playerService from '../services/playerService';
import PlayerPoolManager from '../components/auction/PlayerPoolManager';

const DEFAULT_INCREMENTS = [50, 100, 200, 500, 1000];

export default function AuctionSetup() {
  const { id } = useParams(); // defined when editing existing auction
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [budget, setBudget] = useState(5000);
  const [increments, setIncrements] = useState(DEFAULT_INCREMENTS);
  const [newIncrement, setNewIncrement] = useState('');

  const [teams, setTeams] = useState([]);          // global teams registry
  const [appUsers, setAppUsers] = useState([]);    // app_users for captain assignment
  const [auctionTeams, setAuctionTeams] = useState([]); // saved auction_teams rows
  const [poolPlayers, setPoolPlayers] = useState([]); // saved auction_players rows
  const [auctionId, setAuctionId] = useState(id ?? null);

  const [teamSelections, setTeamSelections] = useState([
    { teamId: '', captainId: '' },
    { teamId: '', captainId: '' },
  ]);

  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [tab, setTab] = useState('basics'); // 'basics' | 'teams' | 'pool'

  useEffect(() => {
    teamService.listTeams().then(setTeams).catch(() => {});
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
        setTeamSelections(at.map(t => ({ teamId: t.team_id, captainId: t.captain_id ?? '' })));
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
    const added = [];
    for (const sel of teamSelections) {
      if (!sel.teamId) continue;
      const existing = auctionTeams.find(t => t.team_id === sel.teamId);
      if (!existing) {
        try {
          const t = await auctionService.addAuctionTeam(auctionId, sel.teamId, sel.captainId || null);
          added.push(t);
        } catch (e) {
          toast.error(e.message);
        }
      }
    }
    if (added.length) {
      setAuctionTeams(prev => [...prev, ...added]);

      // Auto-populate player pool from each newly added team's roster
      const allNewPlayers = [];
      for (const sel of teamSelections) {
        if (!sel.teamId) continue;
        if (auctionTeams.find(t => t.team_id === sel.teamId)) continue; // already existed
        try {
          const playerIds = await teamService.getTeamPlayers(sel.teamId);
          for (const pid of playerIds) {
            // Skip if already in pool
            const alreadyInPool = poolPlayers.some(p => p.player_id === pid);
            if (alreadyInPool) continue;
            try {
              const row = await auctionService.addPlayerToPool(auctionId, pid, 100);
              allNewPlayers.push(row);
            } catch {
              // ignore duplicate constraint if player added twice (two teams share a player edge case)
            }
          }
        } catch (e) {
          // non-fatal — roster may be empty
        }
      }
      if (allNewPlayers.length > 0) {
        setPoolPlayers(prev => [...prev, ...allNewPlayers]);
        toast.success(`Teams saved · ${allNewPlayers.length} players added to pool`);
      } else {
        toast.success('Teams saved');
      }
    }
  }

  async function handleStart() {
    if (!auctionId) return;
    if (poolPlayers.filter(p => p.status === 'pool').length === 0) {
      toast.error('Add at least one player to the pool');
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
    <div className="page-container pt-safe pb-24 space-y-4">
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

      {tab === 'teams' && (
        <div className="card px-4 py-4 space-y-4">
          {teamSelections.map((sel, i) => (
            <div key={i} className="space-y-2">
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Team {i + 1}</p>
              <select
                value={sel.teamId}
                onChange={e => setTeamSelections(prev => prev.map((s, j) => j === i ? { ...s, teamId: e.target.value } : s))}
                className="w-full rounded-xl border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              >
                <option value="">Select team…</option>
                {teams
                  .filter(t => !teamSelections.some((s, j) => j !== i && s.teamId === t.id))
                  .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
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
          <button onClick={() => setTeamSelections(prev => [...prev, { teamId: '', captainId: '' }])}
            className="flex items-center gap-1.5 text-brand-green text-sm font-semibold">
            <Plus size={14} /> Add Team
          </button>
          <button onClick={saveTeams} className="w-full btn-primary py-3">Save Teams</button>
        </div>
      )}

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
