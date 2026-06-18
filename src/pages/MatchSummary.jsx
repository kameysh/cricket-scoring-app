import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Share2, Trash2 } from 'lucide-react';
import * as matchService from '../services/matchService';
import PlayerLink from '../components/player/PlayerLink';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { calcMotmScore } from '../lib/cricketUtils';

export default function MatchSummary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [matchPlayers, setMatchPlayers] = useState([]);
  const [momId, setMomId] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [battingCards, setBattingCards] = useState([]);
  const [bowlingCards, setBowlingCards] = useState([]);
  const [fieldingCards, setFieldingCards] = useState([]);
  const cardRef = useRef(null);

  useEffect(() => {
    matchService.getMatch(id).then(setMatch);
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

  // Auto-suggest MOTM once scorecards are loaded
  useEffect(() => {
    if (!match || match.man_of_match_id || matchPlayers.length === 0) return;
    const scores = matchPlayers.map(mp => ({
      id: mp.player_id,
      score: calcMotmScore(mp.player_id, battingCards, bowlingCards, fieldingCards),
    }));
    const best = scores.sort((a, b) => b.score - a.score)[0];
    if (best && best.score > 0) setMomId(best.id);
  }, [match, matchPlayers, battingCards, bowlingCards, fieldingCards]);

  if (!match) return null;

  const needsMom = match.status === 'completed' && !match.man_of_match_id;

  async function handleDelete() {
    await matchService.deleteMatch(id);
    navigate('/matches');
  }

  async function saveMom() {
    if (!momId) { toast.error('Select Man of the Match'); return; }
    await matchService.updateMatch(id, { man_of_match_id: momId });
    setMatch({ ...match, man_of_match_id: momId });
    toast.success('Man of the Match saved');
  }

  function shareWhatsApp() {
    const text = `${match.team1_name} vs ${match.team2_name}\n${match.result_summary || ''}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  async function shareImage() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    script.onload = async () => {
      const canvas = await window.html2canvas(cardRef.current);
      const link = document.createElement('a');
      link.download = 'match-result.png';
      link.href = canvas.toDataURL();
      link.click();
    };
    document.body.appendChild(script);
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
      <div ref={cardRef} className="bg-gradient-to-br from-brand-green via-brand-teal to-brand-blue text-white rounded-3xl p-7 text-center space-y-2 shadow-pill">
        <p className="text-sm opacity-85">{match.team1_name} vs {match.team2_name}</p>
        <h1 className="text-xl font-bold">{match.result_summary || 'Match in progress'}</h1>
      </div>

      {needsMom && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Man of the Match</p>
            {battingCards.length > 0 && <span className="text-xs text-ink-400">Auto-suggested by performance</span>}
          </div>
          <select value={momId} onChange={e => setMomId(e.target.value)} className="field-input">
            <option value="">Select player</option>
            {matchPlayers
              .map(mp => ({ ...mp, score: calcMotmScore(mp.player_id, battingCards, bowlingCards, fieldingCards) }))
              .sort((a, b) => b.score - a.score)
              .map(mp => (
                <option key={mp.player_id} value={mp.player_id}>
                  {mp.players?.name}{mp.score > 0 ? ` (${mp.score} pts)` : ''}
                </option>
              ))}
          </select>
          <button onClick={saveMom} className="btn-primary w-full !py-2.5">Confirm</button>
        </div>
      )}

      {match.man_of_match_id && (
        <p className="text-sm text-center">
          Man of the Match: <PlayerLink id={match.man_of_match_id} name={matchPlayers.find(mp => mp.player_id === match.man_of_match_id)?.players?.name} />
        </p>
      )}

      <div className="flex gap-2">
        <button onClick={shareWhatsApp} className="btn-secondary flex-1 flex items-center justify-center gap-2 !py-2.5">
          <Share2 size={16} /> WhatsApp
        </button>
        <button onClick={shareImage} className="btn-secondary flex-1 flex items-center justify-center gap-2 !py-2.5">
          <Share2 size={16} /> Image
        </button>
      </div>

      <Link to={`/matches/${id}/scorecard`} className="btn-primary block text-center">
        View Full Scorecard
      </Link>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this match?"
        message={match ? `${match.team1_name} vs ${match.team2_name} — this permanently deletes the match, all deliveries, and scorecards. This cannot be undone.` : ''}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
