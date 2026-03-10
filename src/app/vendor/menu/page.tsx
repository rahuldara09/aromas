'use client';

import { useVendor } from '@/contexts/VendorContext';
import { useAuth } from '@/contexts/AuthContext';
import { toggleProductAvailability, addProduct, deleteProduct, updateProduct } from '@/lib/vendor';
import { Product } from '@/types';
import toast from 'react-hot-toast';
import { Menu as MenuIcon, Search, Plus, X, Trash2, Edit2 } from 'lucide-react';
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
        <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20 h-full flex flex-col transition-colors">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3 transition-colors">
                        <MenuIcon className="text-red-500" /> Menu & Inventory
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1 transition-colors">Manage your catalog and item availability</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-72">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search items..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-sm font-bold placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:font-medium focus:outline-none focus:border-red-400 dark:focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900 transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold transition-colors shadow-sm whitespace-nowrap"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">Add Item</span>
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex-1 overflow-hidden flex flex-col min-h-0 transition-colors">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/80 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors">
                    <div className="col-span-12 md:col-span-5">Item</div>
                    <div className="hidden md:block md:col-span-3">Category</div>
                    <div className="hidden md:block md:col-span-2 text-right">Price</div>
                    <div className="col-span-12 md:col-span-2 text-right mt-2 md:mt-0 flex justify-between md:justify-end gap-6">
                        <span>Status</span>
                        <span>Action</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 scrollbar-thin transition-colors text-sm">
                    {filteredProducts.length === 0 ? (
                        <div className="p-10 text-center text-gray-400 dark:text-gray-500 font-medium transition-colors">No items found matching "{search}"</div>
                    ) : (
                        filteredProducts.map(product => {
                            const available = product.isAvailable ?? true;

                            return (
                                <div key={product.id} className={`grid grid-cols-12 gap-4 p-4 items-center transition-colors ${!available ? 'bg-rose-50/30 dark:bg-rose-950/20' : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/50'}`}>
                                    <div className="col-span-12 md:col-span-5 flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700 transition-colors ${!available ? 'grayscale opacity-60' : ''}`}>
                                            {product.imageURL ? (
                                                <img src={product.imageURL} alt={product.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm">🍽</div>
                                            )}
                                        </div>
                                        <div>
                                            <p className={`font-bold text-sm ${!available ? 'text-gray-500 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>{product.name}</p>
                                            <div className="md:hidden mt-0.5 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                <span>{(product as any).category || 'Uncategorized'}</span>
                                                <span>•</span>
                                                <span className="font-bold text-gray-700 dark:text-gray-300">₹{product.price}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="hidden md:block md:col-span-3">
                                        <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-md transition-colors">
                                            {(product as any).category || 'Uncategorized'}
                                        </span>
                                    </div>

                                    <div className="hidden md:block md:col-span-2 text-right font-black text-gray-900 dark:text-white text-sm transition-colors">
                                        ₹{product.price}
                                    </div>

                                    <div className="col-span-12 md:col-span-2 flex justify-between md:justify-end items-center gap-4">
                                        <div className="flex md:hidden items-center gap-3 w-full">
                                            {/* Mobile layout helpers */}
                                        </div>
                                        <button
                                            onClick={() => handleToggleProduct(product)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shadow-inner flex-shrink-0 ${available ? 'bg-emerald-500 dark:bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${available ? 'translate-x-[22px]' : 'translate-x-[4px]'}`} />
                                        </button>

                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleEditClick(product)}
                                                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors"
                                                title="Edit Item"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteProduct(product)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                                                title="Delete Item"
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
