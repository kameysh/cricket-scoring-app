import { useState } from 'react';
import { ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import { buildHighlights } from '../../lib/cricketUtils';
import toast from 'react-hot-toast';

export default function HighlightsFeed({ deliveries, playersMap }) {
  const [open, setOpen] = useState(false);

  const highlights = buildHighlights(deliveries, playersMap);

  async function handleShare() {
    if (!highlights.length) return;
    const text = highlights.map(h => `${h.emoji} ${h.overLabel}: ${h.text}`).join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Highlights copied to clipboard');
      }
    } catch {
      // Fallback for browsers that block clipboard without gesture
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast.success('Highlights copied');
    }
  }

  return (
    <div className="card p-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full"
      >
        <span className="text-sm font-semibold text-ink-900 dark:text-white flex items-center gap-2">
          ✨ Match Highlights
          <span className="text-[11px] font-normal text-ink-400">({highlights.length})</span>
        </span>
        {open ? <ChevronUp size={16} className="text-ink-400" /> : <ChevronDown size={16} className="text-ink-400" />}
      </button>

      {open && (
        <div className="mt-3 space-y-1">
          {highlights.length === 0 ? (
            <p className="text-xs text-ink-400 py-2 text-center">No highlights yet — boundaries, wickets and milestones appear here</p>
          ) : (
            <>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="text-base leading-none mt-0.5 shrink-0">{h.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-ink-800 dark:text-ink-100 leading-snug">{h.text}</p>
                    </div>
                    <span className="text-[10px] text-ink-400 whitespace-nowrap shrink-0 mt-0.5">{h.overLabel}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-ink-100 dark:border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center gap-1.5 text-xs font-medium text-brand-green hover:underline"
                >
                  <Share2 size={13} /> Share
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
