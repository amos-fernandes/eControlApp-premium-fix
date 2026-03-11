import moment from "moment"
import { create } from "zustand"

interface FilterServiceOrderState {
  filters: {
    status: string
    so_type: string
    start_date?: string
    end_date?: string
    voyage: string
  }
  setFilters: (filters: Partial<FilterServiceOrderState["filters"]>) => void
  resetFilters: () => void
}

const dateFormat = "YYYY-MM-DD"

export const useFilterServiceOrderStore = create<FilterServiceOrderState>((set) => ({
  filters: {
    status: "all",
    so_type: "all",
    start_date: moment().subtract(2, "month").format(dateFormat),
    end_date: moment().add(1, "day").format(dateFormat),
    voyage: "all",
  },
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),
  resetFilters: () =>
    set({
      filters: {
        status: "all",
        so_type: "all",
        start_date: moment().subtract(2, "month").format(dateFormat),
        end_date: moment().add(1, "day").format(dateFormat),
        voyage: "all",
      },
    }),
}))
