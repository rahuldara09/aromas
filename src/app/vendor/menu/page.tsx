'use client';

import { useVendor } from '@/contexts/VendorContext';
import { useAuth } from '@/contexts/AuthContext';
import {
    toggleProductAvailability, addProduct, deleteProduct, updateProduct,
    togglePosProductAvailability, addPosProduct, updatePosProduct, deletePosProduct,
} from '@/lib/vendor';
import { Product } from '@/types';
import toast from 'react-hot-toast';
import { Search, Plus, X, Trash2, Edit2, Globe, Store } from 'lucide-react';
import { useState, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
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

// ─── POS category helpers ─────────────────────────────────────────────────────

const POS_CATEGORY_ORDER = [
    'Biryani',
    'Chaat',
    'Chinese Dry Item',
    'Chinese Rice',
    'Cold Drinks',
    'Frankie',
    'Indian Rice',
    'Non Veg Gravy',
    'Noodles',
    'Paratha / Roti',
    'Sandwich',
    'Shawrma',
    'Veg Gravy',
];


const STARTERS_SET = new Set(['paneer chilly', 'chicken chilly', 'chicken 65', 'veg manchurian dry', 'chicken crispy']);
const BREAKFAST_SET = new Set(['poha', 'idali (2 piece)', 'plain dosa', 'masala dosa', 'breakfast']);

function getPOSCategory(name: string): string {
    const n = name.toLowerCase().trim();
    if (n === 'tea' || n === 'coffee') return 'Beverages';
    if (BREAKFAST_SET.has(n)) return 'Breakfast';
    if (n === 'lunch' || n === 'dinner') return 'Meals';
    if (n.includes('sandwich')) return 'Sandwiches';
    if (n.includes('shawarma') || n === 'open shawrama') return 'Shawarma';
    if (n.includes('chat') || n.includes('samosa')) return 'Snacks';
    if (n.includes('franky')) return 'Franky';
    if (n.includes('paratha')) return 'Paratha';
    if (n.includes('noodle')) return 'Noodles';
    // Rice/Biryani checked before protein so "Chicken Fried Rice" → Biryani & Rice
    if (n.includes('biryani') || n.includes('pulav') || n.endsWith('rice') || n === 'bhedi rice') return 'Biryani & Rice';
    if (n === 'omelette' || n === 'half fry' || n === 'full fry' || n.startsWith('egg')) return 'Egg Items';
    if (STARTERS_SET.has(n)) return 'Starters';
    if (n.includes('chicken') || n === 'butter chicken') return 'Chicken';
    if (n.includes('paneer')) return 'Paneer';
    return 'Veg Curries';
}

// Build slug→display map once at module level (e.g. "snacks" → "Snacks")
const CATEGORY_SLUG_MAP = Object.fromEntries(
    POS_CATEGORY_ORDER.map(c => [c.toLowerCase().replace(/[\s&]+/g, '-'), c])
);

// For POS products: prefer the stored categoryId slug over auto-detecting from the name
function getPOSDisplayCategory(p: Product): string {
    if (p.categoryId) {
        const fromSlug = CATEGORY_SLUG_MAP[p.categoryId.toLowerCase()];
        if (fromSlug) return fromSlug;
    }
    return getPOSCategory(p.name);
}

// The 13 website categories keyed by their Firestore categoryId slug
const ONLINE_CATEGORY_MAP: Record<string, string> = {
    'biryani': 'Biryani',
    'chaat': 'Chaat',
    'chinese-dry': 'Chinese Dry Item',
    'chinese-rice': 'Chinese Rice',
    'cold-drinks': 'Cold Drinks',
    'frankie': 'Frankie',
    'indian-rice': 'Indian Rice',
    'non-veg-gravy': 'Non Veg Gravy',
    'noodles': 'Noodles',
    'paratha': 'Paratha / Roti',
    'paratha-roti': 'Paratha / Roti',
    'sandwich': 'Sandwich',
    'shawrma': 'Shawrma',
    'veg-gravy': 'Veg Gravy',
};

const ONLINE_CATEGORY_ORDER = [
    'Biryani', 'Chaat', 'Chinese Dry Item', 'Chinese Rice', 'Cold Drinks',
    'Frankie', 'Indian Rice', 'Non Veg Gravy', 'Noodles', 'Paratha / Roti',
    'Sandwich', 'Shawrma', 'Veg Gravy',
];

function inferOnlineCategoryFromName(name: string): string {
    const n = name.toLowerCase().trim();

    if (n.includes('paratha') || n === 'roti' || n === 'plain roti') return 'Paratha / Roti';
    if (n.includes('franky') || n.includes('frankie')) return 'Frankie';
    if (n.includes('lassi') || n.includes('milkshake') || n.includes('cold drink') ||
        n.includes('sprite') || n.includes('pepsi') || n.includes('coke') ||
        n.includes('monster') || n.includes('campa') || n.includes('dahi') ||
        n.includes('nescafe') || n.includes('predator') || n.includes('one up') ||
        n.includes('ocean fruit') || n.includes('calvin'))
        return 'Cold Drinks';
    if (n.includes('biryani') || n.includes('pulav')) return 'Biryani';
    if (n.includes('noodle')) return 'Noodles';
    if (n.includes('shawarma') || n.includes('shawrma') || n.includes('shawrma')) return 'Shawrma';
    if (n.includes('sandwich')) return 'Sandwich';
    if (n.includes('fried rice') || n.includes('manchurian rice') || n.includes('schezwan rice') ||
        n.includes('triple rice') || n.includes('bhurji rice')) return 'Chinese Rice';
    if (n.includes('rice') || n.includes('pulao') || n.includes('bhedi') ||
        n.includes('jeera') || n === 'plain rice') return 'Indian Rice';
    if (n.includes('chat') || n.includes('chaat') || n.includes('lays') || n.includes('kurkure')) return 'Chaat';
    if (n.includes('manchurian') || n.includes('chilly') || n.includes('crispy') ||
        n.includes('manchow')) return 'Chinese Dry Item';
    if (n.includes('chicken') && (n.includes('gravy') || n.includes('masala') ||
        n.includes('curry') || n.includes('handi') || n.includes('kolhapuri') ||
        n.includes('kadai') || n.includes('butter'))) return 'Non Veg Gravy';
    if (n.includes('chicken') || n.includes('egg curry') || n.includes('egg bhurji')) return 'Non Veg Gravy';
    if (n.includes('paneer') || n.includes('aloo') || n.includes('dal') ||
        n.includes('veg') || n.includes('gobi') || n.includes('bhindi') ||
        n.includes('sev') || n.includes('mutter')) return 'Veg Gravy';
    return 'Other';
}

function getOnlineCategory(p: Product): string {
    if (p.categoryId) {
        const mapped = ONLINE_CATEGORY_MAP[p.categoryId.toLowerCase()];
        if (mapped) return mapped;
    }
    // Fallback: infer from product name when categoryId is missing/unrecognised
    return inferOnlineCategoryFromName(p.name);
}

function genCode(name: string): string {
    return name.trim().split(/\s+/)
        .map(w => w.replace(/[^a-zA-Z]/g, '')[0] ?? '')
        .filter(c => c !== '')
        .join('').toLowerCase();
}

function matchesPOSSearch(product: Product, search: string): boolean {
    if (!search) return true;
    const s = search.toLowerCase().trim();
    if (/^\d+$/.test(s) && product.serialNumber !== undefined) {
        return String(product.serialNumber).startsWith(s);
    }
    if (product.code && product.code.toLowerCase().startsWith(s)) return true;
    const initials = genCode(product.name);
    if (initials.startsWith(s)) return true;
    return product.name.toLowerCase().includes(s);
}

// ─── Shared modal state shape ─────────────────────────────────────────────────

interface ModalState {
    open: boolean;
    editing: Product | null;
    name: string;
    price: string;
    category: string;
    imageURL: string;
    imageFile: File | null;
    imagePreview: string;
    code: string;
    serialNumber: string;
    submitting: boolean;
}

const EMPTY_MODAL: ModalState = {
    open: false, editing: null, name: '', price: '', category: '',
    imageURL: '', imageFile: null, imagePreview: '', code: '', serialNumber: '', submitting: false,
};

// ─── Inventory handle (exposed to parent) ─────────────────────────────────────

interface InventoryHandle {
    openAdd: () => void;
}

// ─── Online Inventory ─────────────────────────────────────────────────────────

const OnlineInventory = forwardRef<InventoryHandle>((_, ref) => {
    const { products } = useVendor();
    const { user, phoneNumber } = useAuth();
    const [search, setSearch] = useState('');
    const [activeCat, setActiveCat] = useState<string>('All');
    const [modal, setModal] = useState<ModalState>(EMPTY_MODAL);

    useImperativeHandle(ref, () => ({
        openAdd: () => setModal({ ...EMPTY_MODAL, open: true }),
    }));

    // Items explicitly marked by the sync script as online PDF items
    const onlineProducts = useMemo(() =>
        products.filter(p => p.isOnlineItem === true),
        [products]
    );

    const filteredProducts = useMemo(() =>
        onlineProducts.filter(p =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            getOnlineCategory(p).toLowerCase().includes(search.toLowerCase())
        ),
        [onlineProducts, search]
    );

    const grouped = useMemo(() => {
        const map: Record<string, Product[]> = {};
        for (const p of filteredProducts) {
            const cat = getOnlineCategory(p);
            if (!map[cat]) map[cat] = [];
            map[cat].push(p);
        }
        for (const cat of Object.keys(map)) {
            map[cat].sort((a, b) => (a.onlineSerialNumber ?? 999) - (b.onlineSerialNumber ?? 999));
        }
        return map;
    }, [filteredProducts]);

    const presentCategories = ONLINE_CATEGORY_ORDER.filter(c => grouped[c]?.length > 0);
    const displayCategories = activeCat === 'All' ? presentCategories : presentCategories.filter(c => c === activeCat);

    const outOfStockCount = onlineProducts.filter(p => p.isAvailable === false).length;

    const handleToggle = async (product: Product) => {
        const newVal = !(product.isAvailable ?? true);
        try {
            const tok = await user!.getIdToken();
            await toggleProductAvailability(product.id, newVal, tok, phoneNumber ?? '');
            toast.success(newVal ? `${product.name} marked in stock` : `${product.name} marked out of stock`);
        } catch (e) { toast.error(getErrorMessage(e, 'Failed to update')); }
    };

    const handleDelete = async (product: Product) => {
        if (!confirm(`Delete ${product.name}?`)) return;
        try {
            const tok = await user!.getIdToken();
            await deleteProduct(product.id, tok, phoneNumber ?? '');
            toast.success(`${product.name} deleted`);
        } catch (e) { toast.error(getErrorMessage(e, 'Failed to delete')); }
    };

    const openEdit = (product: Product) => {
        setModal({
            open: true, editing: product,
            name: product.name,
            price: (product.onlinePrice ?? product.price).toString(),
            category: getOnlineCategory(product),
            imageURL: product.imageURL,
            imageFile: null,
            imagePreview: product.imageURL || '',
            code: product.code || '',
            serialNumber: product.serialNumber?.toString() || '',
            submitting: false,
        });
    };

    const closeModal = () => setModal(EMPTY_MODAL);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modal.name || !modal.price || !modal.category) {
            toast.error('Please fill all required fields');
            return;
        }
        setModal(m => ({ ...m, submitting: true }));
        try {
            let finalImageUrl = modal.imageURL || '';
            if (modal.imageFile) {
                const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
                const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
                if (!cloudName || !uploadPreset) throw new Error('Cloudinary config missing');
                const fd = new FormData();
                fd.append('file', modal.imageFile);
                fd.append('upload_preset', uploadPreset);
                const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd });
                if (!res.ok) throw new Error('Image upload failed');
                finalImageUrl = (await res.json()).secure_url;
            }
            const tok = await user!.getIdToken();
            const data = {
                name: modal.name,
                onlinePrice: parseFloat(modal.price),
                categoryId: modal.category.toLowerCase().replace(/\s+/g, '-'),
                category: modal.category,
                imageURL: finalImageUrl,
            };
            if (modal.editing) {
                await updateProduct(modal.editing.id, data, tok, phoneNumber ?? '');
                toast.success('Item updated');
            } else {
                await addProduct({
                    ...data,
                    price: parseFloat(modal.price),
                    isAvailable: true,
                    isOnlineItem: true,
                    isPOSItem: false,
                    onlineSerialNumber: onlineProducts.length + 1,
                }, tok, phoneNumber ?? '');
                toast.success('Item added');
            }
            closeModal();
        } catch (e) {
            toast.error(getErrorMessage(e, modal.editing ? 'Failed to update' : 'Failed to add'));
            setModal(m => ({ ...m, submitting: false }));
        }
    };

    return (
        <div className="space-y-5">
            {/* Stats */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex divide-x divide-gray-100">
                    <div className="flex-1 px-6 py-4">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Categories</p>
                        <p className="text-[26px] font-bold text-gray-900 mt-1 leading-none">
                            {new Set(onlineProducts.map(p => getOnlineCategory(p))).size}
                        </p>
                    </div>
                    <div className="flex-1 px-6 py-4">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Items</p>
                        <p className="text-[26px] font-bold text-gray-900 mt-1 leading-none">{onlineProducts.length}</p>
                    </div>
                    <div className="flex-1 px-6 py-4">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Out of stock</p>
                        <p className={`text-[24px] font-semibold mt-1 leading-none ${outOfStockCount > 0 ? 'text-red-500' : 'text-gray-900'}`}>
                            {outOfStockCount}
                        </p>
                    </div>
                </div>
            </div>

            {/* Search + category chips */}
            <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-3">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-50 transition-all">
                    <Search size={13} className="text-gray-400 shrink-0" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search items..."
                        className="bg-transparent border-none outline-none text-[13px] text-gray-700 placeholder:text-gray-400 w-full"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                            <X size={13} />
                        </button>
                    )}
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    <button
                        onClick={() => setActiveCat('All')}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors
                            ${activeCat === 'All' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        All
                    </button>
                    {presentCategories.map(cat => (
                        <button key={cat}
                            onClick={() => setActiveCat(cat === activeCat ? 'All' : cat)}
                            className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors
                                ${activeCat === cat ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            {cat}
                            <span className={`ml-1.5 text-[10px] ${activeCat === cat ? 'text-indigo-200' : 'text-gray-400'}`}>
                                {grouped[cat]?.length ?? 0}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Category-wise item lists */}
            {displayCategories.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
                    <p className="text-[13px] text-gray-400">No items found</p>
                </div>
            ) : displayCategories.map(cat => (
                <div key={cat} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-gray-800">{cat}</span>
                        <span className="text-[11px] text-gray-400 font-normal">{grouped[cat].length} items</span>
                    </div>

                    <div className="grid grid-cols-12 gap-2 px-5 py-2.5 border-b border-gray-50 text-[10px] text-gray-400 font-medium uppercase tracking-wide">
                        <div className="col-span-1 text-center">Sr</div>
                        <div className="col-span-5">Item</div>
                        <div className="col-span-3 text-right">Online Price</div>
                        <div className="col-span-3 flex justify-end">Availability</div>
                    </div>

                    <div className="divide-y divide-gray-50">
                        {grouped[cat].map(product => {
                            const available = product.isAvailable ?? true;
                            return (
                                <div key={product.id}
                                    className={`grid grid-cols-12 gap-2 px-5 py-3 items-center transition-colors group
                                        ${available ? 'hover:bg-gray-50' : 'hover:bg-gray-50 opacity-60'}`}
                                >
                                    <div className="col-span-1 text-center">
                                        <span className="text-[11px] font-mono text-gray-400">
                                            {product.onlineSerialNumber ?? '—'}
                                        </span>
                                    </div>
                                    <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-gray-100 overflow-hidden shrink-0 border border-gray-100">
                                            {product.imageURL ? (
                                                <img
                                                    src={isCloudinaryUrl(product.imageURL) ? cldUrl(product.imageURL, 72) : product.imageURL}
                                                    alt={product.name}
                                                    loading="lazy"
                                                    decoding="async"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">🍽</div>
                                            )}
                                        </div>
                                        <p className="text-[13px] font-medium text-gray-900 truncate">{product.name}</p>
                                    </div>
                                    <div className="col-span-3 text-right">
                                        <span className="text-[13px] font-semibold text-gray-900">
                                            ₹{(product.onlinePrice ?? product.price).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="col-span-3 flex items-center justify-end gap-2">
                                        <Toggle checked={available} onChange={() => handleToggle(product)} />
                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openEdit(product)}
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                                <Edit2 size={12} />
                                            </button>
                                            <button onClick={() => handleDelete(product)}
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Add / Edit Modal */}
            {modal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="text-[15px] font-semibold text-gray-900">
                                {modal.editing ? 'Edit Online Item' : 'Add Online Item'}
                            </h3>
                            <button onClick={closeModal} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Item name</label>
                                <input type="text" required value={modal.name}
                                    onChange={e => setModal(m => ({ ...m, name: e.target.value }))}
                                    placeholder="e.g. Paneer Tikka"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition-colors" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Online Price (₹)</label>
                                    <input type="number" required min="0" step="1" value={modal.price}
                                        onChange={e => setModal(m => ({ ...m, price: e.target.value }))}
                                        placeholder="0"
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Category</label>
                                    <select required value={modal.category}
                                        onChange={e => setModal(m => ({ ...m, category: e.target.value }))}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-gray-900 focus:outline-none focus:border-gray-400 transition-colors">
                                        <option value="">Select category</option>
                                        {POS_CATEGORY_ORDER.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Image</label>
                                {modal.imagePreview ? (
                                    <div className="relative w-full h-40 rounded-xl overflow-hidden bg-gray-100 group">
                                        <img src={modal.imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <button type="button"
                                                onClick={() => setModal(m => ({ ...m, imageFile: null, imagePreview: '', imageURL: '' }))}
                                                className="bg-white text-gray-900 px-3 py-1.5 rounded-lg text-[12px] font-medium hover:bg-gray-100 transition-colors">
                                                Remove image
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                                        <Plus size={20} className="text-gray-400 mb-1.5" />
                                        <p className="text-[12px] text-gray-400">Upload image</p>
                                        <input type="file" accept="image/*" onChange={e => {
                                            const file = e.target.files?.[0];
                                            if (file) setModal(m => ({ ...m, imageFile: file, imagePreview: URL.createObjectURL(file), imageURL: '' }));
                                        }} className="hidden" />
                                    </label>
                                )}
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={closeModal}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={modal.submitting}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                                    {modal.submitting ? 'Saving...' : modal.editing ? 'Save changes' : 'Add item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
});
OnlineInventory.displayName = 'OnlineInventory';

// ─── POS Inventory ────────────────────────────────────────────────────────────

const POSInventory = forwardRef<InventoryHandle>((_, ref) => {
    const { posProducts } = useVendor();
    const { user, phoneNumber } = useAuth();
    const [search, setSearch] = useState('');
    const [activeCat, setActiveCat] = useState<string>('All');
    const [modal, setModal] = useState<ModalState>(EMPTY_MODAL);

    useImperativeHandle(ref, () => ({
        openAdd: () => setModal({ ...EMPTY_MODAL, open: true }),
    }));

    const filtered = useMemo(() =>
        posProducts.filter(p => matchesPOSSearch(p, search)),
        [posProducts, search]
    );

    const grouped = useMemo(() => {
        const map: Record<string, Product[]> = {};
        for (const p of filtered) {
            const cat = getPOSDisplayCategory(p);
            if (!map[cat]) map[cat] = [];
            map[cat].push(p);
        }
        for (const cat of Object.keys(map)) {
            map[cat].sort((a, b) => {
                if (a.serialNumber !== undefined && b.serialNumber !== undefined)
                    return a.serialNumber - b.serialNumber;
                return a.name.localeCompare(b.name);
            });
        }
        return map;
    }, [filtered]);

    const presentCategories = [
        ...POS_CATEGORY_ORDER.filter(c => (grouped[c]?.length ?? 0) > 0),
        ...Object.keys(grouped).filter(c => !POS_CATEGORY_ORDER.includes(c))
    ];
    const displayCategories = activeCat === 'All' ? presentCategories : presentCategories.filter(c => c === activeCat);

    const posOnlyCount = posProducts.length;

    // Category count from all POS products (not search-filtered)
    const totalCategoryCount = useMemo(() => {
        const cats = new Set(posProducts.map(p => getPOSDisplayCategory(p)));
        return cats.size;
    }, [posProducts]);

    const handleToggle = async (product: Product) => {
        const newVal = !(product.isAvailable ?? true);
        try {
            const tok = await user!.getIdToken();
            await togglePosProductAvailability(product.id, newVal, tok, phoneNumber ?? '');
            toast.success(newVal ? `${product.name} in stock` : `${product.name} out of stock`);
        } catch (e) { toast.error(getErrorMessage(e, 'Failed to update')); }
    };

    const handleDelete = async (product: Product) => {
        if (!confirm(`Delete ${product.name}?`)) return;
        try {
            const tok = await user!.getIdToken();
            await deletePosProduct(product.id, tok, phoneNumber ?? '');
            toast.success(`${product.name} deleted`);
        } catch (e) { toast.error(getErrorMessage(e, 'Failed to delete')); }
    };

    const openEdit = (product: Product) => {
        setModal({
            open: true, editing: product,
            name: product.name,
            price: product.price.toString(),
            category: getPOSDisplayCategory(product),
            imageURL: '', imageFile: null, imagePreview: '',
            code: product.code || genCode(product.name),
            serialNumber: product.serialNumber?.toString() || '',
            submitting: false,
        });
    };

    const closeModal = () => setModal(EMPTY_MODAL);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modal.name || !modal.price) {
            toast.error('Name and price are required');
            return;
        }
        setModal(m => ({ ...m, submitting: true }));
        try {
            const tok = await user!.getIdToken();
            const cat = modal.category || getPOSCategory(modal.name);
            const data: Partial<Omit<Product, 'id'>> = {
                name: modal.name,
                price: parseFloat(modal.price),
                categoryId: cat.toLowerCase().replace(/[\s&]+/g, '-'),
                code: modal.code.trim() || genCode(modal.name),
                imageURL: '',
            };
            if (modal.serialNumber) data.serialNumber = parseInt(modal.serialNumber, 10);
            if (modal.editing) {
                await updatePosProduct(modal.editing.id, data, tok, phoneNumber ?? '');
                toast.success('Item updated');
            } else {
                await addPosProduct({
                    ...data,
                    isAvailable: true,
                    serialNumber: modal.serialNumber ? parseInt(modal.serialNumber, 10) : posProducts.length + 1,
                } as Omit<Product, 'id'>, tok, phoneNumber ?? '');
                toast.success('POS item added');
            }
            closeModal();
        } catch (e) {
            toast.error(getErrorMessage(e, modal.editing ? 'Failed to update' : 'Failed to add'));
            setModal(m => ({ ...m, submitting: false }));
        }
    };

    return (
        <div className="space-y-5">
            {/* Stats */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex divide-x divide-gray-100">
                    <div className="flex-1 px-6 py-4">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total POS items</p>
                        <p className="text-[26px] font-bold text-gray-900 mt-1 leading-none">{posProducts.length}</p>
                    </div>
                    <div className="flex-1 px-6 py-4">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">POS-only items</p>
                        <p className="text-[26px] font-bold text-gray-900 mt-1 leading-none">{posOnlyCount}</p>
                    </div>
                    <div className="flex-1 px-6 py-4">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Categories</p>
                        <p className="text-[26px] font-bold text-gray-900 mt-1 leading-none">{totalCategoryCount}</p>
                    </div>
                </div>
            </div>

            {/* Search + category chips */}
            <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-3">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-50 transition-all">
                    <Search size={13} className="text-gray-400 shrink-0" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, code (e.g. ctf → Chicken Tagada Franky), or Sr. No."
                        className="bg-transparent border-none outline-none text-[13px] text-gray-700 placeholder:text-gray-400 w-full"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                            <X size={13} />
                        </button>
                    )}
                </div>

                {/* Category chips */}
                <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    <button
                        onClick={() => setActiveCat('All')}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors
                            ${activeCat === 'All' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        All
                    </button>
                    {presentCategories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCat(cat === activeCat ? 'All' : cat)}
                            className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors
                                ${activeCat === cat ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            {cat}
                            <span className={`ml-1.5 text-[10px] ${activeCat === cat ? 'text-indigo-200' : 'text-gray-400'}`}>
                                {grouped[cat]?.length ?? 0}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Category-wise item lists */}
            {displayCategories.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
                    <p className="text-[13px] text-gray-400">No items found</p>
                    {search && <p className="text-[11px] text-gray-300 mt-1">Try a different code or name</p>}
                </div>
            ) : displayCategories.map(cat => (
                <div key={cat} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-gray-800">{cat}</span>
                        <span className="text-[11px] text-gray-400 font-normal">{grouped[cat].length} items</span>
                    </div>

                    <div className="grid grid-cols-12 gap-2 px-5 py-2.5 border-b border-gray-50 text-[10px] text-gray-400 font-medium uppercase tracking-wide">
                        <div className="col-span-1 text-center">Sr</div>
                        <div className="col-span-2">Code</div>
                        <div className="col-span-5">Item</div>
                        <div className="col-span-2 text-right">Price</div>
                        <div className="col-span-2 flex justify-end">Avail.</div>
                    </div>

                    <div className="divide-y divide-gray-50">
                        {grouped[cat].map(product => {
                            const available = product.isAvailable ?? true;
                            const code = product.code || genCode(product.name);

                            return (
                                <div
                                    key={product.id}
                                    className={`grid grid-cols-12 gap-2 px-5 py-3 items-center transition-colors group
                                        ${available ? 'hover:bg-gray-50' : 'hover:bg-gray-50 opacity-55'}`}
                                >
                                    <div className="col-span-1 text-center">
                                        <span className="text-[11px] font-mono text-gray-400">
                                            {product.serialNumber ?? '—'}
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[11px] font-mono font-medium">
                                            {code}
                                        </span>
                                    </div>
                                    <div className="col-span-5 min-w-0">
                                        <p className="text-[13px] font-medium text-gray-900 truncate">{product.name}</p>
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <span className="text-[13px] font-semibold text-gray-900">₹{product.price}</span>
                                    </div>
                                    <div className="col-span-2 flex items-center justify-end gap-2">
                                        <Toggle checked={available} onChange={() => handleToggle(product)} />
                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openEdit(product)}
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                                <Edit2 size={12} />
                                            </button>
                                            <button onClick={() => handleDelete(product)}
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* POS Add / Edit Modal */}
            {modal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="text-[15px] font-semibold text-gray-900">
                                {modal.editing ? 'Edit POS Item' : 'Add POS Item'}
                            </h3>
                            <button onClick={closeModal} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Serial No.</label>
                                    <input type="number" min="1" value={modal.serialNumber}
                                        onChange={e => setModal(m => ({ ...m, serialNumber: e.target.value }))}
                                        placeholder="e.g. 98"
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Short Code</label>
                                    <input type="text" value={modal.code}
                                        onChange={e => setModal(m => ({ ...m, code: e.target.value.toLowerCase() }))}
                                        placeholder="e.g. ctf"
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition-colors" />
                                    <p className="text-[10px] text-gray-400 mt-1">Auto from initials if blank</p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Item name</label>
                                <input type="text" required value={modal.name}
                                    onChange={e => {
                                        const name = e.target.value;
                                        setModal(m => ({
                                            ...m, name,
                                            code: m.code || genCode(name),
                                        }));
                                    }}
                                    placeholder="e.g. Chicken Tagada Franky"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition-colors" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">POS Price (₹)</label>
                                    <input type="number" required min="0" step="1" value={modal.price}
                                        onChange={e => setModal(m => ({ ...m, price: e.target.value }))}
                                        placeholder="0"
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Category</label>
                                    <select value={modal.category}
                                        onChange={e => setModal(m => ({ ...m, category: e.target.value }))}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-gray-900 focus:outline-none focus:border-gray-400 transition-colors">
                                        <option value="">Auto-detect</option>
                                        {POS_CATEGORY_ORDER.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={closeModal}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={modal.submitting}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                                    {modal.submitting ? 'Saving...' : modal.editing ? 'Save changes' : 'Add POS item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
});
POSInventory.displayName = 'POSInventory';

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VendorMenu() {
    const [tab, setTab] = useState<'online' | 'pos'>('online');
    const onlineRef = useRef<InventoryHandle>(null);
    const posRef = useRef<InventoryHandle>(null);

    const handleAddClick = () => {
        if (tab === 'online') onlineRef.current?.openAdd();
        else posRef.current?.openAdd();
    };

    return (
        <div className="vendor-workspace h-full overflow-y-auto p-5 space-y-5 pb-10">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Inventory</h1>
                    <p className="text-[12px] font-medium text-gray-500 mt-0.5">Catalog management</p>
                </div>
                <button
                    onClick={handleAddClick}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-[13px] font-medium transition-colors"
                >
                    <Plus size={15} />
                    {tab === 'online' ? 'Add Online Item' : 'Add POS Item'}
                </button>
            </div>

            {/* Inventory type chips */}
            <div className="flex gap-2">
                <button
                    onClick={() => setTab('online')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-colors border
                        ${tab === 'online'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-200 hover:text-indigo-600'}`}
                >
                    <Globe size={14} />
                    Online Inventory
                </button>
                <button
                    onClick={() => setTab('pos')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-colors border
                        ${tab === 'pos'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-200 hover:text-indigo-600'}`}
                >
                    <Store size={14} />
                    POS Inventory
                </button>
            </div>

            {/* Content */}
            {tab === 'online'
                ? <OnlineInventory ref={onlineRef} />
                : <POSInventory ref={posRef} />
            }
        </div>
    );
}
