export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-cricket-green/10 flex items-center justify-center mb-4">
          <Icon className="text-cricket-green" size={32} />
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
      {message && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-xs">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
