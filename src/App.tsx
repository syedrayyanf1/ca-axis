import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  Moon,
  Play,
  Sun,
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
import { SOURCE_LABELS, SUBJECTS } from './data/subjects';
import {
  addCustomQuestions,
  clearAllProgress,
  deleteCustomQuestion,
  getQuestionsBySubject,
  initializeStorageWithSeed,
  loadCustomQuestions,
  loadThemePreference,
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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadThemePreference());

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveThemePreference(theme);
  }, [theme]);

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

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-[#09090B] antialiased dark:bg-[#09090B] dark:text-[#FAFAFA]">
      {/* Ultra-Clean Top Navigation Bar (h-14) */}
      <header className="sticky top-0 z-30 h-14 border-b border-black/[0.08] bg-white/85 backdrop-blur-md dark:border-white/[0.07] dark:bg-[#09090B]/85">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-6">
          {/* Left: Bold CAxis wordmark in Outfit font with subtle muted slash / PRC */}
          <a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('dashboard');
            }}
            className="flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <span className="font-display text-lg font-bold tracking-tight text-[#09090B] dark:text-white">
              CAxis
            </span>
            <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500">
              / PRC
            </span>
          </a>

          {/* Center: Pill-style segmented navigation tabs */}
          <nav className="flex items-center gap-1 overflow-x-auto rounded-lg border border-black/[0.06] bg-zinc-100/90 p-1 dark:border-white/[0.06] dark:bg-zinc-900/80">
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'dashboard'
                  ? 'bg-white text-[#09090B] shadow-2xs dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => launchSimulator(simSubjectId, null, null)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'simulator'
                  ? 'bg-white text-[#09090B] shadow-2xs dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              Test Yourself
            </button>
            <button
              type="button"
              onClick={() => setActiveView('analytics')}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'analytics'
                  ? 'bg-white text-[#09090B] shadow-2xs dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              Analytics
            </button>
            <button
              type="button"
              onClick={() => setActiveView('question-bank')}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'question-bank'
                  ? 'bg-white text-[#09090B] shadow-2xs dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              Question Bank
            </button>
          </nav>

          {/* Right: Supabase Auth / Cloud Sync Control, Theme Toggle, and Install App */}
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
            />
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/[0.08] bg-white text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-white/[0.07] dark:bg-[#121215] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <PWAInstallButton />
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {activeView === 'dashboard' && (
          <div className="space-y-8">
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
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 whitespace-nowrap cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Test Yourself</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('analytics')}
                  className="inline-flex items-center gap-2 rounded-lg border border-black/[0.08] bg-white px-4 py-2 text-sm font-medium text-[#09090B] transition-colors hover:bg-zinc-50 dark:border-white/[0.07] dark:bg-[#121215] dark:text-[#FAFAFA] dark:hover:bg-zinc-800/80 whitespace-nowrap cursor-pointer"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>Analytics</span>
                </button>
              </div>
            </section>

            {/* 4 Sleek KPI Stat Cards */}
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-black/[0.08] bg-white p-5 dark:border-white/[0.07] dark:bg-[#121215]">
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

              <div className="rounded-xl border border-black/[0.08] bg-white p-5 dark:border-white/[0.07] dark:bg-[#121215]">
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

              <div className="rounded-xl border border-black/[0.08] bg-white p-5 dark:border-white/[0.07] dark:bg-[#121215]">
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

              <div className="rounded-xl border border-black/[0.08] bg-white p-5 dark:border-white/[0.07] dark:bg-[#121215]">
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
                      className="flex flex-col justify-between rounded-xl border border-black/[0.08] bg-white p-5 transition-colors hover:border-black/[0.15] dark:border-white/[0.07] dark:bg-[#121215] dark:hover:border-white/[0.14]"
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
                              className="h-full rounded-full bg-[#6366F1] transition-all duration-300"
                              style={{
                                width: `${subjAttempts > 0 ? Math.min(100, Math.max(4, subjAccuracy)) : 0}%`,
                              }}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => launchSimulator(subj.id, null, null)}
                          className="shrink-0 rounded-lg border border-black/[0.08] bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:border-white/[0.08] dark:bg-white dark:text-black dark:hover:bg-zinc-200 cursor-pointer"
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
            <section className="rounded-xl border border-black/[0.08] bg-white p-5 dark:border-white/[0.07] dark:bg-[#121215]">
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
                  onClick={() => setActiveView('analytics')}
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
                              {sess.selectedSources
                                .map((s) => SOURCE_LABELS[s].shortLabel)
                                .join(', ')}
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
          </div>
        )}

        {activeView === 'simulator' && (
          <ExamSimulator
            initialSubjectId={simSubjectId}
            initialChapterFilter={simChapterFilter}
            initialSourceFilter={simSourceFilter}
            allQuestionsBySubject={allQuestionsBySubject}
            onCompleteSession={handleCompleteSession}
            onBackToDashboard={() => setActiveView('dashboard')}
            onExamActiveChange={setIsExamActive}
          />
        )}

        {activeView === 'analytics' && (
          <AnalyticsView
            sessions={sessions}
            mastery={mastery}
            allQuestionsBySubject={allQuestionsBySubject}
            onLaunchTargetedDrill={(subjectId, chapterId, source) =>
              launchSimulator(subjectId, chapterId ?? null, source ?? null)
            }
            onResetProgress={handleResetProgress}
          />
        )}

        {activeView === 'question-bank' && (
          <QuestionBankStudio
            allQuestionsBySubject={allQuestionsBySubject}
            customQuestions={customQuestions}
            onImportQuestions={handleImportQuestions}
            onDeleteCustomQuestion={handleDeleteCustomQuestion}
          />
        )}
      </main>

      {/* Clean Monochrome Footer (Hidden during active full-screen exam simulation) */}
      {!(activeView === 'simulator' && isExamActive) && (
        <footer className="mt-12 border-t border-black/[0.08] bg-white px-6 py-7 dark:border-white/[0.07] dark:bg-[#09090B]">
          <div className="mx-auto flex max-w-6xl flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-bold tracking-tight text-[#09090B] dark:text-white">
                  CAxis
                </span>
                <span className="rounded-md border border-black/[0.08] bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-white/[0.07] dark:bg-zinc-900 dark:text-zinc-400">
                  Offline-Ready PWA
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Precision Testing &amp; Analytics for ICAP PRC
              </p>
            </div>

            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <button
                  type="button"
                  onClick={() => setActiveView('dashboard')}
                  className="hover:text-[#09090B] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => launchSimulator(simSubjectId, null, null)}
                  className="hover:text-[#09090B] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Test Yourself
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('analytics')}
                  className="hover:text-[#09090B] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Analytics
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('question-bank')}
                  className="hover:text-[#09090B] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Question Bank
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                CAxis · Built for Chartered Accountancy Candidates
              </p>
            </div>
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
