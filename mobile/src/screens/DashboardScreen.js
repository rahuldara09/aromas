import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../components/DashboardHeader';
import SideMenu from '../components/SideMenu';
import StatCard from '../components/StatCard';
import BarChart from '../components/BarChart';
import { COLORS, SPACING, SIZES, SHADOWS } from '../theme';
import { useOrders } from '../hooks/useOrders';

export default function DashboardScreen({ navigation }) {
  const { orders } = useOrders();
  const [activeRange, setActiveRange] = useState('Today');
  const [isSideMenuVisible, setIsSideMenuVisible] = useState(false);
  
  const ranges = ['Today', 'This Week', 'Month'];

  // 1. Data Filtering Logic for KPIs
  const dashboardStats = useMemo(() => {
    if (!orders || orders.length === 0) return { totalOrders: 0, revenue: 0, avgOrder: 0 };
    
    const now = new Date();
    const todayStr = now.toDateString();
    
    const filtered = orders.filter(o => {
      const d = new Date(o.orderDate?.seconds * 1000 || o.orderDate);
      if (activeRange === 'Today') return d.toDateString() === todayStr;
      if (activeRange === 'This Week') {
        const lastWeek = new Date();
        lastWeek.setDate(now.getDate() - 7);
        return d >= lastWeek;
      }
      if (activeRange === 'Month') {
        const lastMonth = new Date();
        lastMonth.setMonth(now.getMonth() - 1);
        return d >= lastMonth;
      }
      return true;
    });

    const totalOrders = filtered.length;
    const totalRev = filtered.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
    const avgOrder = totalOrders > 0 ? (totalRev / totalOrders).toFixed(0) : 0;

    return { totalOrders, revenue: totalRev, avgOrder };
  }, [orders, activeRange]);

  // 2. Data Aggregation for BarChart
  const chartData = useMemo(() => {
    const revs = [];
    const counts = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(now.getDate() - (6 - i));
        const dayStr = d.toDateString();
        const dayOrders = orders.filter(o => 
            new Date(o.orderDate?.seconds * 1000 || o.orderDate).toDateString() === dayStr
        );
        revs.push(dayOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0));
        counts.push(dayOrders.length);
    }
    return { revs, counts };
  }, [orders]);

  const recentOrders = useMemo(() => {
    return [...orders].sort((a, b) => (b.orderDate?.seconds || 0) - (a.orderDate?.seconds || 0)).slice(0, 4);
  }, [orders]);

  return (
    <View style={styles.container}>
      <DashboardHeader 
        showLogo={true} 
        onMenuPress={() => setIsSideMenuVisible(true)}
        onNotificationPress={() => Alert.alert("Notifications", "You have 3 new order updates today.", [{ text: "View" }])}
      />
      
      <SideMenu 
        visible={isSideMenuVisible} 
        onClose={() => setIsSideMenuVisible(false)} 
        navigation={navigation}
      />

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroSection}>
          <Text style={styles.heroHint}>VYAPAR DASHBOARD</Text>
          <Text style={styles.heroTitle}>Home</Text>
        </View>

        {/* Time Tabs */}
        <View style={styles.rangeRow}>
          {ranges.map(range => (
            <TouchableOpacity 
              key={range} 
              onPress={() => setActiveRange(range)}
              style={[styles.rangeTab, activeRange === range && styles.activeRangeTab]}
            >
              <Text style={[styles.rangeText, activeRange === range && styles.activeRangeText]}>
                {range}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsRow}>
          <StatCard 
            title="Orders" 
            value={dashboardStats.totalOrders.toLocaleString()} 
            trend={dashboardStats.totalOrders > 5 ? "up" : "neutral"} 
          />
          <StatCard 
            title="Revenue" 
            value={`₹${dashboardStats.revenue.toLocaleString()}`} 
            trend={dashboardStats.revenue > 1000 ? "up" : "neutral"}
          />
          <StatCard 
            title="Avg Order" 
            value={`₹${dashboardStats.avgOrder}`} 
          />
        </View>

        <BarChart 
            revenueData={chartData.revs} 
            orderData={chartData.counts} 
        />

        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.primaryAction]}
            onPress={() => navigation.navigate('Catalogue')}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.primaryActionText}>Menu</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionBtn, styles.secondaryAction]}
            onPress={() => navigation.navigate('Orders')}
          >
            <Ionicons name="bag-handle-outline" size={20} color={COLORS.primary} />
            <Text style={styles.secondaryActionText}>Action</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activityContainer}>
          {recentOrders.map((order, idx) => (
            <ActivityItem 
               key={order.id}
               icon="receipt-outline" 
               title={`Order #${order.orderId || order.id.slice(0,4).toUpperCase()}`} 
               subtitle={`${order.deliveryAddress?.name || 'Guest'} • ₹${order.grandTotal}`} 
               price={order.status}
               statusType={order.status === 'Pending' ? 'warning' : 'success'}
               isLast={idx === recentOrders.length - 1}
            />
          ))}
          {recentOrders.length === 0 && (
             <Text style={styles.emptyText}>No recent activity found.</Text>
          )}
        </View>
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function ActivityItem({ icon, title, subtitle, price, statusType, isLast }) {
  const getStatusColor = () => {
    switch(statusType) {
      case 'success': return COLORS.success;
      case 'warning': return '#f59e0b';
      case 'error': return COLORS.error;
      default: return COLORS.primary;
    }
  };

  return (
    <View style={[styles.activityItem, isLast && styles.noBorder]}>
      <View style={styles.activityIconBox}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
      <View style={styles.activityInfo}>
        <View style={styles.activityHeader}>
          <Text style={styles.activityTitle}>{title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor()}15` }]}>
            <Text style={[styles.statusBadgeText, { color: getStatusColor() }]}>{price}</Text>
          </View>
        </View>
        <Text style={styles.activitySubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  heroSection: { marginTop: 12, marginBottom: 16 },
  heroHint: { fontSize: 10, fontWeight: '900', color: COLORS.primary, letterSpacing: 1.5 },
  heroTitle: { fontSize: 32, fontWeight: '900', color: COLORS.text, letterSpacing: -1 },
  rangeRow: { flexDirection: 'row', marginBottom: 20 },
  rangeTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8 },
  activeRangeTab: { backgroundColor: COLORS.primary, ...SHADOWS.soft },
  rangeText: { fontSize: 13, fontWeight: '800', color: COLORS.textSecondary },
  activeRangeText: { color: COLORS.white },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, gap: 10 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 20, gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 54, borderRadius: 20, gap: 8, ...SHADOWS.soft },
  primaryAction: { backgroundColor: COLORS.primary },
  secondaryAction: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#f1f5f9' },
  primaryActionText: { color: COLORS.white, fontWeight: '900', fontSize: 14 },
  secondaryActionText: { color: COLORS.primary, fontWeight: '900', fontSize: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  seeAllText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  activityContainer: { backgroundColor: COLORS.white, borderRadius: 24, overflow: 'hidden', ...SHADOWS.soft, borderWidth: 1, borderColor: '#f1f5f9' },
  activityItem: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  noBorder: { borderBottomWidth: 0 },
  activityIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  activityInfo: { flex: 1 },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  activityTitle: { fontSize: 15, fontWeight: '900', color: COLORS.text },
  activitySubtitle: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '900' },
  emptyText: { padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14, fontWeight: '700' },
});
