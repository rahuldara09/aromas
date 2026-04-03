import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES, SHADOWS } from '../theme';
import { formatCurrency, formatDate } from '../utils/helpers';

export default function OrderDetailsModal({ visible, order, onClose }) {
  if (!order) return null;

  const handleCall = () => {
    const phone = order.deliveryAddress?.mobile;
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const statusColor = order.status === 'Pending' ? COLORS.warning : COLORS.success;
  const isOnline = order.orderType === 'online';

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.orderIdText}>Order #ORD-{order.orderId || order.id.slice(0,4)}</Text>
              <Text style={styles.dateText}>{formatDate(order.orderDate)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Status Section */}
            <View style={styles.section}>
              <View style={styles.badgeRow}>
                <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.statusText, { color: statusColor }]}>{order.status?.toUpperCase()}</Text>
                </View>
                <View style={[styles.sourceBadge, { backgroundColor: isOnline ? '#eff6ff' : '#f0fdf4' }]}>
                  <Ionicons name={isOnline ? 'smartphone' : 'storefront'} size={12} color={isOnline ? COLORS.primary : COLORS.success} />
                  <Text style={[styles.sourceText, { color: isOnline ? COLORS.primary : COLORS.success }]}>{isOnline ? 'APP' : 'POS'}</Text>
                </View>
              </View>
              
              {order.payment_status !== 'success' && (
                <View style={styles.unpaidBadge}>
                  <Ionicons name="alert-circle" size={14} color="#ef4444" />
                  <Text style={styles.unpaidText}>PAYMENT PENDING</Text>
                </View>
              )}
            </View>

            {/* Technical Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Transactional Info</Text>
              <View style={styles.infoCard}>
                <DetailRow icon="barcode-outline" label="Transaction ID" value={order.payment_transaction_id || 'CASH_PAYMENT'} />
                <DetailRow icon="globe-outline" label="Order Source" value={isOnline ? 'Online Mobile App' : 'In-Store POS'} isLast />
              </View>
            </View>

            {/* Customer Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer Details</Text>
              <View style={styles.infoCard}>
                <DetailRow icon="person-outline" label="Name" value={order.deliveryAddress?.name || 'Guest'} />
                <DetailRow icon="call-outline" label="Phone" value={order.deliveryAddress?.mobile || 'N/A'} />
                <DetailRow 
                  icon="location-outline" 
                  label="Address" 
                  value={`${order.deliveryAddress?.hostelNumber}, Room ${order.deliveryAddress?.roomNumber}`} 
                />
                <DetailRow icon="bicycle-outline" label="Type" value={order.deliveryAddress?.deliveryType} isLast />
              </View>
            </View>

            {/* Order Items */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Items</Text>
              <View style={styles.infoCard}>
                {order.items?.map((item, idx) => (
                  <View key={idx} style={[styles.itemRow, idx === order.items.length - 1 && styles.noBorder]}>
                    <View style={styles.itemMain}>
                      <Text style={styles.itemQty}>{item.quantity}x</Text>
                      <Text style={styles.itemName}>{item.name}</Text>
                    </View>
                    <Text style={styles.itemPrice}>{formatCurrency(item.price * item.quantity)}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Summary */}
            <View style={styles.section}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{formatCurrency(order.itemTotal)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Grand Total</Text>
                <Text style={styles.totalValue}>{formatCurrency(order.grandTotal)}</Text>
              </View>
            </View>
            
            <TouchableOpacity style={styles.primaryCallBtn} onPress={handleCall}>
              <Ionicons name="call" size={20} color={COLORS.white} />
              <Text style={styles.primaryCallText}>Call {order.deliveryAddress?.name || 'Customer'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ icon, label, value, isLast }) {
  return (
    <View style={[styles.detailRow, isLast && styles.noBorder]}>
      <Ionicons name={icon} size={18} color={COLORS.primary} style={{ width: 24 }} />
      <View>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    height: '92%',
    ...SHADOWS.medium,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  orderIdText: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  dateText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: '#f1f5f9',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    padding: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  infoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: 10,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '900',
  },
  unpaidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  unpaidText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ef4444',
    marginLeft: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  detailLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '800',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  itemMain: {
    flexDirection: 'row',
    flex: 1,
  },
  itemQty: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.primary,
    marginRight: 10,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '800',
  },
  totalRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
  },
  totalValue: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.primary,
  },
  primaryCallBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    padding: 18,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    ...SHADOWS.medium,
  },
  primaryCallText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 10,
  },
});
