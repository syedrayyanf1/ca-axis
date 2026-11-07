import { OptionId, Question, QuestionSource, SubjectId } from '../types';

export interface ParseResult {
  questions: Question[];
  errors: string[];
}

const VALID_SUBJECTS: SubjectId[] = ['prc-1', 'prc-2', 'prc-3-v1', 'prc-3-v2'];
const VALID_SOURCES: QuestionSource[] = ['self-test', 'apq', 'practice-set'];
const VALID_OPTIONS: OptionId[] = ['A', 'B', 'C', 'D'];

export const SAMPLE_MARKDOWN_TEMPLATE = `---
id: PRC1-CH03-ST-099
subjectId: prc-1
chapterId: 3
chapterName: Bank Reconciliation Statements
source: self-test
correctOption: B
---
The Cash Book of **Chenab Traders** shows a debit balance of **Rs. 125,000** on 30 June 2026. On the same date, the following items were noted:

| Reconciliation Item | Amount (Rs.) |
| :--- | ---: |
| Cheques issued but not yet presented for payment | 38,000 |
| Dividend collected directly by the bank | 12,000 |
| Cheques deposited but not yet credited by bank | 29,000 |

What is the balance as per the **Bank Statement** on 30 June 2026?

A) Rs. 134,000 Favourable
B) Rs. 146,000 Favourable
C) Rs. 104,000 Favourable
D) Rs. 128,000 Overdraft

===

---
id: PRC2-CH02-APQ-099
subjectId: prc-2
chapterId: 2
chapterName: Financial Mathematics: Compounding, Annuities & NPV
source: apq
correctOption: A
---
If a sum of **Rs. 400,000** is invested at a nominal interest rate of **$16\\%$ per annum compounded quarterly**, what is the **Effective Annual Rate (EAR)** using:

$$\\text{EAR} = \\left(1 + \\frac{r}{m}\\right)^m - 1$$

A) 16.99%
B) 16.64%
C) 16.00%
D) 17.25%`;

export const SAMPLE_CSV_TEMPLATE = `id,subjectId,chapterId,chapterName,source,questionText,optionA,optionB,optionC,optionD,correctOption
"PRC1-CH01-PS-088","prc-1",1,"Accounting Fundamentals & Double Entry","practice-set","If total assets increase by **Rs. 180,000** and total liabilities decrease by **Rs. 40,000** during the period, what is the net change in Owner's Equity?","Increase of Rs. 220,000","Increase of Rs. 140,000","Decrease of Rs. 220,000","Increase of Rs. 180,000","A"`;

export function parseMarkdownQuestionBank(
  rawText: string,
  defaults: { subjectId: SubjectId; chapterId: number; chapterName: string; source: QuestionSource }
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

    // Extract Answer if inline
    let inlineAnswer: string | undefined;
    const ansMatch = body.match(/\n(?:Answer|Correct(?:\s*Option)?):\s*([A-D])\s*$/i);
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
    const source = (VALID_SOURCES.includes(meta.source as QuestionSource)
      ? meta.source
      : defaults.source) as QuestionSource;
    const correctRaw = (meta.correctOption || inlineAnswer || 'A').toUpperCase();
    const correctOption = (VALID_OPTIONS.includes(correctRaw as OptionId) ? correctRaw : 'A') as OptionId;

    const id =
      meta.id ||
      `${subjectId.toUpperCase().replace(/-/g, '')}-CH0${chapterId}-${source === 'self-test' ? 'ST' : source === 'apq' ? 'APQ' : 'PS'}-${String(Date.now()).slice(-3)}${idx}`;

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
    if (cols.length < 11) {
      errors.push(`Row ${i + 1}: Expected 11 columns (id,subjectId,chapterId,chapterName,source,questionText,optionA,optionB,optionC,optionD,correctOption), got ${cols.length}.`);
      continue;
    }

    const [
      id,
      subjectRaw,
      chapterIdRaw,
      chapterName,
      sourceRaw,
      questionText,
      optA,
      optB,
      optC,
      optD,
      correctRaw,
    ] = cols;

    const subjectId = (VALID_SUBJECTS.includes(subjectRaw as SubjectId) ? subjectRaw : 'prc-1') as SubjectId;
    const source = (VALID_SOURCES.includes(sourceRaw as QuestionSource) ? sourceRaw : 'self-test') as QuestionSource;
    const correctOption = (VALID_OPTIONS.includes(correctRaw?.toUpperCase() as OptionId)
      ? correctRaw.toUpperCase()
      : 'A') as OptionId;

    questions.push({
      id: id || `CSV-Q-${i}`,
      subjectId,
      chapterId: Number(chapterIdRaw) || 1,
      chapterName: chapterName || 'General Chapter',
      source,
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

      questions.push({
        id: String(item.id || `JSON-Q-${idx + 1}`),
        subjectId: VALID_SUBJECTS.includes(item.subjectId) ? item.subjectId : 'prc-1',
        chapterId: Number(item.chapterId) || 1,
        chapterName: String(item.chapterName || 'Chapter 1'),
        source: VALID_SOURCES.includes(item.source) ? item.source : 'self-test',
        questionText: String(item.questionText),
        options: item.options.slice(0, 4).map((o: { id?: string; text?: string }, oIdx: number) => ({
          id: VALID_OPTIONS[oIdx],
          text: String(o?.text ?? ''),
        })),
        correctOption: VALID_OPTIONS.includes(item.correctOption) ? item.correctOption : 'A',
      });
    });
  } catch (err) {
    errors.push(`Invalid JSON syntax: ${(err as Error).message}`);
  }

  return { questions, errors };
}
