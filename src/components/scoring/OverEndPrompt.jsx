export default function OverEndPrompt({ overNumber, runs, wickets }) {
  return (
    <div className="bg-cricket-pitch/30 text-center text-sm font-medium py-1.5 text-gray-700 dark:text-gray-200">
      Over {overNumber} — {runs} run(s), {wickets} wkt(s)
    </div>
  );
}
