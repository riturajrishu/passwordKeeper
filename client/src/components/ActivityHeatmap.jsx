import React, { useMemo } from 'react';

const ActivityHeatmap = ({ items }) => {
    // Generate dates for the last 90 days
    const heatMapData = useMemo(() => {
        const days = 90;
        const data = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Track dates in a map based on createdAt and password history
        const activityMap = {};

        items.forEach(item => {
            if (item.createdAt) {
                const d = new Date(item.createdAt);
                d.setHours(0, 0, 0, 0);
                const key = d.getTime();
                activityMap[key] = (activityMap[key] || 0) + 1;
            }
            if (item.passwordHistory) {
                item.passwordHistory.forEach(hist => {
                    if (hist.date) {
                        const d = new Date(hist.date);
                        d.setHours(0, 0, 0, 0);
                        const key = d.getTime();
                        activityMap[key] = (activityMap[key] || 0) + 1;
                    }
                });
            }
        });

        // Fill array backwards from today
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today.getTime() - (i * 24 * 60 * 60 * 1000));
            const count = activityMap[d.getTime()] || 0;
            data.push({ date: d, count });
        }

        return data;
    }, [items]);

    const getColor = (count) => {
        if (count === 0) return 'bg-black/5 dark:bg-white/5 border border-border/50';
        if (count < 2) return 'bg-primary/30';
        if (count < 4) return 'bg-primary/60';
        return 'bg-primary shadow-[0_0_8px_var(--primary)] text-primary-foreground';
    };

    return (
        <div className="glass-panel p-6 rounded-3xl border border-border">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Vault Activity (Last 90 Days)</h3>
            <div className="flex flex-wrap gap-1.5 justify-end">
                {heatMapData.map((day, idx) => (
                    <div
                        key={idx}
                        className={`w-3 h-3 md:w-4 md:h-4 rounded-sm ${getColor(day.count)} transition-all hover:scale-125 cursor-help`}
                        title={`${day.date.toDateString()}: ${day.count} activities`}
                    />
                ))}
            </div>
            <div className="flex items-center gap-2 mt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground justify-end opacity-60">
                <span>Less</span>
                <div className="w-2.5 h-2.5 bg-black/5 dark:bg-white/5 rounded-sm"></div>
                <div className="w-2.5 h-2.5 bg-primary/30 rounded-sm"></div>
                <div className="w-2.5 h-2.5 bg-primary/60 rounded-sm"></div>
                <div className="w-2.5 h-2.5 bg-primary rounded-sm shadow-[0_0_5px_var(--primary)]"></div>
                <span>More</span>
            </div>
        </div>
    );
};

export default ActivityHeatmap;
