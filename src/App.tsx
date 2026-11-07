import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Database,
  Flame,
  LayoutDashboard,
  Play,
  XCircle,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import {
  ExamSessionRecord,
  Question,
  QuestionMasteryStat,
  QuestionSource,
  SubjectId,
} from './types';
import { SUBJECTS } from './data/subjects';
import {
  addCustomQuestions,
  clearAllProgress,
  deleteCustomQuestion,
  getQuestionsBySubject,
  initializeStorageWithSeed,
  loadCustomQuestions,
  pushProgressToSupabase,
  saveExamSession,
  saveThemePreference,
  syncUserProgressOnLogin,
} from './utils/storage';
import { supabase } from './supabaseClient';
import { ExamSimulator } from './components/ExamSimulator';
import { AnalyticsView } from './components/AnalyticsView';
import { QuestionBankStudio } from './components/QuestionBankStudio';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { AuthSyncModal, NavbarAuthControl, SyncStatus } from './components/AuthSyncModal';
import { CAxisLogo } from './components/CAxisLogo';
import { DashboardSkeleton, TopLoadingBar } from './components/UIFeedback';
import { AnimatedBackground } from './components/AnimatedBackground';

type ActiveView = 'dashboard' | 'simulator' | 'analytics' | 'question-bank';

function computeStudyStreakDays(sessions: ExamSessionRecord[]): number {
  if (sessions.length === 0) return 0;
  const uniqueDayStrings = Array.from(
    new Set(
      sessions.map((s) => {
        const d = new Date(s.timestamp);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      })
    )
  );
  return uniqueDayStrings.length;
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [isExamActive, setIsExamActive] = useState<boolean>(false);
  const [loadingBarTrigger, setLoadingBarTrigger] = useState<number>(0);
  const [isHydrating, setIsHydrating] = useState<boolean>(true);
  const [barsMounted, setBarsMounted] = useState<boolean>(false);

  const triggerLoadingBar = useCallback(() => {
    setLoadingBarTrigger((n) => n + 1);
  }, []);

  const switchView = useCallback(
    (nextView: ActiveView) => {
      setActiveView(nextView);
      triggerLoadingBar();
    },
    [triggerLoadingBar]
  );

  useEffect(() => {
    document.documentElement.classList.add('dark');
    saveThemePreference('dark');
    const timer = window.setTimeout(() => {
      setIsHydrating(false);
    }, 240);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (activeView === 'dashboard' && !isHydrating) {
      setBarsMounted(false);
      const raf = window.requestAnimationFrame(() => {
        const t = window.setTimeout(() => setBarsMounted(true), 40);
        return () => window.clearTimeout(t);
      });
      return () => window.cancelAnimationFrame(raf);
    }
  }, [activeView, isHydrating]);

  // Local-first initialization so the app works immediately without waiting on network
  const [sessions, setSessions] = useState<ExamSessionRecord[]>(() => {
    const seeded = initializeStorageWithSeed();
    return seeded.sessions;
  });
  const [mastery, setMastery] = useState<Record<string, QuestionMasteryStat>>(() => {
    const seeded = initializeStorageWithSeed();
    return seeded.mastery;
  });
  const [customQuestions, setCustomQuestions] = useState<Question[]>(() =>
    loadCustomQuestions()
  );

  // Keep refs to current local state for safe async merge on login
  const sessionsRef = useRef(sessions);
  const masteryRef = useRef(mastery);
  const customQuestionsRef = useRef(customQuestions);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);
  useEffect(() => {
    masteryRef.current = mastery;
  }, [mastery]);
  useEffect(() => {
    customQuestionsRef.current = customQuestions;
  }, [customQuestions]);

  // Supabase Auth & Sync state
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const syncedUserIdRef = useRef<string | null>(null);

  const performCloudMergeAndSync = useCallback(async (targetUser: User) => {
    setSyncStatus('syncing');
    const localSnapshot = {
      sessions: sessionsRef.current,
      mastery: masteryRef.current,
      customQuestions: customQuestionsRef.current,
    };

    const { merged, synced } = await syncUserProgressOnLogin(
      targetUser.id,
      targetUser.email,
      localSnapshot
    );

    setSessions(merged.sessions);
    setMastery(merged.mastery);
    if (merged.customQuestions) {
      setCustomQuestions(merged.customQuestions);
    }
    setSyncStatus(synced ? 'synced' : 'error');
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
      if (currentUser && syncedUserIdRef.current !== currentUser.id) {
        syncedUserIdRef.current = currentUser.id;
        performCloudMergeAndSync(currentUser);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser && syncedUserIdRef.current !== nextUser.id) {
        syncedUserIdRef.current = nextUser.id;
        performCloudMergeAndSync(nextUser);
      } else if (!nextUser) {
        syncedUserIdRef.current = null;
        setSyncStatus('idle');
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [performCloudMergeAndSync]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    syncedUserIdRef.current = null;
    setUser(null);
    setSyncStatus('idle');
  };

  const [simSubjectId, setSimSubjectId] = useState<SubjectId>('prc-1');
  const [simChapterFilter, setSimChapterFilter] = useState<number | null>(null);
  const [simSourceFilter, setSimSourceFilter] = useState<QuestionSource | null>(null);

  const allQuestionsBySubject: Record<SubjectId, Question[]> = useMemo(
    () => ({
      'prc-1': getQuestionsBySubject('prc-1', customQuestions),
      'prc-2': getQuestionsBySubject('prc-2', customQuestions),
      'prc-3-v1': getQuestionsBySubject('prc-3-v1', customQuestions),
      'prc-3-v2': getQuestionsBySubject('prc-3-v2', customQuestions),
    }),
    [customQuestions]
  );

  const globalStats = useMemo(() => {
    const totalBankCount =
      allQuestionsBySubject['prc-1'].length +
      allQuestionsBySubject['prc-2'].length +
      allQuestionsBySubject['prc-3-v1'].length +
      allQuestionsBySubject['prc-3-v2'].length;

    let totalAttempted = 0;
    let totalCorrect = 0;

    (Object.values(mastery) as QuestionMasteryStat[]).forEach((stat) => {
      totalAttempted += stat.attempts;
      totalCorrect += stat.correct;
    });

    const accuracyRate =
      totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
    const streakDays = computeStudyStreakDays(sessions);

    return {
      totalBankCount,
      totalAttempted,
      totalCorrect,
      accuracyRate,
      testsCompleted: sessions.length,
      streakDays,
    };
  }, [allQuestionsBySubject, mastery, sessions]);

  const launchSimulator = (
    subjectId: SubjectId,
    chapterId: number | null = null,
    source: QuestionSource | null = null
  ) => {
    setSimSubjectId(subjectId);
    setSimChapterFilter(chapterId);
    setSimSourceFilter(source);
    setActiveView('simulator');
    triggerLoadingBar();
  };

  const handleCompleteSession = async (session: ExamSessionRecord) => {
    // 1. Immediately save to localStorage
    const updated = saveExamSession(session, sessions, mastery);
    setSessions(updated.sessions);
    setMastery(updated.mastery);

    // 2. If logged in, immediately upsert updated progress JSON to public.user_progress
    if (user) {
      setSyncStatus('syncing');
      const ok = await pushProgressToSupabase(user.id, user.email, {
        sessions: updated.sessions,
        mastery: updated.mastery,
        customQuestions,
      });
      setSyncStatus(ok ? 'synced' : 'error');
    }
  };

  const handleImportQuestions = async (newQuestions: Question[]) => {
    const merged = addCustomQuestions(newQuestions);
    setCustomQuestions(merged);
    if (user) {
      setSyncStatus('syncing');
      const ok = await pushProgressToSupabase(user.id, user.email, {
        sessions,
        mastery,
        customQuestions: merged,
      });
      setSyncStatus(ok ? 'synced' : 'error');
    }
  };

  const handleDeleteCustomQuestion = async (id: string) => {
    const remaining = deleteCustomQuestion(id);
    setCustomQuestions(remaining);
    if (user) {
      setSyncStatus('syncing');
      const ok = await pushProgressToSupabase(user.id, user.email, {
        sessions,
        mastery,
        customQuestions: remaining,
      });
      setSyncStatus(ok ? 'synced' : 'error');
    }
  };

  const handleResetProgress = async () => {
    triggerLoadingBar();
    const cleared = clearAllProgress();
    setSessions(cleared.sessions);
    setMastery(cleared.mastery);
    if (user) {
      setSyncStatus('syncing');
      const ok = await pushProgressToSupabase(user.id, user.email, {
        sessions: cleared.sessions,
        mastery: cleared.mastery,
        customQuestions,
      });
      setSyncStatus(ok ? 'synced' : 'error');
    }
  };

  const isFullScreenExam = activeView === 'simulator' && isExamActive;

  return (
    <div
      className={`relative isolate flex flex-col bg-transparent text-[#09090B] antialiased dark:text-[#FAFAFA] ${
        isFullScreenExam ? 'h-dvh overflow-hidden' : 'min-h-screen'
      }`}
    >
      {/* Dynamic Layered Ambient Background (Auto-calms by 60% during active exam) */}
      <AnimatedBackground isExamFocus={isFullScreenExam} />

      {/* Global Top Progress Bar (NProgress / Vercel style) */}
      <TopLoadingBar triggerKey={loadingBarTrigger} isBusy={syncStatus === 'syncing'} />

      {/* Ultra-Clean Top Navigation Bar (h-14) — Hidden on mobile during active exam */}
      <header
        className={`sticky top-0 z-30 h-14 shrink-0 border-b border-black/[0.08] bg-white/80 backdrop-blur-md dark:border-white/[0.07] dark:bg-[#09090B]/75 ${
          isFullScreenExam ? 'hidden md:block' : ''
        }`}
      >
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          {/* Left: Precision CAxis Squircle Icon (30x30px) + Space Grotesk Brand Wordmark with Subtle Glow */}
          <a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();
              switchView('dashboard');
            }}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0"
          >
            <CAxisLogo
              containerClassName="h-[30px] w-[30px] shadow-[0_0_18px_rgba(255,255,255,0.22)] border-white/25"
              svgClassName="h-5 w-5"
            />
            <div className="flex items-baseline">
              <span
                style={{ fontFamily: "'Syne', sans-serif", letterSpacing: '-0.04em' }}
                className="caxis-logo text-xl font-extrabold text-[#09090B] dark:text-white dark:drop-shadow-[0_0_10px_rgba(255,255,255,0.35)]"
              >
                CAxis
              </span>
              <span
                style={{ fontFamily: "'Montserrat', sans-serif" }}
                className="ml-1.5 text-xs font-bold text-zinc-500"
              >
                / PRC
              </span>
            </div>
          </a>

          {/* Center: Pill-style segmented navigation tabs (Desktop & Tablet) — Zero Scrollbar */}
          <nav className="hidden md:flex shrink-0 items-center gap-1 rounded-xl border border-black/[0.06] bg-zinc-100/90 p-1 dark:border-white/[0.07] dark:bg-zinc-900/90">
            <button
              type="button"
              onClick={() => switchView('dashboard')}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'dashboard'
                  ? 'bg-white text-[#09090B] border border-black/10 shadow-2xs dark:bg-white/[0.09] dark:text-white dark:border-white/15 dark:shadow-[0_0_20px_-5px_rgba(255,255,255,0.25)]'
                  : 'border border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => launchSimulator(simSubjectId, null, null)}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'simulator'
                  ? 'bg-white text-[#09090B] border border-black/10 shadow-2xs dark:bg-white/[0.09] dark:text-white dark:border-white/15 dark:shadow-[0_0_20px_-5px_rgba(255,255,255,0.25)]'
                  : 'border border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              Test Yourself
            </button>
            <button
              type="button"
              onClick={() => switchView('analytics')}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'analytics'
                  ? 'bg-white text-[#09090B] border border-black/10 shadow-2xs dark:bg-white/[0.09] dark:text-white dark:border-white/15 dark:shadow-[0_0_20px_-5px_rgba(255,255,255,0.25)]'
                  : 'border border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              Analytics
            </button>
            <button
              type="button"
              onClick={() => switchView('question-bank')}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'question-bank'
                  ? 'bg-white text-[#09090B] border border-black/10 shadow-2xs dark:bg-white/[0.09] dark:text-white dark:border-white/15 dark:shadow-[0_0_20px_-5px_rgba(255,255,255,0.25)]'
                  : 'border border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              Question Bank
            </button>
          </nav>

          {/* Right: Supabase Auth / Cloud Sync Control and Install App */}
          <div className="flex items-center gap-2 shrink-0">
            <NavbarAuthControl
              user={user}
              syncStatus={syncStatus}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onSignOut={handleSignOut}
              onManualSync={async () => {
                if (user) {
                  await performCloudMergeAndSync(user);
                }
              }}
              onResetProgress={handleResetProgress}
            />
            <PWAInstallButton />
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main
        className={
          isFullScreenExam
            ? 'mx-auto flex h-dvh w-full max-w-7xl flex-1 flex-col overflow-hidden p-0 md:h-[calc(100dvh-3.5rem)] md:px-6 md:py-3'
            : 'mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8'
        }
      >
        {activeView === 'dashboard' && (
          <div className="space-y-8 animate-view-enter">
            {/* Compact Overview Header */}
            <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-[#09090B] dark:text-[#FAFAFA]">
                  Overview
                </h1>
                <p className="mt-1 text-sm text-[#71717A] dark:text-[#A1A1AA]">
                  Track your ICAP PRC test accuracy and launch chapter simulations.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => launchSimulator('prc-1', null, null)}
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 whitespace-nowrap cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Test Yourself</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchView('analytics')}
                  className="inline-flex items-center gap-2 rounded-lg border border-black/[0.08] bg-white px-4 py-2 text-sm font-medium text-[#09090B] transition-all hover:bg-zinc-50 dark:border-white/[0.07] dark:bg-[#121215] dark:text-[#FAFAFA] dark:hover:bg-zinc-800/80 whitespace-nowrap cursor-pointer"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>Analytics</span>
                </button>
              </div>
            </section>

            {isHydrating ? (
              <DashboardSkeleton />
            ) : (
              <>
                {/* 4 Sleek Frosted Glass KPI Stat Cards */}
                <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="rounded-xl border border-black/[0.08] bg-white/80 p-5 backdrop-blur-md transition-all duration-200 hover:-translate-y-[1px] hover:border-black/15 dark:border-white/[0.07] dark:bg-[#121215]/75 dark:hover:border-white/15">
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Questions Attempted
                    </div>
                    <div className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#09090B] dark:text-white">
                      {globalStats.totalAttempted}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {globalStats.totalCorrect} correct · {globalStats.totalBankCount} in bank
                    </div>
                  </div>

                  <div className="rounded-xl border border-black/[0.08] bg-white/80 p-5 backdrop-blur-md transition-all duration-200 hover:-translate-y-[1px] hover:border-black/15 dark:border-white/[0.07] dark:bg-[#121215]/75 dark:hover:border-white/15">
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Overall Accuracy
                    </div>
                    <div className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#09090B] dark:text-white">
                      {globalStats.accuracyRate}%
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {globalStats.totalAttempted} questions attempted
                    </div>
                  </div>

                  <div className="rounded-xl border border-black/[0.08] bg-white/80 p-5 backdrop-blur-md transition-all duration-200 hover:-translate-y-[1px] hover:border-black/15 dark:border-white/[0.07] dark:bg-[#121215]/75 dark:hover:border-white/15">
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Tests Completed
                    </div>
                    <div className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#09090B] dark:text-white">
                      {globalStats.testsCompleted}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      ICAP passing mark: 50%
                    </div>
                  </div>

                  <div className="rounded-xl border border-black/[0.08] bg-white/80 p-5 backdrop-blur-md transition-all duration-200 hover:-translate-y-[1px] hover:border-black/15 dark:border-white/[0.07] dark:bg-[#121215]/75 dark:hover:border-white/15">
                    <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      <span>Study Streak</span>
                      <Flame className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                    </div>
                    <div className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#09090B] dark:text-white">
                      {globalStats.streakDays} {globalStats.streakDays === 1 ? 'Day' : 'Days'}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Active practice sessions
                    </div>
                  </div>
                </section>

                {/* 4 PRC Subject Module Cards (Linear Project Card Style) */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-semibold tracking-tight text-[#09090B] dark:text-white">
                      Subject Modules
                    </h2>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      4 ICAP PRC papers
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {SUBJECTS.map((subj) => {
                      const questions = allQuestionsBySubject[subj.id] || [];
                      let subjAttempts = 0;
                      let subjCorrect = 0;

                      questions.forEach((q) => {
                        const stat = mastery[q.id];
                        if (stat) {
                          subjAttempts += stat.attempts;
                          subjCorrect += stat.correct;
                        }
                      });

                      const subjAccuracy =
                        subjAttempts > 0 ? Math.round((subjCorrect / subjAttempts) * 100) : 0;

                      return (
                        <div
                          key={subj.id}
                          className="flex flex-col justify-between rounded-xl border border-black/[0.08] bg-white/80 p-5 backdrop-blur-md transition-all duration-200 hover:-translate-y-[1px] hover:border-black/[0.15] dark:border-white/[0.07] dark:bg-[#121215]/75 dark:hover:border-white/15"
                        >
                          <div>
                            {/* Top row: Small pill badge PRC 1 on left, 5 Chapters · 10 MCQs on right */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center rounded-md border border-black/[0.08] bg-zinc-100 px-2 py-0.5 text-xs font-medium text-[#09090B] dark:border-white/[0.08] dark:bg-zinc-800/90 dark:text-zinc-200">
                                {subj.code}
                              </span>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                {subj.chapters.length} Chapters · {questions.length} MCQs
                              </span>
                            </div>

                            {/* Title */}
                            <h3 className="mt-3 font-display text-lg font-semibold tracking-tight text-[#09090B] dark:text-white">
                              {subj.shortTitle}
                            </h3>
                          </div>

                          {/* Bottom section: Thin progress bar + Accuracy text on left, compact Start Test → button on right */}
                          <div className="mt-5 flex items-center justify-between gap-5 pt-2">
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                {subjAttempts > 0
                                  ? `${subjAccuracy}% Accuracy · ${subjCorrect}/${subjAttempts} Correct`
                                  : '0% Accuracy · 0 Attempted'}
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                                <div
                                  className="h-full rounded-full bg-[#6366F1] transition-all duration-700 ease-out"
                                  style={{
                                    width: `${
                                      barsMounted && subjAttempts > 0
                                        ? Math.min(100, Math.max(4, subjAccuracy))
                                        : 0
                                    }%`,
                                  }}
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => launchSimulator(subj.id, null, null)}
                              className="shrink-0 rounded-lg border border-black/[0.08] bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition-all hover:bg-zinc-800 dark:border-white/[0.08] dark:bg-white dark:text-black dark:hover:bg-zinc-200 cursor-pointer"
                            >
                              Start Test →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Compact Recent Test History List */}
                <section className="rounded-xl border border-black/[0.08] bg-white/80 p-5 backdrop-blur-md dark:border-white/[0.07] dark:bg-[#121215]/75">
                  <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.06]">
                    <div>
                      <h2 className="font-display text-base font-semibold tracking-tight text-[#09090B] dark:text-white">
                        Recent Test History
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Latest completed simulations across PRC modules
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => switchView('analytics')}
                      className="text-xs font-medium text-zinc-600 hover:text-[#09090B] dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      View Analytics →
                    </button>
                  </div>

                  {sessions.length > 0 ? (
                    <div className="mt-2 divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                      {sessions.slice(0, 5).map((sess) => {
                        const subj = SUBJECTS.find((s) => s.id === sess.subjectId) || SUBJECTS[0];
                        const passed = sess.scorePercentage >= subj.passingPercentage;

                        return (
                          <div
                            key={sess.id}
                            className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
                          >
                            <div className="flex items-center gap-3">
                              {passed ? (
                                <CheckCircle2 className="h-4 w-4 text-zinc-900 dark:text-white shrink-0" />
                              ) : (
                                <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
                              )}
                              <div>
                                <span className="font-medium text-[#09090B] dark:text-white">
                                  {subj.code}: {subj.shortTitle}
                                </span>
                                <span className="mx-2 text-zinc-300 dark:text-zinc-700">·</span>
                                <span className="text-zinc-500 dark:text-zinc-400">
                                  {sess.selectedChapters.length === subj.chapters.length
                                    ? 'Full Syllabus'
                                    : `${sess.selectedChapters.length} Chapter${
                                        sess.selectedChapters.length === 1 ? '' : 's'
                                      }`}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                                <Clock className="h-3 w-3" />
                                {Math.floor(sess.durationSeconds / 60)}m {sess.durationSeconds % 60}s
                              </span>
                              <span className="rounded-md border border-black/[0.08] bg-zinc-100 px-2.5 py-1 font-medium text-[#09090B] dark:border-white/[0.07] dark:bg-zinc-800/80 dark:text-zinc-200">
                                {sess.scorePercentage}% Accuracy · {sess.correctCount}/{sess.totalQuestions}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <BookOpen className="mx-auto h-5 w-5 text-zinc-400" />
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        No tests completed yet. Select "Start Test →" on any subject card above.
                      </p>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        )}

        {activeView === 'simulator' && (
          <div className="animate-view-enter flex-1 flex flex-col">
            <ExamSimulator
              initialSubjectId={simSubjectId}
              initialChapterFilter={simChapterFilter}
              initialSourceFilter={simSourceFilter}
              allQuestionsBySubject={allQuestionsBySubject}
              mastery={mastery}
              onCompleteSession={handleCompleteSession}
              onBackToDashboard={() => switchView('dashboard')}
              onExamActiveChange={setIsExamActive}
              onTriggerLoadingBar={triggerLoadingBar}
            />
          </div>
        )}

        {activeView === 'analytics' && (
          <div className="animate-view-enter">
            <AnalyticsView
              sessions={sessions}
              mastery={mastery}
              allQuestionsBySubject={allQuestionsBySubject}
              onLaunchTargetedDrill={(subjectId, chapterId, source) =>
                launchSimulator(subjectId, chapterId ?? null, source ?? null)
              }
              onResetProgress={handleResetProgress}
            />
          </div>
        )}

        {activeView === 'question-bank' && (
          <div className="animate-view-enter">
            <QuestionBankStudio
              allQuestionsBySubject={allQuestionsBySubject}
              customQuestions={customQuestions}
              onImportQuestions={handleImportQuestions}
              onDeleteCustomQuestion={handleDeleteCustomQuestion}
            />
          </div>
        )}
      </main>

      {/* Native-Feeling Mobile Fixed Bottom Tab Bar (When Not in Active Exam) */}
      {!isFullScreenExam && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-black/[0.08] bg-white/95 px-2 py-1.5 backdrop-blur-md dark:border-white/[0.07] dark:bg-[#09090B]/95"
        >
          <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
            <button
              type="button"
              onClick={() => switchView('dashboard')}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                activeView === 'dashboard'
                  ? 'text-[#09090B] dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => launchSimulator(simSubjectId, null, null)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                activeView === 'simulator'
                  ? 'text-[#09090B] dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <Play className="h-4 w-4" />
              <span>Test Yourself</span>
            </button>

            <button
              type="button"
              onClick={() => switchView('analytics')}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                activeView === 'analytics'
                  ? 'text-[#09090B] dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Analytics</span>
            </button>

            <button
              type="button"
              onClick={() => switchView('question-bank')}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                activeView === 'question-bank'
                  ? 'text-[#09090B] dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <Database className="h-4 w-4" />
              <span>Question Bank</span>
            </button>
          </div>
        </nav>
      )}

      {/* Bold 4-Column Editorial Footer with Giant Cropped CAXIS Watermark (Hidden during active exam) */}
      {!isFullScreenExam && (
        <footer className="mt-20 relative overflow-hidden rounded-t-[2.5rem] border-t border-x border-white/10 bg-gradient-to-b from-[#141418] to-[#09090B] pt-14 pb-0 px-6 sm:px-12">
          {/* Top 4-Column Editorial Grid */}
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 pb-12">
            {/* Column 1: Left Brand & Story (md:col-span-4) */}
            <div className="md:col-span-4">
              <div className="flex items-center gap-3">
                <CAxisLogo
                  containerClassName="h-10 w-10 rounded-xl shadow-[0_0_18px_rgba(255,255,255,0.18)] border-white/20"
                  svgClassName="h-5 w-5"
                />
                <div>
                  <div
                    style={{ fontFamily: "'Syne', sans-serif", letterSpacing: '-0.04em' }}
                    className="caxis-logo text-2xl font-extrabold text-white leading-none"
                  >
                    CAxis
                  </div>
                  <div className="mt-1 text-[10px] tracking-[0.2em] text-zinc-400 font-semibold uppercase">
                    PRACTICE · ANALYZE · QUALIFY
                  </div>
                </div>
              </div>

              <p className="mt-5 text-sm leading-relaxed text-zinc-300">
                CAxis: Precision MCQ testing and real-time accuracy diagnostics built for ICAP
                Chartered Accountancy (PRC) students. Created from scratch while prepping for my
                own PRC exams to replace 400-page PDFs and scattered handouts with a single fast
                testing engine.
              </p>

              <p className="mt-4 text-xs font-semibold text-white">
                Built with precision for CA learners across Pakistan.
              </p>
            </div>

            {/* Column 2: PLATFORM (md:col-span-2) */}
            <div className="md:col-span-2">
              <h3 className="text-[11px] font-bold tracking-[0.15em] text-zinc-500 uppercase mb-4">
                PLATFORM
              </h3>
              <ul className="space-y-3 text-base font-semibold text-zinc-200">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      switchView('dashboard');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Dashboard
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      launchSimulator(simSubjectId, null, null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Test Yourself
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      switchView('analytics');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Deep Analytics
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      switchView('question-bank');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Question Bank
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('caxis:open-pwa-install'));
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Install App
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: MODULES & SOURCES (md:col-span-3) */}
            <div className="md:col-span-3">
              <h3 className="text-[11px] font-bold tracking-[0.15em] text-zinc-500 uppercase mb-4">
                MODULES &amp; SOURCES
              </h3>
              <ul className="space-y-3 text-base font-semibold text-zinc-200">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      launchSimulator('prc-1', null, null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    PRC 1: Accounting
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      launchSimulator('prc-2', null, null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    PRC 2: Quant &amp; Stats
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      launchSimulator('prc-3-v1', null, null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    PRC 3: Business Insights
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      launchSimulator('prc-3-v2', null, null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    PRC 3: Economic Insights
                  </button>
                </li>
              </ul>
              <p className="mt-5 text-[11px] leading-relaxed text-zinc-500">
                Powered by ICAP Self-Tests, Official APQs &amp; Advanced Practice Sets. 100% free
                &amp; offline-ready PWA.
              </p>
            </div>

            {/* Column 4: CREATOR & CONTACT (md:col-span-3) */}
            <div className="md:col-span-3">
              <h3 className="text-[11px] font-bold tracking-[0.15em] text-zinc-500 uppercase mb-4">
                CREATOR &amp; CONTACT
              </h3>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                  DESIGNED &amp; BUILT BY
                </div>
                <div className="text-sm font-bold text-white mt-0.5">Syed Rayyan</div>
              </div>

              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                  EMAIL INQUIRY
                </div>
                <a
                  href="mailto:syedrayyanf1@gmail.com"
                  className="inline-block text-sm font-semibold text-zinc-200 underline decoration-white/20 hover:text-white mt-0.5 transition-colors"
                >
                  syedrayyanf1@gmail.com
                </a>
              </div>

              <div className="mt-3 text-xs text-zinc-500">
                Timezone: Asia/Karachi (PKT) · ICAP PRC Edition
              </div>
            </div>
          </div>

          {/* Divider & Copyright Bar */}
          <div className="max-w-6xl mx-auto border-t border-white/[0.08] py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
            <div>© 2026 CAxis. All rights reserved.</div>
            <div>Independent Community Portal for ICAP PRC Prep • Asia/Karachi (PKT)</div>
          </div>

          {/* Giant Cropped "CAXIS" Watermark Wordmark at the Very Bottom */}
          <div
            aria-hidden="true"
            className="font-display font-black tracking-tighter text-center select-none pointer-events-none leading-[0.75] text-[18vw] sm:text-[16vw] -mb-[3vw] bg-gradient-to-b from-zinc-900/15 via-zinc-900/[0.05] to-transparent dark:from-white/20 dark:via-white/[0.06] dark:to-transparent bg-clip-text text-transparent"
          >
            CAXIS
          </div>
        </footer>
      )}

      <AuthSyncModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(signedInUser) => {
          setUser(signedInUser);
          if (syncedUserIdRef.current !== signedInUser.id) {
            syncedUserIdRef.current = signedInUser.id;
            performCloudMergeAndSync(signedInUser);
          }
        }}
      />

      <OfflineIndicator />
    </div>
  );
}
