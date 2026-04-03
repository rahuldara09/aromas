import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES, SHADOWS } from '../theme';

export default function StatCard({ title, value, trend, trendValue, icon, subtitle }) {
  const isPositive = trend === 'up';
  
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      
      <Text 
        style={styles.value} 
        adjustsFontSizeToFit 
        numberOfLines={1}
      >
        {value}
      </Text>
      
      <View style={styles.bottomRow}>
        {trendValue ? (
          <View style={styles.trendRow}>
            <Ionicons 
              name={isPositive ? 'arrow-up' : 'arrow-down'} 
              size={12} 
              color={isPositive ? COLORS.success : COLORS.error} 
            />
            <Text style={[styles.trendText, { color: isPositive ? COLORS.success : COLORS.error }]}>
              {trendValue}
            </Text>
          </View>
        ) : (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: SIZES.radius + 4,
    marginHorizontal: SPACING.xs,
    ...SHADOWS.soft,
  },
  title: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  value: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 2,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});
