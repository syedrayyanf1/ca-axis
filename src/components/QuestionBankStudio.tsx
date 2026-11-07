import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  FileCode2,
  PlusCircle,
  Search,
  Trash2,
} from 'lucide-react';
import {
  isMultiSelectQuestion,
  parseOptionList,
  Question,
  SubjectId,
} from '../types';
import { SUBJECTS } from '../data/subjects';
import {
  parseCsvQuestionBank,
  parseJsonQuestionBank,
  parseMarkdownQuestionBank,
  SAMPLE_CSV_TEMPLATE,
  SAMPLE_JSON_TEMPLATE,
  SAMPLE_MARKDOWN_TEMPLATE,
} from '../utils/importParser';
import { RichContent } from './RichContent';

interface QuestionBankStudioProps {
  allQuestionsBySubject: Record<SubjectId, Question[]>;
  customQuestions: Question[];
  onImportQuestions: (newQuestions: Question[]) => void;
  onDeleteCustomQuestion: (id: string) => void;
}

type StudioTab = 'browse' | 'import';
type ImportFormat = 'markdown' | 'json' | 'csv';

export const QuestionBankStudio: React.FC<QuestionBankStudioProps> = ({
  allQuestionsBySubject,
  customQuestions,
  onImportQuestions,
  onDeleteCustomQuestion,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('import');

  const [browseSubject, setBrowseSubject] = useState<SubjectId>('prc-1');
  const [browseChapter, setBrowseChapter] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [format, setFormat] = useState<ImportFormat>('json');
  const [defaultSubjectId, setDefaultSubjectId] = useState<SubjectId>('prc-1');
  const [defaultChapterId, setDefaultChapterId] = useState<number>(1);
  const [rawInput, setRawInput] = useState<string>(SAMPLE_JSON_TEMPLATE);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const selectedSubjectMeta = useMemo(
    () => SUBJECTS.find((s) => s.id === defaultSubjectId) || SUBJECTS[0],
    [defaultSubjectId]
  );

  const browseSubjectMeta = useMemo(
    () => SUBJECTS.find((s) => s.id === browseSubject) || SUBJECTS[0],
    [browseSubject]
  );

  const selectedChapterName = useMemo(() => {
    const found =
      selectedSubjectMeta.chapters.find((c) => c.id === defaultChapterId) ||
      selectedSubjectMeta.chapters[0];
    return found.name.toLowerCase().startsWith('chapter')
      ? found.name
      : `Chapter ${found.id}: ${found.name}`;
  }, [selectedSubjectMeta, defaultChapterId]);

  const parseOutput = useMemo(() => {
    if (!rawInput.trim()) return { questions: [], errors: [] };
    if (format === 'markdown') {
      return parseMarkdownQuestionBank(rawInput, {
        subjectId: defaultSubjectId,
        chapterId: defaultChapterId,
        chapterName: selectedChapterName,
      });
    }
    if (format === 'csv') {
      return parseCsvQuestionBank(rawInput);
    }
    return parseJsonQuestionBank(rawInput);
  }, [rawInput, format, defaultSubjectId, defaultChapterId, selectedChapterName]);

  const handleLoadTemplate = (targetFormat: ImportFormat) => {
    setFormat(targetFormat);
    setStatusBanner(null);
    if (targetFormat === 'markdown') {
      setRawInput(SAMPLE_MARKDOWN_TEMPLATE);
    } else if (targetFormat === 'csv') {
      setRawInput(SAMPLE_CSV_TEMPLATE);
    } else {
      setRawInput(SAMPLE_JSON_TEMPLATE);
    }
  };

  const handleMergeIntoBank = () => {
    if (parseOutput.questions.length === 0) return;
    onImportQuestions(parseOutput.questions);
    setStatusBanner(
      `Imported ${parseOutput.questions.length} question(s) into the active CAxis question bank.`
    );
  };

  const handleDownloadJson = () => {
    if (parseOutput.questions.length === 0) return;
    const blob = new Blob([JSON.stringify(parseOutput.questions, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${defaultSubjectId.replace(/-/g, '_')}_questions.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = async () => {
    if (parseOutput.questions.length === 0) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(parseOutput.questions, null, 2));
      setStatusBanner('Copied formatted Question[] JSON schema to clipboard.');
    } catch {
      setStatusBanner('Unable to copy automatically; please download the JSON file instead.');
    }
  };

  const filteredBrowseQuestions = useMemo(() => {
    const list = allQuestionsBySubject[browseSubject] || [];
    return list.filter((q) => {
      if (browseChapter !== 'all' && q.chapterId !== browseChapter) return false;
      if (searchQuery.trim()) {
        const needle = searchQuery.toLowerCase();
        return (
          q.id.toLowerCase().includes(needle) ||
          q.questionText.toLowerCase().includes(needle) ||
          q.chapterName.toLowerCase().includes(needle)
        );
      }
      return true;
    });
  }, [allQuestionsBySubject, browseSubject, browseChapter, searchQuery]);

  const customIds = useMemo(() => new Set(customQuestions.map((q) => q.id)), [customQuestions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-[#09090B] dark:text-[#FAFAFA]">
            Question Bank
          </h1>
          <p className="mt-1 text-sm text-[#71717A] dark:text-[#A1A1AA]">
            Import Markdown, JSON, or CSV question banks or browse loaded PRC items.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-black/[0.06] bg-zinc-100 p-1 dark:border-white/[0.06] dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'import'
                ? 'bg-white text-[#09090B] shadow-2xs dark:bg-zinc-800 dark:text-white'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
            }`}
          >
            Import Markdown / JSON / CSV
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('browse')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'browse'
                ? 'bg-white text-[#09090B] shadow-2xs dark:bg-zinc-800 dark:text-white'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
            }`}
          >
            Browse Loaded Questions
          </button>
        </div>
      </div>

      {activeTab === 'import' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Left Column: Input Editor (6 cols) */}
          <div className="lg:col-span-6 space-y-4 rounded-xl border border-black/[0.08] bg-white p-6 dark:border-white/[0.07] dark:bg-[#121215]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] pb-4 dark:border-white/[0.06]">
              <div>
                <h2 className="font-display text-base font-semibold tracking-tight text-[#09090B] dark:text-white">
                  1. Paste Question Bank
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Requires Question Text, Options A–D, and Correct Option (A/B/C/D)
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-black/[0.06] bg-zinc-100 p-1 dark:border-white/[0.06] dark:bg-zinc-900">
                {(['json', 'markdown', 'csv'] as ImportFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => handleLoadTemplate(fmt)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium uppercase transition-colors cursor-pointer ${
                      format === fmt
                        ? 'bg-white text-[#09090B] shadow-2xs dark:bg-zinc-800 dark:text-white'
                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  Target Subject
                </label>
                <select
                  value={defaultSubjectId}
                  onChange={(e) => {
                    setDefaultSubjectId(e.target.value as SubjectId);
                    setDefaultChapterId(1);
                  }}
                  className="w-full rounded-lg border border-black/[0.08] bg-[#FAFAFA] px-3 py-2 text-xs text-[#09090B] dark:border-white/[0.07] dark:bg-[#09090B] dark:text-white"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}: {s.shortTitle}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  Default Chapter
                </label>
                <select
                  value={defaultChapterId}
                  onChange={(e) => setDefaultChapterId(Number(e.target.value))}
                  className="w-full rounded-lg border border-black/[0.08] bg-[#FAFAFA] px-3 py-2 text-xs text-[#09090B] dark:border-white/[0.07] dark:bg-[#09090B] dark:text-white"
                >
                  {selectedSubjectMeta.chapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      Chapter {c.id}: {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <textarea
              value={rawInput}
              onChange={(e) => {
                setRawInput(e.target.value);
                setStatusBanner(null);
              }}
              rows={15}
              spellCheck={false}
              placeholder="Paste JSON, Markdown, or CSV question bank content here..."
              className="w-full rounded-lg border border-black/[0.08] bg-[#FAFAFA] p-4 font-mono text-xs leading-relaxed text-[#09090B] focus:border-zinc-900 focus:outline-none dark:border-white/[0.07] dark:bg-[#09090B] dark:text-white dark:focus:border-white"
            />

            {parseOutput.errors.length > 0 && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                <div className="font-semibold">Validation Notices:</div>
                {parseOutput.errors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}

            {statusBanner && (
              <div className="flex items-center gap-2 rounded-lg border border-black/[0.08] bg-[#FAFAFA] px-4 py-2.5 text-xs font-medium text-[#09090B] dark:border-white/[0.07] dark:bg-[#09090B] dark:text-white">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-zinc-900 dark:text-white" />
                <span>{statusBanner}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                type="button"
                disabled={parseOutput.questions.length === 0}
                onClick={handleMergeIntoBank}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200 cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Add {parseOutput.questions.length} MCQ(s) to Bank</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={parseOutput.questions.length === 0}
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-white/[0.07] dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy JSON</span>
                </button>
                <button
                  type="button"
                  disabled={parseOutput.questions.length === 0}
                  onClick={handleDownloadJson}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-white/[0.07] dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export .json</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Preview & JSON Output (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-xl border border-black/[0.08] bg-white p-6 dark:border-white/[0.07] dark:bg-[#121215] space-y-4">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-4 dark:border-white/[0.06]">
                <div>
                  <h2 className="font-display text-base font-semibold tracking-tight text-[#09090B] dark:text-white">
                    2. Live Table &amp; Formula Preview ({parseOutput.questions.length} Parsed)
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Preview Question Text, Options A–D, and Correct Option
                  </p>
                </div>
                <FileCode2 className="h-4 w-4 text-zinc-400" />
              </div>

              <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
                {parseOutput.questions.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-lg border border-black/[0.08] bg-[#FAFAFA] p-4 dark:border-white/[0.07] dark:bg-[#09090B] space-y-3"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-semibold text-[#09090B] dark:text-white">{q.id}</span>
                      <span>·</span>
                      <span>{q.subjectId}</span>
                      <span>·</span>
                      <span>{q.chapterName}</span>
                      <span>·</span>
                      <span className="font-medium text-[#09090B] dark:text-white">
                        Correct: {q.correctOption}
                      </span>
                    </div>

                    <div className="text-xs">
                      <RichContent content={q.questionText} />
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {q.options.map((opt) => {
                        const isOptCorrect = parseOptionList(q.correctOption).includes(opt.id);
                        return (
                          <div
                            key={opt.id}
                            className={`rounded-lg border px-3 py-2 text-xs ${
                              isOptCorrect
                                ? 'border-zinc-900 bg-zinc-100 font-medium text-[#09090B] dark:border-white dark:bg-zinc-800 dark:text-white'
                                : 'border-black/[0.08] bg-white text-zinc-700 dark:border-white/[0.07] dark:bg-[#121215] dark:text-zinc-300'
                            }`}
                          >
                            <span className="font-semibold mr-1.5">{opt.id}.</span>
                            <span>{opt.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {parseOutput.questions.length === 0 && (
                  <p className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400">
                    No valid questions parsed yet. Check the input on the left.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-black/[0.08] bg-white p-5 dark:border-white/[0.07] dark:bg-[#121215]">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Compiled Question[] JSON Schema
                </h3>
                <span className="text-[11px] text-zinc-400">
                  /src/data/questions/{defaultSubjectId.replace(/-/g, '_')}.json
                </span>
              </div>
              <pre className="max-h-48 overflow-auto rounded-lg border border-black/[0.08] bg-[#09090B] p-4 font-mono text-[11px] text-zinc-200 dark:border-white/[0.07]">
                {JSON.stringify(parseOutput.questions, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        /* BROWSE QUESTION BANK TAB */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.08] bg-white p-4 dark:border-white/[0.07] dark:bg-[#121215]">
            <div className="flex flex-wrap items-center gap-1.5">
              {SUBJECTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setBrowseSubject(s.id);
                    setBrowseChapter('all');
                  }}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                    browseSubject === s.id
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {s.code} ({(allQuestionsBySubject[s.id] || []).length})
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={browseChapter}
                onChange={(e) =>
                  setBrowseChapter(e.target.value === 'all' ? 'all' : Number(e.target.value))
                }
                className="rounded-lg border border-black/[0.08] bg-[#FAFAFA] px-3 py-1.5 text-xs text-[#09090B] dark:border-white/[0.07] dark:bg-[#09090B] dark:text-zinc-200"
              >
                <option value="all">All Chapters</option>
                {browseSubjectMeta.chapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    Chapter {ch.id}: {ch.name}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ID, topic, or table..."
                  className="rounded-lg border border-black/[0.08] bg-[#FAFAFA] pl-8 pr-3 py-1.5 text-xs text-[#09090B] focus:border-zinc-900 focus:outline-none dark:border-white/[0.07] dark:bg-[#09090B] dark:text-white dark:focus:border-white"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {filteredBrowseQuestions.map((q) => {
              const isCustom = customIds.has(q.id);
              const correctList = parseOptionList(q.correctOption);
              const isMulti = isMultiSelectQuestion(q.correctOption);
              return (
                <div
                  key={q.id}
                  className="rounded-xl border border-black/[0.08] bg-white/80 p-6 backdrop-blur-md dark:border-white/[0.07] dark:bg-[#121215]/75 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] pb-3 text-xs text-zinc-500 dark:border-white/[0.06] dark:text-zinc-400">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#09090B] dark:text-white">
                        {q.id}
                      </span>
                      <span>·</span>
                      <span>{q.chapterName}</span>
                      {isMulti && (
                        <>
                          <span>·</span>
                          <span className="rounded-md border border-[#6366F1]/40 bg-[#6366F1]/10 px-2 py-0.5 text-[11px] font-medium text-[#6366F1] dark:border-[#6366F1]/50 dark:bg-[#6366F1]/15 dark:text-indigo-300">
                            Select all that apply ({q.correctOption})
                          </span>
                        </>
                      )}
                      {isCustom && (
                        <>
                          <span>·</span>
                          <span className="rounded border border-black/[0.08] bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-white/[0.07] dark:bg-zinc-800 dark:text-zinc-300">
                            Custom Imported
                          </span>
                        </>
                      )}
                    </div>

                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => onDeleteCustomQuestion(q.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline dark:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  <div className="text-sm leading-relaxed">
                    <RichContent content={q.questionText} />
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {q.options.map((opt) => {
                      const isOptCorrect = correctList.includes(opt.id);
                      return (
                        <div
                          key={opt.id}
                          className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs ${
                            isOptCorrect
                              ? 'border-zinc-900 bg-zinc-100/80 font-medium text-[#09090B] dark:border-white dark:bg-zinc-800/80 dark:text-white'
                              : 'border-black/[0.08] bg-[#FAFAFA] text-zinc-700 dark:border-white/[0.07] dark:bg-[#09090B] dark:text-zinc-300'
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-semibold ${
                              isOptCorrect
                                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                                : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                            }`}
                          >
                            {opt.id}
                          </span>
                          <div className="flex-1">
                            <RichContent content={opt.text} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {filteredBrowseQuestions.length === 0 && (
              <div className="rounded-xl border border-dashed border-black/[0.08] bg-white p-10 text-center dark:border-white/[0.08] dark:bg-[#121215]">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  No questions loaded in this subject yet. Switch to "Import Markdown / JSON / CSV" to add questions.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
