import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../theme';

export default function ActionBanner({ count = 3, oldestTime = '14 mins' }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Ionicons name="diamond" size={24} color="#f59e0b" />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>{count} orders need action</Text>
        <Text style={styles.subtitle}>Oldest waiting {oldestTime}</Text>
      </View>
      
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Review →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb', // Light amber background
    borderWidth: 1.5,
    borderColor: '#fcd34d', // Amber 300
    borderRadius: SIZES.radius + 4,
    padding: SPACING.md,
    marginVertical: SPACING.sm,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fef3c7', // Amber 100
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400e', // Amber 800
  },
  subtitle: {
    fontSize: 13,
    color: '#b45309', // Amber 700
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 13,
  },
});
