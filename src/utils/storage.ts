import { ExamSessionRecord, Question, QuestionMasteryStat, SubjectId } from '../types';
import { getAllStaticQuestions, STATIC_QUESTIONS_BY_SUBJECT } from '../data/subjects';
import { supabase } from '../supabaseClient';

const STORAGE_KEYS = {
  SESSIONS: 'icap_prc_exam_sessions_v2',
  MASTERY: 'icap_prc_question_mastery_v2',
  CUSTOM_QUESTIONS: 'icap_prc_custom_questions_v2',
  THEME: 'icap_prc_theme_v1',
  SEEDED: 'icap_prc_seeded_v2',
};

export interface UserProgressPayload {
  sessions: ExamSessionRecord[];
  mastery: Record<string, QuestionMasteryStat>;
  customQuestions?: Question[];
}

export function loadCustomQuestions(): Question[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_QUESTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomQuestions(questions: Question[]): void {
  localStorage.setItem(STORAGE_KEYS.CUSTOM_QUESTIONS, JSON.stringify(questions));
}

export function addCustomQuestions(newQuestions: Question[]): Question[] {
  const existing = loadCustomQuestions();
  const map = new Map<string, Question>();
  for (const q of existing) map.set(q.id, q);
  for (const q of newQuestions) map.set(q.id, q);
  const merged = Array.from(map.values());
  saveCustomQuestions(merged);
  return merged;
}

export function deleteCustomQuestion(id: string): Question[] {
  const existing = loadCustomQuestions().filter((q) => q.id !== id);
  saveCustomQuestions(existing);
  return existing;
}

export function getQuestionsBySubject(subjectId: SubjectId, customQuestions?: Question[]): Question[] {
  const staticList = STATIC_QUESTIONS_BY_SUBJECT[subjectId] || [];
  const custom = (customQuestions ?? loadCustomQuestions()).filter((q) => q.subjectId === subjectId);
  const map = new Map<string, Question>();
  for (const q of staticList) map.set(q.id, q);
  for (const q of custom) map.set(q.id, q);
  return Array.from(map.values());
}

export function getAllQuestions(customQuestions?: Question[]): Question[] {
  const staticList = getAllStaticQuestions();
  const custom = customQuestions ?? loadCustomQuestions();
  const map = new Map<string, Question>();
  for (const q of staticList) map.set(q.id, q);
  for (const q of custom) map.set(q.id, q);
  return Array.from(map.values());
}

function createInitialSeedData(): {
  sessions: ExamSessionRecord[];
  mastery: Record<string, QuestionMasteryStat>;
} {
  const allQuestions = getAllStaticQuestions();
  const mastery: Record<string, QuestionMasteryStat> = {};

  const sampleSessions: ExamSessionRecord[] = [
    {
      id: 'sim-seed-1',
      timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      subjectId: 'prc-1',
      totalQuestions: 6,
      attemptedCount: 6,
      correctCount: 3,
      scorePercentage: 50,
      durationSeconds: 740,
      timeLimitSeconds: 1200,
      selectedChapters: [1, 2, 3],
      selectedSources: ['self-test', 'apq'],
      records: [
        { questionId: 'PRC1-CH01-ST-001', subjectId: 'prc-1', chapterId: 1, source: 'self-test', selectedOption: 'A', correctOption: 'A', isCorrect: true, flagged: false, timeSpentSeconds: 110 },
        { questionId: 'PRC1-CH01-APQ-002', subjectId: 'prc-1', chapterId: 1, source: 'apq', selectedOption: 'B', correctOption: 'B', isCorrect: true, flagged: false, timeSpentSeconds: 95 },
        { questionId: 'PRC1-CH02-ST-003', subjectId: 'prc-1', chapterId: 2, source: 'self-test', selectedOption: 'B', correctOption: 'A', isCorrect: false, flagged: true, timeSpentSeconds: 160 },
        { questionId: 'PRC1-CH02-PS-004', subjectId: 'prc-1', chapterId: 2, source: 'practice-set', selectedOption: 'A', correctOption: 'A', isCorrect: true, flagged: false, timeSpentSeconds: 105 },
        { questionId: 'PRC1-CH03-APQ-005', subjectId: 'prc-1', chapterId: 3, source: 'apq', selectedOption: 'C', correctOption: 'A', isCorrect: false, flagged: true, timeSpentSeconds: 145 },
        { questionId: 'PRC1-CH03-ST-006', subjectId: 'prc-1', chapterId: 3, source: 'self-test', selectedOption: 'B', correctOption: 'A', isCorrect: false, flagged: false, timeSpentSeconds: 125 },
      ],
    },
    {
      id: 'sim-seed-2',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      subjectId: 'prc-2',
      totalQuestions: 6,
      attemptedCount: 6,
      correctCount: 4,
      scorePercentage: 67,
      durationSeconds: 820,
      timeLimitSeconds: 1200,
      selectedChapters: [1, 2, 3, 4],
      selectedSources: ['self-test', 'apq', 'practice-set'],
      records: [
        { questionId: 'PRC2-CH01-ST-001', subjectId: 'prc-2', chapterId: 1, source: 'self-test', selectedOption: 'C', correctOption: 'C', isCorrect: true, flagged: false, timeSpentSeconds: 130 },
        { questionId: 'PRC2-CH01-APQ-002', subjectId: 'prc-2', chapterId: 1, source: 'apq', selectedOption: 'A', correctOption: 'A', isCorrect: true, flagged: false, timeSpentSeconds: 140 },
        { questionId: 'PRC2-CH02-ST-003', subjectId: 'prc-2', chapterId: 2, source: 'self-test', selectedOption: 'A', correctOption: 'A', isCorrect: true, flagged: false, timeSpentSeconds: 120 },
        { questionId: 'PRC2-CH02-APQ-004', subjectId: 'prc-2', chapterId: 2, source: 'apq', selectedOption: 'B', correctOption: 'A', isCorrect: false, flagged: true, timeSpentSeconds: 175 },
        { questionId: 'PRC2-CH03-ST-005', subjectId: 'prc-2', chapterId: 3, source: 'self-test', selectedOption: 'A', correctOption: 'A', isCorrect: true, flagged: false, timeSpentSeconds: 115 },
        { questionId: 'PRC2-CH04-APQ-007', subjectId: 'prc-2', chapterId: 4, source: 'apq', selectedOption: 'C', correctOption: 'A', isCorrect: false, flagged: true, timeSpentSeconds: 140 },
      ],
    },
    {
      id: 'sim-seed-3',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      subjectId: 'prc-1',
      totalQuestions: 8,
      attemptedCount: 8,
      correctCount: 6,
      scorePercentage: 75,
      durationSeconds: 910,
      timeLimitSeconds: 1500,
      selectedChapters: [1, 2, 3, 4, 5],
      selectedSources: ['self-test', 'apq', 'practice-set'],
      records: [
        { questionId: 'PRC1-CH01-ST-001', subjectId: 'prc-1', chapterId: 1, source: 'self-test', selectedOption: 'A', correctOption: 'A', isCorrect: true, flagged: false, timeSpentSeconds: 100 },
        { questionId: 'PRC1-CH02-ST-003', subjectId: 'prc-1', chapterId: 2, source: 'self-test', selectedOption: 'A', correctOption: 'A', isCorrect: true, flagged: false, timeSpentSeconds: 120 },
        { questionId: 'PRC1-CH03-APQ-005', subjectId: 'prc-1', chapterId: 3, source: 'apq', selectedOption: 'A', correctOption: 'A', isCorrect: true, flagged: false, timeSpentSeconds: 115 },
        { questionId: 'PRC1-CH03-ST-006', subjectId: 'prc-1', chapterId: 3, source: 'self-test', selectedOption: 'A', correctOption: 'A', isCorrect: true, flagged: false, timeSpentSeconds: 110 },
        { questionId: 'PRC1-CH04-APQ-007', subjectId: 'prc-1', chapterId: 4, source: 'apq', selectedOption: 'B', correctOption: 'A', isCorrect: false, flagged: true, timeSpentSeconds: 135 },
        { questionId: 'PRC1-CH04-PS-008', subjectId: 'prc-1', chapterId: 4, source: 'practice-set', selectedOption: 'A', correctOption: 'A', isCorrect: true, flagged: false, timeSpentSeconds: 105 },
        { questionId: 'PRC1-CH05-ST-009', subjectId: 'prc-1', chapterId: 5, source: 'self-test', selectedOption: 'B', correctOption: 'A', isCorrect: false, flagged: true, timeSpentSeconds: 120 },
        { questionId: 'PRC1-CH05-APQ-010', subjectId: 'prc-1', chapterId: 5, source: 'apq', selectedOption: 'A', correctOption: 'A', isCorrect: true, flagged: false, timeSpentSeconds: 105 },
      ],
    },
    {
      id: 'sim-seed-4',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      subjectId: 'prc-3-v1',
      totalQuestions: 5,
      attemptedCount: 5,
      correctCount: 4,
      scorePercentage: 80,
      durationSeconds: 420,
      timeLimitSeconds: 900,
      selectedChapters: [1, 2, 3, 4],
      selectedSources: ['self-test', 'apq', 'practice-set'],
      records: [
        { questionId: 'PRC3V1-CH01-ST-001', subjectId: 'prc-3-v1', chapterId: 1, source: 'self-test', selectedOption: 'A', correctOption: 'A', isCorrect: true, flagged: false, timeSpentSeconds: 80 },
        { questionId: 'PRC3V1-CH01-APQ-002', subjectId: 'prc-3-v1', chapterId: 1, source: 'apq', selectedOption: 'A', correctOption: 'A', isCorrect: true, flagged: false, timeSpentSeconds: 85 },
        { questionId: 'PRC3V1-CH02-ST-003', subjectId: 'prc-3-v1', chapterId: 2, source: 'self-test', selectedOption: 'A', correctOption: 'A', isCorrect: true, flagged: false, timeSpentSeconds: 75 },
        { questionId: 'PRC3V1-CH03-APQ-005', subjectId: 'prc-3-v1', chapterId: 3, source: 'apq', selectedOption: 'B', correctOption: 'A', isCorrect: false, flagged: true, timeSpentSeconds: 95 },
        { questionId: 'PRC3V1-CH04-ST-006', subjectId: 'prc-3-v1', chapterId: 4, source: 'self-test', selectedOption: 'A', correctOption: 'A', isCorrect: true, flagged: false, timeSpentSeconds: 85 },
      ],
    },
  ];

  for (const session of sampleSessions) {
    for (const rec of session.records) {
      const qExists = allQuestions.some((q) => q.id === rec.questionId);
      if (!qExists) continue;
      const prev = mastery[rec.questionId];
      if (!prev) {
        mastery[rec.questionId] = {
          questionId: rec.questionId,
          subjectId: rec.subjectId,
          chapterId: rec.chapterId,
          source: rec.source,
          attempts: 1,
          correct: rec.isCorrect ? 1 : 0,
          lastAttemptedAt: session.timestamp,
          lastOutcomeCorrect: rec.isCorrect,
        };
      } else {
        prev.attempts += 1;
        if (rec.isCorrect) prev.correct += 1;
        prev.lastAttemptedAt = session.timestamp;
        prev.lastOutcomeCorrect = rec.isCorrect;
      }
    }
  }

  return { sessions: sampleSessions, mastery };
}

export function initializeStorageWithSeed(): {
  sessions: ExamSessionRecord[];
  mastery: Record<string, QuestionMasteryStat>;
} {
  try {
    const alreadySeeded = localStorage.getItem(STORAGE_KEYS.SEEDED);
    const rawSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    const rawMastery = localStorage.getItem(STORAGE_KEYS.MASTERY);

    if (!alreadySeeded && !rawSessions && !rawMastery) {
      const seed = createInitialSeedData();
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(seed.sessions));
      localStorage.setItem(STORAGE_KEYS.MASTERY, JSON.stringify(seed.mastery));
      localStorage.setItem(STORAGE_KEYS.SEEDED, 'true');
      return seed;
    }

    return {
      sessions: rawSessions ? JSON.parse(rawSessions) : [],
      mastery: rawMastery ? JSON.parse(rawMastery) : {},
    };
  } catch {
    return { sessions: [], mastery: {} };
  }
}

export function saveProgressToLocalStorage(payload: UserProgressPayload): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(payload.sessions));
    localStorage.setItem(STORAGE_KEYS.MASTERY, JSON.stringify(payload.mastery));
    localStorage.setItem(STORAGE_KEYS.SEEDED, 'true');
    if (payload.customQuestions) {
      localStorage.setItem(
        STORAGE_KEYS.CUSTOM_QUESTIONS,
        JSON.stringify(payload.customQuestions)
      );
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function mergeProgressData(
  local: UserProgressPayload,
  cloud?: UserProgressPayload | null
): UserProgressPayload {
  if (!cloud) {
    return local;
  }

  // 1. Merge sessions by unique session ID and sort newest first
  const sessionMap = new Map<string, ExamSessionRecord>();
  const cloudSessions = Array.isArray(cloud.sessions) ? cloud.sessions : [];
  const localSessions = Array.isArray(local.sessions) ? local.sessions : [];

  for (const s of cloudSessions) {
    if (s && s.id) sessionMap.set(s.id, s);
  }
  for (const s of localSessions) {
    if (s && s.id) sessionMap.set(s.id, s);
  }

  const mergedSessions = Array.from(sessionMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // 2. Recompute mastery from deduplicated chronological sessions first so identical sessions are never double-counted
  const chronologicalSessions = [...mergedSessions].reverse();
  const computedMastery: Record<string, QuestionMasteryStat> = {};

  for (const sess of chronologicalSessions) {
    if (!Array.isArray(sess.records)) continue;
    for (const rec of sess.records) {
      if (rec.selectedOption === null) continue;
      const prev = computedMastery[rec.questionId];
      if (!prev) {
        computedMastery[rec.questionId] = {
          questionId: rec.questionId,
          subjectId: rec.subjectId,
          chapterId: rec.chapterId,
          source: rec.source,
          attempts: 1,
          correct: rec.isCorrect ? 1 : 0,
          lastAttemptedAt: sess.timestamp,
          lastOutcomeCorrect: rec.isCorrect,
        };
      } else {
        computedMastery[rec.questionId] = {
          ...prev,
          attempts: prev.attempts + 1,
          correct: prev.correct + (rec.isCorrect ? 1 : 0),
          lastAttemptedAt: sess.timestamp,
          lastOutcomeCorrect: rec.isCorrect,
        };
      }
    }
  }

  // Also preserve any standalone mastery entries in cloud or local that might have more attempts than recorded in sessions
  const allMasteryKeys = new Set<string>([
    ...Object.keys(local.mastery || {}),
    ...Object.keys(cloud.mastery || {}),
    ...Object.keys(computedMastery),
  ]);

  const mergedMastery: Record<string, QuestionMasteryStat> = {};
  allMasteryKeys.forEach((qId) => {
    const fromSessions = computedMastery[qId];
    const fromLocal = local.mastery?.[qId];
    const fromCloud = cloud.mastery?.[qId];

    if (fromSessions) {
      const maxAttempts = Math.max(
        fromSessions.attempts,
        fromLocal?.attempts ?? 0,
        fromCloud?.attempts ?? 0
      );
      const maxCorrect = Math.max(
        fromSessions.correct,
        fromLocal?.correct ?? 0,
        fromCloud?.correct ?? 0
      );
      mergedMastery[qId] = {
        ...fromSessions,
        attempts: maxAttempts,
        correct: Math.min(maxAttempts, maxCorrect),
      };
    } else if (fromLocal && fromCloud) {
      const newer =
        new Date(fromLocal.lastAttemptedAt).getTime() >=
        new Date(fromCloud.lastAttemptedAt).getTime()
          ? fromLocal
          : fromCloud;
      const maxAttempts = Math.max(fromLocal.attempts, fromCloud.attempts);
      const maxCorrect = Math.max(fromLocal.correct, fromCloud.correct);
      mergedMastery[qId] = {
        ...newer,
        attempts: maxAttempts,
        correct: Math.min(maxAttempts, maxCorrect),
      };
    } else if (fromLocal) {
      mergedMastery[qId] = fromLocal;
    } else if (fromCloud) {
      mergedMastery[qId] = fromCloud;
    }
  });

  // 3. Merge custom questions by ID
  const customMap = new Map<string, Question>();
  for (const q of cloud.customQuestions || []) {
    if (q && q.id) customMap.set(q.id, q);
  }
  for (const q of local.customQuestions || []) {
    if (q && q.id) customMap.set(q.id, q);
  }

  return {
    sessions: mergedSessions,
    mastery: mergedMastery,
    customQuestions: Array.from(customMap.values()),
  };
}

export async function pushProgressToSupabase(
  userId: string,
  email: string | undefined,
  payload: UserProgressPayload
): Promise<boolean> {
  try {
    const { error } = await supabase.from('user_progress').upsert(
      {
        user_id: userId,
        email: email ?? '',
        progress_data: payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function syncUserProgressOnLogin(
  userId: string,
  email: string | undefined,
  localPayload: UserProgressPayload
): Promise<{ merged: UserProgressPayload; synced: boolean }> {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('progress_data, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      // Even if select fails or row doesn't exist yet, attempt to upsert local state
      const pushed = await pushProgressToSupabase(userId, email, localPayload);
      return { merged: localPayload, synced: pushed };
    }

    const cloudPayload = (data?.progress_data as UserProgressPayload | null) ?? null;
    const merged = mergeProgressData(localPayload, cloudPayload);

    // Save merged state to localStorage
    saveProgressToLocalStorage(merged);

    // Upsert merged state back to Supabase
    const pushed = await pushProgressToSupabase(userId, email, merged);
    return { merged, synced: pushed };
  } catch {
    return { merged: localPayload, synced: false };
  }
}

export function saveExamSession(
  session: ExamSessionRecord,
  currentSessions: ExamSessionRecord[],
  currentMastery: Record<string, QuestionMasteryStat>
): {
  sessions: ExamSessionRecord[];
  mastery: Record<string, QuestionMasteryStat>;
} {
  const updatedSessions = [session, ...currentSessions];
  const updatedMastery = { ...currentMastery };

  for (const rec of session.records) {
    if (rec.selectedOption === null) continue;
    const prev = updatedMastery[rec.questionId];
    if (!prev) {
      updatedMastery[rec.questionId] = {
        questionId: rec.questionId,
        subjectId: rec.subjectId,
        chapterId: rec.chapterId,
        source: rec.source,
        attempts: 1,
        correct: rec.isCorrect ? 1 : 0,
        lastAttemptedAt: session.timestamp,
        lastOutcomeCorrect: rec.isCorrect,
      };
    } else {
      updatedMastery[rec.questionId] = {
        ...prev,
        attempts: prev.attempts + 1,
        correct: prev.correct + (rec.isCorrect ? 1 : 0),
        lastAttemptedAt: session.timestamp,
        lastOutcomeCorrect: rec.isCorrect,
      };
    }
  }

  saveProgressToLocalStorage({
    sessions: updatedSessions,
    mastery: updatedMastery,
  });

  return { sessions: updatedSessions, mastery: updatedMastery };
}

export function clearAllProgress(): {
  sessions: ExamSessionRecord[];
  mastery: Record<string, QuestionMasteryStat>;
} {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.MASTERY, JSON.stringify({}));
    localStorage.setItem(STORAGE_KEYS.SEEDED, 'true');
  } catch {
    // Ignore
  }
  return { sessions: [], mastery: {} };
}

export function loadThemePreference(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Ignore
  }
  return 'light';
}

export function saveThemePreference(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch {
    // Ignore
  }
}
