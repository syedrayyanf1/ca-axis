import prc1Questions from './questions/prc1.json';
import prc2Questions from './questions/prc2.json';
import prc3V1Questions from './questions/prc3_v1.json';
import prc3V2Questions from './questions/prc3_v2.json';
import { Question, QuestionSource, SubjectId, SubjectInfo } from '../types';

export const SUBJECTS: SubjectInfo[] = [
  {
    id: 'prc-1',
    code: 'PRC 1',
    title: 'PRC 1: Fundamentals of Accounting',
    shortTitle: 'Fundamentals of Accounting',
    description: 'Double-entry bookkeeping, books of prime entry, bank reconciliations, accruals and prepayments, bad debts, IAS 16 PPE, and IAS 2 Inventories.',
    defaultDurationMinutes: 30,
    defaultQuestionCount: 20,
    passingPercentage: 50,
    chapters: [
      { id: 1, name: 'Accounting Fundamentals & Double Entry' },
      { id: 2, name: 'Books of Prime Entry & Trial Balance' },
      { id: 3, name: 'Bank Reconciliation Statements' },
      { id: 4, name: 'Accruals and Prepayments' },
      { id: 5, name: 'IAS 16 Property, Plant & Equipment and IAS 2 Inventories' },
    ],
  },
  {
    id: 'prc-2',
    code: 'PRC 2',
    title: 'PRC 2: Quantitative Analysis for Business & Statistics',
    shortTitle: 'Quantitative Analysis & Statistics',
    description: 'Linear programming, financial mathematics (annuities, NPV, IRR), central tendency, regression, and probability distributions.',
    defaultDurationMinutes: 25,
    defaultQuestionCount: 20,
    passingPercentage: 50,
    chapters: [
      { id: 1, name: 'Linear Equations, Coordinate Geometry & Linear Programming' },
      { id: 2, name: 'Financial Mathematics: Compounding, Annuities & NPV' },
      { id: 3, name: 'Measures of Central Tendency & Dispersion' },
      { id: 4, name: 'Correlation, Regression & Index Numbers' },
      { id: 5, name: 'Probability, Binomial, Poisson & Normal Distributions' },
    ],
  },
  {
    id: 'prc-3-v1',
    code: 'PRC 3 (Vol 1)',
    title: 'PRC 3 (Vol 1): Business Insights',
    shortTitle: 'Business Insights',
    description: 'Corporate governance, stakeholder mapping, organization structures, HR motivation theories, information systems, and ICAP ethics.',
    defaultDurationMinutes: 15,
    defaultQuestionCount: 20,
    passingPercentage: 50,
    chapters: [
      { id: 1, name: 'Nature of Business, Stakeholders & Governance' },
      { id: 2, name: 'Organization Structure, Culture & Human Resources' },
      { id: 3, name: 'Marketing, Operations & Information Systems' },
      { id: 4, name: 'Professional Ethics & Corporate Social Responsibility' },
    ],
  },
  {
    id: 'prc-3-v2',
    code: 'PRC 3 (Vol 2)',
    title: 'PRC 3 (Vol 2): Economic Insights',
    shortTitle: 'Economic Insights',
    description: 'Price & cross elasticity of demand, market structures, National Income accounting (GDP/NNP), Keynesian multiplier, and monetary policy.',
    defaultDurationMinutes: 15,
    defaultQuestionCount: 20,
    passingPercentage: 50,
    chapters: [
      { id: 1, name: 'Microeconomics: Demand, Supply & Elasticity' },
      { id: 2, name: 'Cost of Production & Market Structures' },
      { id: 3, name: 'National Income Accounting & Keynesian Multiplier' },
      { id: 4, name: 'Money, Banking, Inflation & Balance of Payments' },
    ],
  },
];

export const SOURCE_LABELS: Record<QuestionSource, { label: string; shortLabel: string; description: string }> = {
  'self-test': {
    label: 'ICAP Self-Test',
    shortLabel: 'Self-Test',
    description: 'Official end-of-chapter ICAP Study Text self-test MCQs',
  },
  'apq': {
    label: 'ICAP APQ',
    shortLabel: 'ICAP APQ',
    description: 'Additional Practice Questions issued by ICAP',
  },
  'practice-set': {
    label: 'Teacher / Practice Set',
    shortLabel: 'Practice Set',
    description: 'Exam-standard faculty mock & practice sets',
  },
};

export const STATIC_QUESTIONS_BY_SUBJECT: Record<SubjectId, Question[]> = {
  'prc-1': prc1Questions as Question[],
  'prc-2': prc2Questions as Question[],
  'prc-3-v1': prc3V1Questions as Question[],
  'prc-3-v2': prc3V2Questions as Question[],
};

export function getAllStaticQuestions(): Question[] {
  return [
    ...(prc1Questions as Question[]),
    ...(prc2Questions as Question[]),
    ...(prc3V1Questions as Question[]),
    ...(prc3V2Questions as Question[]),
  ];
}
