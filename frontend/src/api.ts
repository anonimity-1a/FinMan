import type { Account, Category, DailyPoint, CategoryPoint, Page, ParseResult, ParserStat, Summary, Transaction, TransactionInput } from './types';

export const BASE: string = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      ...init,
      credentials: 'include',
      headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    });
  } catch {
    throw new Error("Can't reach the server. Is the backend running?");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  // a 401 anywhere except the login call means the session ended; App listens and shows the sign-in screen
  if (res.status === 401 && path !== '/auth/login' && path !== '/auth/register') window.dispatchEvent(new Event('finman:signed-out'));
  if (!res.ok) throw new ApiError(body?.error?.message ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

export const api = {
  me: () => request<Account>('/auth/me'),
  login: (login: string, password: string) =>
    request<Account>('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
  register: (username: string, password: string, displayName: string) =>
    request<Account>('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, displayName }) }),
  updateProfile: (profile: { displayName: string; currency: string }) =>
    request<Account>('/auth/me', { method: 'PATCH', body: JSON.stringify(profile) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  categories: () => request<Category[]>('/categories'),
  createCategory: (name: string, color: string) =>
    request<Category>('/categories', { method: 'POST', body: JSON.stringify({ name, color }) }),
  updateCategory: (name: string, changes: { name?: string; color?: string }) =>
    request<{ category: Category; transactionsUpdated: number }>(`/categories/${encodeURIComponent(name)}`,
      { method: 'PATCH', body: JSON.stringify(changes) }),
  deleteCategory: (name: string) => request<void>(`/categories/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  summary: (from: string, to: string) => request<Summary>(`/analytics/summary?from=${from}&to=${to}`),
  parserStats: () => request<ParserStat[]>('/analytics/parser'),
  parse: (text: string, source: 'sms' | 'text') =>
    request<ParseResult>('/parse', { method: 'POST', body: JSON.stringify({ text, source }) }),
  parseFile: (file: Blob, name: string) => {
    const fd = new FormData();
    fd.append('file', file, name);
    return request<ParseResult>('/parse/file', { method: 'POST', body: fd });
  },
  list: (q: Record<string, string>) => request<Page<Transaction>>(`/entries?${new URLSearchParams(q)}`),
  get: (id: string) => request<Transaction>(`/entries/${id}`),
  create: (t: TransactionInput) => request<Transaction>('/entries', { method: 'POST', body: JSON.stringify(t) }),
  update: (id: string, t: TransactionInput) =>
    request<Transaction>(`/entries/${id}`, { method: 'PUT', body: JSON.stringify(t) }),
  remove: (id: string) => request<void>(`/entries/${id}`, { method: 'DELETE' }),
  daily: (from: string, to: string) => request<DailyPoint[]>(`/analytics/daily?from=${from}&to=${to}`),
  byCategory: (from: string, to: string) =>
    request<CategoryPoint[]>(`/analytics/categories?from=${from}&to=${to}`),
};
