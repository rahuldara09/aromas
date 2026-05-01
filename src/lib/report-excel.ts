import ExcelJS from 'exceljs';
import type { DocumentData } from 'firebase-admin/firestore';

// ─── IST timezone helpers ─────────────────────────────────────────────────────
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

export function startOfDayIST(refDate?: Date): Date {
    const d = refDate ?? new Date();
    const ist = new Date(d.getTime() + IST_OFFSET_MS);
    // Midnight IST expressed as UTC
    const midnight = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
    return new Date(midnight - IST_OFFSET_MS);
}

export function endOfDayIST(refDate?: Date): Date {
    return new Date(startOfDayIST(refDate).getTime() + 86400000 - 1);
}

export function startOfMonthIST(y: number, m: number): Date {
    const midnight = Date.UTC(y, m, 1);
    return new Date(midnight - IST_OFFSET_MS);
}

export function endOfMonthIST(y: number, m: number): Date {
    const midnight = Date.UTC(y, m + 1, 1); // first of next month
    return new Date(midnight - IST_OFFSET_MS - 1);
}

export function prevMonthIST(): { year: number; month: number; label: string } {
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    const m = nowIST.getUTCMonth(); // 0-indexed
    const y = nowIST.getUTCFullYear();
    const prevM = m === 0 ? 11 : m - 1;
    const prevY = m === 0 ? y - 1 : y;
    const label = new Date(Date.UTC(prevY, prevM, 1)).toLocaleDateString('en-IN', {
        month: 'long', year: 'numeric', timeZone: 'UTC',
    });
    return { year: prevY, month: prevM, label };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderRow {
    id: string;
    token: string;
    date: string;
    time: string;
    customer: string;
    type: string;
    items: string;
    revenue: number;
    paymentStatus: string;
    status: string;
}

export interface ItemRow {
    name: string;
    qty: number;
    revenue: number;
    avgPrice: number;
    orders: number;
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const INDIGO = 'FF6366F1';
const WHITE  = 'FFFFFFFF';
const LIGHT  = 'FFF5F3FF';

function styleHeader(row: ExcelJS.Row) {
    row.eachCell(cell => {
        cell.font = { bold: true, color: { argb: WHITE }, size: 11 };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            bottom: { style: 'thin', color: { argb: 'FF4F46E5' } },
        };
    });
    row.height = 22;
}

function styleDataRow(row: ExcelJS.Row, isEven: boolean) {
    row.eachCell(cell => {
        cell.fill = isEven
            ? { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }
            : { type: 'pattern', pattern: 'solid', fgColor: { argb: WHITE } };
        cell.alignment = { vertical: 'middle', wrapText: false };
    });
    row.height = 18;
}

function styleTotals(row: ExcelJS.Row) {
    row.eachCell(cell => {
        cell.font = { bold: true, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
        cell.border = { top: { style: 'medium', color: { argb: INDIGO } } };
    });
    row.height = 20;
}

// ─── Firestore doc → OrderRow ─────────────────────────────────────────────────

export function docToOrderRow(id: string, data: DocumentData): OrderRow {
    const orderDate = data.orderDate?.toDate?.() ?? new Date(data.orderDate ?? Date.now());
    const items: { name: string; quantity: number; price: number }[] = data.items ?? [];
    return {
        id,
        token: data.orderToken ?? id.slice(0, 6).toUpperCase(),
        date:  orderDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
        time:  orderDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
        customer: data.deliveryAddress?.name ?? data.customerPhone ?? 'Walk-in',
        type: data.orderType === 'pos' ? 'POS' : 'Online',
        items: items.map(i => `${i.name} ×${i.quantity}`).join(' | '),
        revenue: data.grandTotal ?? 0,
        paymentStatus: data.payment_status ?? 'cash',
        status: data.status ?? '—',
    };
}

// ─── Aggregate item rows ──────────────────────────────────────────────────────

export function buildItemRows(orders: OrderRow[], rawDocs: DocumentData[]): ItemRow[] {
    const map = new Map<string, { qty: number; revenue: number; appearances: number }>();
    rawDocs.forEach(data => {
        if (data.status === 'Cancelled') return;
        const items: { name: string; quantity: number; price: number }[] = data.items ?? [];
        items.forEach(i => {
            const ex = map.get(i.name) ?? { qty: 0, revenue: 0, appearances: 0 };
            map.set(i.name, {
                qty: ex.qty + i.quantity,
                revenue: ex.revenue + i.price * i.quantity,
                appearances: ex.appearances + 1,
            });
        });
    });
    return [...map.entries()]
        .map(([name, d]) => ({
            name,
            qty: d.qty,
            revenue: d.revenue,
            avgPrice: d.qty > 0 ? Math.round(d.revenue / d.qty) : 0,
            orders: d.appearances,
        }))
        .sort((a, b) => b.revenue - a.revenue);
}

// ─── Build workbook ───────────────────────────────────────────────────────────

export async function buildReportWorkbook(
    orderRows: OrderRow[],
    itemRows: ItemRow[],
    meta: { dateLabel: string; period: string },
): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Aroma Ops';
    wb.created = new Date();
    wb.properties.date1904 = false;

    // ── Sheet 1: Transactions ─────────────────────────────────────────────────
    const txSheet = wb.addWorksheet('Transactions', {
        pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    // Title
    txSheet.mergeCells('A1:J1');
    const title1 = txSheet.getCell('A1');
    title1.value = `Aroma Dhaba · Transaction Report · ${meta.dateLabel}`;
    title1.font  = { bold: true, size: 14, color: { argb: INDIGO } };
    title1.alignment = { horizontal: 'center', vertical: 'middle' };
    txSheet.getRow(1).height = 28;

    txSheet.mergeCells('A2:J2');
    const sub1 = txSheet.getCell('A2');
    sub1.value = `Period: ${meta.period}  ·  Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
    sub1.font  = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
    sub1.alignment = { horizontal: 'center' };
    txSheet.getRow(2).height = 16;

    txSheet.addRow([]); // blank

    txSheet.columns = [
        { key: 'id',            width: 24 },
        { key: 'token',         width: 8  },
        { key: 'date',          width: 12 },
        { key: 'time',          width: 10 },
        { key: 'customer',      width: 22 },
        { key: 'type',          width: 10 },
        { key: 'items',         width: 52 },
        { key: 'revenue',       width: 14 },
        { key: 'paymentStatus', width: 14 },
        { key: 'status',        width: 14 },
    ];

    const headerRow = txSheet.addRow([
        'Order ID', 'Token', 'Date', 'Time', 'Customer', 'Type', 'Items', 'Revenue (₹)', 'Payment', 'Status',
    ]);
    styleHeader(headerRow);

    let totalRevenue = 0;
    orderRows.forEach((row, i) => {
        const r = txSheet.addRow([
            row.id, row.token, row.date, row.time,
            row.customer, row.type, row.items,
            row.revenue, row.paymentStatus, row.status,
        ]);
        styleDataRow(r, i % 2 === 0);
        if (row.status !== 'Cancelled') totalRevenue += row.revenue;
        // Revenue column = index 8 (col H)
        r.getCell(8).numFmt = '₹#,##0.00';
        r.getCell(8).alignment = { horizontal: 'right' };
    });

    // Totals row
    const totalRow = txSheet.addRow([
        '', '', '', '', `${orderRows.length} orders`, '', '', totalRevenue, '', '',
    ]);
    styleTotals(totalRow);
    totalRow.getCell(8).numFmt = '₹#,##0.00';
    totalRow.getCell(8).alignment = { horizontal: 'right' };

    // Freeze header
    txSheet.views = [{ state: 'frozen', ySplit: 4, xSplit: 0 }];
    txSheet.autoFilter = { from: 'A4', to: 'J4' };

    // ── Sheet 2: Item Summary ─────────────────────────────────────────────────
    const itemSheet = wb.addWorksheet('Item Summary', {
        pageSetup: { paperSize: 9, orientation: 'portrait' },
    });

    itemSheet.mergeCells('A1:F1');
    const title2 = itemSheet.getCell('A1');
    title2.value = `Aroma Dhaba · Item Sales Summary · ${meta.dateLabel}`;
    title2.font  = { bold: true, size: 14, color: { argb: INDIGO } };
    title2.alignment = { horizontal: 'center', vertical: 'middle' };
    itemSheet.getRow(1).height = 28;

    itemSheet.addRow([]); // blank

    itemSheet.columns = [
        { key: 'rank',     width: 6  },
        { key: 'name',     width: 36 },
        { key: 'qty',      width: 14 },
        { key: 'revenue',  width: 16 },
        { key: 'avgPrice', width: 14 },
        { key: 'orders',   width: 14 },
    ];

    const ih = itemSheet.addRow(['#', 'Item Name', 'Qty Sold', 'Revenue (₹)', 'Avg Price (₹)', 'In Orders']);
    styleHeader(ih);

    let itemTotalQty = 0;
    let itemTotalRev = 0;
    itemRows.forEach((item, i) => {
        const r = itemSheet.addRow([
            i + 1, item.name, item.qty, item.revenue, item.avgPrice, item.orders,
        ]);
        styleDataRow(r, i % 2 === 0);
        r.getCell(4).numFmt = '₹#,##0.00';
        r.getCell(5).numFmt = '₹#,##0.00';
        r.getCell(4).alignment = { horizontal: 'right' };
        r.getCell(5).alignment = { horizontal: 'right' };
        r.getCell(3).alignment = { horizontal: 'center' };
        itemTotalQty += item.qty;
        itemTotalRev += item.revenue;
    });

    const itemTotal = itemSheet.addRow(['', 'TOTAL', itemTotalQty, itemTotalRev, '', '']);
    styleTotals(itemTotal);
    itemTotal.getCell(4).numFmt = '₹#,##0.00';
    itemTotal.getCell(4).alignment = { horizontal: 'right' };

    itemSheet.views = [{ state: 'frozen', ySplit: 3, xSplit: 0 }];

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
}
