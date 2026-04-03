import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, SIZES, SHADOWS } from '../theme';

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function BarChart({ revenueData = [], orderData = [], isLoading }) {
  const [view, setView] = useState('revenue'); // 'revenue' | 'orders'
  
  const currentDayIdx = new Date().getDay();
  // Rotate days so it fits the data provided (usually ending in today)
  // Our aggregator will provide 7 points [d-6, d-5, ... today]
  const displayLabels = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return days[d.getDay()];
  });

  const data = view === 'revenue' ? revenueData : orderData;
  const maxVal = Math.max(...data, 1); // Avoid division by 0

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loading]}>
        <Text style={styles.loadingText}>Loading performance data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.chartTitle}>Weekly performance</Text>
        <View style={styles.legend}>
          <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />
          <Text style={styles.legendText}>Today</Text>
          <View style={[styles.dot, { backgroundColor: '#e2e8f0', marginLeft: 8 }]} />
          <Text style={styles.legendText}>Prev</Text>
        </View>
      </View>

      <View style={styles.toggleRow}>
        <TouchableOpacity 
          onPress={() => setView('revenue')}
          style={[styles.smallToggle, view === 'revenue' && styles.activeSmallToggle]}
        >
          <Text style={[styles.toggleText, view === 'revenue' && styles.activeToggleText]}>Revenue</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setView('orders')}
          style={[styles.smallToggle, view === 'orders' && styles.activeSmallToggle]}
        >
          <Text style={[styles.toggleText, view === 'orders' && styles.activeToggleText]}>Orders</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.chartArea}>
        {data.map((val, idx) => {
          const heightPercent = (val / maxVal) * 100;
          const isToday = idx === 6; // Last item is today
          
          return (
            <View key={idx} style={styles.barColumn}>
              <Text style={[styles.barValue, isToday && styles.todayValue]}>
                {view === 'revenue' ? `₹${Math.round(val/1000)}k` : val}
              </Text>
              <View style={styles.barBackground}>
                <View 
                  style={[
                    styles.bar, 
                    { height: `${heightPercent}%`, backgroundColor: isToday ? COLORS.primary : '#e2e8f0' }
                  ]} 
                />
              </View>
              <Text style={[styles.dayLabel, isToday && styles.todayLabel]}>{displayLabels[idx]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: SIZES.radiusLarge,
    marginVertical: SPACING.md,
    ...SHADOWS.soft,
    minHeight: 240,
  },
  loading: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  smallToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#f1f5f9',
  },
  activeSmallToggle: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  activeToggleText: {
    color: COLORS.white,
  },
  chartArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 10,
  },
  barColumn: {
    alignItems: 'center',
    width: 32,
  },
  barValue: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  todayValue: {
    color: COLORS.primary,
  },
  barBackground: {
    width: 28,
    height: 100,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: 8,
  },
  dayLabel: {
    marginTop: SPACING.sm,
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  todayLabel: {
    color: COLORS.primary,
  },
});
