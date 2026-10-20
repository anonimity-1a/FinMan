export const PAYMENT_METHODS = ['UPI', 'Card', 'Cash', 'NetBanking', 'Wallet', 'Other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type Direction = 'debit' | 'credit';
export type Source = 'sms' | 'text' | 'bill' | 'manual';

export const CURRENCIES = [
  { code: 'INR', name: 'Indian rupee', locale: 'en-IN' },
  { code: 'USD', name: 'US dollar', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', locale: 'de-DE' },
  { code: 'GBP', name: 'British pound', locale: 'en-GB' },
  { code: 'AED', name: 'UAE dirham', locale: 'en-AE' },
  { code: 'AUD', name: 'Australian dollar', locale: 'en-AU' },
  { code: 'BDT', name: 'Bangladeshi taka', locale: 'en-BD' },
  { code: 'BRL', name: 'Brazilian real', locale: 'pt-BR' },
  { code: 'CAD', name: 'Canadian dollar', locale: 'en-CA' },
  { code: 'CHF', name: 'Swiss franc', locale: 'de-CH' },
  { code: 'CNY', name: 'Chinese yuan', locale: 'zh-CN' },
  { code: 'DKK', name: 'Danish krone', locale: 'da-DK' },
  { code: 'HKD', name: 'Hong Kong dollar', locale: 'en-HK' },
  { code: 'IDR', name: 'Indonesian rupiah', locale: 'id-ID' },
  { code: 'JPY', name: 'Japanese yen', locale: 'ja-JP' },
  { code: 'KRW', name: 'South Korean won', locale: 'ko-KR' },
  { code: 'KWD', name: 'Kuwaiti dinar', locale: 'en-KW' },
  { code: 'LKR', name: 'Sri Lankan rupee', locale: 'en-LK' },
  { code: 'MXN', name: 'Mexican peso', locale: 'es-MX' },
  { code: 'MYR', name: 'Malaysian ringgit', locale: 'ms-MY' },
  { code: 'NOK', name: 'Norwegian krone', locale: 'nb-NO' },
  { code: 'NPR', name: 'Nepalese rupee', locale: 'en-NP' },
  { code: 'NZD', name: 'New Zealand dollar', locale: 'en-NZ' },
  { code: 'PHP', name: 'Philippine peso', locale: 'en-PH' },
  { code: 'PKR', name: 'Pakistani rupee', locale: 'en-PK' },
  { code: 'QAR', name: 'Qatari riyal', locale: 'en-QA' },
  { code: 'SAR', name: 'Saudi riyal', locale: 'en-SA' },
  { code: 'SEK', name: 'Swedish krona', locale: 'sv-SE' },
  { code: 'SGD', name: 'Singapore dollar', locale: 'en-SG' },
  { code: 'THB', name: 'Thai baht', locale: 'th-TH' },
  { code: 'ZAR', name: 'South African rand', locale: 'en-ZA' },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

export interface Account {
  id: string;
  username: string;
  email: string | null;
  displayName: string;
  currency: CurrencyCode;
  createdAt: string;
  lastLoginAt: string | null;
}

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
