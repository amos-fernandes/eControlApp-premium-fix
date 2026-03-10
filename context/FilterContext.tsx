import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface ServiceOrderFilters {
  status: string;
  type: string;
  hasVoyage: string;
  startDate: string;
  endDate: string;
  routeName: string;
  search: string;
}

// Helper para calcular datas
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

const defaultFilters: ServiceOrderFilters = {
  status: "",
  type: "",
  hasVoyage: "",
  startDate: getDateDaysAgo(20), // Últimos 20 dias
  endDate: getTodayDate(),
  routeName: "",
  search: "",
};

interface FilterContextValue {
  filters: ServiceOrderFilters;
  setFilter: <K extends keyof ServiceOrderFilters>(key: K, value: string) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<ServiceOrderFilters>(defaultFilters);

  const setFilter = useCallback(
    <K extends keyof ServiceOrderFilters>(key: K, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters({
      status: "",
      type: "",
      hasVoyage: "",
      startDate: getDateDaysAgo(20),
      endDate: getTodayDate(),
      routeName: "",
      search: "",
    });
  }, []);

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((v) => v !== ""),
    [filters]
  );

  const value = useMemo(
    () => ({ filters, setFilter, resetFilters, hasActiveFilters }),
    [filters, setFilter, resetFilters, hasActiveFilters]
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilters must be used within FilterProvider");
  }
  return context;
}
