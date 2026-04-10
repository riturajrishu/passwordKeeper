import React, { useMemo } from 'react';
import { Shield, ShieldAlert, ShieldCheck, ShieldEllipsis } from 'lucide-react';
import clsx from 'clsx';

const PasswordStrength = ({ password }) => {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: 'Empty', color: 'bg-slate-700', text: 'text-slate-500', icon: ShieldEllipsis, width: '0%' };
    
    let score = 0;
    if (password.length > 7) score++;
    if (password.length > 11) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-red-500', text: 'text-red-500', icon: ShieldAlert, width: '25%' };
    if (score === 3) return { score: 2, label: 'Fair', color: 'bg-yellow-500', text: 'text-yellow-500', icon: ShieldEllipsis, width: '50%' };
    if (score === 4) return { score: 3, label: 'Good', color: 'bg-blue-500', text: 'text-blue-500', icon: ShieldCheck, width: '75%' };
    return { score: 4, label: 'Strong', color: 'bg-green-500', text: 'text-green-500', icon: ShieldCheck, width: '100%' };
  }, [password]);

  const { label, color, text, icon: Icon, width } = strength;

  return (
    <div className="space-y-2 mt-2 w-full">
      <div className="flex justify-between items-center px-1">
        <div className={clsx("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest", text)}>
          <Icon size={12} />
          {label}
        </div>
        <div className="text-[10px] font-mono text-muted-foreground opacity-70">
          Entropy: {password.length * 4} bits (Est.)
        </div>
      </div>
      <div className="h-1.5 w-full bg-black/20 dark:bg-white/5 rounded-full overflow-hidden border border-white/5">
        <div 
          className={clsx("h-full transition-all duration-500 ease-out", color)} 
          style={{ width }} 
        />
      </div>
      <div className="grid grid-cols-4 gap-1 px-0.5">
          <div className={clsx("h-0.5 rounded-full transition-colors", strength.score >= 1 ? color : "bg-white/5")} />
          <div className={clsx("h-0.5 rounded-full transition-colors", strength.score >= 2 ? color : "bg-white/5")} />
          <div className={clsx("h-0.5 rounded-full transition-colors", strength.score >= 3 ? color : "bg-white/5")} />
          <div className={clsx("h-0.5 rounded-full transition-colors", strength.score >= 4 ? color : "bg-white/5")} />
      </div>
    </div>
  );
};

export default PasswordStrength;
