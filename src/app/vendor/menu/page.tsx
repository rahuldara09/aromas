'use client';

import { useVendor } from '@/contexts/VendorContext';
import { useAuth } from '@/contexts/AuthContext';
import { toggleProductAvailability, addProduct, deleteProduct, updateProduct } from '@/lib/vendor';
import { Product } from '@/types';
import toast from 'react-hot-toast';
import { Menu as MenuIcon, Search, Plus, X, Trash2, Edit2, TrendingUp, Filter, Download } from 'lucide-react';
import { useState } from 'react';

export default function VendorMenu() {
    const { products } = useVendor();
    const { user, phoneNumber } = useAuth();
    const [search, setSearch] = useState('');

    // Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [newItemName, setNewItemName] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [newItemCategory, setNewItemCategory] = useState('');
    const [newItemImage, setNewItemImage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p as any).category?.toLowerCase().includes(search.toLowerCase()) ||
        p.categoryId.toLowerCase().includes(search.toLowerCase())
    );

    const handleToggleProduct = async (product: Product) => {
        const newValue = !(product.isAvailable ?? true);
        try {
            const idToken = await user!.getIdToken();
            await toggleProductAvailability(product.id, newValue, idToken, phoneNumber ?? '');
            if (newValue) {
                toast.success(`${product.name} marked In-Stock`);
            } else {
                toast.error(`${product.name} marked Out-of-Stock`);
            }
        } catch {
            toast.error('Failed to update stock');
        }
    };

    const handleDeleteProduct = async (product: Product) => {
        if (!confirm(`Are you sure you want to delete ${product.name}?`)) return;
        try {
            const idToken = await user!.getIdToken();
            await deleteProduct(product.id, idToken, phoneNumber ?? '');
            toast.success(`${product.name} deleted`);
        } catch {
            toast.error('Failed to delete item');
        }
    };

    const handleEditClick = (product: Product) => {
        setEditingProduct(product);
        setNewItemName(product.name);
        setNewItemPrice(product.price.toString());
        setNewItemCategory((product as any).category || product.categoryId);
        setNewItemImage(product.imageURL);
        setIsAddModalOpen(true);
    };

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemName || !newItemPrice || !newItemCategory) {
            toast.error('Please fill all required fields');
            return;
        }

        setIsSubmitting(true);
        try {
            const idToken = await user!.getIdToken();
            const data = {
                name: newItemName,
                price: parseFloat(newItemPrice),
                categoryId: newItemCategory.toLowerCase().replace(/\s+/g, '-'),
                category: newItemCategory,
                imageURL: newItemImage || '',
            };

            if (editingProduct) {
                await updateProduct(editingProduct.id, data, idToken, phoneNumber ?? '');
                toast.success('Item updated successfully!');
            } else {
                await addProduct({ ...data, isAvailable: true }, idToken, phoneNumber ?? '');
                toast.success('Item added successfully!');
            }

            closeModal();
        } catch (error) {
            toast.error(editingProduct ? 'Failed to update item' : 'Failed to add item');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const closeModal = () => {
        setIsAddModalOpen(false);
        setEditingProduct(null);
        setNewItemName('');
        setNewItemPrice('');
        setNewItemCategory('');
        setNewItemImage('');
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6 pb-20 flex-1 overflow-y-auto w-full transition-colors">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-[28px] font-extrabold text-[#111827] tracking-tight">
                        Menu & Inventory
                    </h2>
                    <p className="text-[15px] text-gray-500 font-medium mt-1">Manage your catalog and item availability with precision.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 bg-[#d92d20] hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    <span>Add Item</span>
                </button>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-shrink-0">
                <div className="bg-white rounded-[16px] p-6 shadow-sm border border-gray-100 flex flex-col justify-center min-h-[140px]">
                    <span className="text-xs font-bold text-gray-500 tracking-wider uppercase mb-2">Total Catalog Value</span>
                    <span className="text-[34px] font-black text-[#111827] mb-2 leading-none">₹{products.reduce((acc, p) => acc + p.price, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <div className="flex items-center text-[#d92d20] text-xs font-bold gap-1 mt-auto">
                        <TrendingUp size={14} /> 12% increase from last month
                    </div>
                </div>
                <div className="bg-[#f8fafc] rounded-[16px] p-6 flex flex-col justify-center min-h-[140px] border border-transparent">
                    <span className="text-xs font-bold text-[#1e40af] tracking-wider uppercase mb-2">Active Items</span>
                    <span className="text-[34px] font-black text-[#111827] mb-2 leading-none">{products.filter(p => p.isAvailable).length}</span>
                    <div className="w-full h-1 bg-[#dbeafe] rounded-full mt-auto">
                        <div className="h-full bg-[#d92d20] rounded-full w-[80%]"></div>
                    </div>
                </div>
                <div className="bg-[#fce7f3] rounded-[16px] p-6 flex flex-col justify-center min-h-[140px] border border-transparent">
                    <span className="text-xs font-bold text-[#831843] tracking-wider uppercase mb-2">Stock Alerts</span>
                    <span className="text-[34px] font-black text-[#9B1B30] mb-2 leading-none">{products.filter(p => !p.isAvailable).length.toString().padStart(2, '0')}</span>
                    <span className="text-xs font-bold text-[#be185d] underline underline-offset-2 mt-auto cursor-pointer hover:text-[#9B1B30] transition-colors leading-none">View critical items</span>
                </div>
            </div>

            {/* Sticky Catalog Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-20 bg-[#f8f9fc] py-4 -mx-8 px-8 border-b border-gray-200/60 shadow-sm backdrop-blur-md bg-opacity-90">
                    <h3 className="text-[19px] font-bold text-[#111827]">Catalog Listings</h3>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Search is positioned here as Filter placeholder equivalent conceptually */}
                        <div className="flex bg-[#f1f5f9] rounded-lg items-center px-3 py-1.5 border border-indigo-50/50">
                            <Search size={14} className="text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search items..."
                                className="bg-transparent border-none outline-none ml-2 text-xs font-bold text-[#111827] placeholder:text-gray-400 w-32"
                            />
                        </div>
                        <button className="flex items-center gap-2 bg-[#eff6ff] text-[#1e40af] px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#dbeafe] transition-colors shadow-sm">
                            <Filter size={14} /> Filter
                        </button>
                        <button className="flex items-center gap-2 bg-[#eff6ff] text-[#1e40af] px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#dbeafe] transition-colors shadow-sm">
                            <Download size={14} /> Export
                        </button>
                    </div>
            </div>

            {/* Catalog List */}
            <div className="bg-white rounded-[16px] border border-gray-100 shadow-sm flex flex-col relative shrink-0">

                <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-white text-[11px] font-extrabold text-[#64748b] uppercase tracking-wider border-b border-gray-50">
                    <div className="col-span-12 md:col-span-5">Item</div>
                    <div className="hidden md:block md:col-span-3">Category</div>
                    <div className="hidden md:block md:col-span-2 text-right">Price</div>
                    <div className="col-span-12 md:col-span-2 flex justify-between md:justify-end gap-12">
                        <span>Status</span>
                        <span>Actions</span>
                    </div>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-800 transition-colors text-sm">
                    {filteredProducts.length === 0 ? (
                        <div className="p-10 text-center text-gray-400 dark:text-gray-500 font-medium transition-colors">No items found matching "{search}"</div>
                    ) : (
                        filteredProducts.map(product => {
                            const available = product.isAvailable ?? true;

                            return (
                                <div key={product.id} className={`grid grid-cols-12 gap-4 px-6 py-5 items-center transition-colors hover:bg-[#f8fafc] bg-white`}>
                                    <div className="col-span-12 md:col-span-5 flex items-center gap-4">
                                        <div className={`w-[52px] h-[52px] rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0 border border-gray-200 transition-colors ${!available ? 'grayscale opacity-60' : ''}`}>
                                            {product.imageURL ? (
                                                <img src={product.imageURL} alt={product.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm">🍽</div>
                                            )}
                                        </div>
                                        <div>
                                            <p className={`font-bold text-[15px] ${!available ? 'text-gray-500' : 'text-[#111827]'}`}>{product.name}</p>
                                            <p className="text-[11px] font-bold text-[#64748b] mt-0.5 tracking-wide">ID: ARM-{product.id.slice(0, 4).toUpperCase()}</p>
                                        </div>
                                    </div>

                                    <div className="hidden md:block md:col-span-3">
                                        <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider ${
                                            ((product as any).category || 'UNCATEGORIZED').toLowerCase().includes('health') ? 'bg-[#fce7f3] text-[#be185d]' :
                                            ((product as any).category || 'UNCATEGORIZED').toLowerCase().includes('breakfast') ? 'bg-[#fce7f3] text-[#be185d]' :
                                            ((product as any).category || 'UNCATEGORIZED').toLowerCase().includes('premium') ? 'bg-[#ffedd5] text-[#c2410c]' :
                                            'bg-[#f3e8eb] text-[#9B1B30]'
                                        }`}>
                                            {(product as any).category || 'UNCATEGORIZED'}
                                        </span>
                                    </div>

                                    <div className="hidden md:block md:col-span-2 text-right font-black text-[#111827] text-[15px]">
                                        ₹{product.price.toFixed(2)}
                                    </div>

                                    <div className="col-span-12 md:col-span-2 flex justify-between md:justify-end items-center gap-8">
                                        <div className="flex md:hidden items-center gap-3 w-full"></div>
                                        
                                        <button
                                            onClick={() => handleToggleProduct(product)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${available ? 'bg-[#d92d20]' : 'bg-[#e2e8f0]'}`}
                                        >
                                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${available ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
                                        </button>

                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleEditClick(product)}
                                                className="text-[#64748b] hover:text-[#1e40af] transition-colors"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteProduct(product)}
                                                className="text-[#64748b] hover:text-[#d92d20] transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ADD ITEM MODAL */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-800">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                            <h3 className="font-extrabold text-lg text-gray-900 dark:text-white">
                                {editingProduct ? 'Edit Menu Item' : 'Add New Menu Item'}
                            </h3>
                            <button
                                onClick={closeModal}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Item Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={newItemName}
                                    onChange={(e) => setNewItemName(e.target.value)}
                                    placeholder="e.g. Schezwan Fried Rice"
                                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-medium focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900 transition-all placeholder:text-gray-400"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Price (₹) *</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="1"
                                        value={newItemPrice}
                                        onChange={(e) => setNewItemPrice(e.target.value)}
                                        placeholder="e.g. 150"
                                        className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-medium focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900 transition-all placeholder:text-gray-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Category *</label>
                                    <input
                                        type="text"
                                        required
                                        value={newItemCategory}
                                        onChange={(e) => setNewItemCategory(e.target.value)}
                                        placeholder="e.g. Mains"
                                        className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-medium focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900 transition-all placeholder:text-gray-400"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Image URL (Optional)</label>
                                <input
                                    type="url"
                                    value={newItemImage}
                                    onChange={(e) => setNewItemImage(e.target.value)}
                                    placeholder="https://example.com/image.jpg"
                                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-medium focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900 transition-all placeholder:text-gray-400"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                    {isSubmitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Add Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
