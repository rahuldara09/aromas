import { useMemo } from 'react';
import { useOrders } from './useOrders';

export function useAnalytics(timeFilter = 'Today') {
  const { orders } = useOrders();

  const analytics = useMemo(() => {
    if (!orders || orders.length === 0) {
      return {
        kpis: { revenue: 0, count: 0, aov: 0, unpaid: 0, revTrend: 0, countTrend: 0 },
        trendData: { labels: [], datasets: [{ data: [0] }] },
        topItems: [],
        peakHours: { labels: [], data: [] },
        payments: { online: 0, cash: 0, paid: 0, unpaid: 0 },
        funnel: { received: 0, accepted: 0, completed: 0 },
        insights: []
      };
    }

    const now = new Date();
    const todayStr = now.toDateString();
    
    // 1. Time Filter Logic
    const filteredOrders = orders.filter(o => {
      const orderDate = new Date(o.orderDate?.seconds * 1000 || o.orderDate);
      if (timeFilter === 'Today') return orderDate.toDateString() === todayStr;
      if (timeFilter === 'Week') {
        const lastWeek = new Date();
        lastWeek.setDate(now.getDate() - 7);
        return orderDate >= lastWeek;
      }
      if (timeFilter === 'Month') {
        const lastMonth = new Date();
        lastMonth.setMonth(now.getMonth() - 1);
        return orderDate >= lastMonth;
      }
      return true;
    });

    // 2. KPI Calculations
    const revenue = filteredOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
    const count = filteredOrders.length;
    const aov = count > 0 ? (revenue / count) : 0;
    const unpaid = filteredOrders
      .filter(o => o.payment_status?.toLowerCase() !== 'success' && o.status?.toLowerCase() !== 'cancelled')
      .reduce((sum, o) => sum + (o.grandTotal || 0), 0);

    // 3. Trends (Last 7 Days)
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(now.getDate() - (6 - i));
      return d.toDateString();
    });

    const labels = last7Days.map(d => d.split(' ')[0]); // "Mon", "Tue"...
    const trendValues = last7Days.map(d => {
      return orders
        .filter(o => new Date(o.orderDate?.seconds * 1000 || o.orderDate).toDateString() === d)
        .reduce((sum, o) => sum + (o.grandTotal || 0), 0);
    });

    // 4. Top Selling Items
    const itemMap = {};
    filteredOrders.forEach(o => {
      o.items?.forEach(item => {
        const name = item.name;
        if (!itemMap[name]) itemMap[name] = { name, count: 0, revenue: 0 };
        itemMap[name].count += item.quantity || 1;
        itemMap[name].revenue += (item.price || 0) * (item.quantity || 1);
      });
    });

    const topItems = Object.values(itemMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(it => ({
        ...it,
        contribution: revenue > 0 ? Math.round((it.revenue / revenue) * 100) : 0,
        trending: it.count > 5 // Simple heuristic
      }));

    // 5. Peak Hours
    const hourMap = [...Array(24)].map(() => 0);
    filteredOrders.forEach(o => {
      const date = new Date(o.orderDate?.seconds * 1000 || o.orderDate);
      hourMap[date.getHours()] += 1;
    });
    
    // Only show hours with data or a specific range (e.g. 10 AM to 11 PM)
    const hourData = hourMap.slice(10, 23);
    const hourLabels = [...Array(13)].map((_, i) => `${10 + i}:00`);

    // 6. Payments & Funnel
    const funnel = {
      received: filteredOrders.length,
      accepted: filteredOrders.filter(o => o.status !== 'Pending' && o.status !== 'Cancelled').length,
      completed: filteredOrders.filter(o => o.status === 'Completed' || o.status === 'Ready').length
    };

    const online = filteredOrders.filter(o => o.orderType === 'online').length;
    const cash = filteredOrders.filter(o => o.orderType === 'pos').length;

    // 7. Generation of Smart Insights
    const insights = [];
    const avgRev = trendValues.slice(0, 6).reduce((a, b) => a + b, 0) / 6;
    const todayRev = trendValues[6];

    if (todayRev < avgRev * 0.8) insights.push({ type: 'alert', text: `Revenue down ${Math.round((1 - todayRev/avgRev)*100)}% today vs week avg`, icon: 'trending-down' });
    if (unpaid > revenue * 0.2) insights.push({ type: 'alert', text: `Unpaid orders higher than usual (₹${unpaid})`, icon: 'wallet-outline' });
    
    const peakHourIndex = hourMap.indexOf(Math.max(...hourMap));
    insights.push({ type: 'info', text: `Peak performance around ${peakHourIndex}:00`, icon: 'time-outline' });

    if (topItems.length > 0 && topItems[0].contribution > 30) {
      insights.push({ type: 'success', text: `${topItems[0].name} accounts for ${topItems[0].contribution}% of revenue`, icon: 'star-outline' });
    }

    if (funnel.received > 5 && funnel.accepted / funnel.received < 0.75) {
      insights.push({ type: 'alert', text: `${Math.round((1 - funnel.accepted/funnel.received)*100)}% of orders not accepted`, icon: 'warning-outline' });
    }

    return {
      kpis: {
        revenue,
        count,
        aov,
        unpaid,
        revenueTrend: todayRev > avgRev ? Math.round(((todayRev/avgRev)-1)*100) : -Math.round((1-(todayRev/avgRev))*100)
      },
      trendData: {
        labels: labels,
        datasets: [{ data: trendValues.map(v => v/1000) }] // Shown in 'k'
      },
      topItems,
      peakHours: { labels: hourLabels, data: hourData },
      payments: { online, cash, paid: revenue - unpaid, unpaid },
      funnel,
      insights
    };
  }, [orders, timeFilter]);

  return analytics;
}
