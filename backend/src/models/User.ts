import { Schema, model } from 'mongoose';

export const CURRENCY_CODES = [
  'INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'BDT', 'BRL', 'CAD', 'CHF',
  'CNY', 'DKK', 'HKD', 'IDR', 'JPY', 'KRW', 'KWD', 'LKR', 'MXN', 'MYR',
  'NOK', 'NPR', 'NZD', 'PHP', 'PKR', 'QAR', 'SAR', 'SEK', 'SGD', 'THB', 'ZAR',
] as const;

// passwordHash is scrypt "salt:hash" hex. The password itself is never stored.
const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, trim: true, default: '', maxlength: 40 },
    currency: { type: String, enum: CURRENCY_CODES, default: 'INR' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export const User = model('User', userSchema);
