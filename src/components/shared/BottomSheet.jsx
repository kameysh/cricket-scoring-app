import { useEffect } from 'react';
import { X } from 'lucide-react';

// Global counter — only the first opener locks body scroll; last closer unlocks it.
// Prevents permanent scroll-lock when multiple sheets open/close in sequence.
let _lockCount = 0;
function acquireScrollLock() {
  if (_lockCount === 0) document.body.style.overflow = 'hidden';
  _lockCount++;
}
function releaseScrollLock() {
  _lockCount = Math.max(0, _lockCount - 1);
  if (_lockCount === 0) document.body.style.overflow = '';
}

export default function BottomSheet({ open, onClose, title, heightClass = 'h-[70vh]', noScroll = false, children }) {
  useEffect(() => {
    if (!open) return;
    acquireScrollLock();
    return () => releaseScrollLock();
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative bg-white dark:bg-gray-900 rounded-t-2xl ${heightClass} w-full flex flex-col animate-[slideUp_0.25s_ease-out] shadow-2xl`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={20} />
          </button>
        </div>
        <div className={`flex-1 ${noScroll ? 'overflow-hidden' : 'overflow-y-auto'} px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]`}>{children}</div>
      </div>
    </div>
  );
}
