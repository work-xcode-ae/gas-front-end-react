import { useEffect, useState } from 'react';
import { api } from './client';

/** Dropdown data shared by many forms. Loaded once per session (and again when the language changes). */
export interface Branch { id: number; code: string; nameEn?: string; nameAr?: string; cityId?: number }
export interface Emirate { id: number; code: string; nameEn?: string; nameAr?: string }
export interface City { id: number; code?: string; nameEn?: string; nameAr?: string; emirateId?: number }
export interface GasType { id: number; code: string; nameEn?: string; nameAr?: string; litreToM3?: number }
export interface Currency { id: number; code: string; nameEn?: string; nameAr?: string; symbol?: string }
export interface LookupValue { id: number; code: string; label: string; nameEn?: string; nameAr?: string; parentId?: number }

export interface ReferenceData {
  branches: Branch[];
  emirates: Emirate[];
  cities: City[];
  gasTypes: GasType[];
  currencies: Currency[];
  /** Lookup values grouped by type code, e.g. lookups.BUILDING_TYPE */
  lookups: Record<string, LookupValue[]>;
}

let cache: { lang: string; promise: Promise<ReferenceData> } | null = null;

export function loadReference(lang: string): Promise<ReferenceData> {
  if (cache && cache.lang === lang) return cache.promise;
  const promise = Promise.all([
    api<Omit<ReferenceData, 'lookups'>>('/lookups/reference'),
    api<Record<string, LookupValue[]>>('/lookups'),
  ]).then(([ref, lookups]) => ({ ...ref, lookups }));
  cache = { lang, promise };
  promise.catch(() => { if (cache?.promise === promise) cache = null; });
  return promise;
}

export function clearReferenceCache() { cache = null; }

/** Hook: { data, loading, error }. */
export function useReference(lang: string) {
  const [data, setData] = useState<ReferenceData | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let alive = true;
    loadReference(lang).then(d => { if (alive) { setData(d); setError(null); } }, e => { if (alive) setError(e); });
    return () => { alive = false; };
  }, [lang]);
  return { data, loading: !data && !error, error };
}

/** Localised name of a record that has nameEn / nameAr. */
export const locName = (r: { nameEn?: string; nameAr?: string } | undefined | null, isAr: boolean) =>
  r ? (isAr ? r.nameAr ?? r.nameEn : r.nameEn ?? r.nameAr) ?? '' : '';
