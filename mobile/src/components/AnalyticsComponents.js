import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme';
import { LineChart, BarChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');

export const KPICard = ({ title, value, trend, icon, color = COLORS.primary, warning = false }) => (
  <View style={[styles.kpiCard, warning && styles.warningCard]}>
    <View style={styles.kpiTop}>
      <Text style={styles.kpiLabel}>{title}</Text>
      <View style={[styles.iconBox, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
    </View>
    <View style={styles.kpiValueRow}>
      <Text style={styles.kpiValue}>{value}</Text>
      {trend !== undefined && (
        <View style={styles.trendBox}>
          <Ionicons name={trend >= 0 ? "trending-up" : "trending-down"} size={12} color={trend >= 0 ? COLORS.success : COLORS.warning} />
          <Text style={[styles.trendText, { color: trend >= 0 ? COLORS.success : COLORS.warning }]}> {Math.abs(trend)}%</Text>
        </View>
      )}
    </View>
  </View>
);

export const ChartWrapper = ({ title, subtitle, children }) => (
  <View style={styles.chartSection}>
    <View style={styles.chartHeader}>
      <Text style={styles.chartTitle}>{title}</Text>
      {subtitle && <Text style={styles.chartSubtitle}>{subtitle}</Text>}
    </View>
    {children}
  </View>
);

export const TopItemRow = ({ name, revenue, contribution, trending }) => (
  <View style={styles.itemRow}>
    <View style={styles.itemLead}>
      <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
      {trending && (
        <View style={styles.trendingBadge}>
          <Text style={styles.trendingText}>Trending ↑</Text>
        </View>
      )}
    </View>
    <View style={styles.itemData}>
      <Text style={styles.itemRev}>₹{Math.round(revenue)}</Text>
      <Text style={styles.itemContrib}>{contribution}%</Text>
    </View>
  </View>
);

export const SmartInsight = ({ type, text, icon }) => {
  const color = type === 'alert' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6';
  const bg = type === 'alert' ? '#fef2f2' : type === 'success' ? '#f0fdf4' : '#eff6ff';

  return (
    <View style={[styles.insightCard, { backgroundColor: bg, borderColor: `${color}20` }]}>
      <View style={[styles.insightIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.insightText, { color: COLORS.text }]}>{text}</Text>
    </View>
  );
};

export const ChartConfig = {
  backgroundColor: '#fff',
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: { r: '4', strokeWidth: '2', stroke: '#fff' },
  propsForBackgroundLines: { strokeDasharray: '', stroke: '#f1f5f9' },
};

const styles = StyleSheet.create({
  kpiCard: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 24, marginHorizontal: 6, marginBottom: 12, ...SHADOWS.soft, borderWidth: 1, borderColor: '#f1f5f9' },
  warningCard: { borderColor: '#fee2e2', backgroundColor: '#fff' },
  kpiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  kpiLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  iconBox: { padding: 6, borderRadius: 10 },
  kpiValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  kpiValue: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  trendBox: { flexDirection: 'row', alignItems: 'center' },
  trendText: { fontSize: 10, fontWeight: '700' },
  chartSection: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 16, borderRadius: 32, padding: 24, ...SHADOWS.soft, borderWidth: 1, borderColor: '#f1f5f9' },
  chartHeader: { marginBottom: 20 },
  chartTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  chartSubtitle: { fontSize: 13, color: '#64748b', fontWeight: '600', marginTop: 2 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  itemLead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemName: { fontSize: 15, fontWeight: '800', color: COLORS.text, flexShrink: 1 },
  trendingBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  trendingText: { color: '#16a34a', fontSize: 9, fontWeight: '900' },
  itemData: { alignItems: 'flex-end' },
  itemRev: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  itemContrib: { fontSize: 10, fontWeight: '700', color: '#64748b', marginTop: 2 },
  insightCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 24, marginBottom: 12, borderWidth: 1 },
  insightIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  insightText: { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 20 },
});
