import { WifiOff } from 'lucide-react';

export default function OfflineBanner({ visible }) {
  if (!visible) return null;
  return (
    <div className="bg-amber-500 text-white text-sm font-medium flex items-center justify-center gap-2 py-1.5 px-3">
      <WifiOff size={14} />
      Offline — scoring will sync automatically once reconnected
    </div>
  );
}
