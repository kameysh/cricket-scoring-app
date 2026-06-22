import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import * as auctionService from '../services/auctionService';
import AuctionCard from '../components/auction/AuctionCard';
import { useRole } from '../hooks/useRole';

export default function Auctions() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    auctionService.listAuctions()
      .then(setAuctions)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4"><p className="text-center py-12 text-ink-400">Loading…</p></div>;

  return (
    <div className="p-4 space-y-4 page-transition">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink-900 dark:text-white">Auctions</h1>
        {isAdmin && (
          <button
            onClick={() => navigate('/auctions/new')}
            className="btn-primary flex items-center gap-1.5 py-2 px-4 text-sm"
          >
            <Plus size={15} />
            New
          </button>
        )}
      </div>

      {auctions.length === 0 ? (
        <div className="card p-8 flex flex-col items-center text-center gap-2">
          <p className="text-3xl">🏷️</p>
          <p className="font-semibold text-ink-700 dark:text-ink-200">No auctions yet</p>
          {isAdmin && <p className="text-sm text-ink-400">Create one to get started</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {auctions.map(a => (
            <AuctionCard key={a.id} auction={a} onClick={() => navigate(`/auctions/${a.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
