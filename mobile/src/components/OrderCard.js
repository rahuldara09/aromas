import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Linking, Alert } from 'react-native';
import { formatCurrency } from '../utils/helpers';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { COLORS, SPACING, SHADOWS } from '../theme';
import * as Haptics from 'expo-haptics';

export default function OrderCard({ order, onPress }) {
  const [loading, setLoading] = useState(false);

  const handleUpdateStatus = async (newStatus) => {
    try {
      setLoading(true);
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, { status: newStatus });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error("Status update error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = () => {
    Alert.alert(
      "Reject Order",
      "Are you sure you want to reject this order?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Reject", 
          style: "destructive", 
          onPress: () => handleUpdateStatus('Rejected')
        }
      ]
    );
  };

  const status = order.status || 'Pending';
  const isPending = status.toLowerCase() === 'pending';
  const isOnline = order.orderType === 'online';
  const isPaid = order.payment_status === 'success';

  const orderTime = new Date(order.orderDate?.seconds * 1000 || order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();

  return (
    <TouchableOpacity activeOpacity={0.97} style={styles.card} onPress={() => onPress(order)}>
      <View style={styles.content}>
        {/* Compact Top Row */}
        <View style={styles.topRow}>
          <View style={styles.tokenBox}>
            <Text style={styles.tokenVal}>{order.orderToken || order.id.slice(0, 3).toUpperCase()}</Text>
          </View>
          <View style={styles.metaData}>
            <Text style={styles.idText}>#ORD-{order.orderId || order.id.slice(0, 4).toUpperCase()} • {orderTime}</Text>
            <View style={styles.subInfo}>
              <Text style={styles.cName} numberOfLines={1}>{order.deliveryAddress?.name || 'Guest'}</Text>
              <View style={[styles.sourceTag, {backgroundColor: isOnline ? COLORS.onlineSoft : COLORS.posSoft}]}>
                <Ionicons name={isOnline ? 'globe-outline' : 'business-outline'} size={8} color={COLORS.textSecondary} />
                <Text style={styles.sourceText}>{isOnline ? 'APP' : 'POS'}</Text>
              </View>
            </View>
          </View>
          <View style={styles.rightInfo}>
            <Text style={styles.priceVal}>{formatCurrency(order.grandTotal || 0)}</Text>
            {!isPaid && <View style={styles.unpaidBadge}><Text style={styles.unpaidText}>UNPAID</Text></View>}
          </View>
        </View>

        {/* Compact Item Summary */}
        <View style={styles.itemSummary}>
          <Text style={styles.itemText} numberOfLines={1}>
            {order.items?.map(it => `${it.quantity}x ${it.name}`).join(', ')}
          </Text>
        </View>

        {/* Simplified Action Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.miniCallBtn} onPress={() => Linking.openURL(`tel:${order.deliveryAddress?.mobile}`)}>
            <Ionicons name="call" size={16} color={COLORS.primary} />
          </TouchableOpacity>
          
          <View style={styles.decisionZone}>
            {isPending ? (
              <>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.rejectBtn]} 
                  onPress={handleReject}
                  disabled={loading}
                >
                  <Ionicons name="close-circle" size={16} color="#ef4444" />
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionBtn, styles.acceptBtn]} 
                  onPress={() => handleUpdateStatus('Preparing')}
                  disabled={loading}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.statusPill}>
                <View style={[styles.dot, { backgroundColor: status === 'Preparing' ? COLORS.primary : COLORS.success }]} />
                <Text style={styles.statusLabel}>{status.toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { 
    backgroundColor: '#fff', 
    borderRadius: 24, 
    padding: 12, 
    marginBottom: 10, 
    ...SHADOWS.soft, 
    borderWidth: 1, 
    borderColor: '#f1f5f9' 
  },
  content: { gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tokenBox: { 
    width: 42, 
    height: 42, 
    backgroundColor: '#f8fafc', 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1, 
    borderColor: '#f1f5f9' 
  },
  tokenVal: { fontSize: 18, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  metaData: { flex: 1 },
  idText: { fontSize: 10, fontWeight: '800', color: COLORS.textSecondary, marginBottom: 2 },
  subInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cName: { fontSize: 15, fontWeight: '900', color: COLORS.text, flexShrink: 1 },
  sourceTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  sourceText: { fontSize: 7, fontWeight: '900', color: COLORS.textSecondary, marginLeft: 2 },
  rightInfo: { alignItems: 'flex-end' },
  priceVal: { fontSize: 16, fontWeight: '900', color: COLORS.text },
  unpaidBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, marginTop: 2 },
  unpaidText: { fontSize: 7, fontWeight: '900', color: '#ef4444' },
  itemSummary: { backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  itemText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniCallBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 12, 
    backgroundColor: '#fff', 
    alignItems: 'center', 
    justifyContent: 'center', 
    ...SHADOWS.soft, 
    borderWidth: 1, 
    borderColor: '#f1f5f9' 
  },
  decisionZone: { flex: 1, flexDirection: 'row', gap: 8 },
  actionBtn: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 8, 
    borderRadius: 12, 
    gap: 6,
    ...SHADOWS.soft 
  },
  acceptBtn: { backgroundColor: COLORS.primary },
  rejectBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#fee2e2' },
  acceptBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  rejectBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '800' },
  statusPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f8fafc', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 12,
    alignSelf: 'flex-start' 
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  statusLabel: { fontSize: 10, fontWeight: '900', color: COLORS.textSecondary, letterSpacing: 0.5 },
});
