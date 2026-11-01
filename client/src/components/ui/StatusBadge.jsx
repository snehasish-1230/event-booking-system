const STATUS_CONFIG = {
  event: {
    draft: {
      label: 'Draft',
      classes: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      dot: 'bg-gray-400',
    },
    published: {
      label: 'Published',
      classes: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
      dot: 'bg-green-500',
    },
    cancelled: {
      label: 'Cancelled',
      classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
      dot: 'bg-red-500',
    },
    completed: {
      label: 'Completed',
      classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
      dot: 'bg-blue-500',
    },
  },
  registration: {
    pending: {
      label: 'Awaiting Payment',
      classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      dot: 'bg-amber-500',
    },
    confirmed: {
      label: 'Confirmed',
      classes: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
      dot: 'bg-green-500',
    },
    cancelled: {
      label: 'Cancelled',
      classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
      dot: 'bg-red-500',
    },
    attended: {
      label: 'Attended',
      classes: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400',
      dot: 'bg-indigo-500',
    },
  },
};

const StatusBadge = ({ status, type = 'event' }) => {
  const config = STATUS_CONFIG[type]?.[status] || {
    label: status,
    classes: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    dot: 'bg-gray-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${config.classes}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};

export default StatusBadge;
