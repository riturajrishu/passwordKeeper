import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import useToastStore from '../store/useToastStore';

const config = {
  success: {
    Icon: CheckCircle,
    cls: 'text-green-400 bg-green-500/10 border-green-500/25',
    bar: 'bg-green-400',
  },
  error: {
    Icon: XCircle,
    cls: 'text-red-400 bg-red-500/10 border-red-500/25',
    bar: 'bg-red-400',
  },
  warning: {
    Icon: AlertTriangle,
    cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25',
    bar: 'bg-yellow-400',
  },
  info: {
    Icon: Info,
    cls: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
    bar: 'bg-blue-400',
  },
};

export default function Toast() {
  const toasts = useToastStore(s => s.toasts);
    const removeToast = useToastStore(s => s.removeToast);

  return (
    <div className="fixed top-4 right-4 z-[150] flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)]">
      <AnimatePresence mode="sync">
        {toasts.map((toast) => {
          const { Icon, cls, bar } = config[toast.type] || config.info;
          const duration = toast.duration || 3500;
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`pointer-events-auto relative flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl w-[300px] sm:min-w-[300px] sm:max-w-sm overflow-hidden ${cls}`}
            >
              <Icon size={18} className="shrink-0" />
              <p className="text-sm font-medium text-foreground flex-1 leading-snug">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors ml-1"
              >
                <X size={15} />
              </button>
              {/* Progress bar */}
              <div
                className={`absolute bottom-0 left-0 h-[2px] ${bar} toast-progress-bar opacity-60`}
                style={{ animationDuration: `${duration}ms` }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
