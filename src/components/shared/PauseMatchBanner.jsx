import { PauseCircle } from 'lucide-react';

export default function PauseMatchBanner({ visible }) {
  if (!visible) return null;
  return (
    <div className="bg-gray-700 text-white text-sm font-medium flex items-center justify-center gap-2 py-1.5 px-3">
      <PauseCircle size={14} />
      Match paused
    </div>
  );
}
