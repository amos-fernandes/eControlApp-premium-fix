/**
 * Services para cálculo e gestão de métricas de logística
 * 
 * @version 1.0.0
 * @date 2026-03-24
 */

import { getDB } from '@/databases/database';
import type { 
  DailyMetrics, 
  VehicleMetrics, 
  MonthlyMetrics, 
  LogisticsKPIs,
  LogisticsTargets 
} from '@/interfaces/LogisticsMetrics';
import type { ServiceOrder } from './api';

/**
 * Configurações de metas padrão
 */
export const LOGISTICS_TARGETS: LogisticsTargets = {
  kmPerOS: 15, // Meta: < 15 km/OS
  avgTimePerOS: 4, // Meta: < 4 horas
  fuelEfficiency: 8, // Meta: > 8 km/L
  onTimePercentage: 90, // Meta: > 90%
  productivity: 5, // Meta: > 5 OS/dia
  fleetUtilization: 85, // Meta: > 85%
};

/**
 * Salva métricas diárias de um motorista
 */
export const saveDailyMetrics = async (metrics: Omit<DailyMetrics, 'id' | 'created_at'>) => {
  const db = getDB();
  
  try {
    db.runSync(
      `INSERT OR REPLACE INTO daily_metrics (
        driver_id, driver_name, date, total_os, total_km,
        total_fuel_liters, total_time_hours, on_time_deliveries,
        late_deliveries, avg_time_per_os, avg_km_per_os
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        metrics.driver_id,
        metrics.driver_name,
        metrics.date,
        metrics.total_os,
        metrics.total_km,
        metrics.total_fuel_liters,
        metrics.total_time_hours,
        metrics.on_time_deliveries,
        metrics.late_deliveries,
        metrics.avg_time_per_os,
        metrics.avg_km_per_os,
      ]
    );
    
    console.log(`[LogisticsMetrics] Daily metrics saved for ${metrics.driver_id} on ${metrics.date}`);
    return true;
  } catch (error) {
    console.error('[LogisticsMetrics] Error saving daily metrics:', error);
    return false;
  }
};

/**
 * Salva métricas diárias de um veículo
 */
export const saveVehicleMetrics = async (metrics: Omit<VehicleMetrics, 'id' | 'total_km' | 'created_at'>) => {
  const db = getDB();
  const totalKm = metrics.km_end - metrics.km_start;
  
  try {
    db.runSync(
      `INSERT OR REPLACE INTO vehicle_metrics (
        vehicle_id, vehicle_name, date, km_start, km_end,
        total_km, fuel_liters, os_count, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        metrics.vehicle_id,
        metrics.vehicle_name,
        metrics.date,
        metrics.km_start,
        metrics.km_end,
        totalKm,
        metrics.fuel_liters,
        metrics.os_count,
        metrics.status,
      ]
    );
    
    console.log(`[LogisticsMetrics] Vehicle metrics saved for ${metrics.vehicle_id} on ${metrics.date}`);
    return true;
  } catch (error) {
    console.error('[LogisticsMetrics] Error saving vehicle metrics:', error);
    return false;
  }
};

/**
 * Salva métricas mensais consolidadas
 */
export const saveMonthlyMetrics = async (metrics: Omit<MonthlyMetrics, 'id' | 'created_at'>) => {
  const db = getDB();
  
  try {
    db.runSync(
      `INSERT OR REPLACE INTO monthly_metrics (
        month, year, total_os, total_km, total_fuel_liters,
        total_fuel_cost, avg_km_per_os, avg_time_per_os,
        fuel_efficiency, on_time_percentage, route_optimization_percentage,
        productivity, fleet_utilization, cost_savings
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        metrics.month,
        metrics.year,
        metrics.total_os,
        metrics.total_km,
        metrics.total_fuel_liters,
        metrics.total_fuel_cost,
        metrics.avg_km_per_os,
        metrics.avg_time_per_os,
        metrics.fuel_efficiency,
        metrics.on_time_percentage,
        metrics.route_optimization_percentage,
        metrics.productivity,
        metrics.fleet_utilization,
        metrics.cost_savings,
      ]
    );
    
    console.log(`[LogisticsMetrics] Monthly metrics saved for ${metrics.month}/${metrics.year}`);
    return true;
  } catch (error) {
    console.error('[LogisticsMetrics] Error saving monthly metrics:', error);
    return false;
  }
};

/**
 * Calcula métricas diárias a partir das OS finalizadas
 */
export const calculateDailyMetrics = async (
  driverId: string,
  driverName: string,
  date: string,
  orders: ServiceOrder[]
): Promise<boolean> => {
  if (orders.length === 0) return false;
  
  const totalOS = orders.length;
  
  // Calcula KM total
  const totalKM = orders.reduce((sum, os) => {
    const kmStart = parseFloat(os.start_km || '0');
    const kmEnd = parseFloat(os.end_km || '0');
    return sum + (kmEnd - kmStart);
  }, 0);
  
  // Calcula tempo total em horas
  const totalTime = orders.reduce((sum, os) => {
    const arrival = new Date(os.arrival_date || Date.now());
    const departure = new Date(os.departure_date || Date.now());
    return sum + (departure.getTime() - arrival.getTime()) / 1000 / 3600;
  }, 0);
  
  // Calcula médias
  const avgKmPerOS = totalKM / totalOS;
  const avgTimePerOS = totalTime / totalOS;
  
  // Conta coletas pontuais (exemplo: dentro de 2 horas do horário previsto)
  // TODO: Implementar lógica real de pontualidade
  const onTimeCount = totalOS; // Placeholder
  
  const metrics: Omit<DailyMetrics, 'id' | 'created_at'> = {
    driver_id: driverId,
    driver_name: driverName,
    date,
    total_os: totalOS,
    total_km: totalKM,
    total_fuel_liters: undefined, // TODO: Implementar quando tiver dados de combustível
    total_time_hours: totalTime,
    on_time_deliveries: onTimeCount,
    late_deliveries: totalOS - onTimeCount,
    avg_time_per_os: avgTimePerOS,
    avg_km_per_os: avgKmPerOS,
  };
  
  return saveDailyMetrics(metrics);
};

/**
 * Calcula e consolida métricas mensais
 */
export const calculateMonthlyMetrics = async (
  month: string,
  year: number
): Promise<boolean> => {
  const db = getDB();
  
  try {
    // Agrega métricas diárias do mês
    const result: any = db.getFirstSync(
      `SELECT 
        SUM(total_os) as total_os,
        SUM(total_km) as total_km,
        SUM(total_fuel_liters) as total_fuel,
        SUM(total_time_hours) as total_time,
        SUM(on_time_deliveries) as on_time,
        AVG(avg_km_per_os) as avg_km_per_os,
        AVG(avg_time_per_os) as avg_time_per_os,
        COUNT(DISTINCT driver_id) as total_drivers,
        COUNT(DISTINCT date) as total_days
      FROM daily_metrics
      WHERE strftime('%Y-%m', date) = ?`,
      [`${year}-${month}`]
    );
    
    if (!result || !result.total_os) {
      console.log('[LogisticsMetrics] No data to consolidate for', month, year);
      return false;
    }
    
    // Calcula KPIs consolidados
    const totalOS = result.total_os || 0;
    const totalKM = result.total_km || 0;
    const totalTime = result.total_time || 0;
    const onTimeCount = result.on_time || 0;
    
    const avgKmPerOS = result.avg_km_per_os || 0;
    const avgTimePerOS = result.avg_time_per_os || 0;
    const onTimePercentage = totalOS > 0 ? (onTimeCount * 100 / totalOS) : 0;
    const productivity = result.total_days > 0 ? (totalOS / result.total_days / result.total_drivers) : 0;
    
    // TODO: Calcular eficiência de combustível quando tiver dados
    const fuelEfficiency = 0;
    const costSavings = 0;
    
    const metrics: Omit<MonthlyMetrics, 'id' | 'created_at'> = {
      month,
      year,
      total_os: totalOS,
      total_km: totalKM,
      total_fuel_liters: result.total_fuel || 0,
      total_fuel_cost: 0, // TODO: Calcular quando tiver preço do combustível
      avg_km_per_os: avgKmPerOS,
      avg_time_per_os: avgTimePerOS,
      fuel_efficiency: fuelEfficiency,
      on_time_percentage: onTimePercentage,
      route_optimization_percentage: 0, // TODO: Implementar
      productivity: productivity,
      fleet_utilization: 0, // TODO: Implementar
      cost_savings: costSavings,
    };
    
    return saveMonthlyMetrics(metrics);
  } catch (error) {
    console.error('[LogisticsMetrics] Error calculating monthly metrics:', error);
    return false;
  }
};

/**
 * Obtém KPIs de logística para um período
 */
export const getLogisticsKPIs = async (
  period: 'week' | 'month' | 'year' = 'month'
): Promise<LogisticsKPIs> => {
  const db = getDB();
  
  try {
    // Busca métricas mais recentes
    const metrics: MonthlyMetrics | undefined = db.getFirstSync(
      `SELECT * FROM monthly_metrics 
       ORDER BY created_at DESC 
       LIMIT 1`
    );
    
    if (!metrics) {
      console.log('[LogisticsMetrics] No metrics found');
      return getDefaultKPIs(period);
    }
    
    // Calcula datas do período
    const now = new Date();
    let startDate: string;
    let endDate: string;
    
    if (period === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = weekAgo.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0];
    } else if (period === 'month') {
      startDate = `${metrics.year}-${metrics.month}-01`;
      const lastDay = new Date(metrics.year, parseInt(metrics.month), 0);
      endDate = lastDay.toISOString().split('T')[0];
    } else {
      startDate = `${metrics.year}-01-01`;
      endDate = `${metrics.year}-12-31`;
    }
    
    return {
      kmPerOS: metrics.avg_km_per_os || 0,
      routeOptimization: metrics.route_optimization_percentage || 0,
      avgTimePerOS: metrics.avg_time_per_os || 0,
      onTimePercentage: metrics.on_time_percentage || 0,
      fuelEfficiency: metrics.fuel_efficiency || 0,
      fuelCost: metrics.total_fuel_cost || 0,
      costSavings: metrics.cost_savings || 0,
      productivity: metrics.productivity || 0,
      totalOS: metrics.total_os || 0,
      fleetUtilization: metrics.fleet_utilization || 0,
      vehiclesOperating: 0, // TODO: Implementar
      vehiclesTotal: 0, // TODO: Implementar
      period,
      startDate,
      endDate,
    };
  } catch (error) {
    console.error('[LogisticsMetrics] Error getting KPIs:', error);
    return getDefaultKPIs(period);
  }
};

/**
 * Retorna KPIs padrão (quando não há dados)
 */
const getDefaultKPIs = (period: 'week' | 'month' | 'year'): LogisticsKPIs => {
  const now = new Date();
  const startDate = now.toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];
  
  return {
    kmPerOS: 0,
    routeOptimization: 0,
    avgTimePerOS: 0,
    onTimePercentage: 0,
    fuelEfficiency: 0,
    fuelCost: 0,
    costSavings: 0,
    productivity: 0,
    totalOS: 0,
    fleetUtilization: 0,
    vehiclesOperating: 0,
    vehiclesTotal: 0,
    period,
    startDate,
    endDate,
  };
};

/**
 * Avalia status de um KPI comparado com a meta
 */
export const evaluateKPIStatus = (
  kpi: keyof LogisticsTargets,
  value: number
): 'good' | 'warning' | 'bad' => {
  const target = LOGISTICS_TARGETS[kpi];
  
  // KPIs onde menor é melhor (km/OS, tempo, combustível)
  const lowerIsBetter = ['kmPerOS', 'avgTimePerOS'].includes(kpi);
  
  if (lowerIsBetter) {
    if (value <= target * 0.9) return 'good';
    if (value <= target) return 'good';
    if (value <= target * 1.2) return 'warning';
    return 'bad';
  } else {
    // KPIs onde maior é melhor (eficiência, pontualidade, produtividade)
    if (value >= target * 1.1) return 'good';
    if (value >= target) return 'good';
    if (value >= target * 0.9) return 'warning';
    return 'bad';
  }
};

/**
 * Calcula mudança percentual entre dois valores
 */
export const calculateChange = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};
