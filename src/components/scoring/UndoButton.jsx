import { Undo2 } from 'lucide-react';

export default function UndoButton({ disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="min-w-[52px] min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-ink-200 dark:border-white/15 text-ink-700 dark:text-ink-200 active:scale-95 disabled:opacity-30 transition-transform"
    >
      <Undo2 size={20} />
      <span className="text-[10px]">Undo</span>
    </button>
  );
}
