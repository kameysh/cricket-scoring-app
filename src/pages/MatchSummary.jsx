import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Share2, Trash2, Trophy } from 'lucide-react';
import * as matchService from '../services/matchService';
import PlayerLink from '../components/player/PlayerLink';
import ConfirmDialog from '../components/shared/ConfirmDialog';

export default function MatchSummary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [matchPlayers, setMatchPlayers] = useState([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [battingCards, setBattingCards] = useState([]);
  const [bowlingCards, setBowlingCards] = useState([]);
  const [fieldingCards, setFieldingCards] = useState([]);
  const cardRef = useRef(null);

  useEffect(() => {
    matchService.getMatch(id).then(m => {
      setMatch(m);
      // Auto-assign MoTM for legacy matches completed before auto-assign was added
      if (m?.status === 'completed' && !m.man_of_match_id) {
        matchService.autoAssignManOfMatch(id).then(() => matchService.getMatch(id).then(setMatch));
      }
    });
    matchService.getMatchPlayers(id).then(setMatchPlayers);
    matchService.getInnings(id).then(async inns => {
      try {
        const results = await Promise.all(inns.map(inn => matchService.getScorecards(inn.id)));
        const allBatting = [], allBowling = [], allFielding = [];
        results.forEach(cards => {
          allBatting.push(...cards.batting);
          allBowling.push(...cards.bowling);
          allFielding.push(...(cards.fielding || []));
        });
        setBattingCards(allBatting);
        setBowlingCards(allBowling);
        setFieldingCards(allFielding);
      } catch { toast.error('Failed to load scorecards'); }
    });
  }, [id]);

  if (!match) return null;

  const motmName = matchPlayers.find(mp => mp.player_id === match.man_of_match_id)?.players?.name;
  const topScorer = [...battingCards].sort((a, b) => (b.runs || 0) - (a.runs || 0))[0];
  const topBowler = [...bowlingCards]
    .filter(b => (b.wickets || 0) > 0)
    .sort((a, b) => (b.wickets || 0) - (a.wickets || 0) || (a.runs_conceded || 0) - (b.runs_conceded || 0))[0];
  const topScorerName = matchPlayers.find(mp => mp.player_id === topScorer?.player_id)?.players?.name;
  const topBowlerName = matchPlayers.find(mp => mp.player_id === topBowler?.player_id)?.players?.name;

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await matchService.deleteMatch(id);
      navigate('/matches');
    } catch (e) {
      toast.error(e.message || 'Failed to delete match');
      setDeleting(false);
    }
  }

  async function shareResult() {
    if (sharing) return;
    setSharing(true);
    try {
      // Load html2canvas if not already loaded
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
          s.onload = resolve;
          s.onerror = reject;
          document.body.appendChild(s);
        });
      }
      const canvas = await window.html2canvas(cardRef.current, { useCORS: true, scale: 2, backgroundColor: null });
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      const file = new File([blob], 'match-result.png', { type: 'image/png' });

      // 1. Web Share API (mobile)
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${match.team1_name} vs ${match.team2_name}` });
          return;
        } catch { /* user cancelled — fall through */ }
      }

      // 2. Clipboard (desktop Chrome/Edge)
      if (navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          toast.success('Copied to clipboard!');
          return;
        } catch { /* permission denied — fall through */ }
      }

      // 3. Download fallback
      const link = document.createElement('a');
      link.download = 'match-result.png';
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      toast.error('Could not generate share image');
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="p-4 space-y-5 page-transition">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/matches')} className="flex items-center gap-1 text-sm text-ink-500 dark:text-ink-300 hover:text-ink-900 dark:hover:text-white">
          ← Matches
        </button>
        <button onClick={() => setDeleteOpen(true)} className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
          <Trash2 size={13} /> Delete Match
        </button>
      </div>

      {/* Visible result card */}
      <div className="bg-gradient-to-br from-brand-green via-brand-teal to-brand-blue text-white rounded-3xl p-7 text-center space-y-2 shadow-pill">
        <p className="text-sm opacity-85">{match.team1_name} vs {match.team2_name}</p>
        <h1 className="text-xl font-bold">{match.result_summary || 'Match in progress'}</h1>
      </div>

      {/* Off-screen rich card for sharing */}
      <div
        ref={cardRef}
        style={{ position: 'absolute', left: '-9999px', width: '400px' }}
        className="bg-gradient-to-br from-brand-green via-brand-teal to-brand-blue text-white p-6 rounded-2xl space-y-4"
      >
        <div className="text-center space-y-1">
          <p className="text-sm opacity-80">{match.team1_name} vs {match.team2_name}</p>
          <h2 className="text-xl font-bold">{match.result_summary || 'Match Result'}</h2>
        </div>
        {match.man_of_match_id && motmName && (
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
            <span className="text-cricket-gold text-lg">★</span>
            <div>
              <p className="text-[10px] opacity-70 uppercase tracking-wider">Man of the Match</p>
              <p className="text-sm font-bold">{motmName}</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {topScorer && topScorerName && (
            <div className="bg-white/10 rounded-xl px-3 py-2">
              <p className="text-[10px] opacity-70 uppercase tracking-wider">Top Scorer</p>
              <p className="font-bold">{topScorerName}</p>
              <p className="text-xs opacity-80">{topScorer.runs} runs</p>
            </div>
          )}
          {topBowler && topBowlerName && (
            <div className="bg-white/10 rounded-xl px-3 py-2">
              <p className="text-[10px] opacity-70 uppercase tracking-wider">Top Bowler</p>
              <p className="font-bold">{topBowlerName}</p>
              <p className="text-xs opacity-80">{topBowler.wickets}/{topBowler.runs_conceded}</p>
            </div>
          )}
        </div>
        <p className="text-center text-[10px] opacity-40">Cricket Scoring App</p>
      </div>

      {/* MoTM display — gold card */}
      {match.man_of_match_id && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-cricket-gold/10 border border-cricket-gold/30">
          <Trophy size={20} className="text-cricket-gold shrink-0" />
          <div>
            <p className="text-[11px] font-semibold text-cricket-gold uppercase tracking-wider">Man of the Match</p>
            <PlayerLink id={match.man_of_match_id} name={motmName} className="font-bold text-ink-900 dark:text-white" />
          </div>
        </div>
      )}

      <button
        onClick={shareResult}
        disabled={sharing}
        className="btn-secondary w-full flex items-center justify-center gap-2 !py-2.5 disabled:opacity-50"
      >
        <Share2 size={16} /> {sharing ? 'Generating…' : 'Share Result'}
      </button>

      <Link to={`/matches/${id}/scorecard`} className="btn-primary block text-center">
        View Full Scorecard
      </Link>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this match?"
        message={match ? `${match.team1_name} vs ${match.team2_name} — this permanently deletes the match, all deliveries, and scorecards. This cannot be undone.` : ''}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        danger
        disabled={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
