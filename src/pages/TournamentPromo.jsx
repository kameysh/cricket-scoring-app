import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ImageIcon, Upload, CheckCircle2, X } from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { usePlayerStore } from '../stores/playerStore';
import { publishPromo, getActivePromo, deactivatePromo } from '../services/promoService';

export default function TournamentPromo() {
  const navigate = useNavigate();
  const { isAdmin } = useRole();

  // All hooks must be called before any conditional return
  const players = usePlayerStore(s => s.players);
  const fetchPlayers = usePlayerStore(s => s.fetchPlayers);
  const fileInputRef = useRef(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [form, setForm] = useState({
    tournamentName: '',
    team1Name: '',
    captain1Id: '',
    team2Name: '',
    captain2Id: '',
    date: '',
  });
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [activePromo, setActivePromo] = useState(null);
  const [loadingActive, setLoadingActive] = useState(true);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => { fetchPlayers({ activeOnly: true }); }, []);
  useEffect(() => { if (isAdmin === false) navigate('/'); }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    getActivePromo()
      .then(setActivePromo)
      .catch(() => {})
      .finally(() => setLoadingActive(false));
  }, [isAdmin]);

  if (!isAdmin) return null;

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setPublished(false);
  }

  async function handlePublish() {
    if (!imageFile) { toast.error('Please upload a banner image first'); return; }
    setPublishing(true);
    try {
      const captain1Name = players.find(p => p.id === form.captain1Id)?.name || '';
      const captain2Name = players.find(p => p.id === form.captain2Id)?.name || '';
      const promo = await publishPromo({
        bannerFile: imageFile,
        tournamentName: form.tournamentName,
        team1Name: form.team1Name,
        captain1Name,
        team2Name: form.team2Name,
        captain2Name,
        eventDate: form.date,
      });
      setActivePromo(promo);
      setPublished(true);
      toast.success('Promo published! Visible on Home page.');
    } catch (e) {
      toast.error('Failed to publish: ' + e.message);
    } finally {
      setPublishing(false);
    }
  }

  async function handleDeactivate() {
    if (!activePromo) return;
    setDeactivating(true);
    try {
      await deactivatePromo(activePromo.id);
      setActivePromo(null);
      setPublished(false);
      toast.success('Promo removed from Home page');
    } catch (e) {
      toast.error('Failed to remove: ' + e.message);
    } finally {
      setDeactivating(false);
    }
  }

  const inputClass = 'w-full rounded-xl border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-800 px-3 py-2.5 text-sm text-ink-900 dark:text-white placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-green/50';

  return (
    <div className="p-4 pb-28 space-y-5 page-transition">
      {/* Header */}
      <div className="flex items-center gap-3 pt-safe">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-ink-100 dark:bg-white/10 shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-white">Tournament Promo</h1>
          <p className="text-xs text-ink-400 mt-0.5">Publish a banner to the Home page</p>
        </div>
      </div>

      {/* Currently live promo */}
      {!loadingActive && activePromo && (
        <div className="rounded-2xl border-2 border-brand-green/30 bg-brand-green/5 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
              <span className="text-sm font-semibold text-brand-green">Currently Live on Home</span>
            </div>
            <button
              onClick={handleDeactivate}
              disabled={deactivating}
              className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
              aria-label="Remove promo"
            >
              <X size={15} />
            </button>
          </div>
          <img src={activePromo.banner_url} alt="Live promo" className="w-full max-h-40 object-cover" />
          {activePromo.tournament_name && (
            <p className="px-4 py-2 text-sm font-semibold text-ink-700 dark:text-ink-200">
              {activePromo.tournament_name}
              {activePromo.team1_name && activePromo.team2_name &&
                ` · ${activePromo.team1_name} vs ${activePromo.team2_name}`}
            </p>
          )}
        </div>
      )}

      {/* Banner image upload */}
      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
        >
          {imagePreviewUrl ? (
            <div className="relative">
              <img src={imagePreviewUrl} alt="Banner preview" className="w-full h-52 object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2 text-white text-sm font-semibold">
                  <Upload size={16} /> Change image
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 h-44 bg-ink-50 dark:bg-white/5 text-ink-400 hover:bg-ink-100 dark:hover:bg-white/10 transition-colors">
              <ImageIcon size={32} />
              <div className="text-center">
                <p className="text-sm font-semibold text-ink-600 dark:text-ink-300">Tap to upload banner</p>
                <p className="text-xs text-ink-400 mt-0.5">PNG, JPG, SVG, WEBP supported</p>
              </div>
            </div>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageChange}
        />
      </div>

      {/* Form fields */}
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-200">Tournament Details <span className="text-ink-400 font-normal">(optional)</span></h2>
        <input
          value={form.tournamentName}
          onChange={set('tournamentName')}
          placeholder="Tournament name"
          className={inputClass}
        />
        <input
          type="date"
          value={form.date}
          onChange={set('date')}
          className={inputClass}
        />
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-200">Teams <span className="text-ink-400 font-normal">(optional)</span></h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Team 1</label>
            <input value={form.team1Name} onChange={set('team1Name')} placeholder="Team name" className={inputClass} />
            <select value={form.captain1Id} onChange={set('captain1Id')} className={inputClass}>
              <option value="">Captain</option>
              {players.filter(p => p.id !== form.captain2Id).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Team 2</label>
            <input value={form.team2Name} onChange={set('team2Name')} placeholder="Team name" className={inputClass} />
            <select value={form.captain2Id} onChange={set('captain2Id')} className={inputClass}>
              <option value="">Captain</option>
              {players.filter(p => p.id !== form.captain1Id).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Publish button */}
      {published ? (
        <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand-green/10 border border-brand-green/30 text-brand-green font-semibold text-sm">
          <CheckCircle2 size={18} />
          Published! Visible on Home page
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePublish}
          disabled={publishing || !imageFile}
          className="btn-primary w-full disabled:opacity-50"
        >
          {publishing ? 'Publishing…' : 'Publish to Home Page'}
        </button>
      )}

      {published && (
        <button
          type="button"
          onClick={() => {
            if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
            setPublished(false);
            setImageFile(null);
            setImagePreviewUrl(null);
            setForm({ tournamentName: '', team1Name: '', captain1Id: '', team2Name: '', captain2Id: '', date: '' });
          }}
          className="w-full py-2.5 rounded-2xl border border-ink-200 dark:border-white/10 text-sm text-ink-500 dark:text-ink-400 font-medium"
        >
          Publish a new banner
        </button>
      )}
    </div>
  );
}
