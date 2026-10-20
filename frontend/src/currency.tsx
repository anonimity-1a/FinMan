import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { CurrencyCode } from './types';

const CurrencyContext = createContext<CurrencyCode>('INR');

export function CurrencyProvider({ code, children }: { code: CurrencyCode; children: ReactNode }) {
  return <CurrencyContext.Provider value={code}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
