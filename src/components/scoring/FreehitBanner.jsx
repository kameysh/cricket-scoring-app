export default function FreehitBanner({ active }) {
  if (!active) return null;
  return (
    <div className="bg-amber-500 text-white text-center text-sm font-bold py-1.5 tracking-wide">
      FREE HIT
    </div>
  );
}
