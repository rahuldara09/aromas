import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ScrollView, Image, Platform } from 'react-native';
import DashboardHeader from '../components/DashboardHeader';
import SideMenu from '../components/SideMenu';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES, SHADOWS } from '../theme';
import { useAuth } from '../contexts/AuthContext';

export default function ProfileScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [storeOpen, setStoreOpen] = useState(true);
  const [isSideMenuVisible, setIsSideMenuVisible] = useState(false);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out of Curator?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => signOut() }
    ]);
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
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <View style={styles.avatarLarge}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=200&h=200&fit=crop' }} 
              style={styles.avatarImage}
            />
          </View>
          <Text style={styles.userName}>Vyapar Business Vendor</Text>
          <Text style={styles.userRole}>Store Administrator</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BUSINESS SETTINGS</Text>
          
          <View style={styles.card}>
            <SettingRow 
              icon="business" 
              label="Store Status" 
              value={storeOpen ? 'Accepting Orders' : 'Store Closed'}
              type="switch"
              state={storeOpen}
              onToggle={setStoreOpen}
              isLast
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.card}>
            <SettingRow icon="person-outline" label="Edit Profile" />
            <SettingRow icon="notifications-outline" label="Notifications" />
            <SettingRow icon="shield-checkmark-outline" label="Security" isLast />
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Vyapar v1.0.0 (Powered by Curator)</Text>
      </ScrollView>
    </View>
  );
}

function SettingRow({ icon, label, value, type = 'arrow', state, onToggle, isLast }) {
  return (
    <View style={[styles.settingRow, isLast && styles.noBorder]}>
      <View style={styles.settingLeft}>
        <View style={styles.settingIconBox}>
          <Ionicons name={icon} size={20} color={COLORS.primary} />
        </View>
        <View>
          <Text style={styles.settingLabel}>{label}</Text>
          {value && <Text style={styles.settingValue}>{value}</Text>}
        </View>
      </View>
      
      {type === 'switch' ? (
        <Switch 
          value={state} 
          onValueChange={onToggle}
          trackColor={{ false: COLORS.border, true: COLORS.primary }}
        />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={COLORS.border} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: SPACING.md, paddingBottom: 40 },
  profileSection: {
    alignItems: 'center',
    marginVertical: SPACING.xl,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: COLORS.white,
    ...SHADOWS.medium,
    marginBottom: SPACING.md,
  },
  avatarImage: { width: '100%', height: '100%' },
  userName: { fontSize: 22, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  userRole: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  section: { marginBottom: SPACING.xl },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    marginLeft: SPACING.xs,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLarge,
    overflow: 'hidden',
    ...SHADOWS.soft,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  noBorder: { borderBottomWidth: 0 },
  settingLeft: { flexDirection: 'row', alignItems: 'center' },
  settingIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingLabel: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  settingValue: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1f2',
    padding: 16,
    borderRadius: SIZES.radius,
    marginBottom: SPACING.xl,
  },
  logoutText: { color: COLORS.error, fontSize: 16, fontWeight: '900', marginLeft: 8 },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
