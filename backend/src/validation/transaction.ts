import { z } from 'zod';
import { DIRECTIONS, PAYMENT_METHODS, SOURCES } from '../models/Transaction.js';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const transactionInput = z.object({
  amount: z.coerce.number().positive().max(10_000_000).transform((n) => Math.round(n * 100) / 100),
  direction: z.enum(DIRECTIONS).default('debit'),
  merchant: z.string().trim().max(120).default(''),
  occurredAt: z.coerce.date().refine((d) => d.getTime() < Date.now() + 86_400_000, 'Date is in the future'),
  description: z.string().trim().max(500).default(''),
  category: z.string().trim().min(1),
  paymentMethod: z.enum(PAYMENT_METHODS).default('Other'),
  source: z.enum(SOURCES).default('manual'),
  aiParsed: z.boolean().default(false),
  details: z.record(z.string(), z.unknown()).default({}),
  rawInput: z.string().max(5000).optional(),
});
export type TransactionInput = z.infer<typeof transactionInput>;

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  from: ymd.optional(),
  to: ymd.optional(),
  category: z.string().optional(),
  q: z.string().trim().max(100).optional(),
});

export const rangeQuery = z.object({ from: ymd, to: ymd }).refine((r) => r.from <= r.to, 'from must be before to');
export const optionalRangeQuery = z
  .object({ from: ymd.optional(), to: ymd.optional() })
  .refine((r) => !r.from || !r.to || r.from <= r.to, 'from must be before to');
