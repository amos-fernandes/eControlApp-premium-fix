/**
 * Interfaces para métricas de logística do eControlApp
 * 
 * @version 1.0.0
 * @date 2026-03-24
 */

/**
 * Métricas diárias por motorista
 */
export interface DailyMetrics {
  id: number;
  driver_id: string;
  driver_name?: string;
  date: string;
  total_os: number;
  total_km: number;
  total_fuel_liters?: number;
  total_time_hours: number;
  on_time_deliveries: number;
  late_deliveries: number;
  avg_time_per_os: number;
  avg_km_per_os: number;
  created_at: string;
}

/**
 * Métricas por veículo
 */
export interface VehicleMetrics {
  id: number;
  vehicle_id: string;
  vehicle_name?: string;
  date: string;
  km_start: number;
  km_end: number;
  total_km: number;
  fuel_liters?: number;
  os_count: number;
  status: 'operating' | 'maintenance' | 'idle';
  created_at: string;
}

/**
 * Métricas consolidadas mensais
 */
export interface MonthlyMetrics {
  id: number;
  month: string; // YYYY-MM
  year: number;
  total_os: number;
  total_km: number;
  total_fuel_liters?: number;
  total_fuel_cost?: number;
  avg_km_per_os: number;
  avg_time_per_os: number;
  fuel_efficiency?: number; // km/L
  on_time_percentage: number;
  route_optimization_percentage?: number;
  productivity?: number; // OS/dia
  fleet_utilization?: number; // %
  cost_savings?: number; // Economia em R$
  created_at: string;
}

/**
 * KPIs consolidados de logística
 */
export interface LogisticsKPIs {
  // Rota
  kmPerOS: number;
  routeOptimization: number;
  
  // Tempo
  avgTimePerOS: number;
  onTimePercentage: number;
  
  // Combustível
  fuelEfficiency: number;
  fuelCost: number;
  costSavings: number;
  
  // Produtividade
  productivity: number; // OS/dia
  totalOS: number;
  
  // Frota
  fleetUtilization: number;
  vehiclesOperating: number;
  vehiclesTotal: number;
  
  // Período
  period: 'week' | 'month' | 'year';
  startDate: string;
  endDate: string;
}

/**
 * Configurações de metas de logística
 */
export interface LogisticsTargets {
  kmPerOS: number; // Meta: < 15 km/OS
  avgTimePerOS: number; // Meta: < 4 horas
  fuelEfficiency: number; // Meta: > 8 km/L
  onTimePercentage: number; // Meta: > 90%
  productivity: number; // Meta: > 5 OS/dia
  fleetUtilization: number; // Meta: > 85%
}

/**
 * Dados para exibição no card de logística
 */
export interface LogisticsCardData {
  kmPerOS: { value: number; status: 'good' | 'warning' | 'bad' };
  avgTimePerOS: { value: number; status: 'good' | 'warning' | 'bad' };
  fuelEfficiency: { value: number; status: 'good' | 'warning' | 'bad' };
  productivity: { value: number; status: 'good' | 'warning' | 'bad' };
  onTimePercentage: { value: number; status: 'good' | 'warning' | 'bad' };
  fleetUtilization: { value: number; status: 'good' | 'warning' | 'bad' };
}

/**
 * Comparação de métricas (atual vs anterior)
 */
export interface MetricsComparison {
  current: number;
  previous: number;
  change: number; // % de mudança
  trend: 'up' | 'down' | 'stable';
}
