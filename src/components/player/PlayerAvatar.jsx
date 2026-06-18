function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

export default function PlayerAvatar({ name, photoUrl, size = 40 }) {
  const style = { width: size, height: size };
  if (photoUrl) {
    return <img src={photoUrl} alt={name} style={style} className="rounded-full object-cover flex-shrink-0" />;
  }
  return (
    <div
      style={style}
      className="rounded-full bg-ink-800 dark:bg-white/10 text-white flex items-center justify-center font-semibold flex-shrink-0"
    >
      <span style={{ fontSize: size * 0.4 }}>{initials(name)}</span>
    </div>
  );
}
