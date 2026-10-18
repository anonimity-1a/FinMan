import { Schema, model } from 'mongoose';

const categorySchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  color: { type: String, required: true },   // hex, used by charts
});

export const Category = model('Category', categorySchema);
