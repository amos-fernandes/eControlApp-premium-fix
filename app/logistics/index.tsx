/**
 * Tela completa de Logística do eControlApp
 * 
 * @version 1.0.0
 * @date 2026-03-24
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/constants/theme';
import { useQuery } from '@tanstack/react-query';
import { 
  getLogisticsKPIs, 
  evaluateKPIStatus,
  LOGISTICS_TARGETS 
} from '@/services/logisticsMetrics';
import type { LogisticsKPIs } from '@/interfaces/LogisticsMetrics';

type Period = 'week' | 'month' | 'year';

export default function LogisticsScreen() {
  const { theme } = useTheme();
  const [period, setPeriod] = useState<Period>('month');
  const [refreshing, setRefreshing] = useState(false);
  
  const { data: kpis, isLoading, refetch } = useQuery<LogisticsKPIs>({
    queryKey: ['logistics_kpis', period],
    queryFn: () => getLogisticsKPIs(period),
  });
  
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };
  
  if (isLoading && !kpis) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Carregando logística...
        </Text>
      </View>
    );
  }
  
  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          tintColor={theme.primary}
        />
      }
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Logística
        </Text>
        
        <PeriodSelector period={period} setPeriod={setPeriod} />
      </View>
      
      {/* Resumo */}
      <View style={[styles.summaryCard, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          📈 Resumo do Período
        </Text>
        
        <View style={styles.summaryGrid}>
          <SummaryItem 
            label="Total de OS" 
            value={kpis?.totalOS?.toString() || '0'} 
            icon="clipboard-check-outline"
          />
          <SummaryItem 
            label="KM Total" 
            value={`${(kpis?.totalOS || 0) * (kpis?.kmPerOS || 0) | 0} km`} 
            icon="map-marker-distance"
          />
          <SummaryItem 
            label="Produtividade" 
            value={`${kpis?.productivity?.toFixed(1) || '0'} OS/dia`} 
            icon="chart-bar"
            highlight
          />
          <SummaryItem 
            label="Pontualidade" 
            value={`${kpis?.onTimePercentage?.toFixed(0) || '0'}%`} 
            icon="clock-check-outline"
            highlight
          />
        </View>
      </View>
      
      {/* KPIs Detalhados */}
      <Text style={[styles.sectionSubtitle, { color: theme.text }]}>
        Indicadores de Desempenho
      </Text>
      
      <KPIMetricCard
        icon="map-marker-radius"
        title="Economia de Rota"
        value={`${kpis?.kmPerOS?.toFixed(1) || '0'} km/OS`}
        target={`< ${LOGISTICS_TARGETS.kmPerOS} km/OS`}
        status={kpis ? evaluateKPIStatus('kmPerOS', kpis.kmPerOS) : 'warning'}
        description="Quilometragem média por ordem de serviço"
      />
      
      <KPIMetricCard
        icon="clock-outline"
        title="Tempo Médio de Viagem"
        value={`${kpis?.avgTimePerOS?.toFixed(1) || '0'} horas`}
        target={`< ${LOGISTICS_TARGETS.avgTimePerOS} horas`}
        status={kpis ? evaluateKPIStatus('avgTimePerOS', kpis.avgTimePerOS) : 'warning'}
        description="Tempo médio gasto em cada coleta"
      />
      
      <KPIMetricCard
        icon="gas-station"
        title="Eficiência de Combustível"
        value={kpis?.fuelEfficiency && kpis.fuelEfficiency > 0 ? `${kpis.fuelEfficiency.toFixed(1)} km/L` : 'N/A'}
        target={`> ${LOGISTICS_TARGETS.fuelEfficiency} km/L`}
        status={kpis && kpis.fuelEfficiency > 0 ? evaluateKPIStatus('fuelEfficiency', kpis.fuelEfficiency) : 'warning'}
        description="Quilômetros percorridos por litro de combustível"
      />
      
      <KPIMetricCard
        icon="clock-check-outline"
        title="Pontualidade"
        value={`${kpis?.onTimePercentage?.toFixed(0) || '0'}%`}
        target={`> ${LOGISTICS_TARGETS.onTimePercentage}%`}
        status={kpis ? evaluateKPIStatus('onTimePercentage', kpis.onTimePercentage) : 'warning'}
        description="Porcentagem de coletas realizadas no horário"
      />
      
      <KPIMetricCard
        icon="chart-bar"
        title="Produtividade"
        value={`${kpis?.productivity?.toFixed(1) || '0'} OS/dia`}
        target={`> ${LOGISTICS_TARGETS.productivity} OS/dia`}
        status={kpis ? evaluateKPIStatus('productivity', kpis.productivity) : 'warning'}
        description="Média de ordens de serviço por motorista por dia"
      />
      
      <KPIMetricCard
        icon="truck"
        title="Utilização da Frota"
        value={kpis?.fleetUtilization && kpis.fleetUtilization > 0 ? `${kpis.fleetUtilization.toFixed(0)}%` : 'N/A'}
        target={`> ${LOGISTICS_TARGETS.fleetUtilization}%`}
        status={kpis && kpis.fleetUtilization > 0 ? evaluateKPIStatus('fleetUtilization', kpis.fleetUtilization) : 'warning'}
        description="Porcentagem de veículos em operação"
      />
      
      {/* Legenda */}
      <View style={[styles.legendCard, { backgroundColor: theme.surface }]}>
        <Text style={[styles.legendTitle, { color: theme.text }]}>
          Legenda de Status
        </Text>
        
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={[styles.legendText, { color: theme.textSecondary }]}>
            Dentro da meta
          </Text>
          
          <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={[styles.legendText, { color: theme.textSecondary }]}>
            Atenção
          </Text>
          
          <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={[styles.legendText, { color: theme.textSecondary }]}>
            Fora da meta
          </Text>
        </View>
      </View>
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

/**
 * Seletor de Período
 */
function PeriodSelector({ 
  period, 
  setPeriod 
}: { 
  period: Period; 
  setPeriod: (p: Period) => void;
}) {
  const { theme } = useTheme();
  
  const periods: { value: Period; label: string }[] = [
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mês' },
    { value: 'year', label: 'Ano' },
  ];
  
  return (
    <View style={[styles.periodSelector, { backgroundColor: theme.surfaceSecondary }]}>
      {periods.map((p) => (
        <Pressable
          key={p.value}
          onPress={() => setPeriod(p.value)}
          style={[
            styles.periodButton,
            period === p.value && { backgroundColor: theme.primary },
          ]}
        >
          <Text
            style={[
              styles.periodButtonText,
              { color: period === p.value ? '#fff' : theme.textSecondary },
            ]}
          >
            {p.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Item de resumo
 */
function SummaryItem({ 
  label, 
  value, 
  icon,
  highlight 
}: { 
  label: string; 
  value: string; 
  icon: string;
  highlight?: boolean;
}) {
  const { theme } = useTheme();
  
  return (
    <View style={[
      styles.summaryItem, 
      { 
        backgroundColor: highlight ? theme.primary + '15' : theme.surfaceSecondary,
        borderColor: highlight ? theme.primary : theme.border,
      }
    ]}>
      <MaterialCommunityIcons 
        name={icon as any} 
        size={20} 
        color={highlight ? theme.primary : theme.textSecondary} 
      />
      <Text style={[styles.summaryValue, { color: theme.text }]}>
        {value}
      </Text>
      <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Card de métrica KPI
 */
function KPIMetricCard({
  icon,
  title,
  value,
  target,
  status,
  description,
}: {
  icon: string;
  title: string;
  value: string;
  target: string;
  status: 'good' | 'warning' | 'bad';
  description: string;
}) {
  const { theme } = useTheme();
  
  const statusColor = 
    status === 'good' ? '#10B981' : 
    status === 'warning' ? '#F59E0B' : '#EF4444';
  
  const statusIcon = 
    status === 'good' ? 'check-circle' : 
    status === 'warning' ? 'alert-circle' : 'close-circle';
  
  return (
    <View style={[styles.kpiCard, { backgroundColor: theme.surface }]}>
      <View style={styles.kpiHeader}>
        <View style={styles.kpiTitleRow}>
          <MaterialCommunityIcons 
            name={icon as any} 
            size={20} 
            color={statusColor} 
          />
          <Text style={[styles.kpiTitle, { color: theme.text }]}>
            {title}
          </Text>
        </View>
        
        <MaterialCommunityIcons 
          name={statusIcon as any} 
          size={20} 
          color={statusColor} 
        />
      </View>
      
      <View style={styles.kpiContent}>
        <Text style={[styles.kpiValue, { color: theme.text }]}>
          {value}
        </Text>
        <Text style={[styles.kpiTarget, { color: theme.textSecondary }]}>
          Meta: {target}
        </Text>
      </View>
      
      <Text style={[styles.kpiDescription, { color: theme.textMuted }]}>
        {description}
      </Text>
      
      {/* Barra de progresso */}
      <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
        <View 
          style={[
            styles.progressFill, 
            { 
              backgroundColor: statusColor,
              width: status === 'good' ? '100%' : status === 'warning' ? '70%' : '40%',
            }
          ]} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    padding: 16,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  periodSelector: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryCard: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 12,
  },
  kpiCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  kpiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kpiTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  kpiContent: {
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  kpiTarget: {
    fontSize: 14,
  },
  kpiDescription: {
    fontSize: 12,
    marginBottom: 12,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  legendCard: {
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    marginRight: 8,
  },
});
