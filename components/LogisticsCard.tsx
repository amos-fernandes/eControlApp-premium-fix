/**
 * Card de Logística para tela inicial do eControlApp
 * 
 * @version 1.0.0
 * @date 2026-03-24
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/constants/theme';
import { useQuery } from '@tanstack/react-query';
import { getLogisticsKPIs, evaluateKPIStatus } from '@/services/logisticsMetrics';
import type { LogisticsCardData } from '@/interfaces/LogisticsMetrics';

interface LogisticsCardProps {
  onPress?: () => void;
}

export function LogisticsCard({ onPress }: LogisticsCardProps) {
  const { theme } = useTheme();
  
  const { data: kpis, isLoading } = useQuery<LogisticsCardData>({
    queryKey: ['logistics_kpis_card'],
    queryFn: async () => {
      const kpiData = await getLogisticsKPIs('month');
      
      return {
        kmPerOS: {
          value: kpiData.kmPerOS,
          status: evaluateKPIStatus('kmPerOS', kpiData.kmPerOS),
        },
        avgTimePerOS: {
          value: kpiData.avgTimePerOS,
          status: evaluateKPIStatus('avgTimePerOS', kpiData.avgTimePerOS),
        },
        fuelEfficiency: {
          value: kpiData.fuelEfficiency,
          status: kpiData.fuelEfficiency > 0 
            ? evaluateKPIStatus('fuelEfficiency', kpiData.fuelEfficiency)
            : 'warning',
        },
        productivity: {
          value: kpiData.productivity,
          status: evaluateKPIStatus('productivity', kpiData.productivity),
        },
        onTimePercentage: {
          value: kpiData.onTimePercentage,
          status: evaluateKPIStatus('onTimePercentage', kpiData.onTimePercentage),
        },
        fleetUtilization: {
          value: kpiData.fleetUtilization,
          status: kpiData.fleetUtilization > 0
            ? evaluateKPIStatus('fleetUtilization', kpiData.fleetUtilization)
            : 'warning',
        },
      };
    },
    refetchInterval: 1000 * 60 * 5, // Atualiza a cada 5 minutos
  });
  
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/logistics');
    }
  };
  
  if (isLoading || !kpis) {
    return <LogisticsCardSkeleton />;
  }
  
  return (
    <Pressable 
      style={[styles.card, { backgroundColor: theme.surface }]}
      onPress={handlePress}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          📊 Logística
        </Text>
        <Text style={[styles.seeAll, { color: theme.primary }]}>
          Ver todos ›
        </Text>
      </View>
      
      <View style={styles.kpisGrid}>
        <KPIBadge
          icon="map-marker-radius"
          label="Rota"
          value={`${kpis.kmPerOS.value.toFixed(1)} km`}
          status={kpis.kmPerOS.status}
        />
        
        <KPIBadge
          icon="clock-outline"
          label="Tempo"
          value={`${kpis.avgTimePerOS.value.toFixed(1)}h`}
          status={kpis.avgTimePerOS.status}
        />
        
        <KPIBadge
          icon="gas-station"
          label="Comb."
          value={kpis.fuelEfficiency.value > 0 ? `${kpis.fuelEfficiency.value.toFixed(1)} km/L` : 'N/A'}
          status={kpis.fuelEfficiency.status}
        />
        
        <KPIBadge
          icon="chart-bar"
          label="Prod."
          value={`${kpis.productivity.value.toFixed(1)} OS/d`}
          status={kpis.productivity.status}
        />
        
        <KPIBadge
          icon="clock-check-outline"
          label="Pont."
          value={`${kpis.onTimePercentage.value.toFixed(0)}%`}
          status={kpis.onTimePercentage.status}
        />
        
        <KPIBadge
          icon="truck"
          label="Frota"
          value={kpis.fleetUtilization.value > 0 ? `${kpis.fleetUtilization.value.toFixed(0)}%` : 'N/A'}
          status={kpis.fleetUtilization.status}
        />
      </View>
    </Pressable>
  );
}

/**
 * Badge individual de KPI
 */
function KPIBadge({ 
  icon, 
  label, 
  value, 
  status 
}: { 
  icon: string; 
  label: string; 
  value: string; 
  status: 'good' | 'warning' | 'bad';
}) {
  const { theme } = useTheme();
  
  const statusColor = 
    status === 'good' ? '#10B981' : 
    status === 'warning' ? '#F59E0B' : '#EF4444';
  
  return (
    <View style={[styles.badge, { backgroundColor: theme.surfaceSecondary }]}>
      <MaterialCommunityIcons 
        name={icon as any} 
        size={16} 
        color={statusColor} 
      />
      <Text style={[styles.badgeLabel, { color: theme.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.badgeValue, { color: theme.text }]}>
        {value}
      </Text>
      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
    </View>
  );
}

/**
 * Skeleton loader para o card
 */
function LogisticsCardSkeleton() {
  const { theme } = useTheme();
  
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.header}>
        <View style={[styles.skeleton, styles.skeletonTitle, { backgroundColor: theme.border }]} />
        <View style={[styles.skeleton, styles.skeletonSeeAll, { backgroundColor: theme.border }]} />
      </View>
      
      <View style={styles.kpisGrid}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <View key={i} style={[styles.badge, { backgroundColor: theme.surfaceSecondary }]}>
            <View style={[styles.skeleton, styles.skeletonIcon, { backgroundColor: theme.border }]} />
            <View style={[styles.skeleton, styles.skeletonLabel, { backgroundColor: theme.border }]} />
            <View style={[styles.skeleton, styles.skeletonValue, { backgroundColor: theme.border }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  kpisGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flex: 1,
    minWidth: '30%',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  badgeValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  skeleton: {
    borderRadius: 4,
  },
  skeletonTitle: {
    width: 100,
    height: 20,
  },
  skeletonSeeAll: {
    width: 60,
    height: 16,
  },
  skeletonIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  skeletonLabel: {
    width: 30,
    height: 10,
  },
  skeletonValue: {
    width: 50,
    height: 14,
  },
});
