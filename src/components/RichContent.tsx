import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface RichContentProps {
  content: string;
  className?: string;
}

function extractPlainText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractPlainText).join('');
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return extractPlainText(props.children);
  }
  return '';
}

function isNumericOrCurrencyCell(text: string): boolean {
  const cleaned = text.trim();
  if (!cleaned) return false;
  return /^(?:Rs\.?\s*|PKR\s*|\$\s*)?\(?[-+]?\d[\d,.]*(?:\s*%|\s*Billion|\s*Million|\s*units|\s*(?:Dr|Cr)\.?)?\)?$/i.test(
    cleaned
  );
}

function isNumericHeader(text: string): boolean {
  const cleaned = text.trim();
  return /(?:Rs\.?|Amount|Balance|Debit|Credit|Dr\.?|Cr\.?|Units|Cost|Price|Factor|Inflow|Outflow|Variance|Return|Value|\(\%\)|As at|\d{4})/i.test(
    cleaned
  );
}

export const RichContent: React.FC<RichContentProps> = ({ content, className = '' }) => {
  return (
    <div className={`rich-markdown text-[#09090B] dark:text-[#FAFAFA] ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 space-y-2 my-3 text-sm sm:text-[15px] leading-relaxed marker:font-semibold marker:text-zinc-600 dark:marker:text-zinc-400">
              {children}
            </ol>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-6 space-y-2 my-3 text-sm sm:text-[15px] leading-relaxed marker:text-zinc-500 dark:marker:text-zinc-400">
              {children}
            </ul>
          ),
          li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
          table: ({ children }) => (
            <div className="-mx-2 my-3.5 overflow-x-auto px-2 sm:mx-0 sm:px-0">
              <div className="inline-block min-w-full align-middle rounded-lg border border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
                <table className="min-w-full border-collapse text-left">{children}</table>
              </div>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-zinc-100/80 dark:bg-zinc-900 border-b border-black/[0.08] dark:border-white/[0.08]">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.06] bg-white dark:bg-[#121215]">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
              {children}
            </tr>
          ),
          th: ({ children }) => {
            const plain = extractPlainText(children);
            const alignRight = isNumericHeader(plain);
            return (
              <th
                className={`px-2.5 py-2 sm:px-4 sm:py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 border-r last:border-r-0 border-black/[0.06] dark:border-white/[0.06] whitespace-nowrap ${
                  alignRight ? 'text-right' : 'text-left'
                }`}
              >
                {children}
              </th>
            );
          },
          td: ({ children }) => {
            const plain = extractPlainText(children);
            const isNum = isNumericOrCurrencyCell(plain);
            return (
              <td
                className={`px-2.5 py-2 sm:px-4 sm:py-2.5 border-r last:border-r-0 border-black/[0.06] dark:border-white/[0.06] ${
                  isNum
                    ? 'text-right font-mono text-xs sm:text-sm tabular-nums text-[#09090B] dark:text-[#FAFAFA] whitespace-nowrap'
                    : 'text-left text-xs sm:text-sm text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {children}
              </td>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
