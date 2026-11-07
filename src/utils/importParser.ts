import {
  formatOptionList,
  OptionId,
  parseOptionList,
  Question,
  QuestionSource,
  SubjectId,
} from '../types';

export interface ParseResult {
  questions: Question[];
  errors: string[];
}

const VALID_SUBJECTS: SubjectId[] = ['prc-1', 'prc-2', 'prc-3-v1', 'prc-3-v2'];
const VALID_SOURCES: QuestionSource[] = ['self-test', 'apq', 'practice-set'];
const VALID_OPTIONS: OptionId[] = ['A', 'B', 'C', 'D'];

function normalizeCorrectOption(raw: unknown): string {
  if (typeof raw !== 'string') return 'A';
  const parsed = parseOptionList(raw);
  return parsed.length > 0 ? formatOptionList(parsed) : 'A';
}

export const SAMPLE_JSON_TEMPLATE = JSON.stringify(
  [
    {
      id: 'PRC1-CH01-001',
      subjectId: 'prc-1',
      chapterId: 1,
      chapterName: 'Chapter 1: Accounting Fundamentals',
      questionText: 'Markdown + $LaTeX$ supported question text here',
      options: [
        { id: 'A', text: 'Option A text' },
        { id: 'B', text: 'Option B text' },
        { id: 'C', text: 'Option C text' },
        { id: 'D', text: 'Option D text' },
      ],
      correctOption: 'B',
    },
  ],
  null,
  2
);

export const SAMPLE_MARKDOWN_TEMPLATE = `---
id: PRC1-CH01-001
subjectId: prc-1
chapterId: 1
chapterName: Chapter 1: Accounting Fundamentals
correctOption: B
---
Markdown + $LaTeX$ supported question text here

A) Option A text
B) Option B text
C) Option C text
D) Option D text`;

export const SAMPLE_CSV_TEMPLATE = `id,subjectId,chapterId,chapterName,questionText,optionA,optionB,optionC,optionD,correctOption
"PRC1-CH01-001","prc-1",1,"Chapter 1: Accounting Fundamentals","Markdown + $LaTeX$ supported question text here","Option A text","Option B text","Option C text","Option D text","B"`;

export function parseMarkdownQuestionBank(
  rawText: string,
  defaults: { subjectId: SubjectId; chapterId: number; chapterName: string; source?: QuestionSource }
): ParseResult {
  const questions: Question[] = [];
  const errors: string[] = [];

  const trimmed = rawText.trim();
  if (!trimmed) {
    return { questions: [], errors: ['Input text is empty.'] };
  }

  const blocks = trimmed.split(/\n===\s*\n|\n===$/);

  blocks.forEach((block, idx) => {
    const blockNum = idx + 1;
    let body = block.trim();
    if (!body) return;

    const meta: Record<string, string> = {};
    if (body.startsWith('---')) {
      const endFrontmatter = body.indexOf('\n---', 3);
      if (endFrontmatter !== -1) {
        const fmLines = body.slice(3, endFrontmatter).trim().split('\n');
        fmLines.forEach((line) => {
          const colonIdx = line.indexOf(':');
          if (colonIdx !== -1) {
            const k = line.slice(0, colonIdx).trim();
            const v = line.slice(colonIdx + 1).trim();
            meta[k] = v;
          }
        });
        body = body.slice(endFrontmatter + 4).trim();
      }
    }

    // Strip any trailing Explanation block if present in legacy pasted text
    const expMatch = body.match(/\nExplanation:\s*([\s\S]*)$/i);
    if (expMatch && expMatch.index !== undefined) {
      body = body.slice(0, expMatch.index).trim();
    }

    // Extract Answer if inline (supports single "B" or multi "A,C")
    let inlineAnswer: string | undefined;
    const ansMatch = body.match(/\n(?:Answer|Correct(?:\s*Option)?):\s*([A-D](?:\s*,\s*[A-D])*)\s*$/i);
    if (ansMatch && ansMatch.index !== undefined) {
      inlineAnswer = ansMatch[1].toUpperCase();
      body = body.slice(0, ansMatch.index).trim();
    }

    // Extract Options A) B) C) D)
    const optionRegex = /\n([A-D])[).:]\s+([^\n]+)/g;
    const matchedOptions: { id: OptionId; text: string; index: number }[] = [];
    let match: RegExpExecArray | null;
    while ((match = optionRegex.exec('\n' + body)) !== null) {
      matchedOptions.push({
        id: match[1] as OptionId,
        text: match[2].trim(),
        index: match.index,
      });
    }

    if (matchedOptions.length < 4) {
      errors.push(`Block #${blockNum}: Could not find all 4 options A), B), C), D). Found ${matchedOptions.length}.`);
      return;
    }

    const firstOptIndex = matchedOptions[0].index;
    const questionText = ('\n' + body).slice(0, firstOptIndex).trim();

    const subjectId = (VALID_SUBJECTS.includes(meta.subjectId as SubjectId)
      ? meta.subjectId
      : defaults.subjectId) as SubjectId;
    const chapterId = meta.chapterId ? Number(meta.chapterId) || defaults.chapterId : defaults.chapterId;
    const chapterName = meta.chapterName || defaults.chapterName;
    const source: QuestionSource = 'self-test';
    const correctOption = normalizeCorrectOption(meta.correctOption || inlineAnswer || 'A');

    const id =
      meta.id ||
      `${subjectId.toUpperCase().replace(/-/g, '')}-CH${String(chapterId).padStart(2, '0')}-${String(idx + 1).padStart(3, '0')}`;

    const options = VALID_OPTIONS.map((optId) => {
      const found = matchedOptions.find((o) => o.id === optId);
      return { id: optId, text: found ? found.text : `Option ${optId}` };
    });

    if (!questionText) {
      errors.push(`Block #${blockNum}: Question stem text is empty.`);
      return;
    }

    questions.push({
      id,
      subjectId,
      chapterId,
      chapterName,
      source,
      questionText,
      options,
      correctOption,
    });
  });

  return { questions, errors };
}

function splitCsvRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCsvQuestionBank(rawCsv: string): ParseResult {
  const questions: Question[] = [];
  const errors: string[] = [];
  const lines = rawCsv
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { questions: [], errors: ['CSV must include a header row and at least one question row.'] };
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    if (cols.length < 10) {
      errors.push(
        `Row ${i + 1}: Expected 10 columns (id,subjectId,chapterId,chapterName,questionText,optionA,optionB,optionC,optionD,correctOption), got ${cols.length}.`
      );
      continue;
    }

    const hasLegacySourceCol = cols.length >= 11;
    const id = cols[0];
    const subjectRaw = cols[1];
    const chapterIdRaw = cols[2];
    const chapterName = cols[3];
    const questionText = hasLegacySourceCol ? cols[5] : cols[4];
    const optA = hasLegacySourceCol ? cols[6] : cols[5];
    const optB = hasLegacySourceCol ? cols[7] : cols[6];
    const optC = hasLegacySourceCol ? cols[8] : cols[7];
    const optD = hasLegacySourceCol ? cols[9] : cols[8];
    const correctRaw = hasLegacySourceCol ? cols[10] : cols[9];

    const subjectId = (VALID_SUBJECTS.includes(subjectRaw as SubjectId) ? subjectRaw : 'prc-1') as SubjectId;
    const chapterId = Number(chapterIdRaw) || 1;
    const correctOption = normalizeCorrectOption(correctRaw);

    questions.push({
      id: id || `CSV-Q-${i}`,
      subjectId,
      chapterId,
      chapterName: chapterName || `Chapter ${chapterId}`,
      source: 'self-test',
      questionText,
      options: [
        { id: 'A', text: optA },
        { id: 'B', text: optB },
        { id: 'C', text: optC },
        { id: 'D', text: optD },
      ],
      correctOption,
    });
  }

  return { questions, errors };
}

export function parseJsonQuestionBank(rawJson: string): ParseResult {
  const questions: Question[] = [];
  const errors: string[] = [];

  try {
    const parsed = JSON.parse(rawJson);
    const arr = Array.isArray(parsed) ? parsed : [parsed];

    arr.forEach((item, idx) => {
      if (!item || typeof item !== 'object') {
        errors.push(`Item #${idx + 1}: Not a valid JSON object.`);
        return;
      }
      if (!item.questionText || !Array.isArray(item.options) || item.options.length < 4) {
        errors.push(`Item #${idx + 1}: Missing questionText or 4 options.`);
        return;
      }

      const chapterId = Number(item.chapterId) || 1;

      questions.push({
        id: String(item.id || `JSON-Q-${idx + 1}`),
        subjectId: VALID_SUBJECTS.includes(item.subjectId) ? item.subjectId : 'prc-1',
        chapterId,
        chapterName: String(item.chapterName || `Chapter ${chapterId}`),
        source: VALID_SOURCES.includes(item.source) ? item.source : 'self-test',
        questionText: String(item.questionText),
        options: item.options.slice(0, 4).map((o: { id?: string; text?: string }, oIdx: number) => ({
          id: VALID_OPTIONS[oIdx],
          text: String(o?.text ?? ''),
        })),
        correctOption: normalizeCorrectOption(item.correctOption),
      });
    });
  } catch (err) {
    errors.push(`Invalid JSON syntax: ${(err as Error).message}`);
  }

  return { questions, errors };
}
