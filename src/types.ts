export type SubjectId = 'prc-1' | 'prc-2' | 'prc-3-v1' | 'prc-3-v2';

export type QuestionSource = 'self-test' | 'apq' | 'practice-set';

export type OptionId = 'A' | 'B' | 'C' | 'D';

export interface QuestionOption {
  id: OptionId;
  text: string;
}

export interface Question {
  id: string; // e.g., "PRC1-CH01-ST-001"
  subjectId: SubjectId;
  chapterId: number;
  chapterName: string;
  source: QuestionSource; // 1: ICAP Self-Test, 2: ICAP APQ, 3: Teacher/Practice Tests
  questionText: string; // Supports Markdown tables and $LaTeX$ math
  options: QuestionOption[];
  correctOption: OptionId;
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
  selectedOption: OptionId | null;
  correctOption: OptionId;
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
