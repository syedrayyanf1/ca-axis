import { ExamSessionRecord, Question, QuestionMasteryStat, SubjectId } from '../types';
import { getAllStaticQuestions, STATIC_QUESTIONS_BY_SUBJECT } from '../data/subjects';
import { supabase } from '../supabaseClient';

const STORAGE_KEYS = {
  SESSIONS: 'caxis_prc_exam_sessions_v3',
  MASTERY: 'caxis_prc_question_mastery_v3',
  CUSTOM_QUESTIONS: 'icap_prc_custom_questions_v2',
  THEME: 'icap_prc_theme_v1',
  LEGACY_SESSIONS: 'icap_prc_exam_sessions_v2',
  LEGACY_MASTERY: 'icap_prc_question_mastery_v2',
  LEGACY_SEEDED: 'icap_prc_seeded_v2',
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

export function initializeStorageWithSeed(): {
  sessions: ExamSessionRecord[];
  mastery: Record<string, QuestionMasteryStat>;
} {
  try {
    // Clean up legacy fake seeded keys if present
    localStorage.removeItem(STORAGE_KEYS.LEGACY_SESSIONS);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_MASTERY);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_SEEDED);

    const rawSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    const rawMastery = localStorage.getItem(STORAGE_KEYS.MASTERY);

    const parsedSessions: ExamSessionRecord[] = rawSessions ? JSON.parse(rawSessions) : [];
    const cleanSessions = Array.isArray(parsedSessions)
      ? parsedSessions.filter((s) => s && s.id && !s.id.startsWith('sim-seed-'))
      : [];

    return {
      sessions: cleanSessions,
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

  // 1. Merge sessions by unique session ID (excluding any legacy fake seed sessions) and sort newest first
  const sessionMap = new Map<string, ExamSessionRecord>();
  const cloudSessions = Array.isArray(cloud.sessions) ? cloud.sessions : [];
  const localSessions = Array.isArray(local.sessions) ? local.sessions : [];

  for (const s of cloudSessions) {
    if (s && s.id && !s.id.startsWith('sim-seed-')) sessionMap.set(s.id, s);
  }
  for (const s of localSessions) {
    if (s && s.id && !s.id.startsWith('sim-seed-')) sessionMap.set(s.id, s);
  }

  const mergedSessions = Array.from(sessionMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // 2. Recompute mastery from deduplicated chronological sessions so identical sessions are never double-counted
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
    mastery: computedMastery,
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
    localStorage.removeItem(STORAGE_KEYS.LEGACY_SESSIONS);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_MASTERY);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_SEEDED);
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
