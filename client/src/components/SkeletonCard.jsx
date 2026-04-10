import React from 'react';

/**
 * Pulsing skeleton card that matches ItemCard dimensions
 * Used during vault loading to replace a raw spinner
 */
export function SkeletonCard() {
    return (
        <div className="glass-panel p-6 rounded-3xl border border-border/50 flex flex-col justify-between">
            {/* Header */}
            <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl skeleton-shimmer shrink-0" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 rounded-lg skeleton-shimmer w-3/4" />
                    <div className="h-3 rounded-lg skeleton-shimmer w-1/2" />
                </div>
            </div>

            {/* Body rows */}
            <div className="space-y-3 mb-5">
                <div className="h-12 rounded-2xl skeleton-shimmer" />
                <div className="h-12 rounded-2xl skeleton-shimmer" />
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-border/40 flex items-center justify-between">
                <div className="h-3 rounded-lg skeleton-shimmer w-24" />
                <div className="h-3 rounded-lg skeleton-shimmer w-12" />
            </div>
        </div>
    );
}

/**
 * Row of N skeleton cards
 */
export default function SkeletonGrid({ count = 6 }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
}
