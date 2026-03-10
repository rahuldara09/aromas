import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

/**
 * GET /api/admin/audit
 *
 * Read-only diagnostic endpoint. Returns a JSON report of:
 *   - All categories with their imageURL health status
 *   - All products grouped by categoryId, with image health
 *   - Orphaned products (categoryId does not match any category)
 *   - Per-category product counts vs stored productCount field
 *
 * Protected by x-admin-key header matching ADMIN_AUDIT_KEY env var.
 */

const ADMIN_AUDIT_KEY = process.env.ADMIN_AUDIT_KEY ?? '';

function isValidURL(url: unknown): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    return trimmed.startsWith('http');
}

export async function GET(request: NextRequest) {
    // ── Auth check ────────────────────────────────────────────────────────────
    const incomingKey = request.headers.get('x-admin-key') ?? '';
    if (!ADMIN_AUDIT_KEY || incomingKey !== ADMIN_AUDIT_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // ── Fetch categories ─────────────────────────────────────────────────
        const catSnap = await adminDb.collection('categories').get();
        const categoryMap: Record<string, { name: string; imageURL: string; storedCount?: number }> = {};
        const categoryReport: Array<{
            id: string;
            name: string;
            imageURL: string;
            imageStatus: 'ok' | 'broken' | 'missing';
            storedProductCount: number | null;
        }> = [];

        catSnap.docs.forEach((d) => {
            const data = d.data();
            categoryMap[d.id] = {
                name: data.name ?? '',
                imageURL: data.imageURL ?? '',
                storedCount: data.productCount,
            };
            categoryReport.push({
                id: d.id,
                name: data.name ?? '',
                imageURL: data.imageURL ?? '',
                imageStatus: !data.imageURL
                    ? 'missing'
                    : isValidURL(data.imageURL)
                        ? 'ok'
                        : 'broken',
                storedProductCount: data.productCount ?? null,
            });
        });

        // ── Fetch products ───────────────────────────────────────────────────
        const prodSnap = await adminDb.collection('products').get();
        const productCountByCategory: Record<string, number> = {};
        const orphanedProducts: Array<{ id: string; name: string; categoryId: string }> = [];
        const missingImageProducts: Array<{ id: string; name: string; categoryId: string; imageURL: string }> = [];

        prodSnap.docs.forEach((d) => {
            const data = d.data();
            const catId = data.categoryId ?? '';

            // Count products per category
            productCountByCategory[catId] = (productCountByCategory[catId] ?? 0) + 1;

            // Orphan check
            if (!categoryMap[catId]) {
                orphanedProducts.push({
                    id: d.id,
                    name: data.name ?? '',
                    categoryId: catId,
                });
            }

            // Image check
            if (!isValidURL(data.imageURL)) {
                missingImageProducts.push({
                    id: d.id,
                    name: data.name ?? '',
                    categoryId: catId,
                    imageURL: data.imageURL ?? '',
                });
            }
        });

        // ── Build category count diff report ─────────────────────────────────
        const categoryCountDiff = categoryReport.map((cat) => ({
            ...cat,
            actualProductCount: productCountByCategory[cat.id] ?? 0,
            countMismatch:
                cat.storedProductCount !== null &&
                cat.storedProductCount !== (productCountByCategory[cat.id] ?? 0),
        }));

        return NextResponse.json({
            generatedAt: new Date().toISOString(),
            summary: {
                totalCategories: categoryReport.length,
                categoriesWithBrokenImages: categoryReport.filter((c) => c.imageStatus !== 'ok').length,
                totalProducts: prodSnap.size,
                orphanedProducts: orphanedProducts.length,
                productsWithMissingImages: missingImageProducts.length,
            },
            categories: categoryCountDiff,
            orphanedProducts,
            productsWithMissingImages: missingImageProducts,
        });
    } catch (err) {
        console.error('[AdminAudit] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
