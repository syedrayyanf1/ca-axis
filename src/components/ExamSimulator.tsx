import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flag,
  Minus,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Timer,
  XCircle,
} from 'lucide-react';
import {
  areOptionsEqual,
  ExamSessionRecord,
  formatOptionList,
  isMultiSelectQuestion,
  OptionId,
  parseOptionList,
  Question,
  QuestionAttemptRecord,
  QuestionMasteryStat,
  QuestionSource,
  SubjectId,
} from '../types';
import { SUBJECTS } from '../data/subjects';
import { RichContent } from './RichContent';
import { CAxisLogo } from './CAxisLogo';
import { ExamLaunchSkeleton } from './UIFeedback';

interface ExamSimulatorProps {
  initialSubjectId: SubjectId;
  initialChapterFilter?: number | null;
  initialSourceFilter?: QuestionSource | null;
  allQuestionsBySubject: Record<SubjectId, Question[]>;
  mastery: Record<string, QuestionMasteryStat>;
  onCompleteSession: (session: ExamSessionRecord) => void;
  onBackToDashboard: () => void;
  onExamActiveChange?: (isActive: boolean) => void;
  onTriggerLoadingBar?: () => void;
}

type SimulatorStage = 'config' | 'active' | 'results';
type PaceMode = 'icap-standard' | 'speed-drill' | 'relaxed' | 'untimed' | 'custom';
type ReviewFilter = 'all' | 'incorrect' | 'correct' | 'marked' | 'unanswered';

function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Smart "Unseen-First" Question Selection Algorithm:
 * - Bucket 1 (Unseen): Questions never attempted before (shuffled randomly)
 * - Bucket 2 (Previously Incorrect): Questions seen before & got wrong on last attempt (shuffled randomly)
 * - Bucket 3 (Previously Correct): Questions got right, sorted by least-recently attempted first
 */
function selectSmartQuestions(
  pool: Question[],
  count: number,
  mastery: Record<string, QuestionMasteryStat>
): Question[] {
  const unseenBucket: Question[] = [];
  const incorrectBucket: Question[] = [];
  const correctBucket: Question[] = [];

  for (const q of pool) {
    const stat = mastery[q.id];
    if (!stat || stat.attempts === 0) {
      unseenBucket.push(q);
    } else if (!stat.lastOutcomeCorrect) {
      incorrectBucket.push(q);
    } else {
      correctBucket.push(q);
    }
  }

  const shuffledUnseen = shuffleArray(unseenBucket);
  const shuffledIncorrect = shuffleArray(incorrectBucket);
  // Shuffle first so ties with identical session timestamps are broken randomly, then sort oldest first
  const sortedCorrect = shuffleArray(correctBucket).sort((a, b) => {
    const timeA = mastery[a.id]?.lastAttemptedAt
      ? new Date(mastery[a.id].lastAttemptedAt).getTime()
      : 0;
    const timeB = mastery[b.id]?.lastAttemptedAt
      ? new Date(mastery[b.id].lastAttemptedAt).getTime()
      : 0;
    return timeA - timeB;
  });

  return [...shuffledUnseen, ...shuffledIncorrect, ...sortedCorrect].slice(0, count);
}

export const ExamSimulator: React.FC<ExamSimulatorProps> = ({
  initialSubjectId,
  initialChapterFilter = null,
  initialSourceFilter = null,
  allQuestionsBySubject,
  mastery,
  onCompleteSession,
  onBackToDashboard,
  onExamActiveChange,
  onTriggerLoadingBar,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<SubjectId>(initialSubjectId);
  const currentSubject = useMemo(
    () => SUBJECTS.find((s) => s.id === selectedSubjectId) || SUBJECTS[0],
    [selectedSubjectId]
  );

  const [selectedChapters, setSelectedChapters] = useState<number[]>(() =>
    initialChapterFilter ? [initialChapterFilter] : currentSubject.chapters.map((c) => c.id)
  );
  const [selectedSources, setSelectedSources] = useState<QuestionSource[]>(() =>
    initialSourceFilter ? [initialSourceFilter] : ['self-test', 'apq', 'practice-set']
  );

  const [maxQuestionCount, setMaxQuestionCount] = useState<number>(20);
  const [paceMode, setPaceMode] = useState<PaceMode>('icap-standard');
  const [customMinutes, setCustomMinutes] = useState<number>(30);

  useEffect(() => {
    const subj = SUBJECTS.find((s) => s.id === initialSubjectId) || SUBJECTS[0];
    setSelectedSubjectId(initialSubjectId);
    setSelectedChapters(
      initialChapterFilter ? [initialChapterFilter] : subj.chapters.map((c) => c.id)
    );
    setSelectedSources(
      initialSourceFilter ? [initialSourceFilter] : ['self-test', 'apq', 'practice-set']
    );
    setCustomMinutes(subj.defaultDurationMinutes);
  }, [initialSubjectId, initialChapterFilter, initialSourceFilter]);

  const handleSubjectChange = (newSubjectId: SubjectId) => {
    const subj = SUBJECTS.find((s) => s.id === newSubjectId) || SUBJECTS[0];
    setSelectedSubjectId(newSubjectId);
    setSelectedChapters(subj.chapters.map((c) => c.id));
    setCustomMinutes(subj.defaultDurationMinutes);
  };

  const matchingPool = useMemo(() => {
    const subjectPool = allQuestionsBySubject[selectedSubjectId] || [];
    return subjectPool.filter((q) => selectedChapters.includes(q.chapterId));
  }, [allQuestionsBySubject, selectedSubjectId, selectedChapters]);

  const unseenInPoolCount = useMemo(() => {
    return matchingPool.filter((q) => !mastery[q.id] || mastery[q.id].attempts === 0).length;
  }, [matchingPool, mastery]);

  const effectiveQuestionCount = useMemo(() => {
    if (matchingPool.length === 0) return 0;
    return Math.max(1, Math.min(maxQuestionCount, matchingPool.length));
  }, [maxQuestionCount, matchingPool.length]);

  const effectiveDurationMinutes = useMemo(() => {
    if (paceMode === 'untimed') return 0;
    if (paceMode === 'icap-standard') return Math.max(1, Math.ceil(effectiveQuestionCount * 1.5));
    if (paceMode === 'speed-drill') return Math.max(1, effectiveQuestionCount * 1);
    if (paceMode === 'relaxed') return Math.max(1, effectiveQuestionCount * 2);
    return Math.max(1, customMinutes);
  }, [paceMode, effectiveQuestionCount, customMinutes]);

  // Active exam state
  const [stage, setStage] = useState<SimulatorStage>('config');
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [questionTimings, setQuestionTimings] = useState<Record<string, number>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [confirmSubmitModal, setConfirmSubmitModal] = useState<boolean>(false);
  const [completedSession, setCompletedSession] = useState<ExamSessionRecord | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [activeReviewIndex, setActiveReviewIndex] = useState<number | null>(null);
  const [isLaunchingSkeleton, setIsLaunchingSkeleton] = useState<boolean>(false);

  const leftPaneRef = useRef<HTMLDivElement | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onExamActiveChange?.(stage === 'active');
    return () => onExamActiveChange?.(false);
  }, [stage, onExamActiveChange]);

  const activeQuestionIdRef = useRef<string | null>(null);
  const currentQuestion = activeQuestions[currentIndex];

  useEffect(() => {
    activeQuestionIdRef.current = currentQuestion ? currentQuestion.id : null;
    // Reset scroll of question panes when switching questions
    if (leftPaneRef.current) {
      leftPaneRef.current.scrollTop = 0;
    }
    if (mobileScrollRef.current) {
      mobileScrollRef.current.scrollTop = 0;
    }
  }, [currentQuestion]);

  const handleSelectOption = useCallback((question: Question, optId: OptionId) => {
    const multi = isMultiSelectQuestion(question.correctOption);
    setSelectedAnswers((prev) => {
      if (!multi) {
        return { ...prev, [question.id]: optId };
      }
      const existing = parseOptionList(prev[question.id]);
      const next = existing.includes(optId)
        ? existing.filter((item) => item !== optId)
        : [...existing, optId];
      const formatted = formatOptionList(next);
      const copy = { ...prev };
      if (!formatted) {
        delete copy[question.id];
      } else {
        copy[question.id] = formatted;
      }
      return copy;
    });
  }, []);

  const startExam = () => {
    if (matchingPool.length === 0) return;
    onTriggerLoadingBar?.();
    const subset = selectSmartQuestions(matchingPool, effectiveQuestionCount, mastery);
    setActiveQuestions(subset);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setFlaggedQuestions({});
    setQuestionTimings({});
    setElapsedSeconds(0);
    setRemainingSeconds(effectiveDurationMinutes * 60);
    setConfirmSubmitModal(false);
    setCompletedSession(null);
    setIsLaunchingSkeleton(true);
    setStage('active');
    window.setTimeout(() => {
      setIsLaunchingSkeleton(false);
    }, 200);
  };

  const finalizeExam = () => {
    const records: QuestionAttemptRecord[] = activeQuestions.map((q) => {
      const picked = selectedAnswers[q.id] ?? null;
      const normCorrect = formatOptionList(parseOptionList(q.correctOption));
      return {
        questionId: q.id,
        subjectId: q.subjectId,
        chapterId: q.chapterId,
        source: q.source,
        selectedOption: picked,
        correctOption: normCorrect,
        isCorrect: areOptionsEqual(picked, normCorrect),
        flagged: !!flaggedQuestions[q.id],
        timeSpentSeconds: questionTimings[q.id] || 0,
      };
    });

    const attemptedCount = records.filter((r) => r.selectedOption !== null).length;
    const correctCount = records.filter((r) => r.isCorrect).length;
    const scorePercentage =
      activeQuestions.length > 0 ? Math.round((correctCount / activeQuestions.length) * 100) : 0;

    const session: ExamSessionRecord = {
      id: `sim-${Date.now()}`,
      timestamp: new Date().toISOString(),
      subjectId: selectedSubjectId,
      totalQuestions: activeQuestions.length,
      attemptedCount,
      correctCount,
      scorePercentage,
      durationSeconds: elapsedSeconds,
      timeLimitSeconds: effectiveDurationMinutes * 60,
      selectedChapters,
      selectedSources,
      records,
    };

    onTriggerLoadingBar?.();
    setCompletedSession(session);
    setConfirmSubmitModal(false);
    setReviewFilter('all');
    setActiveReviewIndex(null);
    setStage('results');
    onCompleteSession(session);
  };

  // Timer effect during active exam
  useEffect(() => {
    if (stage !== 'active') return;

    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
      const qId = activeQuestionIdRef.current;
      if (qId) {
        setQuestionTimings((prev) => ({
          ...prev,
          [qId]: (prev[qId] || 0) + 1,
        }));
      }

      if (paceMode !== 'untimed') {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            window.clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [stage, paceMode]);

  // Auto-submit when timer hits 0 (only when timed)
  useEffect(() => {
    if (
      stage === 'active' &&
      paceMode !== 'untimed' &&
      remainingSeconds === 0 &&
      activeQuestions.length > 0
    ) {
      finalizeExam();
    }
  }, [remainingSeconds, stage, paceMode, activeQuestions.length]);

  // Keyboard shortcuts during active exam
  useEffect(() => {
    if (stage !== 'active' || !currentQuestion) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toUpperCase();
      if (key === 'A' || key === '1') {
        handleSelectOption(currentQuestion, 'A');
      } else if (key === 'B' || key === '2') {
        handleSelectOption(currentQuestion, 'B');
      } else if (key === 'C' || key === '3') {
        handleSelectOption(currentQuestion, 'C');
      } else if (key === 'D' || key === '4') {
        handleSelectOption(currentQuestion, 'D');
      } else if (key === 'F') {
        setFlaggedQuestions((prev) => ({
          ...prev,
          [currentQuestion.id]: !prev[currentQuestion.id],
        }));
      } else if (e.key === 'ArrowRight' && currentIndex < activeQuestions.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    stage,
    currentQuestion,
    currentIndex,
    activeQuestions.length,
    handleSelectOption,
  ]);

  const toggleChapter = (chapterId: number) => {
    setSelectedChapters((prev) =>
      prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId]
    );
  };

  const answeredTotal = Object.keys(selectedAnswers).length;
  const flaggedTotal = Object.values(flaggedQuestions).filter(Boolean).length;

  // STAGE 1: STEP-BY-STEP TEST BUILDER
  if (stage === 'config') {
    const isFullSubjectSelected = selectedChapters.length === currentSubject.chapters.length;
    const presetCounts = [10, 20, 35, 50];

    return (
      <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-[28px] font-bold leading-tight tracking-tight text-[#09090B] dark:text-[#FAFAFA]">
              Test Yourself
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#71717A] dark:text-[#A1A1AA]">
              Smart unseen-first selection prioritizes unattempted questions automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3.5 py-2 text-xs font-medium text-[#09090B] transition-colors hover:bg-zinc-50 dark:border-white/[0.07] dark:bg-[#121215] dark:text-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Overview</span>
          </button>
        </div>

        {/* Step 1: Select Subject */}
        <div className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Step 1 · Choose PRC Subject
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SUBJECTS.map((subj) => {
              const isSelected = subj.id === selectedSubjectId;
              const subjQuestions = allQuestionsBySubject[subj.id] || [];
              const count = subjQuestions.length;
              const unseenSubj = subjQuestions.filter(
                (q) => !mastery[q.id] || mastery[q.id].attempts === 0
              ).length;

              return (
                <button
                  key={subj.id}
                  type="button"
                  onClick={() => handleSubjectChange(subj.id)}
                  className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-zinc-900 bg-white ring-1 ring-zinc-900 dark:border-white dark:bg-[#121215] dark:ring-white'
                      : 'border-black/[0.08] bg-white hover:border-black/[0.15] dark:border-white/[0.07] dark:bg-[#121215] dark:hover:border-white/[0.15]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center rounded-md border border-black/[0.08] bg-zinc-100 px-2 py-0.5 font-medium text-[#09090B] dark:border-white/[0.08] dark:bg-zinc-800 dark:text-zinc-200">
                        {subj.code}
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {unseenSubj} Unseen / {count}
                      </span>
                    </div>
                    <p className="mt-2.5 font-display text-base font-semibold tracking-tight text-[#09090B] dark:text-white">
                      {subj.shortTitle}
                    </p>
                  </div>
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {subj.chapters.length} Chapters · Pass {subj.passingPercentage}%
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Step 2: Select Chapters */}
          <div className="lg:col-span-7 rounded-xl border border-black/[0.08] bg-white/80 p-4 sm:p-6 backdrop-blur-md dark:border-white/[0.07] dark:bg-[#121215]/75">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-black/[0.06] dark:border-white/[0.06]">
              <div>
                <h2 className="font-display text-base font-semibold tracking-tight text-[#09090B] dark:text-white">
                  Step 2 · Select Chapters
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Pick individual chapters or test the full {currentSubject.code} syllabus
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChapters(currentSubject.chapters.map((c) => c.id))}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isFullSubjectSelected
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  Full Subject
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedChapters([])}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {currentSubject.chapters.map((ch) => {
                const checked = selectedChapters.includes(ch.id);
                const chQuestions = (allQuestionsBySubject[selectedSubjectId] || []).filter(
                  (q) => q.chapterId === ch.id
                );
                const chCount = chQuestions.length;
                const chUnseenCount = chQuestions.filter(
                  (q) => !mastery[q.id] || mastery[q.id].attempts === 0
                ).length;

                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleChapter(ch.id)}
                    className={`w-full flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 sm:px-4 sm:py-3 text-left text-sm transition-all cursor-pointer ${
                      checked
                        ? 'border-zinc-900/40 bg-zinc-50 text-[#09090B] dark:border-white/30 dark:bg-zinc-800/50 dark:text-white'
                        : 'border-black/[0.06] bg-white text-zinc-600 hover:bg-zinc-50 dark:border-white/[0.06] dark:bg-[#09090B] dark:text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-[11px] font-semibold transition-colors ${
                          checked
                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                            : 'border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-[#121215]'
                        }`}
                      >
                        {checked ? '✓' : ''}
                      </span>
                      <div className="truncate">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 mr-2">
                          Ch {String(ch.id).padStart(2, '0')}
                        </span>
                        <span className="font-medium">{ch.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {chCount > 0 ? (
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                            chUnseenCount > 0
                              ? 'border-[#6366F1]/30 bg-[#6366F1]/10 text-[#6366F1] dark:border-[#6366F1]/40 dark:bg-[#6366F1]/15 dark:text-indigo-300'
                              : 'border-black/[0.08] bg-zinc-100 text-zinc-600 dark:border-white/[0.08] dark:bg-zinc-800 dark:text-zinc-400'
                          }`}
                        >
                          {chUnseenCount} Unseen / {chCount} Total
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">0 MCQs</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3 & 4: Question Count & Time Allocation */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-black/[0.08] bg-white/80 p-4 sm:p-6 backdrop-blur-md dark:border-white/[0.07] dark:bg-[#121215]/75 space-y-6">
            <div className="space-y-6">
              {/* Step 3: Tactile Question Count Selector */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold tracking-tight text-[#09090B] dark:text-white">
                    Step 3 · Question Count
                  </h2>
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {unseenInPoolCount} Unseen / {matchingPool.length} Total
                  </span>
                </div>

                {/* Quick-Select Pill Buttons + Stepper */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {presetCounts.map((preset) => {
                      const isActive =
                        maxQuestionCount === preset && matchingPool.length >= preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setMaxQuestionCount(preset)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                            isActive
                              ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                              : 'border border-black/[0.08] bg-[#FAFAFA] text-zinc-700 hover:bg-zinc-100 dark:border-white/[0.07] dark:bg-[#09090B] dark:text-zinc-300 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setMaxQuestionCount(Math.max(1, matchingPool.length))}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                        maxQuestionCount >= matchingPool.length && matchingPool.length > 0
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                          : 'border border-black/[0.08] bg-[#FAFAFA] text-zinc-700 hover:bg-zinc-100 dark:border-white/[0.07] dark:bg-[#09090B] dark:text-zinc-300 dark:hover:bg-zinc-800'
                      }`}
                    >
                      All ({matchingPool.length})
                    </button>
                  </div>

                  {/* Direct Number Input & - / + Stepper */}
                  <div className="inline-flex items-center rounded-lg border border-black/[0.08] bg-[#FAFAFA] p-0.5 dark:border-white/[0.07] dark:bg-[#09090B]">
                    <button
                      type="button"
                      onClick={() =>
                        setMaxQuestionCount((prev) =>
                          Math.max(1, Math.min(prev, matchingPool.length) - 1)
                        )
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                      aria-label="Decrease question count"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, matchingPool.length)}
                      value={effectiveQuestionCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!Number.isNaN(val)) {
                          setMaxQuestionCount(Math.max(1, val));
                        }
                      }}
                      className="w-11 bg-transparent text-center text-xs font-semibold text-[#09090B] focus:outline-none dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setMaxQuestionCount((prev) =>
                          Math.min(Math.max(1, matchingPool.length), prev + 1)
                        )
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                      aria-label="Increase question count"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Smart Selection Indicator */}
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <Sparkles className="h-3 w-3 text-[#6366F1] shrink-0" />
                  <span>
                    {unseenInPoolCount >= effectiveQuestionCount
                      ? `All ${effectiveQuestionCount} questions will be drawn fresh from ${unseenInPoolCount} unseen MCQs.`
                      : unseenInPoolCount > 0
                        ? `Draws all ${unseenInPoolCount} unseen MCQs first, then ${effectiveQuestionCount - unseenInPoolCount} review MCQs.`
                        : 'All questions in this pool have been seen; prioritizes previously incorrect & oldest first.'}
                  </span>
                </div>
              </div>

              {/* Step 4: Time Allocation Segmented Toggle Cards */}
              <div className="border-t border-black/[0.06] pt-5 dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold tracking-tight text-[#09090B] dark:text-white">
                    Step 4 · Time Allocation
                  </h2>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    <Timer className="h-3.5 w-3.5" />
                    <span>
                      {paceMode === 'untimed'
                        ? 'Untimed Mode'
                        : `${effectiveDurationMinutes} min total`}
                    </span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      id: 'icap-standard' as PaceMode,
                      title: 'ICAP Exam Pace',
                      sub: '1.5m / Question',
                    },
                    {
                      id: 'speed-drill' as PaceMode,
                      title: 'Speed Drill',
                      sub: '1.0m / Question',
                    },
                    {
                      id: 'relaxed' as PaceMode,
                      title: 'Relaxed Pace',
                      sub: '2.0m / Question',
                    },
                    {
                      id: 'untimed' as PaceMode,
                      title: 'Untimed',
                      sub: 'No countdown limit',
                    },
                  ].map((card) => {
                    const active = paceMode === card.id;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => setPaceMode(card.id)}
                        className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all cursor-pointer ${
                          active
                            ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900 dark:border-white dark:bg-zinc-800/60 dark:ring-white'
                            : 'border-black/[0.08] bg-[#FAFAFA] hover:bg-zinc-100/70 dark:border-white/[0.07] dark:bg-[#09090B] dark:hover:bg-zinc-900'
                        }`}
                      >
                        <span className="text-xs font-semibold text-[#09090B] dark:text-white">
                          {card.title}
                        </span>
                        <span className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                          {card.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Minutes Row */}
                <div
                  onClick={() => setPaceMode('custom')}
                  className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 transition-all cursor-pointer ${
                    paceMode === 'custom'
                      ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900 dark:border-white dark:bg-zinc-800/60 dark:ring-white'
                      : 'border-black/[0.08] bg-[#FAFAFA] dark:border-white/[0.07] dark:bg-[#09090B]'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold text-[#09090B] dark:text-white">
                      Custom Timer (Minutes)
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Set exact duration manually
                    </div>
                  </div>

                  <div
                    className="inline-flex items-center rounded-md border border-black/[0.08] bg-white p-0.5 dark:border-white/[0.07] dark:bg-[#121215]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setPaceMode('custom');
                        setCustomMinutes((m) => Math.max(1, m - 5));
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-12 text-center text-xs font-semibold text-[#09090B] dark:text-white">
                      {customMinutes}m
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPaceMode('custom');
                        setCustomMinutes((m) => Math.min(180, m + 5));
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={matchingPool.length === 0}
              onClick={startExam}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>
                Start Test ({effectiveQuestionCount} MCQs ·{' '}
                {paceMode === 'untimed' ? 'Untimed' : `${effectiveDurationMinutes}m`})
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STAGE 2: ZERO-SCROLL SPLIT-SCREEN ACTIVE EXAM WORKSPACE (DESKTOP) + FULL-VIEWPORT MOBILE EXAM LAYOUT
  if (stage === 'active' && currentQuestion) {
    if (isLaunchingSkeleton) {
      return <ExamLaunchSkeleton />;
    }

    const selectedRaw = selectedAnswers[currentQuestion.id] || null;
    const selectedOptionSet = new Set(parseOptionList(selectedRaw));
    const isMulti = isMultiSelectQuestion(currentQuestion.correctOption);
    const isFlagged = !!flaggedQuestions[currentQuestion.id];
    const isLowTime = paceMode !== 'untimed' && remainingSeconds <= 120;

    const getQuestionTileClasses = (q: Question, idx: number, sizeClass: string) => {
      const isCurrent = idx === currentIndex;
      const isAns = !!selectedAnswers[q.id];
      const isFlg = !!flaggedQuestions[q.id];

      let colorClass =
        'bg-zinc-100 text-zinc-600 border border-black/[0.08] hover:border-black/[0.2] dark:bg-zinc-800/80 dark:text-zinc-400 dark:border-white/[0.07] dark:hover:border-white/[0.2]';
      if (isFlg) {
        colorClass =
          'bg-amber-100 text-amber-800 border border-amber-400 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/50';
      } else if (isAns) {
        colorClass =
          'bg-emerald-100 text-emerald-800 border border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/50';
      }

      const activeRingClass = isCurrent
        ? 'ring-2 ring-zinc-900 dark:ring-white ring-offset-1 ring-offset-white dark:ring-offset-[#09090B]'
        : '';

      return `${sizeClass} rounded-lg text-xs font-semibold flex items-center justify-center shrink-0 transition-all cursor-pointer ${colorClass} ${activeRingClass}`;
    };

    return (
      <div className="relative flex flex-col w-full h-dvh md:h-full overflow-hidden">
        {/* =====================================================================
            MOBILE EXAM LAYOUT (< 768px): Strict h-dvh flex-col overflow-hidden
           ===================================================================== */}
        <div className="md:hidden h-dvh w-full flex flex-col bg-transparent overflow-hidden">
          {/* Top Fixed Header */}
          <div className="shrink-0 px-3 pt-2.5 pb-2 border-b border-black/[0.08] bg-white/80 backdrop-blur-md dark:border-white/[0.07] dark:bg-[#09090B]/75">
            {/* Row 1: CAxis Logo + PRC 1 · 1/20 on left; compact Timer pill and Submit button on right */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CAxisLogo containerClassName="h-6 w-6" svgClassName="h-4 w-4" />
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-display text-sm font-bold tracking-tight text-[#09090B] dark:text-white">
                    {currentSubject.code}
                  </span>
                  <span className="text-zinc-400 dark:text-zinc-600" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-display text-sm font-semibold text-[#09090B] dark:text-white">
                    {currentIndex + 1}/{activeQuestions.length}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <div
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 font-mono text-xs font-medium tabular-nums ${
                    isLowTime
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : 'border-black/[0.08] bg-[#FAFAFA] text-[#09090B] dark:border-white/[0.07] dark:bg-[#121215] dark:text-white'
                  }`}
                >
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>
                    {paceMode === 'untimed'
                      ? formatSeconds(elapsedSeconds)
                      : formatSeconds(remainingSeconds)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmSubmitModal(true)}
                  className="rounded-lg bg-zinc-900 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 cursor-pointer"
                >
                  Submit
                </button>
              </div>
            </div>

            {/* Row 2: Horizontal swipeable row of numbered, color-coded Question Tiles (w-7 h-7) */}
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-0.5">
              {activeQuestions.map((q, idx) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={getQuestionTileClasses(q, idx, 'w-7 h-7')}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Middle Scrollable Content Area (No double nested cards on mobile) */}
          <div
            ref={mobileScrollRef}
            key={`mobile-q-${currentQuestion.id}`}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-3 animate-question-enter"
          >
            {/* Single Compact Metadata Line */}
            <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium truncate">
                {currentQuestion.chapterName}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {isMulti && (
                  <span className="rounded-md border border-[#6366F1]/40 bg-[#6366F1]/10 px-2 py-0.5 text-[11px] font-medium text-[#6366F1] dark:border-[#6366F1]/50 dark:bg-[#6366F1]/15 dark:text-indigo-300">
                    Select all that apply
                  </span>
                )}
                {selectedRaw && (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedAnswers((prev) => {
                        const copy = { ...prev };
                        delete copy[currentQuestion.id];
                        return copy;
                      })
                    }
                    className="text-[11px] font-medium text-zinc-500 underline dark:text-zinc-400 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Question Text */}
            <div className="text-[15px] leading-relaxed text-[#09090B] dark:text-zinc-100">
              <RichContent content={currentQuestion.questionText} />
            </div>

            {/* Options A, B, C, D */}
            <div className="space-y-2 pt-1">
              {currentQuestion.options.map((opt) => {
                const isChosen = selectedOptionSet.has(opt.id);

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectOption(currentQuestion, opt.id)}
                    className={`w-full flex items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm active:scale-[0.985] transition-all duration-150 cursor-pointer ${
                      isChosen
                        ? 'border-zinc-900 bg-zinc-100 ring-1 ring-zinc-900 dark:border-white dark:bg-zinc-800/80 dark:ring-white'
                        : 'border-black/[0.08] bg-white dark:border-white/[0.07] dark:bg-[#121215]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold transition-all duration-150 ${
                          isChosen
                            ? 'scale-105 bg-zinc-900 text-white dark:bg-white dark:text-black'
                            : 'scale-100 border border-black/[0.08] bg-zinc-100 text-zinc-700 dark:border-white/[0.07] dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {opt.id}
                      </span>
                      <div className="text-sm font-medium text-[#09090B] dark:text-[#FAFAFA] min-w-0">
                        <RichContent content={opt.text} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Fixed Action Bar */}
          <div className="shrink-0 px-3 py-2.5 border-t border-black/[0.08] bg-white dark:border-white/[0.07] dark:bg-[#09090B] grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-black/[0.08] bg-white px-3 py-2.5 text-xs font-semibold text-[#09090B] disabled:opacity-40 dark:border-white/[0.07] dark:bg-[#121215] dark:text-zinc-200 cursor-pointer"
            >
              <span>← Prev</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setFlaggedQuestions((prev) => ({
                  ...prev,
                  [currentQuestion.id]: !prev[currentQuestion.id],
                }))
              }
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                isFlagged
                  ? 'border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-400'
                  : 'border-black/[0.08] bg-white text-zinc-600 dark:border-white/[0.07] dark:bg-[#121215] dark:text-zinc-300'
              }`}
            >
              <Flag className={`h-3.5 w-3.5 ${isFlagged ? 'fill-current' : ''}`} />
              <span>{isFlagged ? 'Marked' : 'Mark'}</span>
            </button>

            {currentIndex < activeQuestions.length - 1 ? (
              <button
                type="button"
                onClick={() =>
                  setCurrentIndex((i) => Math.min(activeQuestions.length - 1, i + 1))
                }
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-zinc-900 px-3 py-2.5 text-xs font-semibold text-white dark:bg-white dark:text-black cursor-pointer"
              >
                <span>Next →</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmSubmitModal(true)}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-zinc-900 px-3 py-2.5 text-xs font-semibold text-white dark:bg-white dark:text-black cursor-pointer"
              >
                <span>Submit</span>
              </button>
            )}
          </div>
        </div>

        {/* =====================================================================
            DESKTOP & TABLET EXAM LAYOUT (>= 768px): Zero-Scroll Split-Screen
           ===================================================================== */}
        <div className="hidden md:flex md:flex-col md:w-full md:h-full md:overflow-hidden md:gap-3.5">
          {/* Compact Exam Header Bar + Color-Coded Question Tiles */}
          <div className="shrink-0 rounded-xl border border-black/[0.08] bg-white/80 px-4 py-2.5 backdrop-blur-md dark:border-white/[0.07] dark:bg-[#121215]/75">
            <div className="flex items-center justify-between gap-2">
              {/* Left: CAxis Logo + Subject Title + Question X of Y */}
              <div className="flex items-center gap-2.5 min-w-0">
                <CAxisLogo containerClassName="h-6 w-6" svgClassName="h-4 w-4" />
                <span className="inline-flex items-center rounded-md border border-black/[0.08] bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-[#09090B] dark:border-white/[0.08] dark:bg-zinc-800 dark:text-white shrink-0">
                  {currentSubject.code}
                </span>
                <span className="font-display text-sm font-semibold text-[#09090B] dark:text-white truncate">
                  {currentSubject.shortTitle}
                </span>
                <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">
                  ·
                </span>
                <span className="font-display text-sm font-semibold text-[#09090B] dark:text-white whitespace-nowrap">
                  Question {currentIndex + 1} of {activeQuestions.length}
                </span>
              </div>

              {/* Right: Mark Toggle, Countdown Timer, Submit */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setFlaggedQuestions((prev) => ({
                      ...prev,
                      [currentQuestion.id]: !prev[currentQuestion.id],
                    }))
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                    isFlagged
                      ? 'border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-400'
                      : 'border-black/[0.08] bg-white text-zinc-600 hover:bg-zinc-50 dark:border-white/[0.07] dark:bg-[#121215] dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                  title="Mark for Review (Shortcut: F)"
                >
                  <Flag className={`h-3.5 w-3.5 ${isFlagged ? 'fill-current' : ''}`} />
                  <span>{isFlagged ? 'Marked' : 'Mark'}</span>
                </button>

                {/* Live Exam Countdown Timer: strictly JetBrains Mono */}
                <div
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-sm font-medium tabular-nums ${
                    isLowTime
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : 'border-black/[0.08] bg-[#FAFAFA] text-[#09090B] dark:border-white/[0.07] dark:bg-[#09090B] dark:text-white'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {paceMode === 'untimed'
                      ? formatSeconds(elapsedSeconds)
                      : formatSeconds(remainingSeconds)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmSubmitModal(true)}
                  className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Submit Exam
                </button>
              </div>
            </div>

            {/* Color-Coded Numbered Question Tiles (w-7 h-7 sm:w-8 sm:h-8) */}
            <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-0.5">
              {activeQuestions.map((q, idx) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  title={`Go to Question ${idx + 1}${
                    flaggedQuestions[q.id]
                      ? ' (Flagged)'
                      : selectedAnswers[q.id]
                        ? ' (Solved)'
                        : ''
                  }`}
                  className={getQuestionTileClasses(q, idx, 'w-7 h-7 sm:w-8 sm:h-8')}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Two-Column Side-by-Side Stage on Desktop (grid-cols-12) */}
          <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
            {/* LEFT COLUMN (7 cols): Question Stem, Numbered Statements, and Accounting Tables */}
            <div
              ref={leftPaneRef}
              className="col-span-7 flex flex-col rounded-xl border border-black/[0.08] bg-white/80 p-5 h-full overflow-y-auto backdrop-blur-md dark:border-white/[0.07] dark:bg-[#121215]/75"
            >
              <div key={`desktop-stem-${currentQuestion.id}`} className="flex flex-col flex-1 animate-question-enter">
                {/* Compact Question Metadata Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-black/[0.06] dark:border-white/[0.06] text-xs text-zinc-500 dark:text-zinc-400">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#09090B] dark:text-white">
                      {currentQuestion.id}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{currentQuestion.chapterName}</span>
                  </div>

                  {isMulti && (
                    <span className="rounded-md border border-[#6366F1]/40 bg-[#6366F1]/10 px-2 py-0.5 text-[11px] font-medium text-[#6366F1] dark:border-[#6366F1]/50 dark:bg-[#6366F1]/15 dark:text-indigo-300">
                      Select all that apply
                    </span>
                  )}
                </div>

                {/* Question Stem */}
                <div className="mt-4 text-[15px] leading-relaxed flex-1">
                  <RichContent content={currentQuestion.questionText} />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN (5 cols): Options A, B, C, D at Same Eye Level + Prev/Next Controls */}
            <div className="col-span-5 flex flex-col justify-between rounded-xl border border-black/[0.08] bg-white/80 p-5 h-full overflow-y-auto backdrop-blur-md dark:border-white/[0.07] dark:bg-[#121215]/75">
              <div key={`desktop-opts-${currentQuestion.id}`} className="space-y-3 animate-question-enter">
                <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.06] dark:border-white/[0.06]">
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {isMulti ? 'Select All Correct Options' : 'Select Answer'}
                  </span>
                  {selectedRaw && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedAnswers((prev) => {
                          const copy = { ...prev };
                          delete copy[currentQuestion.id];
                          return copy;
                        })
                      }
                      className="text-xs font-medium text-zinc-500 hover:text-[#09090B] dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                    >
                      Clear Choice
                    </button>
                  )}
                </div>

                {/* Tactile Option Cards (A, B, C, D) */}
                <div className="space-y-2.5">
                  {currentQuestion.options.map((opt) => {
                    const isChosen = selectedOptionSet.has(opt.id);

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectOption(currentQuestion, opt.id)}
                        className={`group w-full flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left text-sm active:scale-[0.985] transition-all duration-150 cursor-pointer ${
                          isChosen
                            ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900 dark:border-white dark:bg-zinc-800/60 dark:ring-white'
                            : 'border-black/[0.08] bg-white hover:border-black/[0.15] hover:bg-zinc-50/60 dark:border-white/[0.07] dark:bg-[#121215] dark:hover:border-white/[0.15] dark:hover:bg-zinc-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold transition-all duration-150 ${
                              isChosen
                                ? 'scale-105 bg-zinc-900 text-white dark:bg-white dark:text-black'
                                : 'scale-100 border border-black/[0.08] bg-zinc-100 text-zinc-700 dark:border-white/[0.07] dark:bg-zinc-800 dark:text-zinc-300'
                            }`}
                          >
                            {opt.id}
                          </span>
                          <div className="text-sm font-medium text-[#09090B] dark:text-[#FAFAFA] min-w-0">
                            <RichContent content={opt.text} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Desktop Navigation Controls Right Below Options A–D */}
              <div className="pt-4 mt-4 border-t border-black/[0.06] dark:border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-4 py-2.5 text-xs font-medium text-[#09090B] transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-white/[0.07] dark:bg-[#09090B] dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Previous Question</span>
                  </button>

                  {currentIndex < activeQuestions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentIndex((i) => Math.min(activeQuestions.length - 1, i + 1))
                      }
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 cursor-pointer"
                    >
                      <span>Next Question</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmSubmitModal(true)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 cursor-pointer"
                    >
                      <span>Finish &amp; Submit</span>
                    </button>
                  )}
                </div>

                <p className="text-center text-[11px] text-zinc-400 dark:text-zinc-500">
                  Shortcuts: A–D to select · ←/→ to navigate · F to flag
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Confirmation Modal */}
        {confirmSubmitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-xl border border-black/[0.08] bg-white p-6 shadow-xl dark:border-white/[0.07] dark:bg-[#121215]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/[0.08] bg-zinc-100 text-zinc-900 dark:border-white/[0.07] dark:bg-zinc-800 dark:text-white">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold tracking-tight text-[#09090B] dark:text-white">
                    Submit Exam Simulation?
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Check your progress before grading
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2.5 rounded-lg border border-black/[0.08] bg-[#FAFAFA] p-3.5 text-center dark:border-white/[0.07] dark:bg-[#09090B]">
                <div>
                  <div className="font-display text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                    {answeredTotal}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Answered</div>
                </div>
                <div>
                  <div className="font-display text-lg font-semibold text-zinc-600 dark:text-zinc-300">
                    {activeQuestions.length - answeredTotal}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Unanswered</div>
                </div>
                <div>
                  <div className="font-display text-lg font-semibold text-amber-600 dark:text-amber-400">
                    {flaggedTotal}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Flagged</div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmSubmitModal(false)}
                  className="rounded-lg border border-black/[0.08] px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-white/[0.07] dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Keep Working
                </button>
                <button
                  type="button"
                  onClick={finalizeExam}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 cursor-pointer"
                >
                  Confirm &amp; Grade
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // STAGE 3: POST-EXAM RESULTS & REVIEW (NO EXPLANATIONS — ONLY QUESTION + 4 OPTIONS)
  if (stage === 'results' && completedSession) {
    const passed = completedSession.scorePercentage >= currentSubject.passingPercentage;

    const recordByQuestionId = new Map<string, QuestionAttemptRecord>();
    for (const r of completedSession.records) {
      recordByQuestionId.set(r.questionId, r);
    }

    const correctCount = completedSession.correctCount;
    const unansweredCount =
      completedSession.totalQuestions - completedSession.attemptedCount;
    const incorrectCount =
      completedSession.attemptedCount - completedSession.correctCount;
    const markedCount = completedSession.records.filter((r) => r.flagged).length;

    const jumpToReviewQuestion = (idx: number) => {
      setActiveReviewIndex(idx);
      const scrollNow = () => {
        const el = document.getElementById(`review-question-${idx}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };
      if (reviewFilter !== 'all') {
        setReviewFilter('all');
        window.setTimeout(scrollNow, 60);
      } else {
        scrollNow();
      }
    };

    const filteredReviewQuestions = activeQuestions
      .map((q, idx) => ({ q, idx, rec: recordByQuestionId.get(q.id) }))
      .filter(({ rec }) => {
        if (reviewFilter === 'correct') return !!rec?.isCorrect;
        if (reviewFilter === 'incorrect')
          return rec?.selectedOption !== null && !rec?.isCorrect;
        if (reviewFilter === 'marked') return !!rec?.flagged;
        if (reviewFilter === 'unanswered') return rec?.selectedOption === null;
        return true;
      });

    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-black/[0.08] bg-white p-4 sm:p-6 dark:border-white/[0.07] dark:bg-[#121215]">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/[0.06] pb-5 dark:border-white/[0.06]">
            <div className="flex items-center gap-3.5">
              <CAxisLogo containerClassName="h-10 w-10" svgClassName="h-6 w-6" />
              <div>
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium text-[#09090B] dark:text-white">
                    {currentSubject.title}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Passing Standard: {currentSubject.passingPercentage}%</span>
                </div>
                <h1 className="mt-1 font-display text-xl sm:text-2xl font-bold tracking-tight text-[#09090B] dark:text-white">
                  {passed ? 'Examination Passed' : 'Below Passing Threshold'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setStage('config')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3.5 py-2 text-xs font-medium text-[#09090B] hover:bg-zinc-50 dark:border-white/[0.07] dark:bg-[#09090B] dark:text-zinc-200 cursor-pointer"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Configure New Test</span>
              </button>
              <button
                type="button"
                onClick={startExam}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Next Set</span>
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-black/[0.06] bg-[#FAFAFA] p-3.5 sm:p-4 dark:border-white/[0.06] dark:bg-[#09090B]">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Accuracy Score</div>
              <div className="mt-1 font-display text-2xl font-semibold text-[#09090B] dark:text-white">
                {completedSession.scorePercentage}%
              </div>
              <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {completedSession.correctCount} / {completedSession.totalQuestions} Correct
              </div>
            </div>

            <div className="rounded-lg border border-black/[0.06] bg-[#FAFAFA] p-3.5 sm:p-4 dark:border-white/[0.06] dark:bg-[#09090B]">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Verdict</div>
              <div className="mt-1 flex items-center gap-1.5 font-display text-base font-semibold">
                {passed ? (
                  <span className="inline-flex items-center gap-1.5 text-[#09090B] dark:text-white">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>PASS</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                    <XCircle className="h-4 w-4" />
                    <span>FAIL</span>
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {completedSession.attemptedCount} Attempted
              </div>
            </div>

            <div className="rounded-lg border border-black/[0.06] bg-[#FAFAFA] p-3.5 sm:p-4 dark:border-white/[0.06] dark:bg-[#09090B]">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Time Spent</div>
              <div className="mt-1 font-display text-2xl font-semibold text-[#09090B] dark:text-white">
                {formatSeconds(completedSession.durationSeconds)}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Avg{' '}
                {Math.round(
                  completedSession.durationSeconds / Math.max(1, completedSession.totalQuestions)
                )}
                s / MCQ
              </div>
            </div>

            <div className="rounded-lg border border-black/[0.06] bg-[#FAFAFA] p-3.5 sm:p-4 dark:border-white/[0.06] dark:bg-[#09090B]">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Marked for Review</div>
              <div className="mt-1 font-display text-2xl font-semibold text-[#09090B] dark:text-white">
                {markedCount}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Items bookmarked
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Quick-Jump Question Navigator & Filter Bar */}
        <div className="sticky top-14 z-20 rounded-xl border border-black/[0.08] bg-white/95 p-4 backdrop-blur-md dark:border-white/[0.07] dark:bg-[#121215]/95 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-semibold tracking-tight text-[#09090B] dark:text-white">
                Response Breakdown
              </h2>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                · Click any question number to jump
              </span>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all' as ReviewFilter, label: `All (${activeQuestions.length})` },
                { id: 'incorrect' as ReviewFilter, label: `Incorrect (${incorrectCount})` },
                { id: 'correct' as ReviewFilter, label: `Correct (${correctCount})` },
                { id: 'marked' as ReviewFilter, label: `Marked (${markedCount})` },
                ...(unansweredCount > 0
                  ? [{ id: 'unanswered' as ReviewFilter, label: `Unanswered (${unansweredCount})` }]
                  : []),
              ].map((tab) => {
                const isActive = reviewFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setReviewFilter(tab.id)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                        : 'border border-black/[0.08] bg-[#FAFAFA] text-zinc-600 hover:bg-zinc-100 dark:border-white/[0.07] dark:bg-[#09090B] dark:text-zinc-400 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color-Coded Numbered Question Tiles (1 to N) */}
          <div className="flex items-center gap-1.5 overflow-x-auto md:flex-wrap no-scrollbar py-1 px-0.5">
            {activeQuestions.map((q, idx) => {
              const rec = recordByQuestionId.get(q.id);
              const isCorrect = !!rec?.isCorrect;
              const isUnanswered = rec?.selectedOption === null;
              const isMarked = !!rec?.flagged;
              const isSelectedTile = activeReviewIndex === idx;

              let tileColor =
                'bg-zinc-100 text-zinc-600 border border-black/[0.08] dark:bg-zinc-800/80 dark:text-zinc-400 dark:border-white/[0.07]';
              if (isCorrect) {
                tileColor =
                  'bg-emerald-100 text-emerald-800 border border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/50';
              } else if (!isUnanswered) {
                tileColor =
                  'bg-rose-100 text-rose-800 border border-rose-400 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/50';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => jumpToReviewQuestion(idx)}
                  title={`Jump to Question ${idx + 1} (${
                    isCorrect ? 'Correct' : isUnanswered ? 'Unanswered' : 'Incorrect'
                  }${isMarked ? ' · Marked' : ''})`}
                  className={`relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-semibold flex items-center justify-center shrink-0 transition-all cursor-pointer ${tileColor} ${
                    isSelectedTile
                      ? 'ring-2 ring-zinc-900 dark:ring-white ring-offset-1 ring-offset-white dark:ring-offset-[#121215]'
                      : 'hover:opacity-90'
                  }`}
                >
                  <span>{idx + 1}</span>
                  {isMarked && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question & Option Review List (No Explanations) */}
        <div className="space-y-4">
          {filteredReviewQuestions.map(({ q, idx, rec }) => {
            const picked = rec?.selectedOption ?? null;
            const normCorrect = formatOptionList(parseOptionList(q.correctOption));
            const isCorrect = areOptionsEqual(picked, normCorrect);
            const correctSet = new Set(parseOptionList(normCorrect));
            const pickedSet = new Set(parseOptionList(picked));
            const isHighlighted = activeReviewIndex === idx;

            return (
              <div
                key={q.id}
                id={`review-question-${idx}`}
                className={`scroll-mt-44 rounded-xl border bg-white p-4 sm:p-6 dark:bg-[#121215] space-y-4 transition-all ${
                  isHighlighted
                    ? 'border-zinc-900 ring-1 ring-zinc-900 dark:border-white dark:ring-white'
                    : 'border-black/[0.08] dark:border-white/[0.07]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] pb-3 text-xs dark:border-white/[0.06]">
                  <div className="flex flex-wrap items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    <span className="font-semibold text-[#09090B] dark:text-white">
                      Q{idx + 1}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{q.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>{q.chapterName}</span>
                    {rec?.flagged && (
                      <span className="rounded border border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-400">
                        Marked
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium">
                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Correct ({normCorrect})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                        <XCircle className="h-4 w-4" />
                        <span>
                          {picked ? `Your Choice: ${picked}` : 'Unanswered'} · Correct: {normCorrect}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-sm leading-relaxed">
                  <RichContent content={q.questionText} />
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {q.options.map((opt) => {
                    const isOptCorrect = correctSet.has(opt.id);
                    const isOptPicked = pickedSet.has(opt.id);

                    let boxClass =
                      'border-black/[0.08] bg-[#FAFAFA] text-zinc-700 dark:border-white/[0.07] dark:bg-[#09090B] dark:text-zinc-300';
                    if (isOptCorrect) {
                      boxClass =
                        'border-emerald-500/50 bg-emerald-500/10 text-[#09090B] font-medium dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-white';
                    } else if (isOptPicked && !isOptCorrect) {
                      boxClass =
                        'border-rose-500/60 bg-rose-500/10 text-rose-900 dark:border-rose-500/60 dark:bg-rose-950/35 dark:text-rose-200';
                    }

                    return (
                      <div
                        key={opt.id}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-xs ${boxClass}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-semibold ${
                              isOptCorrect
                                ? 'bg-emerald-600 text-white'
                                : isOptPicked
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                            }`}
                          >
                            {opt.id}
                          </span>
                          <div className="flex-1">
                            <RichContent content={opt.text} />
                          </div>
                        </div>

                        {isOptCorrect && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        )}
                        {isOptPicked && !isOptCorrect && (
                          <XCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filteredReviewQuestions.length === 0 && (
            <div className="rounded-xl border border-black/[0.08] bg-white py-10 text-center text-xs text-zinc-500 dark:border-white/[0.07] dark:bg-[#121215] dark:text-zinc-400">
              No questions match the selected filter.
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
