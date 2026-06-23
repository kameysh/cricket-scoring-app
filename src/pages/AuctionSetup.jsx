import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import * as auctionService from '../services/auctionService';
import PlayerPoolManager from '../components/auction/PlayerPoolManager';

const DEFAULT_INCREMENTS = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];

const STEPS = [
  { key: 'basics', label: 'Basics' },
  { key: 'teams',  label: 'Teams'  },
  { key: 'pool',   label: 'Pool'   },
];

export default function AuctionSetup() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [name, setName]             = useState('');
  const [budget, setBudget]         = useState(5000);
  const [increments, setIncrements] = useState(DEFAULT_INCREMENTS);
  const [newIncrement, setNewIncrement] = useState('');

  const [appUsers, setAppUsers]         = useState([]);
  const [auctionTeams, setAuctionTeams] = useState([]);
  const [poolPlayers, setPoolPlayers]   = useState([]);
  const [auctionId, setAuctionId]       = useState(id ?? null);

  const [teamSelections, setTeamSelections] = useState([
    { name: '', captainId: '' },
    { name: '', captainId: '' },
  ]);

  const [saving, setSaving]           = useState(false);
  const [savingTeams, setSavingTeams] = useState(false);
  const [starting, setStarting]       = useState(false);
  const [step, setStep]               = useState(0); // 0=basics 1=teams 2=pool

  // Track which steps have been completed so the indicator can show ✓
  const [done, setDone] = useState({ basics: !!id, teams: false });

  // Set to true inside saveDraft so the effect skips the redundant DB reload
  // when we're the ones who changed the URL (data is already in state).
  const skipReloadRef = useRef(false);

  useEffect(() => {
    supabase.from('app_users').select('id, full_name, email, role').then(({ data }) => {
      setAppUsers(data ?? []);
    });
    if (id) {
      if (skipReloadRef.current) {
        // We just created the auction and navigated — data is already in state.
        // Just advance the step without another round-trip.
        skipReloadRef.current = false;
        setDone(d => ({ ...d, basics: true }));
        setStep(s => s > 0 ? s : 1);
        return;
      }
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
        if (at.length > 0) {
          setTeamSelections(at.map(t => ({ name: t.name ?? '', captainId: t.captain_id ?? '' })));
          setDone(d => ({ ...d, basics: true, teams: true }));
          setStep(2);
        } else {
          setDone(d => ({ ...d, basics: true }));
          setStep(s => s > 0 ? s : 1);
        }
      });
    }
  }, [id]);

  // ── Step 1: Basics ───────────────────────────────────────────────────────────

  async function saveDraft() {
    if (!name.trim()) { toast.error('Enter auction name'); return; }
    setSaving(true);
    try {
      if (!auctionId) {
        const a = await auctionService.createAuction({ name, budget_per_team: budget, bid_increments: increments });
        setAuctionId(a.id);
        skipReloadRef.current = true;
        navigate(`/auctions/new/${a.id}`, { replace: true });
      } else {
        // Update basics if already created (name/budget may have changed)
        await supabase
          .from('auctions')
          .update({ name, budget_per_team: budget, bid_increments: increments })
          .eq('id', auctionId);
      }
      setDone(d => ({ ...d, basics: true }));
      setStep(1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Step 2: Teams ────────────────────────────────────────────────────────────

  async function saveTeams() {
    if (!auctionId) { toast.error('Save basics first'); return; }
    const validSlots = teamSelections.filter(s => s.name.trim());
    if (validSlots.length < 2) { toast.error('Enter at least 2 team names'); return; }

    const names = validSlots.map(s => s.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) { toast.error('Team names must be unique'); return; }

    setSavingTeams(true);
    try {
      const added = [];
      const updated = [];
      for (const sel of validSlots) {
        const existing = auctionTeams.find(t => t.name?.toLowerCase() === sel.name.trim().toLowerCase());
        if (!existing) {
          const t = await auctionService.addAuctionTeam(auctionId, sel.name.trim(), sel.captainId || null);
          added.push(t);
        } else if ((sel.captainId || null) !== (existing.captain_id || null)) {
          const t = await auctionService.updateAuctionTeamCaptain(existing.id, sel.captainId || null);
          updated.push(t);
        }
      }
      if (added.length || updated.length) {
        setAuctionTeams(prev => {
          const withNew = [...prev, ...added];
          return withNew.map(t => {
            const upd = updated.find(u => u.id === t.id);
            return upd ? { ...t, ...upd } : t;
          });
        });
      }
      setDone(d => ({ ...d, teams: true }));
      setStep(2);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingTeams(false);
    }
  }

  // ── Step 3: Start ────────────────────────────────────────────────────────────

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
      const sold = await auctionService.autosellCaptains(auctionId);
      if (sold.length > 0) {
        toast.success(`${sold.length} captain${sold.length > 1 ? 's' : ''} auto-sold to their teams`);
      }
      await auctionService.updateAuctionStatus(auctionId, 'live');
      navigate(`/auctions/${auctionId}`, { replace: true });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setStarting(false);
    }
  }

  // ── Step indicator ───────────────────────────────────────────────────────────

  function StepIndicator() {
    return (
      <div className="flex items-center gap-0 mb-2">
        {STEPS.map((s, i) => {
          const isActive   = step === i;
          const isComplete = (s.key === 'basics' && done.basics) || (s.key === 'teams' && done.teams);
          const isReachable = i === 0 || (i === 1 && done.basics) || (i === 2 && done.teams);
          return (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <button
                disabled={!isReachable}
                onClick={() => isReachable && setStep(i)}
                className="flex flex-col items-center gap-1 disabled:cursor-not-allowed"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  isComplete
                    ? 'bg-brand-green border-brand-green text-white'
                    : isActive
                      ? 'bg-white dark:bg-ink-800 border-brand-green text-brand-green'
                      : 'bg-ink-100 dark:bg-white/10 border-transparent text-ink-400'
                }`}>
                  {isComplete ? <Check size={14} /> : i + 1}
                </div>
                <span className={`text-[11px] font-semibold ${isActive ? 'text-brand-green' : isComplete ? 'text-ink-600 dark:text-ink-300' : 'text-ink-400'}`}>
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full transition-colors ${done.basics && i === 0 ? 'bg-brand-green' : done.teams && i === 1 ? 'bg-brand-green' : 'bg-ink-200 dark:bg-white/10'}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 pb-32 space-y-4 page-transition">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/auctions')} className="p-2 rounded-xl bg-ink-100 dark:bg-white/10">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-ink-900 dark:text-white flex-1">
          {id ? 'Edit Auction' : 'New Auction'}
        </h1>
      </div>

      <StepIndicator />

      {/* ── Step 0: Basics ── */}
      {step === 0 && (
        <div className="card px-4 py-4 space-y-4">
          <div>
            <p className="text-base font-bold text-ink-900 dark:text-white mb-0.5">Auction Details</p>
            <p className="text-xs text-ink-400">Set the name, team budget, and bidding increments.</p>
          </div>

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
            {saving ? 'Saving…' : 'Continue →'}
          </button>
        </div>
      )}

      {/* ── Step 1: Teams ── */}
      {step === 1 && (
        <div className="card px-4 py-4 space-y-4">
          <div>
            <p className="text-base font-bold text-ink-900 dark:text-white mb-0.5">Bidding Teams</p>
            <p className="text-xs text-ink-400">Enter team names and optionally assign a captain who can bid from their device.</p>
          </div>

          {teamSelections.map((sel, i) => (
            <div key={i} className="space-y-2 pb-3 border-b border-ink-100 dark:border-white/5 last:border-0 last:pb-0">
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
                placeholder={`e.g. ${i === 0 ? 'Super Kings' : 'Back Street Boyz'}`}
                className="w-full rounded-xl border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              />
              <select
                value={sel.captainId}
                onChange={e => setTeamSelections(prev => prev.map((s, j) => j === i ? { ...s, captainId: e.target.value } : s))}
                className="w-full rounded-xl border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              >
                <option value="">Captain (optional)…</option>
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
            <Plus size={14} /> Add Another Team
          </button>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setStep(0)} className="px-4 py-3 rounded-xl text-sm font-semibold bg-ink-100 dark:bg-white/10 text-ink-600 dark:text-ink-300">
              ← Back
            </button>
            <button onClick={saveTeams} disabled={savingTeams} className="flex-1 btn-primary py-3 disabled:opacity-60">
              {savingTeams ? 'Saving…' : 'Continue →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Player Pool ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="card px-4 py-4">
            {/* Saved teams summary */}
            {auctionTeams.length > 0 && (
              <div className="mb-4 space-y-1.5">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Teams</p>
                <div className="flex flex-wrap gap-2">
                  {auctionTeams.map(t => (
                    <span key={t.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-500/10 text-sm font-semibold text-ink-800 dark:text-ink-100">
                      <span className="w-2 h-2 rounded-full bg-brand-green" />
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {auctionId ? (
              <PlayerPoolManager
                auctionId={auctionId}
                poolPlayers={poolPlayers.filter(p => p.status === 'pool')}
                captainUserIds={auctionTeams.map(t => t.captain_id).filter(Boolean)}
                onPoolChange={() => {
                  auctionService.listAuctionPlayers(auctionId).then(setPoolPlayers);
                }}
              />
            ) : (
              <p className="text-sm text-ink-400 text-center py-6">Save auction basics first</p>
            )}
          </div>

          <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-sm font-semibold text-ink-500 dark:text-ink-400 px-1">
            ← Back to Teams
          </button>
        </div>
      )}

      {/* ── Start Auction CTA (step 2 only) ── */}
      {step === 2 && auctionId && (
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
