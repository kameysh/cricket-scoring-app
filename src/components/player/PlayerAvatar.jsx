const NAMED_SIZES = { xs: 24, sm: 32, md: 44, lg: 56, xl: 80 };

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

export default function PlayerAvatar({ player, name, photoUrl, size = 40 }) {
  // Accept either a `player` object shorthand or explicit name/photoUrl props
  const resolvedName = name ?? player?.name ?? '';
  const resolvedUrl  = photoUrl ?? player?.photo_url ?? null;
  const px = typeof size === 'number' ? size : (NAMED_SIZES[size] ?? 40);
  const style = { width: px, height: px };

  if (resolvedUrl) {
    return <img src={resolvedUrl} alt={resolvedName} style={style} className="rounded-full object-cover flex-shrink-0" />;
  }
  return (
    <div
      style={style}
      className="rounded-full bg-ink-800 dark:bg-white/10 text-white flex items-center justify-center font-semibold flex-shrink-0"
    >
      <span style={{ fontSize: px * 0.4 }}>{initials(resolvedName)}</span>
    </div>
  );
}
