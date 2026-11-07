export type SubjectId = 'prc-1' | 'prc-2' | 'prc-3-v1' | 'prc-3-v2';

export type QuestionSource = 'self-test' | 'apq' | 'practice-set';

export type OptionId = 'A' | 'B' | 'C' | 'D';

export interface QuestionOption {
  id: OptionId;
  text: string;
}

export interface Question {
  id: string; // e.g., "PRC1-CH04-ST-001"
  subjectId: SubjectId;
  chapterId: number;
  chapterName: string;
  source: QuestionSource; // 1: ICAP Self-Test, 2: ICAP APQ, 3: Teacher/Practice Tests
  questionText: string; // Supports Markdown tables and $LaTeX$ math
  options: QuestionOption[];
  correctOption: string; // Supports single "B" or multi-select "A,C" / "B,C,D"
}

export interface SubjectInfo {
  id: SubjectId;
  code: string;
  title: string;
  shortTitle: string;
  description: string;
  defaultDurationMinutes: number;
  defaultQuestionCount: number;
  passingPercentage: number;
  chapters: { id: number; name: string }[];
}

export interface QuestionAttemptRecord {
  questionId: string;
  subjectId: SubjectId;
  chapterId: number;
  source: QuestionSource;
  selectedOption: string | null;
  correctOption: string;
  isCorrect: boolean;
  flagged: boolean;
  timeSpentSeconds: number;
}

export interface ExamSessionRecord {
  id: string;
  timestamp: string;
  subjectId: SubjectId;
  totalQuestions: number;
  attemptedCount: number;
  correctCount: number;
  scorePercentage: number;
  durationSeconds: number;
  timeLimitSeconds: number;
  selectedChapters: number[];
  selectedSources: QuestionSource[];
  records: QuestionAttemptRecord[];
}

export interface QuestionMasteryStat {
  questionId: string;
  subjectId: SubjectId;
  chapterId: number;
  source: QuestionSource;
  attempts: number;
  correct: number;
  lastAttemptedAt: string;
  lastOutcomeCorrect: boolean;
}

const VALID_OPTION_IDS: OptionId[] = ['A', 'B', 'C', 'D'];

export function parseOptionList(raw: string | null | undefined): OptionId[] {
  if (!raw) return [];
  const items = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is OptionId => VALID_OPTION_IDS.includes(s as OptionId));
  return Array.from(new Set(items)).sort();
}

export function formatOptionList(options: OptionId[]): string {
  return Array.from(new Set(options)).sort().join(',');
}

export function isMultiSelectQuestion(correctOption: string): boolean {
  return parseOptionList(correctOption).length > 1;
}

export function areOptionsEqual(
  selected: string | null | undefined,
  correct: string
): boolean {
  const normSelected = formatOptionList(parseOptionList(selected));
  const normCorrect = formatOptionList(parseOptionList(correct));
  return normSelected.length > 0 && normSelected === normCorrect;
}
