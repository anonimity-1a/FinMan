import { Schema, model, type InferSchemaType } from 'mongoose';

export const PAYMENT_METHODS = ['UPI', 'Card', 'Cash', 'NetBanking', 'Wallet', 'Other'] as const;
export const SOURCES = ['sms', 'text', 'bill', 'manual'] as const;
export const DIRECTIONS = ['debit', 'credit'] as const;

const transactionSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 0.01 },
    direction: { type: String, enum: DIRECTIONS, default: 'debit' },
    merchant: { type: String, trim: true, default: '' },
    occurredAt: { type: Date, required: true },
    description: { type: String, trim: true, default: '' },
    category: { type: String, required: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'Other' },
    source: { type: String, enum: SOURCES, required: true },
    aiParsed: { type: Boolean, default: false },
    details: { type: Schema.Types.Mixed, default: {} },
    rawInput: { type: String },
    dedupeHash: { type: String },
  },
  { timestamps: true, minimize: false },
);

transactionSchema.index({ occurredAt: -1 });                 // History list, newest first
transactionSchema.index({ direction: 1, occurredAt: -1 });   // analytics: equality field, then range field
transactionSchema.index({ category: 1, occurredAt: -1 });    // History filtered by category
transactionSchema.index(
  { dedupeHash: 1 },
  { unique: true, partialFilterExpression: { dedupeHash: { $type: 'string' } } },
);

export type TransactionDoc = InferSchemaType<typeof transactionSchema>;
export const Transaction = model('Transaction', transactionSchema);
