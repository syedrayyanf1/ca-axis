import React, { useEffect, useState } from 'react';

interface TopLoadingBarProps {
  /** Increment or change this value to trigger a 0% -> 70% -> 100% sweep */
  triggerKey: number | string;
  /** Keep the bar at 70% while an async action like Cloud Sync is running */
  isBusy?: boolean;
}

export const TopLoadingBar: React.FC<TopLoadingBarProps> = ({ triggerKey, isBusy = false }) => {
  const [progress, setProgress] = useState<number>(0);
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    setVisible(true);
    setProgress(15);

    const t1 = window.setTimeout(() => {
      setProgress(72);
    }, 40);

    const t2 = window.setTimeout(() => {
      if (!isBusy) {
        setProgress(100);
      }
    }, 190);

    const t3 = window.setTimeout(() => {
      if (!isBusy) {
        setVisible(false);
        setProgress(0);
      }
    }, 360);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [triggerKey]);

  useEffect(() => {
    if (isBusy) {
      setVisible(true);
      setProgress(74);
    } else if (visible) {
      setProgress(100);
      const doneTimer = window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 220);
      return () => window.clearTimeout(doneTimer);
    }
  }, [isBusy]);

  return (
    <div
      className="fixed top-0 left-0 right-0 h-[2px] z-[100] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <div
        className={`h-full bg-gradient-to-r from-indigo-500 via-white to-indigo-400 shadow-[0_0_10px_rgba(255,255,255,0.7)] transition-all ease-out ${
          visible ? 'opacity-100 duration-200' : 'opacity-0 duration-150'
        }`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = 'h-4 w-full' }) => {
  return (
    <div
      className={`bg-gradient-to-r from-zinc-800/40 via-zinc-700/50 to-zinc-800/40 bg-[length:200%_100%] animate-shimmer rounded-xl ${className}`}
      aria-hidden="true"
    />
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 animate-view-enter">
      {/* 4 KPI Card Skeletons */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="rounded-xl border border-white/[0.07] bg-[#121215] p-5 space-y-3"
          >
            <Skeleton className="h-3.5 w-28 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-3 w-36 rounded-md" />
          </div>
        ))}
      </section>

      {/* 4 Subject Module Card Skeletons */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36 rounded-md" />
          <Skeleton className="h-3.5 w-24 rounded-md" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="flex flex-col justify-between rounded-xl border border-white/[0.07] bg-[#121215] p-5 space-y-5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-14 rounded-md" />
                  <Skeleton className="h-3.5 w-28 rounded-md" />
                </div>
                <Skeleton className="h-6 w-56 rounded-lg" />
              </div>
              <div className="flex items-center justify-between gap-5 pt-2">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-40 rounded-md" />
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
                <Skeleton className="h-8 w-24 rounded-lg shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export const AnalyticsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-view-enter">
      {/* Chart Container + Weak Areas Skeletons */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-xl border border-white/[0.07] bg-[#121215] p-6 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-56 rounded-md" />
            <Skeleton className="h-3.5 w-72 rounded-md" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="lg:col-span-5 rounded-xl border border-white/[0.07] bg-[#121215] p-6 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-3.5 w-64 rounded-md" />
          </div>
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((idx) => (
              <Skeleton key={idx} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      {/* 5 Chapter Accuracy Row Skeletons */}
      <div className="rounded-xl border border-white/[0.07] bg-[#121215] p-6 space-y-4">
        <div className="space-y-2 pb-3 border-b border-white/[0.06]">
          <Skeleton className="h-5 w-64 rounded-md" />
          <Skeleton className="h-3.5 w-72 rounded-md" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex items-center justify-between gap-4 py-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-14 rounded-md" />
                <Skeleton className="h-4 w-48 rounded-md" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-28 rounded-md" />
                <Skeleton className="h-2 w-24 rounded-full" />
                <Skeleton className="h-7 w-16 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ExamLaunchSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col w-full h-dvh md:h-full overflow-hidden gap-3.5 p-3 md:p-0 animate-view-enter">
      {/* Header Bar Skeleton */}
      <div className="shrink-0 rounded-xl border border-white/[0.07] bg-[#121215] px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-6 w-6 rounded-lg" />
            <Skeleton className="h-5 w-44 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg shrink-0" />
          ))}
        </div>
      </div>

      {/* Split-Screen Question & Options Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0">
        <div className="md:col-span-7 rounded-xl border border-white/[0.07] bg-[#121215] p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <Skeleton className="h-4 w-48 rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
          </div>
          <div className="space-y-3 pt-2">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-11/12 rounded-md" />
            <Skeleton className="h-4 w-4/5 rounded-md" />
            <Skeleton className="h-24 w-full rounded-xl mt-4" />
          </div>
        </div>
        <div className="md:col-span-5 rounded-xl border border-white/[0.07] bg-[#121215] p-5 flex flex-col justify-between">
          <div className="space-y-3">
            <Skeleton className="h-4 w-36 rounded-md mb-2" />
            {[1, 2, 3, 4].map((opt) => (
              <Skeleton key={opt} className="h-14 w-full rounded-xl" />
            ))}
          </div>
          <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 flex-1 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
};
