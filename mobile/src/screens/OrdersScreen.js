import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ScrollView, TextInput, Switch, Platform, ActivityIndicator } from 'react-native';
import DashboardHeader from '../components/DashboardHeader';
import SideMenu from '../components/SideMenu';
import OrderCard from '../components/OrderCard';
import OrderDetailsModal from '../components/OrderDetailsModal';
import { useOrders } from '../hooks/useOrders';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES, SHADOWS } from '../theme';

export default function OrdersScreen({ navigation }) {
  const { orders, hasUnacknowledged, acknowledgeAlerts, pendingCount } = useOrders();
  const [activeTab, setActiveTab] = useState('Pending'); 
  const [timeFilter, setTimeFilter] = useState('Today');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPOS, setShowPOS] = useState(true); 
  const [isSideMenuVisible, setIsSideMenuVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const tabs = ['Pending', 'Accepted', 'Preparing', 'Ready', 'All'];
  const timeChips = ['Today', 'Yesterday', 'All Time'];

  const todayStr = new Date().toDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toDateString();

  const handleOrderPress = (order) => {
    setSelectedOrder(order);
    setModalVisible(true);
  };

  // Add a small delay for "Processing" view state for better UX on heavy filters
  const onTabChange = (tab) => {
    setIsProcessing(true);
    setActiveTab(tab);
    setTimeout(() => setIsProcessing(false), 300);
  };

  const onTimeFilterChange = (filter) => {
    setIsProcessing(true);
    setTimeFilter(filter);
    setTimeout(() => setIsProcessing(false), 400); // Slightly longer for All Time
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const status = (o.status || 'Pending').toLowerCase();
      const tabLower = activeTab.toLowerCase();
      
      // Status Logic
      let matchesTab = false;
      if (tabLower === 'all') matchesTab = true;
      else if (tabLower === 'pending') matchesTab = status === 'pending';
      else if (tabLower === 'accepted') matchesTab = status === 'accepted' || status === 'preparing';
      else if (tabLower === 'preparing') matchesTab = status === 'preparing';
      else if (tabLower === 'ready') matchesTab = status === 'ready';

      // Time Logic
      const orderDate = new Date(o.orderDate?.seconds * 1000 || o.orderDate).toDateString();
      let matchesTime = false;
      if (timeFilter === 'All Time') matchesTime = true;
      else if (timeFilter === 'Today') matchesTime = orderDate === todayStr;
      else if (timeFilter === 'Yesterday') matchesTime = orderDate === yesterdayStr;

      // Search Logic
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        o.deliveryAddress?.name?.toLowerCase().includes(searchLower) || 
        o.orderId?.toLowerCase().includes(searchLower);

      // POS Logic
      const isPOS = o.orderType === 'pos';
      const matchesPOS = showPOS || !isPOS;

      return matchesTab && matchesTime && matchesSearch && matchesPOS;
    });
  }, [orders, activeTab, timeFilter, searchQuery, showPOS]);

  const summaryData = useMemo(() => {
    const list = orders.filter(o => {
      const orderDate = new Date(o.orderDate?.seconds * 1000 || o.orderDate).toDateString();
      if (timeFilter === 'All Time') return true;
      if (timeFilter === 'Today') return orderDate === todayStr;
      if (timeFilter === 'Yesterday') return orderDate === yesterdayStr;
      return false;
    });

    return {
      count: list.length,
      revenue: list.reduce((sum, o) => sum + (o.grandTotal || 0), 0)
    };
  }, [orders, timeFilter]);

  return (
    <View style={styles.container}>
      <DashboardHeader 
        showLogo={true} 
        onMenuPress={() => setIsSideMenuVisible(true)}
      />

      <SideMenu 
        visible={isSideMenuVisible} 
        onClose={() => setIsSideMenuVisible(false)} 
        navigation={navigation}
      />
      
      <ScrollView stickyHeaderIndices={[2]} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View>
              <Text style={styles.headerHint}>VYAPAR PIPELINE</Text>
              <Text style={styles.headerTitle}>Orders</Text>
            </View>
            <View style={styles.timeToggle}>
              {timeChips.map(chip => (
                <TouchableOpacity 
                  key={chip} 
                  onPress={() => onTimeFilterChange(chip)}
                  style={[styles.timeChip, timeFilter === chip && styles.activeTimeChip]}
                >
                  <Text style={[styles.timeChipText, timeFilter === chip && styles.activeTimeChipText]}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.summaryContainer}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryVal}>{summaryData.count}</Text>
              <Text style={styles.summaryLabel}>{timeFilter === 'All Time' ? 'Total' : timeFilter}</Text>
            </View>
            <View style={styles.vDivider} />
            <View style={styles.summaryBox}>
              <Text style={[styles.summaryVal, { color: COLORS.warning }]}>{pendingCount}</Text>
              <Text style={styles.summaryLabel}>Pending</Text>
            </View>
            <View style={styles.vDivider} />
            <View style={styles.summaryBox}>
              <Text style={styles.summaryVal}>₹{(summaryData.revenue / 1000).toFixed(1)}k</Text>
              <Text style={styles.summaryLabel}>Revenue</Text>
            </View>
          </View>
        </View>

        <View style={styles.controlStrip}>
          <View style={styles.searchWrapper}>
            <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
            <TextInput 
              placeholder="Search or filter..."
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={COLORS.textSecondary}
              clearButtonMode="while-editing"
            />
          </View>
          <View style={styles.posSwitch}>
            <Text style={styles.posLabel}>POS</Text>
            <Switch 
              value={showPOS}
              onValueChange={setShowPOS}
              trackColor={{ false: '#e2e8f0', true: COLORS.primary }}
              ios_backgroundColor="#e2e8f0"
              style={{ transform: [{ scale: 0.75 }] }}
            />
          </View>
        </View>

        <View style={styles.tabWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabList}>
            {tabs.map(tab => (
              <TouchableOpacity 
                key={tab} 
                onPress={() => onTabChange(tab)}
                style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
              >
                <Text style={[styles.tabButtonText, activeTab === tab && styles.activeTabButtonText]}>
                  {tab}
                </Text>
                {tab === 'Pending' && pendingCount > 0 && (
                  <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{pendingCount}</Text></View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {isProcessing && (
           <View style={styles.loadingProgressWrapper}>
             <View style={styles.loadingBar}>
                <View style={[styles.loadingFill, { width: '40%' }]} /> 
             </View>
             <Text style={styles.loadingTxt}>Organizing your kitchen archive...</Text>
           </View>
        )}

        {hasUnacknowledged && pendingCount > 0 && (
          <TouchableOpacity style={styles.alertToast} onPress={acknowledgeAlerts}>
            <View style={styles.alertPulse} />
            <Text style={styles.alertMsg}>Unaccepted Orders Detected</Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </TouchableOpacity>
        )}

        <View style={styles.flatListBody}>
          {!isProcessing && filteredOrders.map((item) => (
            <OrderCard key={item.id} order={item} onPress={handleOrderPress} />
          ))}
          {(!isProcessing && filteredOrders.length === 0) && (
            <View style={styles.emptyView}>
              <Ionicons name="leaf-outline" size={32} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptySub}>No {activeTab.toLowerCase()} orders found for {timeFilter.toLowerCase()}.</Text>
            </View>
          )}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      <OrderDetailsModal 
        visible={modalVisible} 
        order={selectedOrder} 
        onClose={() => setModalVisible(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  scrollBody: { paddingTop: Platform.OS === 'ios' ? 0 : 10 },
  header: { paddingHorizontal: 24, paddingVertical: 12 },
  headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerHint: { fontSize: 10, fontWeight: '900', color: COLORS.primary, letterSpacing: 1.5 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: COLORS.text, letterSpacing: -0.8 },
  timeToggle: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 2, borderRadius: 20 },
  timeChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 18 },
  activeTimeChip: { backgroundColor: COLORS.primary },
  timeChipText: { fontSize: 10, fontWeight: '900', color: COLORS.textSecondary },
  activeTimeChipText: { color: '#fff' },
  summaryContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 24, 
    borderWidth: 1, 
    borderColor: '#f1f5f9',
    ...SHADOWS.soft 
  },
  summaryBox: { flex: 1, alignItems: 'center' },
  vDivider: { width: 1, height: 30, backgroundColor: '#f1f5f9' },
  summaryVal: { fontSize: 22, fontWeight: '900', color: COLORS.text },
  summaryLabel: { fontSize: 9, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase' },
  controlStrip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 8 },
  searchWrapper: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f8fafc', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 16 
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13, fontWeight: '700', color: COLORS.text },
  posSwitch: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginLeft: 10, 
    backgroundColor: '#fff', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  posLabel: { fontSize: 9, fontWeight: '900', color: COLORS.textSecondary, marginRight: 4 },
  tabWrapper: { backgroundColor: COLORS.white, paddingVertical: 8 },
  tabList: { paddingHorizontal: 24 },
  tabButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 16, 
    marginRight: 8, 
    backgroundColor: '#f8fafc' 
  },
  activeTabButton: { backgroundColor: COLORS.primary, ...SHADOWS.soft },
  tabButtonText: { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary },
  activeTabButtonText: { color: '#fff' },
  tabBadge: { backgroundColor: '#ef4444', marginLeft: 6, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  loadingProgressWrapper: { paddingHorizontal: 24, marginVertical: 10, alignItems: 'center' },
  loadingBar: { width: '100%', height: 4, backgroundColor: '#f1f5f9', borderRadius: 2, overflow: 'hidden' },
  loadingFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 2 },
  loadingTxt: { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  alertToast: { 
    backgroundColor: '#1e293b', 
    marginHorizontal: 24, 
    marginVertical: 8, 
    padding: 12, 
    borderRadius: 20, 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  alertPulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444', marginRight: 10 },
  alertMsg: { flex: 1, color: '#fff', fontWeight: '900', fontSize: 11 },
  flatListBody: { paddingHorizontal: 24, paddingTop: 4 },
  emptyView: { padding: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text, marginTop: 12 },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4, fontWeight: '600' },
});
