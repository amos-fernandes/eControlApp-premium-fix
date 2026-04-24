/**
 * Tela de Logística do eControlApp (Tab LOG)
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
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/constants/theme';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { 
  getLogisticsKPIs, 
  evaluateKPIStatus,
  LOGISTICS_TARGETS 
} from '@/services/logisticsMetrics';
import type { LogisticsKPIs } from '@/interfaces/LogisticsMetrics';

type Period = 'week' | 'month' | 'year';

export default function LogScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
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
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Carregando métricas...
        </Text>
      </View>
    );
  }
  
  const topPadding = Platform.OS === "web" ? 20 : insets.top + 10;

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
      contentContainerStyle={{ paddingTop: topPadding }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Logística & Desempenho
        </Text>
        
        <PeriodSelector period={period} setPeriod={setPeriod} />
      </View>
      
      {/* Resumo */}
      <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
            value={`${Math.round((kpis?.totalOS || 0) * (kpis?.kmPerOS || 0))} km`} 
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
        Indicadores de Eficiência
      </Text>
      
      <KPIMetricCard
        icon="map-marker-radius"
        title="Consumo de Rota"
        value={`${kpis?.kmPerOS?.toFixed(1) || '0'} km/OS`}
        target={`< ${LOGISTICS_TARGETS.kmPerOS} km/OS`}
        status={kpis ? evaluateKPIStatus('kmPerOS', kpis.kmPerOS) : 'warning'}
        description="Média de quilômetros rodados por OS finalizada"
      />
      
      <KPIMetricCard
        icon="clock-outline"
        title="Tempo de Atendimento"
        value={`${kpis?.avgTimePerOS?.toFixed(1) || '0'} h`}
        target={`< ${LOGISTICS_TARGETS.avgTimePerOS} h`}
        status={kpis ? evaluateKPIStatus('avgTimePerOS', kpis.avgTimePerOS) : 'warning'}
        description="Tempo médio gasto por ordem de serviço"
      />
      
      <KPIMetricCard
        icon="clock-check-outline"
        title="Pontualidade"
        value={`${kpis?.onTimePercentage?.toFixed(0) || '0'}%`}
        target={`> ${LOGISTICS_TARGETS.onTimePercentage}%`}
        status={kpis ? evaluateKPIStatus('onTimePercentage', kpis.onTimePercentage) : 'warning'}
        description="Porcentagem de coletas no horário previsto"
      />
      
      <KPIMetricCard
        icon="chart-bar"
        title="Média Diária"
        value={`${kpis?.productivity?.toFixed(1) || '0'} OS/dia`}
        target={`> ${LOGISTICS_TARGETS.productivity} OS/dia`}
        status={kpis ? evaluateKPIStatus('productivity', kpis.productivity) : 'warning'}
        description="Quantidade de coletas realizadas por dia"
      />
      
      {/* Legenda */}
      <View style={[styles.legendCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.legendTitle, { color: theme.text }]}>
          Legenda de Metas
        </Text>
        
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Meta atingida</Text>
          </View>
          
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Atenção</Text>
          </View>
          
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Abaixo</Text>
          </View>
        </View>
      </View>
      
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function PeriodSelector({ period, setPeriod }: { period: Period; setPeriod: (p: Period) => void; }) {
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
            period === p.value && { backgroundColor: Colors.primary },
          ]}
        >
          <Text style={[styles.periodButtonText, { color: period === p.value ? '#fff' : theme.textSecondary }]}>
            {p.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function SummaryItem({ label, value, icon, highlight }: { label: string; value: string; icon: string; highlight?: boolean; }) {
  const { theme } = useTheme();
  return (
    <View style={[
      styles.summaryItem, 
      { 
        backgroundColor: highlight ? Colors.primary + '10' : theme.surfaceSecondary,
        borderColor: highlight ? theme.primary : theme.border,
      }
    ]}>
      <MaterialCommunityIcons name={icon as any} size={20} color={highlight ? theme.primary : theme.textSecondary} />
      <Text style={[styles.summaryValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function KPIMetricCard({ icon, title, value, target, status, description }: { icon: string; title: string; value: string; target: string; status: 'good' | 'warning' | 'bad'; description: string; }) {
  const { theme } = useTheme();
  const statusColor = status === 'good' ? '#10B981' : status === 'warning' ? '#F59E0B' : '#EF4444';
  
  return (
    <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.kpiHeader}>
        <View style={styles.kpiTitleRow}>
          <MaterialCommunityIcons name={icon as any} size={20} color={statusColor} />
          <Text style={[styles.kpiTitle, { color: theme.text }]}>{title}</Text>
        </View>
        <MaterialCommunityIcons name={status === 'good' ? 'check-circle' : status === 'warning' ? 'alert-circle' : 'close-circle'} size={18} color={statusColor} />
      </View>
      <View style={styles.kpiContent}>
        <Text style={[styles.kpiValue, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.kpiTarget, { color: theme.textSecondary }]}>Meta: {target}</Text>
      </View>
      <Text style={[styles.kpiDescription, { color: theme.textMuted }]}>{description}</Text>
      <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
        <View style={[styles.progressFill, { backgroundColor: statusColor, width: status === 'good' ? '100%' : status === 'warning' ? '65%' : '35%' }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  header: { padding: 16 },
  headerTitle: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  periodSelector: { flexDirection: 'row', borderRadius: 12, padding: 4 },
  periodButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  periodButtonText: { fontSize: 13, fontWeight: '600' },
  summaryCard: { margin: 16, borderRadius: 16, padding: 16, borderWidth: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  sectionSubtitle: { fontSize: 16, fontWeight: '600', marginHorizontal: 16, marginBottom: 12 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryItem: { flex: 1, minWidth: '45%', padding: 14, borderRadius: 12, alignItems: 'center', gap: 4, borderWidth: 1 },
  summaryValue: { fontSize: 18, fontWeight: '700' },
  summaryLabel: { fontSize: 11 },
  kpiCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, borderWidth: 1 },
  kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  kpiTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kpiTitle: { fontSize: 15, fontWeight: '700' },
  kpiContent: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 },
  kpiValue: { fontSize: 22, fontWeight: '700' },
  kpiTarget: { fontSize: 12 },
  kpiDescription: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  legendCard: { margin: 16, borderRadius: 16, padding: 16, borderWidth: 1 },
  legendTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
});
