import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions, TouchableWithoutFeedback, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import AnimatedLogo from './AnimatedLogo';

const { width } = Dimensions.get('window');
const MENU_WIDTH = width * 0.75;

export default function SideMenu({ visible, onClose, navigation }) {
  const { logout, user } = useAuth();
  const slideAnim = useRef(new Animated.Value(-MENU_WIDTH)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -MENU_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to exit?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", onPress: logout, style: "destructive" }
    ]);
  };

  const navTo = (screen) => {
    onClose();
    navigation.navigate(screen);
  };

  const MenuItem = ({ icon, label, screen, badge }) => (
    <TouchableOpacity style={styles.menuItem} onPress={() => navTo(screen)}>
      <View style={styles.menuIconBox}>
        <Ionicons name={icon} size={22} color={COLORS.text} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        
        <Animated.View style={[styles.menuContainer, { transform: [{ translateX: slideAnim }] }]}>
          <View style={styles.header}>
            <View style={styles.profileBox}>
              <AnimatedLogo size={54} showText={true} layout="row" />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Main Kitchen</Text>
            <MenuItem icon="grid-outline" label="Home" screen="Home" />
            <MenuItem icon="receipt-outline" label="Orders List" screen="Orders" />
            <MenuItem icon="folder-outline" label="Catalogue" screen="Catalogue" />
            
            <View style={styles.divider} />
            
            <Text style={styles.sectionTitle}>Business Tools</Text>
            <MenuItem icon="bar-chart-outline" label="Performance" screen="Analytics" />
            <MenuItem icon="settings-outline" label="Settings" screen="Settings" />
            
            <View style={styles.divider} />
            
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color="#ef4444" />
              <Text style={styles.logoutTxt}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerTxt}>Vyapar Vendor • v1.0.0</Text>
            <Text style={styles.footerEmail}>{user?.email}</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { 
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'flex-start', // Forces children to the left
  },
  backdrop: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.45)' 
  },
  menuContainer: { 
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0, // Pin to left
    width: MENU_WIDTH, 
    backgroundColor: '#fff', 
    ...SHADOWS.medium,
    elevation: 10, // Ensure it's on top
    zIndex: 99,
  },
  header: { 
    paddingTop: Platform.OS === 'ios' ? 70 : 60, 
    paddingHorizontal: 24, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 20
  },
  profileBox: { 
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
  },
  shopMeta: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, marginTop: 4 },
  closeBtn: { marginTop: 15 },
  content: { flex: 1, paddingHorizontal: 12 },
  sectionTitle: { fontSize: 9, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginLeft: 8, marginBottom: 12 },
  menuItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 10, 
    borderRadius: 14, 
    marginBottom: 2,
  },
  menuIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  menuLabel: { fontSize: 14, fontWeight: '800', color: COLORS.text, flex: 1 },
  badge: { backgroundColor: '#ef4444', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 16, marginHorizontal: 8 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 14, marginTop: 4, gap: 10 },
  logoutTxt: { fontSize: 13, fontWeight: '800', color: '#ef4444' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  footerTxt: { fontSize: 9, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' },
  footerEmail: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginTop: 2 },
});
