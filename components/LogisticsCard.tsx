/**
 * Card de Logística para tela inicial do eControlApp
 * Formato: Acordeão (encolhido/expandir)
 * 
 * @version 1.1.0
 * @date 2026-03-24
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/theme';
import { useQuery } from '@tanstack/react-query';
import { getLogisticsKPIs, evaluateKPIStatus } from '@/services/logisticsMetrics';
import type { LogisticsCardData } from '@/interfaces/LogisticsMetrics';

interface LogisticsCardProps {
  onPress?: () => void;
}

export function LogisticsCard({ onPress }: LogisticsCardProps) {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Animação de expansão
  const [animation] = useState(new Animated.Value(0));
  
  const toggleExpand = () => {
    Animated.timing(animation, {
      toValue: isExpanded ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setIsExpanded(!isExpanded);
  };
  
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
    toggleExpand();
    if (onPress) onPress();
  };
  
  const handleSeeAll = () => {
    router.push('/(tabs)/log');
  };
  
  if (isLoading || !kpis) {
    return <LogisticsCardSkeleton isExpanded={isExpanded} />;
  }
  
  const height = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 360], // Altura máxima quando expandido
  });
  
  return (
    <Pressable 
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={handlePress}
    >
      {/* Header (sempre visível) */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + '15' }]}>
            <MaterialCommunityIcons 
              name="truck-delivery" 
              size={20} 
              color={theme.primary} 
            />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>
              Logística & Desempenho
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {isExpanded ? 'Toque para recolher' : 'Métricas e indicadores do mês'}
            </Text>
          </View>
        </View>
        
        <View style={styles.headerRight}>
          <Pressable 
            style={[styles.seeAllButton, { backgroundColor: theme.primary }]}
            onPress={handleSeeAll}
          >
            <Text style={styles.seeAllText}>Detalhes</Text>
          </Pressable>
          
          <Feather 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={20} 
            color={theme.textSecondary} 
          />
        </View>
      </View>
      
      {/* Conteúdo Expansível */}
      <Animated.View style={[styles.expandedContent, { height, opacity: animation }]}>
        <View style={styles.kpisGrid}>
          <KPIBadge
            icon="map-marker-radius"
            label="Rota"
            value={`${kpis.kmPerOS.value.toFixed(1)}`}
            subValue="km/OS"
            status={kpis.kmPerOS.status}
            target="< 15"
          />
          
          <KPIBadge
            icon="clock-outline"
            label="Tempo"
            value={`${kpis.avgTimePerOS.value.toFixed(1)}`}
            subValue="horas"
            status={kpis.avgTimePerOS.status}
            target="< 4h"
          />
          
          <KPIBadge
            icon="gas-station"
            label="Comb."
            value={kpis.fuelEfficiency.value > 0 ? `${kpis.fuelEfficiency.value.toFixed(1)}` : 'N/A'}
            subValue="km/L"
            status={kpis.fuelEfficiency.status}
            target="> 8"
          />
          
          <KPIBadge
            icon="chart-bar"
            label="Prod."
            value={`${kpis.productivity.value.toFixed(1)}`}
            subValue="OS/d"
            status={kpis.productivity.status}
            target="> 5"
          />
          
          <KPIBadge
            icon="clock-check-outline"
            label="Pont."
            value={`${kpis.onTimePercentage.value.toFixed(0)}%`}
            subValue=""
            status={kpis.onTimePercentage.status}
            target="> 90%"
          />
          
          <KPIBadge
            icon="truck"
            label="Frota"
            value={kpis.fleetUtilization.value > 0 ? `${kpis.fleetUtilization.value.toFixed(0)}%` : 'N/A'}
            subValue=""
            status={kpis.fleetUtilization.status}
            target="> 85%"
          />
        </View>
        
        <View style={[styles.summaryRow, { backgroundColor: theme.surfaceSecondary }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total OS</Text>
            <Text style={[styles.summaryValue, { color: theme.text }]}>
              {Math.round(kpis.productivity.value * 22) || '--'}
            </Text>
          </View>
          
          <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
          
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>KM Total</Text>
            <Text style={[styles.summaryValue, { color: theme.text }]}>
              {Math.round(kpis.kmPerOS.value * Math.round(kpis.productivity.value * 22)) || '--'}
            </Text>
          </View>
          
          <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
          
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Eficiência</Text>
            <Text style={[styles.summaryValue, { color: kpis.onTimePercentage.status === 'good' ? '#10B981' : '#F59E0B' }]}>
              {kpis.onTimePercentage.value.toFixed(0)}%
            </Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function KPIBadge({ 
  icon, 
  label, 
  value, 
  subValue,
  status,
  target,
}: { 
  icon: string; 
  label: string; 
  value: string; 
  subValue: string;
  status: 'good' | 'warning' | 'bad';
  target: string;
}) {
  const { theme } = useTheme();
  
  const statusColor = 
    status === 'good' ? '#10B981' : 
    status === 'warning' ? '#F59E0B' : '#EF4444';
  
  return (
    <View style={[styles.badge, { backgroundColor: theme.surfaceSecondary }]}>
      <View style={styles.badgeHeader}>
        <MaterialCommunityIcons 
          name={icon as any} 
          size={14} 
          color={statusColor} 
        />
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </View>
      
      <Text style={[styles.badgeLabel, { color: theme.textSecondary }]}>
        {label}
      </Text>
      
      <View style={styles.badgeValueRow}>
        <Text style={[styles.badgeValue, { color: theme.text }]}>
          {value}
        </Text>
        {subValue && (
          <Text style={[styles.badgeSubValue, { color: theme.textSecondary }]}>
            {subValue}
          </Text>
        )}
      </View>
      
      <Text style={[styles.badgeTarget, { color: theme.textMuted }]}>
        Meta: {target}
      </Text>
    </View>
  );
}

function LogisticsCardSkeleton({ isExpanded }: { isExpanded?: boolean }) {
  const { theme } = useTheme();
  
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconContainer, { backgroundColor: theme.border }]} />
          <View>
            <View style={[styles.skeleton, styles.skeletonTitle, { backgroundColor: theme.border }]} />
            <View style={[styles.skeleton, styles.skeletonSubtitle, { backgroundColor: theme.border }]} />
          </View>
        </View>
        
        <View style={styles.headerRight}>
          <View style={[styles.skeleton, styles.seeAllButton, { backgroundColor: theme.border, width: 60 }]} />
          <View style={[styles.skeleton, { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.border }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seeAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  seeAllText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  expandedContent: {
    marginTop: 16,
    overflow: 'hidden',
  },
  kpisGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    flex: 1,
    minWidth: '30%',
    padding: 10,
    borderRadius: 12,
    gap: 4,
  },
  badgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  badgeValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  badgeValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  badgeSubValue: {
    fontSize: 10,
    fontWeight: '500',
  },
  badgeTarget: {
    fontSize: 9,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 9,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 4,
  },
  skeleton: {
    borderRadius: 4,
  },
  skeletonTitle: {
    width: 100,
    height: 14,
  },
  skeletonSubtitle: {
    width: 140,
    height: 10,
    marginTop: 6,
  },
  skeletonLabel: {
    width: 30,
    height: 8,
  },
  skeletonValue: {
    width: 40,
    height: 12,
  },
});
