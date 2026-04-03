import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Dimensions, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAnalytics } from '../hooks/useAnalytics';
import { KPICard, ChartWrapper, TopItemRow, SmartInsight, ChartConfig } from '../components/AnalyticsComponents';
import { COLORS, SHADOWS } from '../theme';
import { LineChart, BarChart } from 'react-native-chart-kit';
import DashboardHeader from '../components/DashboardHeader';
import SideMenu from '../components/SideMenu';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen({ navigation }) {
  const [timeFilter, setTimeFilter] = useState('Week');
  const [compare, setCompare] = useState(true);
  const [isSideMenuVisible, setIsSideMenuVisible] = useState(false);
  const data = useAnalytics(timeFilter);

  const handleExport = () => {
    Alert.alert("Generating Report", "Your business report (PDF/CSV) is being generated for the selected period.", [{ text: "Done" }]);
  };

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
      
      {/* Sticky Controls Strip */}
      <View style={styles.controlsSticky}>
        <View style={styles.filterStrip}>
          {['Today', 'Week', 'Month'].map(t => (
            <TouchableOpacity 
              key={t} 
              onPress={() => setTimeFilter(t)}
              style={[styles.filterBtn, timeFilter === t && styles.activeFilterBtn]}
            >
              <Text style={[styles.filterBtnText, timeFilter === t && styles.activeFilterBtnText]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.actionStrip}>
          <TouchableOpacity style={[styles.subAction, compare && styles.activeSubAction]} onPress={() => setCompare(!compare)}>
            <Ionicons name="git-compare-outline" size={14} color={compare ? COLORS.primary : '#64748b'} />
            <Text style={[styles.subActionText, compare && styles.activeSubActionText]}>Compare</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mainAction} onPress={handleExport}>
            <Ionicons name="download-outline" size={16} color="#fff" />
            <Text style={styles.mainActionText}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
        
        {/* 1. KPI SNAPSHOT */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiRow}>
            <KPICard title="Revenue" value={`₹${Math.round(data.kpis.revenue)}`} trend={data.kpis.revenueTrend} icon="cash-outline" color="#3b82f6" />
            <KPICard title="Orders" value={data.kpis.count} trend={5} icon="bag-check-outline" color="#8b5cf6" />
          </View>
          <View style={styles.kpiRow}>
            <KPICard title="Avg Order" value={`₹${Math.round(data.kpis.aov)}`} icon="receipt-outline" color="#10b981" />
            <KPICard title="Unpaid" value={`₹${Math.round(data.kpis.unpaid)}`} icon="alert-circle-outline" color="#ef4444" warning={data.kpis.unpaid > 0} />
          </View>
        </View>

        {/* 2. REVENUE TREND */}
        <ChartWrapper title="Revenue Growth" subtitle="Performance of the last 7 days (₹ in thousands)">
          <LineChart
            data={data.trendData}
            width={width - 72}
            height={200}
            chartConfig={ChartConfig}
            bezier
            style={styles.chart}
            withInnerLines={false}
          />
        </ChartWrapper>

        {/* 3. SMART INSIGHTS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Smart Insights</Text>
          {data.insights.map((insight, idx) => (
            <SmartInsight key={idx} {...insight} />
          ))}
        </View>

        {/* 4. TOP SELLING */}
        <ChartWrapper title="Top Performing Items" subtitle="Ranking by revenue contribution">
          {data.topItems.map((item, idx) => (
            <TopItemRow key={idx} {...item} />
          ))}
          {data.topItems.length === 0 && <Text style={styles.emptyText}>No data available for this period.</Text>}
        </ChartWrapper>

        {/* 5. PEAK HOURS */}
        <ChartWrapper title="Peak Order Hours" subtitle="Hourly distribution of business (10 AM - 11 PM)">
          <BarChart
            data={{
              labels: ["10", "12", "14", "16", "18", "20", "22"],
              datasets: [{ data: data.peakHours.data.filter((_, i) => i % 2 === 0) }]
            }}
            width={width - 72}
            height={200}
            chartConfig={{...ChartConfig, color: (o) => `rgba(139, 92, 246, ${o})` }}
            verticalLabelRotation={0}
            style={styles.chart}
            withInnerLines={false}
            fromZero
          />
        </ChartWrapper>

        {/* 6. FUNNEL & OPS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operational Funnel</Text>
          <View style={styles.funnelCard}>
            <View style={styles.funnelStep}>
              <Text style={styles.funnelVal}>{data.funnel.received}</Text>
              <Text style={styles.funnelLabel}>Received</Text>
            </View>
            <View style={styles.funnelArrow}><Ionicons name="arrow-forward" size={12} color="#cbd5e1" /></View>
            <View style={styles.funnelStep}>
              <Text style={styles.funnelVal}>{data.funnel.accepted}</Text>
              <Text style={styles.funnelLabel}>Accepted</Text>
            </View>
            <View style={styles.funnelArrow}><Ionicons name="arrow-forward" size={12} color="#cbd5e1" /></View>
            <View style={styles.funnelStep}>
              <Text style={[styles.funnelVal, { color: COLORS.success }]}>{data.funnel.completed}</Text>
              <Text style={styles.funnelLabel}>Fulfilled</Text>
            </View>
          </View>
          <Text style={styles.funnelHint}>
            {data.funnel.received > 0 
              ? `${Math.round((data.funnel.completed/data.funnel.received)*100)}% fulfillment rate`
              : "0% fulfillment rate"}
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  controlsSticky: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f5f9',
    ...SHADOWS.soft
  },
  filterStrip: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 2, borderRadius: 12 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  activeFilterBtn: { backgroundColor: '#fff', ...SHADOWS.soft },
  filterBtnText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  activeFilterBtnText: { color: COLORS.primary },
  actionStrip: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  activeSubAction: { borderColor: `${COLORS.primary}30`, backgroundColor: `${COLORS.primary}05` },
  subActionText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  activeSubActionText: { color: COLORS.primary },
  mainAction: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, ...SHADOWS.medium },
  mainActionText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  scrollBody: { paddingTop: 20 },
  kpiGrid: { paddingHorizontal: 18, marginBottom: 12 },
  kpiRow: { flexDirection: 'row' },
  chart: { marginVertical: 8, borderRadius: 16, paddingRight: 40 },
  section: { paddingHorizontal: 24, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text, marginBottom: 16, letterSpacing: -0.5 },
  emptyText: { textAlign: 'center', color: '#94a3b8', fontSize: 14, fontWeight: '600', padding: 20 },
  funnelCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 20, borderRadius: 24, ...SHADOWS.soft, borderWidth: 1, borderColor: '#f1f5f9' },
  funnelStep: { alignItems: 'center', flex: 1 },
  funnelVal: { fontSize: 20, fontWeight: '900', color: COLORS.text },
  funnelLabel: { fontSize: 9, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginTop: 4 },
  funnelArrow: { paddingHorizontal: 4 },
  funnelHint: { textAlign: 'center', color: '#64748b', fontSize: 11, fontWeight: '700', marginTop: 12, fontStyle: 'italic' },
});
