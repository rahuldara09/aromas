import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Switch, TextInput, TouchableOpacity, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../components/DashboardHeader';
import SideMenu from '../components/SideMenu';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../services/firebase';
import { formatCurrency } from '../utils/helpers';
import { COLORS, SPACING, SIZES, SHADOWS } from '../theme';

export default function ProductsScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All Items');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSideMenuVisible, setIsSideMenuVisible] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setProducts(items);
    }, (error) => {
      console.error("Products error:", error);
    });

    return () => unsubscribe();
  }, []);

  const toggleStock = async (id, currentStatus) => {
    try {
      import('firebase/auth').then(({ getAuth }) => {
        const auth = getAuth();
        auth.currentUser?.getIdToken().then(idToken => {
          const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.61.102.243:3000';
          fetch(`${API_BASE_URL}/api/products`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({ id, isAvailable: !currentStatus })
          });
        });
      });
    } catch (e) {
      console.error("Error updating stock", e);
    }
  };

  const filters = ['All Items', 'Out of Stock'];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'Out of Stock' ? !p.isAvailable : true;
    return matchesSearch && matchesFilter;
  });

  const outOfStockCount = products.filter(p => !p.isAvailable).length;

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
      
      <View style={styles.subheader}>
        <View>
          <Text style={styles.tagline}>VYAPAR BUSINESS INVENTORY</Text>
          <Text style={styles.title}>Products</Text>
        </View>
        <TouchableOpacity style={styles.newBtn}>
          <Ionicons name="add" size={18} color={COLORS.white} />
          <Text style={styles.newBtnText}>Add Dish</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryStrip}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryVal}>{products.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.vDivider} />
        <View style={styles.summaryBox}>
          <Text style={[styles.summaryVal, { color: outOfStockCount > 0 ? COLORS.warning : COLORS.success }]}>
            {outOfStockCount}
          </Text>
          <Text style={styles.summaryLabel}>Sold Out</Text>
        </View>
        <View style={styles.vDivider} />
        <View style={styles.summaryBox}>
          <Text style={styles.summaryVal}>₹{(products.reduce((a, b) => a + (b.price || 0), 0) / 1000).toFixed(1)}k</Text>
          <Text style={styles.summaryLabel}>Value</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search kitchen..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <View style={styles.filterContainer}>
        {filters.map(filter => (
          <TouchableOpacity 
            key={filter} 
            onPress={() => setActiveFilter(filter)}
            style={[styles.filterChip, activeFilter === filter && styles.activeFilterChip]}
          >
            <Text style={[styles.filterText, activeFilter === filter && styles.activeFilterText]}>
              {filter} {filter === 'All Items' ? `(${products.length})` : `(${outOfStockCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList 
        data={filteredProducts}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            <View style={styles.productTop}>
              <View style={styles.imageWrapper}>
                {item.imageURL ? (
                  <Image source={{ uri: item.imageURL }} style={styles.productImage} />
                ) : (
                  <View style={styles.placeholderBox}>
                    <Ionicons name="fast-food-outline" size={24} color={COLORS.textSecondary} />
                  </View>
                )}
              </View>
              
              <View style={styles.productMainInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                </View>
                <View style={styles.metaRow}>
                   <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{item.category || 'Food'}</Text>
                  </View>
                  <Text style={styles.productPriceText}>₹{item.price}</Text>
                </View>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: item.isAvailable ? COLORS.success : COLORS.error }]} />
                  <Text style={[styles.statusLabel, { color: item.isAvailable ? COLORS.success : COLORS.error }]}>
                    {item.isAvailable ? 'LIVE' : 'SOLD OUT'}
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity style={styles.editBtn}>
                <Ionicons name="ellipsis-vertical" size={18} color="#cbd5e1" />
              </TouchableOpacity>
            </View>

            <View style={styles.productBottom}>
              <View style={styles.toggleLabelGroup}>
                <Text style={styles.toggleLabel}>Online Visibility</Text>
              </View>
              <Switch
                value={item.isAvailable}
                onValueChange={() => toggleStock(item.id, item.isAvailable)}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                ios_backgroundColor='#e2e8f0'
                style={{ transform: [{ scale: 0.75 }] }}
              />
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyView}>
            <Ionicons name="pizza-outline" size={40} color="#cbd5e1" />
            <Text style={styles.emptyText}>No matches found</Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  subheader: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  tagline: { fontSize: 9, fontWeight: '900', color: COLORS.primary, letterSpacing: 1.2 },
  title: { fontSize: 26, fontWeight: '900', color: COLORS.text, letterSpacing: -0.8 },
  newBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, ...SHADOWS.soft },
  newBtnText: { color: COLORS.white, fontWeight: '900', marginLeft: 4, fontSize: 11 },
  summaryStrip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    marginHorizontal: 20,
    padding: 16, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#f1f5f9',
    marginBottom: 16,
    ...SHADOWS.soft 
  },
  summaryBox: { flex: 1, alignItems: 'center' },
  vDivider: { width: 1, height: 24, backgroundColor: '#f1f5f9' },
  summaryVal: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  summaryLabel: { fontSize: 8, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase' },
  filterContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 14 },
  searchContainer: { paddingHorizontal: 20, marginBottom: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, fontWeight: '700', color: COLORS.text },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: '#f1f5f9', marginRight: 8 },
  activeFilterChip: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary },
  activeFilterText: { color: COLORS.white },
  listContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  productCard: { backgroundColor: COLORS.white, borderRadius: 20, padding: 14, marginBottom: 10, ...SHADOWS.soft, borderWidth: 1, borderColor: '#f1f5f9' },
  productTop: { flexDirection: 'row', alignItems: 'flex-start' },
  imageWrapper: { width: 56, height: 56, borderRadius: 14, overflow: 'hidden', backgroundColor: '#f8fafc' },
  productImage: { width: '100%', height: '100%' },
  placeholderBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  productMainInfo: { flex: 1, paddingHorizontal: 10 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productName: { fontSize: 15, fontWeight: '900', color: COLORS.text, flex: 1 },
  editBtn: { padding: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  categoryBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, marginRight: 8 },
  categoryText: { fontSize: 8, fontWeight: '900', color: '#92400e', textTransform: 'uppercase' },
  productPriceText: { fontSize: 11, color: COLORS.text, fontWeight: '900' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 4 },
  statusLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  productBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f8fafc' },
  toggleLabelGroup: { flex: 1 },
  toggleLabel: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary },
  emptyView: { padding: 60, alignItems: 'center' },
  emptyText: { marginTop: 10, fontSize: 13, fontWeight: '700', color: '#cbd5e1' },
});
