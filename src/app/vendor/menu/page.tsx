'use client';

import { useVendor } from '@/contexts/VendorContext';
import { useAuth } from '@/contexts/AuthContext';
import { toggleProductAvailability, addProduct, deleteProduct, updateProduct } from '@/lib/vendor';
import { Product } from '@/types';
import toast from 'react-hot-toast';
import { Search, Plus, X, Trash2, Edit2, Filter, Download, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { cldUrl, isCloudinaryUrl } from '@/lib/cloudinary';

type ProductWithCategory = Product & { category?: string };

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button
            onClick={onChange}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none
                ${checked ? 'bg-emerald-500' : 'bg-gray-200'}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200
                ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </button>
    );
}

export default function VendorMenu() {
    const { products } = useVendor();
    const { user, phoneNumber } = useAuth();
    const [search, setSearch] = useState('');

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [newItemName, setNewItemName] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [newItemCategory, setNewItemCategory] = useState('');
    const [newItemImage, setNewItemImage] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p as ProductWithCategory).category?.toLowerCase().includes(search.toLowerCase()) ||
        p.categoryId.toLowerCase().includes(search.toLowerCase())
    );

    const availableCount = products.filter(p => p.isAvailable !== false).length;
    const outOfStockCount = products.filter(p => p.isAvailable === false).length;

    const handleToggleProduct = async (product: Product) => {
        const newValue = !(product.isAvailable ?? true);
        try {
            const idToken = await user!.getIdToken();
            await toggleProductAvailability(product.id, newValue, idToken, phoneNumber ?? '');
            toast.success(newValue ? `${product.name} marked in stock` : `${product.name} marked out of stock`);
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Failed to update stock'));
        }
    };

    const handleDeleteProduct = async (product: Product) => {
        if (!confirm(`Delete ${product.name}?`)) return;
        try {
            const idToken = await user!.getIdToken();
            await deleteProduct(product.id, idToken, phoneNumber ?? '');
            toast.success(`${product.name} deleted`);
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Failed to delete item'));
        }
    };

    const handleEditClick = (product: Product) => {
        setEditingProduct(product);
        setNewItemName(product.name);
        setNewItemPrice(product.price.toString());
        setNewItemCategory((product as ProductWithCategory).category || product.categoryId);
        setNewItemImage(product.imageURL);
        setImageFile(null);
        setImagePreview(product.imageURL || '');
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
            let finalImageUrl = newItemImage || '';
            if (imageFile) {
                const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
                const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
                if (!cloudName || !uploadPreset) {
                    toast.error('Cloudinary configuration missing');
                    setIsSubmitting(false);
                    return;
                }
                const formData = new FormData();
                formData.append('file', imageFile);
                formData.append('upload_preset', uploadPreset);
                const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData });
                if (!uploadRes.ok) throw new Error('Failed to upload image');
                const uploadData = await uploadRes.json();
                finalImageUrl = uploadData.secure_url;
            }
            const idToken = await user!.getIdToken();
            const data = {
                name: newItemName,
                price: parseFloat(newItemPrice),
                categoryId: newItemCategory.toLowerCase().replace(/\s+/g, '-'),
                category: newItemCategory,
                imageURL: finalImageUrl,
            };
            if (editingProduct) {
                await updateProduct(editingProduct.id, data, idToken, phoneNumber ?? '');
                toast.success('Item updated');
            } else {
                await addProduct({ ...data, isAvailable: true }, idToken, phoneNumber ?? '');
                toast.success('Item added');
            }
            closeModal();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, editingProduct ? 'Failed to update item' : 'Failed to add item'));
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
        setImageFile(null);
        setImagePreview('');
    };

    return (
        <div className="vendor-workspace h-full overflow-y-auto p-5 space-y-5 pb-10">

            {/* ── HEADER ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Inventory</h1>
                    <p className="text-[12px] font-medium text-gray-500 mt-0.5">Catalog management</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-[13px] font-medium transition-colors"
                >
                    <Plus size={15} />
                    Add Item
                </button>
            </div>

            {/* ── STATS ── */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex divide-x divide-gray-100">
                    <div className="flex-1 px-6 py-4">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Portfolio value</p>
                        <p className="text-[26px] font-bold text-gray-900 mt-1 leading-none">
                            ₹{products.reduce((acc, p) => acc + p.price, 0).toLocaleString()}
                        </p>
                    </div>
                    <div className="flex-1 px-6 py-4">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Active SKUs</p>
                        <p className="text-[26px] font-bold text-gray-900 mt-1 leading-none">{availableCount}</p>
                    </div>
                    <div className="flex-1 px-6 py-4">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Out of stock</p>
                        <p className={`text-[24px] font-semibold mt-1 leading-none ${outOfStockCount > 0 ? 'text-red-500' : 'text-gray-900'}`}>
                            {outOfStockCount}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── CATALOG ── */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">

                {/* Catalog header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 gap-3">
                    <p className="text-[14px] font-semibold text-gray-900 shrink-0">
                        Catalog
                        <span className="ml-2 text-[12px] font-normal text-gray-400">
                            {filteredProducts.length} items
                        </span>
                    </p>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 flex-1 max-w-xs focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-50 transition-all">
                            <Search size={13} className="text-gray-400 shrink-0" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search items..."
                                className="bg-transparent border-none outline-none text-[13px] text-gray-700 placeholder:text-gray-400 w-full"
                            />
                        </div>
                        <button className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 text-gray-600 px-3 py-2 rounded-xl text-[12px] hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-colors">
                            <Filter size={13} />
                            Filter
                        </button>
                        <button className="flex items-center gap-1.5 bg-indigo-600 border border-indigo-600 text-white px-3 py-2 rounded-xl text-[12px] hover:bg-indigo-700 transition-colors">
                            <Download size={13} />
                            Export
                        </button>
                    </div>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-[11px] text-gray-400 font-medium">
                    <div className="col-span-5">Item</div>
                    <div className="hidden md:block md:col-span-3">Category</div>
                    <div className="hidden md:block md:col-span-2 text-right">Price</div>
                    <div className="col-span-7 md:col-span-2 flex justify-end">Availability</div>
                </div>

                {/* Items */}
                <div className="divide-y divide-gray-50">
                    {filteredProducts.length === 0 ? (
                        <div className="py-16 text-center">
                            <p className="text-[13px] text-gray-400">No items found</p>
                        </div>
                    ) : filteredProducts.map(product => {
                        const available = product.isAvailable ?? true;
                        const category = (product as ProductWithCategory).category || product.categoryId || 'Uncategorized';

                        return (
                            <div
                                key={product.id}
                                className={`grid grid-cols-12 gap-4 px-5 py-3.5 items-center transition-colors group
                                    ${available ? 'hover:bg-gray-50' : 'hover:bg-gray-50 opacity-60'}`}
                            >
                                {/* Image + name */}
                                <div className="col-span-5 flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden shrink-0 border border-gray-100">
                                        {product.imageURL ? (
                                            <img
                                                src={isCloudinaryUrl(product.imageURL) ? cldUrl(product.imageURL, 80) : product.imageURL}
                                                alt={product.name}
                                                loading="lazy"
                                                decoding="async"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300 text-base">🍽</div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-medium text-gray-900 truncate">{product.name}</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">SKU {product.id.slice(0, 8).toUpperCase()}</p>
                                    </div>
                                </div>

                                {/* Category */}
                                <div className="hidden md:block md:col-span-3">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-medium">
                                        {category}
                                    </span>
                                </div>

                                {/* Price */}
                                <div className="hidden md:block md:col-span-2 text-right">
                                    <span className="text-[13px] font-medium text-gray-900">₹{product.price.toLocaleString()}</span>
                                </div>

                                {/* Actions */}
                                <div className="col-span-7 md:col-span-2 flex items-center justify-end gap-3">
                                    <Toggle checked={available} onChange={() => handleToggleProduct(product)} />
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEditClick(product)}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteProduct(product)}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── ADD / EDIT MODAL ── */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden">

                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="text-[15px] font-semibold text-gray-900">
                                {editingProduct ? 'Edit Item' : 'Add New Item'}
                            </h3>
                            <button onClick={closeModal} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal form */}
                        <form onSubmit={handleAddSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Item name</label>
                                <input
                                    type="text"
                                    required
                                    value={newItemName}
                                    onChange={e => setNewItemName(e.target.value)}
                                    placeholder="e.g. Paneer Tikka"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Price (₹)</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="1"
                                        value={newItemPrice}
                                        onChange={e => setNewItemPrice(e.target.value)}
                                        placeholder="0"
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Category</label>
                                    <input
                                        type="text"
                                        required
                                        value={newItemCategory}
                                        onChange={e => setNewItemCategory(e.target.value)}
                                        placeholder="e.g. Mains"
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Image</label>
                                {imagePreview ? (
                                    <div className="relative w-full h-40 rounded-xl overflow-hidden bg-gray-100 group">
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <button
                                                type="button"
                                                onClick={() => { setImageFile(null); setImagePreview(''); setNewItemImage(''); }}
                                                className="bg-white text-gray-900 px-3 py-1.5 rounded-lg text-[12px] font-medium hover:bg-gray-100 transition-colors"
                                            >
                                                Remove image
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                                        <Plus size={20} className="text-gray-400 mb-1.5" />
                                        <p className="text-[12px] text-gray-400">Upload image</p>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setImageFile(file);
                                                    setImagePreview(URL.createObjectURL(file));
                                                    setNewItemImage('');
                                                }
                                            }}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>

                            <div className="flex gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                >
                                    {isSubmitting ? 'Saving...' : editingProduct ? 'Save changes' : 'Add item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
