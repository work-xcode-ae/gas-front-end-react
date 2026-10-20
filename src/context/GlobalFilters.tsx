import React, { createContext, useContext, useMemo, useState } from 'react';
import type { Dayjs } from 'dayjs';

/** Filters chosen in the header toolbar, shared by every page that supports them. */
export interface GlobalFilters {
  /** selected month (null = no period filter) */
  month: Dayjs | null;
  branchId?: number;
  /** BUILDING_TYPE code (residential / commercial …) */
  buildingType?: string;
  /** global search text (applied on Enter) */
  search: string;
  /** bumps on every Enter in the search box, so pages re-apply the same text */
  searchNonce: number;
}

interface Ctx extends GlobalFilters {
  setMonth: (m: Dayjs | null) => void;
  setBranchId: (id?: number) => void;
  setBuildingType: (t?: string) => void;
  submitSearch: (text: string) => void;
}

const GlobalFiltersContext = createContext<Ctx | null>(null);

export const GlobalFiltersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [month, setMonth] = useState<Dayjs | null>(null);
  const [branchId, setBranchId] = useState<number | undefined>();
  const [buildingType, setBuildingType] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [searchNonce, setSearchNonce] = useState(0);
  const value = useMemo<Ctx>(() => ({
    month, branchId, buildingType, search, searchNonce,
    setMonth, setBranchId, setBuildingType,
    submitSearch: (text: string) => { setSearch(text.trim()); setSearchNonce(n => n + 1); },
  }), [month, branchId, buildingType, search, searchNonce]);
  return <GlobalFiltersContext.Provider value={value}>{children}</GlobalFiltersContext.Provider>;
};

/** Header toolbar filters. Outside the provider it returns empty filters (no-op setters). */
export function useGlobalFilters(): Ctx {
  return useContext(GlobalFiltersContext) ?? {
    month: null, search: '', searchNonce: 0,
    setMonth: () => undefined, setBranchId: () => undefined, setBuildingType: () => undefined, submitSearch: () => undefined,
  };
}
