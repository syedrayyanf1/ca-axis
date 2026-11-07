import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flag,
  Minus,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Timer,
  XCircle,
} from 'lucide-react';
import {
  ExamSessionRecord,
  OptionId,
  Question,
  QuestionAttemptRecord,
  QuestionSource,
  SubjectId,
} from '../types';
import { SOURCE_LABELS, SUBJECTS } from '../data/subjects';
import { RichContent } from './RichContent';

interface ExamSimulatorProps {
  initialSubjectId: SubjectId;
  initialChapterFilter?: number | null;
  initialSourceFilter?: QuestionSource | null;
  allQuestionsBySubject: Record<SubjectId, Question[]>;
  onCompleteSession: (session: ExamSessionRecord) => void;
  onBackToDashboard: () => void;
  onExamActiveChange?: (isActive: boolean) => void;
}

type SimulatorStage = 'config' | 'active' | 'results';
type PaletteFilter = 'all' | 'unanswered' | 'flagged';
type PaceMode = 'icap-standard' | 'speed-drill' | 'relaxed' | 'untimed' | 'custom';

function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const ExamSimulator: React.FC<ExamSimulatorProps> = ({
  initialSubjectId,
  initialChapterFilter = null,
  initialSourceFilter = null,
  allQuestionsBySubject,
  onCompleteSession,
  onBackToDashboard,
  onExamActiveChange,
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
  const [customMinutes, setCustomMinutes] = useState<number>(25);

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
    return subjectPool.filter(
      (q) => selectedChapters.includes(q.chapterId) && selectedSources.includes(q.source)
    );
  }, [allQuestionsBySubject, selectedSubjectId, selectedChapters, selectedSources]);

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
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, OptionId>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [questionTimings, setQuestionTimings] = useState<Record<string, number>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [paletteFilter, setPaletteFilter] = useState<PaletteFilter>('all');
  const [showPaletteDrawer, setShowPaletteDrawer] = useState<boolean>(true);
  const [confirmSubmitModal, setConfirmSubmitModal] = useState<boolean>(false);
  const [completedSession, setCompletedSession] = useState<ExamSessionRecord | null>(null);

  useEffect(() => {
    onExamActiveChange?.(stage === 'active');
    return () => onExamActiveChange?.(false);
  }, [stage, onExamActiveChange]);

  const activeQuestionIdRef = useRef<string | null>(null);
  const currentQuestion = activeQuestions[currentIndex];

  useEffect(() => {
    activeQuestionIdRef.current = currentQuestion ? currentQuestion.id : null;
  }, [currentQuestion]);

  const startExam = () => {
    if (matchingPool.length === 0) return;
    const subset = matchingPool.slice(0, effectiveQuestionCount);
    setActiveQuestions(subset);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setFlaggedQuestions({});
    setQuestionTimings({});
    setElapsedSeconds(0);
    setRemainingSeconds(effectiveDurationMinutes * 60);
    setPaletteFilter('all');
    setConfirmSubmitModal(false);
    setCompletedSession(null);
    setStage('active');
  };

  const finalizeExam = () => {
    const records: QuestionAttemptRecord[] = activeQuestions.map((q) => {
      const picked = selectedAnswers[q.id] ?? null;
      return {
        questionId: q.id,
        subjectId: q.subjectId,
        chapterId: q.chapterId,
        source: q.source,
        selectedOption: picked,
        correctOption: q.correctOption,
        isCorrect: picked === q.correctOption,
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

    setCompletedSession(session);
    setConfirmSubmitModal(false);
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
        setSelectedAnswers((prev) => ({ ...prev, [currentQuestion.id]: 'A' }));
      } else if (key === 'B' || key === '2') {
        setSelectedAnswers((prev) => ({ ...prev, [currentQuestion.id]: 'B' }));
      } else if (key === 'C' || key === '3') {
        setSelectedAnswers((prev) => ({ ...prev, [currentQuestion.id]: 'C' }));
      } else if (key === 'D' || key === '4') {
        setSelectedAnswers((prev) => ({ ...prev, [currentQuestion.id]: 'D' }));
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
  }, [stage, currentQuestion, currentIndex, activeQuestions.length]);

  const toggleChapter = (chapterId: number) => {
    setSelectedChapters((prev) =>
      prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId]
    );
  };

  const toggleSource = (source: QuestionSource) => {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  const filteredPaletteIndices = useMemo(() => {
    return activeQuestions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => {
        if (paletteFilter === 'unanswered') return !selectedAnswers[q.id];
        if (paletteFilter === 'flagged') return !!flaggedQuestions[q.id];
        return true;
      });
  }, [activeQuestions, paletteFilter, selectedAnswers, flaggedQuestions]);

  const answeredTotal = Object.keys(selectedAnswers).length;
  const flaggedTotal = Object.values(flaggedQuestions).filter(Boolean).length;

  // STAGE 1: STEP-BY-STEP TEST BUILDER
  if (stage === 'config') {
    const isFullSubjectSelected = selectedChapters.length === currentSubject.chapters.length;
    const presetCounts = [10, 20, 35, 50];

    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-[#09090B] dark:text-[#FAFAFA]">
              Test Yourself
            </h1>
            <p className="mt-1 text-sm text-[#71717A] dark:text-[#A1A1AA]">
              Configure subject chapters, question sources, count, and exam pace.
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-4 py-2 text-xs font-medium text-[#09090B] transition-colors hover:bg-zinc-50 dark:border-white/[0.07] dark:bg-[#121215] dark:text-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
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
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {SUBJECTS.map((subj) => {
              const isSelected = subj.id === selectedSubjectId;
              const count = (allQuestionsBySubject[subj.id] || []).length;
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
                        {count} MCQs
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
          <div className="lg:col-span-7 rounded-xl border border-black/[0.08] bg-white p-6 dark:border-white/[0.07] dark:bg-[#121215]">
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
                const chCount = (allQuestionsBySubject[selectedSubjectId] || []).filter(
                  (q) => q.chapterId === ch.id
                ).length;

                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleChapter(ch.id)}
                    className={`w-full flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all cursor-pointer ${
                      checked
                        ? 'border-zinc-900/40 bg-zinc-50 text-[#09090B] dark:border-white/30 dark:bg-zinc-800/50 dark:text-white'
                        : 'border-black/[0.06] bg-white text-zinc-600 hover:bg-zinc-50 dark:border-white/[0.06] dark:bg-[#09090B] dark:text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-[11px] font-semibold transition-colors ${
                          checked
                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                            : 'border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-[#121215]'
                        }`}
                      >
                        {checked ? '✓' : ''}
                      </span>
                      <div>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 mr-2">
                          Ch {String(ch.id).padStart(2, '0')}
                        </span>
                        <span className="font-medium">{ch.name}</span>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                      {chCount} MCQs
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3, 4, 5: Sources, Question Count & Time Allocation */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-black/[0.08] bg-white p-6 dark:border-white/[0.07] dark:bg-[#121215] space-y-6">
            <div className="space-y-6">
              {/* Step 3: Sources */}
              <div>
                <h2 className="font-display text-base font-semibold tracking-tight text-[#09090B] dark:text-white">
                  Step 3 · Question Sources
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Combine official ICAP Self-Tests, APQ, and Practice Sets
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(['self-test', 'apq', 'practice-set'] as QuestionSource[]).map((src) => {
                    const active = selectedSources.includes(src);
                    const count = (allQuestionsBySubject[selectedSubjectId] || []).filter(
                      (q) => q.source === src && selectedChapters.includes(q.chapterId)
                    ).length;
                    return (
                      <button
                        key={src}
                        type="button"
                        onClick={() => toggleSource(src)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                          active
                            ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black'
                            : 'border-black/[0.08] bg-[#FAFAFA] text-zinc-600 hover:bg-zinc-100 dark:border-white/[0.07] dark:bg-[#09090B] dark:text-zinc-400'
                        }`}
                      >
                        <span>{SOURCE_LABELS[src].shortLabel}</span>
                        <span className="opacity-70">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 4: Tactile Question Count Selector */}
              <div className="border-t border-black/[0.06] pt-5 dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold tracking-tight text-[#09090B] dark:text-white">
                    Step 4 · Question Count
                  </h2>
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {effectiveQuestionCount} of {matchingPool.length} available
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
              </div>

              {/* Step 5: Time Allocation Segmented Toggle Cards */}
              <div className="border-t border-black/[0.06] pt-5 dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold tracking-tight text-[#09090B] dark:text-white">
                    Step 5 · Time Allocation
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

  // STAGE 2: CLEAN, FOCUSED ACTIVE EXAM SCREEN
  if (stage === 'active' && currentQuestion) {
    const selectedOpt = selectedAnswers[currentQuestion.id] || null;
    const isFlagged = !!flaggedQuestions[currentQuestion.id];
    const isLowTime = paceMode !== 'untimed' && remainingSeconds <= 120;

    return (
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Top Exam Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-black/[0.08] bg-white px-5 py-3 dark:border-white/[0.07] dark:bg-[#121215]">
          <div className="flex items-center gap-2.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-display font-semibold text-[#09090B] dark:text-white">
              {currentSubject.code} · {currentSubject.shortTitle}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Question {currentIndex + 1} of {activeQuestions.length}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Live Exam Countdown Timer: strictly JetBrains Mono */}
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-sm font-medium tabular-nums ${
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
              onClick={() => setShowPaletteDrawer((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-white/[0.07] dark:bg-[#121215] dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
              title="Toggle Question Palette"
            >
              {showPaletteDrawer ? (
                <PanelRightClose className="h-3.5 w-3.5" />
              ) : (
                <PanelRightOpen className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Palette</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmSubmitModal(true)}
              className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Submit Exam
            </button>
          </div>
        </div>

        {/* Main Centered Stage + Collapsible Question Palette Drawer */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          <div
            className={`${
              showPaletteDrawer ? 'lg:col-span-8' : 'lg:col-span-10 lg:col-start-2'
            } transition-all`}
          >
            <div className="rounded-xl border border-black/[0.08] bg-white p-6 dark:border-white/[0.07] dark:bg-[#121215]">
              {/* Quiet Question Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-black/[0.06] dark:border-white/[0.06] text-xs text-zinc-500 dark:text-zinc-400">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[#09090B] dark:text-white">
                    {currentQuestion.id}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Ch {currentQuestion.chapterId}: {currentQuestion.chapterName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="rounded border border-black/[0.08] bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-white/[0.07] dark:bg-zinc-800 dark:text-zinc-300">
                    {SOURCE_LABELS[currentQuestion.source].shortLabel}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setFlaggedQuestions((prev) => ({
                      ...prev,
                      [currentQuestion.id]: !prev[currentQuestion.id],
                    }))
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    isFlagged
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      : 'border-black/[0.08] text-zinc-600 hover:bg-zinc-50 dark:border-white/[0.07] dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Flag className="h-3.5 w-3.5" />
                  <span>{isFlagged ? 'Flagged' : 'Flag for Review'}</span>
                </button>
              </div>

              {/* Question Stem (with Textbook Accounting Tables & KaTeX) */}
              <div className="mt-6 text-[15px] leading-relaxed">
                <RichContent content={currentQuestion.questionText} />
              </div>

              {/* Tactile Option Cards (A, B, C, D) */}
              <div className="mt-7 space-y-2.5">
                {currentQuestion.options.map((opt) => {
                  const isChosen = selectedOpt === opt.id;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setSelectedAnswers((prev) => ({
                          ...prev,
                          [currentQuestion.id]: opt.id,
                        }))
                      }
                      className={`group w-full flex items-center justify-between gap-4 rounded-xl border p-4 text-left transition-all cursor-pointer ${
                        isChosen
                          ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900 dark:border-white dark:bg-zinc-800/60 dark:ring-white'
                          : 'border-black/[0.08] bg-white hover:border-black/[0.15] hover:bg-zinc-50/60 dark:border-white/[0.07] dark:bg-[#121215] dark:hover:border-white/[0.15] dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold transition-colors ${
                            isChosen
                              ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                              : 'border border-black/[0.08] bg-zinc-100 text-zinc-700 dark:border-white/[0.07] dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          {opt.id}
                        </span>
                        <div className="text-sm font-medium text-[#09090B] dark:text-[#FAFAFA]">
                          <RichContent content={opt.text} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Bottom Navigation Controls */}
              <div className="mt-8 flex items-center justify-between border-t border-black/[0.06] pt-5 dark:border-white/[0.06]">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-4 py-2 text-xs font-medium text-[#09090B] transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-white/[0.07] dark:bg-[#09090B] dark:text-zinc-200 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center gap-2.5">
                  {selectedOpt && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedAnswers((prev) => {
                          const copy = { ...prev };
                          delete copy[currentQuestion.id];
                          return copy;
                        })
                      }
                      className="rounded-lg px-3 py-2 text-xs font-medium text-zinc-500 hover:text-[#09090B] dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                    >
                      Clear Choice
                    </button>
                  )}

                  {currentIndex < activeQuestions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentIndex((i) => Math.min(activeQuestions.length - 1, i + 1))
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 cursor-pointer"
                    >
                      <span>Next</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmSubmitModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-5 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 cursor-pointer"
                    >
                      <span>Finish &amp; Submit</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Question Palette Drawer */}
          {showPaletteDrawer && (
            <div className="lg:col-span-4 rounded-xl border border-black/[0.08] bg-white p-5 dark:border-white/[0.07] dark:bg-[#121215] space-y-5">
              <div>
                <h2 className="font-display text-sm font-semibold tracking-tight text-[#09090B] dark:text-white">
                  Question Palette
                </h2>
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Solved {answeredTotal}</span>
                  <span aria-hidden="true">·</span>
                  <span>Left {activeQuestions.length - answeredTotal}</span>
                  <span aria-hidden="true">·</span>
                  <span>Flagged {flaggedTotal}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 rounded-lg border border-black/[0.06] bg-zinc-100 p-1 dark:border-white/[0.06] dark:bg-zinc-900">
                {(['all', 'unanswered', 'flagged'] as PaletteFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setPaletteFilter(f)}
                    className={`rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors whitespace-nowrap cursor-pointer ${
                      paletteFilter === f
                        ? 'bg-white text-[#09090B] shadow-2xs dark:bg-zinc-800 dark:text-white'
                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-5 gap-2">
                {filteredPaletteIndices.map(({ q, idx }) => {
                  const isCurrent = idx === currentIndex;
                  const isAns = !!selectedAnswers[q.id];
                  const isFlg = !!flaggedQuestions[q.id];

                  let btnClass =
                    'border-black/[0.08] bg-[#FAFAFA] text-zinc-600 hover:border-black/[0.2] dark:border-white/[0.07] dark:bg-[#09090B] dark:text-zinc-400';
                  if (isFlg) {
                    btnClass =
                      'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300';
                  } else if (isAns) {
                    btnClass =
                      'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black';
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`relative flex h-9 items-center justify-center rounded-lg border text-xs font-medium transition-all cursor-pointer ${btnClass} ${
                        isCurrent ? 'ring-2 ring-[#6366F1]' : ''
                      }`}
                    >
                      <span>{idx + 1}</span>
                      {isFlg && (
                        <Flag className="absolute -top-1 -right-1 h-3 w-3 fill-amber-500 text-amber-600" />
                      )}
                    </button>
                  );
                })}
              </div>

              {filteredPaletteIndices.length === 0 && (
                <p className="py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
                  No questions in "{paletteFilter}" view.
                </p>
              )}

              <div className="border-t border-black/[0.06] pt-4 dark:border-white/[0.06] grid grid-cols-2 gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-white" />
                  <span>Answered ({answeredTotal})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>Flagged ({flaggedTotal})</span>
                </div>
              </div>
            </div>
          )}
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
                  <div className="font-display text-lg font-semibold text-[#09090B] dark:text-white">
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

    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-black/[0.08] bg-white p-6 dark:border-white/[0.07] dark:bg-[#121215]">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/[0.06] pb-5 dark:border-white/[0.06]">
            <div>
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-medium text-[#09090B] dark:text-white">
                  {currentSubject.title}
                </span>
                <span aria-hidden="true">·</span>
                <span>Passing Standard: {currentSubject.passingPercentage}%</span>
              </div>
              <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[#09090B] dark:text-white">
                {passed ? 'Examination Passed' : 'Below Passing Threshold'}
              </h1>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setStage('config')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-4 py-2 text-xs font-medium text-[#09090B] hover:bg-zinc-50 dark:border-white/[0.07] dark:bg-[#09090B] dark:text-zinc-200 cursor-pointer"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Configure New Test</span>
              </button>
              <button
                type="button"
                onClick={startExam}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Retake Test</span>
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-black/[0.06] bg-[#FAFAFA] p-4 dark:border-white/[0.06] dark:bg-[#09090B]">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Accuracy Score</div>
              <div className="mt-1 font-display text-2xl font-semibold text-[#09090B] dark:text-white">
                {completedSession.scorePercentage}%
              </div>
              <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {completedSession.correctCount} / {completedSession.totalQuestions} Correct
              </div>
            </div>

            <div className="rounded-lg border border-black/[0.06] bg-[#FAFAFA] p-4 dark:border-white/[0.06] dark:bg-[#09090B]">
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

            <div className="rounded-lg border border-black/[0.06] bg-[#FAFAFA] p-4 dark:border-white/[0.06] dark:bg-[#09090B]">
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

            <div className="rounded-lg border border-black/[0.06] bg-[#FAFAFA] p-4 dark:border-white/[0.06] dark:bg-[#09090B]">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Flagged for Review</div>
              <div className="mt-1 font-display text-2xl font-semibold text-[#09090B] dark:text-white">
                {completedSession.records.filter((r) => r.flagged).length}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Items bookmarked
              </div>
            </div>
          </div>
        </div>

        {/* Question & Option Review List (No Explanations) */}
        <div className="space-y-4">
          <h2 className="font-display text-base font-semibold tracking-tight text-[#09090B] dark:text-white">
            Response Breakdown
          </h2>

          {activeQuestions.map((q, idx) => {
            const rec = completedSession.records.find((r) => r.questionId === q.id);
            const picked = rec?.selectedOption ?? null;
            const isCorrect = picked === q.correctOption;

            return (
              <div
                key={q.id}
                className="rounded-xl border border-black/[0.08] bg-white p-6 dark:border-white/[0.07] dark:bg-[#121215] space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] pb-3 text-xs dark:border-white/[0.06]">
                  <div className="flex flex-wrap items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    <span className="font-semibold text-[#09090B] dark:text-white">
                      Q{idx + 1}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{q.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Ch {q.chapterId}: {q.chapterName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{SOURCE_LABELS[q.source].shortLabel}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium">
                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-[#09090B] dark:text-white">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Correct ({q.correctOption})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                        <XCircle className="h-4 w-4" />
                        <span>
                          {picked ? `Your Choice: ${picked}` : 'Unanswered'} · Correct: {q.correctOption}
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
                    const isOptCorrect = opt.id === q.correctOption;
                    const isOptPicked = opt.id === picked;

                    let boxClass =
                      'border-black/[0.08] bg-[#FAFAFA] text-zinc-700 dark:border-white/[0.07] dark:bg-[#09090B] dark:text-zinc-300';
                    if (isOptCorrect) {
                      boxClass =
                        'border-zinc-900 bg-zinc-100/80 text-[#09090B] font-medium dark:border-white dark:bg-zinc-800/80 dark:text-white';
                    } else if (isOptPicked && !isOptCorrect) {
                      boxClass =
                        'border-rose-500/60 bg-rose-500/10 text-rose-900 dark:border-rose-500/60 dark:bg-rose-950/35 dark:text-rose-200';
                    }

                    return (
                      <div
                        key={opt.id}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-xs ${boxClass}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-semibold ${
                              isOptCorrect
                                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
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
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#09090B] dark:text-white" />
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
        </div>
      </div>
    );
  }

  return null;
};
