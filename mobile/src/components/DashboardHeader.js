import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES, SHADOWS } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedLogo from './AnimatedLogo';

export default function DashboardHeader({ title, showLogo = true, onMenuPress, onNotificationPress }) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.leftContainer}>
          <TouchableOpacity style={styles.iconBtn} onPress={onMenuPress}>
            <Ionicons name="menu-outline" size={30} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.centerContainer}>
          <AnimatedLogo size={30} showText={true} />
        </View>

        <View style={styles.rightContainer}>
          <TouchableOpacity style={styles.iconBtn} onPress={onNotificationPress}>
            <View style={styles.notificationContainer}>
              <Ionicons name="notifications-outline" size={24} color={COLORS.textSecondary} />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>3</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: COLORS.white,
  },
  container: {
    height: Platform.OS === 'ios' ? 70 : 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'ios' ? 12 : 5,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  leftContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerContainer: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 26 // 
  },
  rightContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  iconBtn: {
    padding: 4,
  },
  notificationContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
});
