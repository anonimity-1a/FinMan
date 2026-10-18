export const PAYMENT_METHODS = ['UPI', 'Card', 'Cash', 'NetBanking', 'Wallet', 'Other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type Direction = 'debit' | 'credit';
export type Source = 'sms' | 'text' | 'bill' | 'manual';

export interface Category {
  _id: string;
  name: string;
  color: string;
  transactionCount?: number;
}

export interface TransactionInput {
  amount: number;
  direction: Direction;
  merchant: string;
  occurredAt: string;
  description: string;
  category: string;
  paymentMethod: PaymentMethod;
  source: Source;
  aiParsed: boolean;
  details: Record<string, unknown>;
  rawInput?: string;
}

export interface Transaction extends TransactionInput {
  _id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParseFields {
  amount: number | null;
  direction: Direction | null;
  merchant: string | null;
  date: string | null;
  time: string | null;
  description: string | null;
  category: string | null;
  paymentMethod: PaymentMethod | null;
  details: Record<string, unknown>;
}

export interface ParseResult {
  isTransaction: boolean;
  fields: ParseFields | null;
  aiFilled: string[];
  missing: string[];
  warnings: string[];
  rawInput: string;
  source: Source;
}

export interface DailyPoint {
  day: string;
  total: number;
  count: number;
}

export interface CategoryPoint {
  category: string;
  total: number;
  count: number;
  color: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface Bucket { name: string; total: number; count: number }

export interface Summary {
  from: string;
  to: string;
  days: number;
  spent: number;
  received: number;
  net: number;
  count: number;
  avgPerDay: number;
  aiParsedShare: number;
  byMethod: Bucket[];
  topMerchants: Bucket[];
  largest: { merchant: string; amount: number; category: string; occurredAt: string } | null;
}

export interface ParserStat { model: string; runs: number; successRate: number; avgMs: number }
