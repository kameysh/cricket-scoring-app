import { useState, useEffect, useRef } from 'react';
import { Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import BottomSheet from '../shared/BottomSheet';
import { generateMvpCard } from '../../lib/generateShareCard.jsx';

/**
 * Shareable MVP rank card for a top-3 leaderboard player.
 * Props:
 *   open      – boolean
 *   onClose   – () => void
 *   player    – { id, name, photo_url, role }
 *   rank      – 1 | 2 | 3
 *   mvpScore  – number (already computed in Leaderboard)
 *   stats     – the player_career_stats row (bat_runs, bowl_wickets, …)
 */
export default function MvpCardSheet({ open, onClose, player, rank, mvpScore, stats }) {
  const [cardBlob, setCardBlob]     = useState(null);
  const [cardUrl, setCardUrl]       = useState(null);
  const [generating, setGenerating] = useState(false);
  const [sharing, setSharing]       = useState(false);
  const prevUrl = useRef(null);

  useEffect(() => {
    if (!open || !player) return;

    setGenerating(true);
    setCardBlob(null);
    if (prevUrl.current) { URL.revokeObjectURL(prevUrl.current); prevUrl.current = null; }
    setCardUrl(null);

    generateMvpCard({ player, rank, mvpScore, stats })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        prevUrl.current = url;
        setCardBlob(blob);
        setCardUrl(url);
      })
      .catch(() => toast.error('Could not generate card'))
      .finally(() => setGenerating(false));
  }, [open, player?.id, rank]);

  // Cleanup object URL on unmount
  useEffect(() => () => { if (prevUrl.current) URL.revokeObjectURL(prevUrl.current); }, []);

  async function handleShare() {
    if (!cardBlob || sharing) return;
    setSharing(true);
    try {
      const fileName = `${(player.name || 'player').replace(/\s+/g, '-')}-mvp.png`;
      const file = new File([cardBlob], fileName, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: `${player.name} — MVP` }); return; }
        catch { /* user cancelled */ }
      }
      if (navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': cardBlob })]);
          toast.success('Copied to clipboard!'); return;
        } catch { /* permission denied */ }
      }
      // Download fallback
      const link = document.createElement('a');
      link.download = fileName;
      link.href = cardUrl;
      link.click();
    } catch {
      toast.error('Could not share');
    } finally {
      setSharing(false);
    }
  }

  if (!open) return null;

  return (
    <BottomSheet open onClose={onClose} title={`${player?.name || ''} — MVP Card`} heightClass="h-[85vh]">
      {/* Card preview — shows the exact exported PNG */}
      <div className="flex items-center justify-center rounded-2xl overflow-hidden bg-[#0d1b2a] mb-4" style={{ height: '440px' }}>
        {generating && (
          <div className="flex flex-col items-center gap-3 text-ink-400">
            <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Generating card…</span>
          </div>
        )}
        {!generating && cardUrl && (
          <img src={cardUrl} alt="MVP card" className="h-full w-auto object-contain" />
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2 pb-2">
        <button
          onClick={handleShare}
          disabled={!cardBlob || sharing}
          className="w-full flex items-center justify-center gap-2 bg-brand-green text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
        >
          <Share2 size={16} />
          {sharing ? 'Sharing…' : 'Share MVP Card'}
        </button>
      </div>
    </BottomSheet>
  );
}
