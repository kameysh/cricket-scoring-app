import MatchSetupStepper from '../components/match/MatchSetupStepper';

export default function MatchSetup() {
  return (
    <div className="p-4 page-transition">
      <h1 className="text-2xl font-bold text-ink-900 dark:text-white mb-5">New Match</h1>
      <MatchSetupStepper />
    </div>
  );
}
