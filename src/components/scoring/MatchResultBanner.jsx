import { Trophy } from 'lucide-react';

export default function MatchResultBanner({ summary, onClose }) {
  if (!summary) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-[fadeIn_0.3s_ease-out]">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center max-w-sm w-full animate-[popIn_0.4s_ease-out]">
        <Trophy size={56} className="text-cricket-gold mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{summary}</h2>
        {onClose && (
          <button onClick={onClose} className="btn-primary w-full mt-6">
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
