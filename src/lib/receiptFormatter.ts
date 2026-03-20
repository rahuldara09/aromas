/**
 * ESC/POS Receipt Formatter for 80mm Thermal Printers
 *
 * Generates raw ESC/POS byte sequences as string arrays
 * compatible with QZ Tray's qz.print(config, data).
 */

import { Order } from '@/types';

// 80mm paper = 48 chars per line
const COLS = 48;

// ── ESC/POS Control Codes ─────────────────────────────────────────
const ESC = '\x1B';
const GS = '\x1D';

const CMD = {
    INIT: `${ESC}\x40`,
    CENTER: `${ESC}\x61\x01`,
    LEFT: `${ESC}\x61\x00`,
    BOLD_ON: `${ESC}\x45\x01`,
    BOLD_OFF: `${ESC}\x45\x00`,
    DOUBLE_SIZE: `${GS}\x21\x11`,
    NORMAL_SIZE: `${GS}\x21\x00`,
    CUT: `${GS}\x56\x41`,
    NL: '\x0A',
};

// ── Helpers ───────────────────────────────────────────────────────

function divider(char = '-'): string {
    return char.repeat(COLS);
}

function twoCol(left: string, right: string): string {
    const gap = COLS - left.length - right.length;
    if (gap < 1) return left.substring(0, COLS - right.length - 1) + ' ' + right;
    return left + ' '.repeat(gap) + right;
}

// ═══════════════════════════════════════════════════════════════════
//  Format receipt as ESC/POS raw data for QZ Tray
// ═══════════════════════════════════════════════════════════════════

export function formatReceipt(order: Order, token: string): string[] {
    const orderDate = new Date(order.orderDate);
    const time = orderDate.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
    const date = orderDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

    const isPOS = order.orderType === 'pos';
    const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const platformFee = Math.max(0, (order.grandTotal || subtotal) - subtotal);
    const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);
    const paymentLabel =
        order.payment_status === 'success'
            ? 'PAID ONLINE'
            : isPOS
              ? 'IN-STORE'
              : 'COD';
    const typeLabel = isPOS
        ? 'Walk-in'
        : order.deliveryAddress?.deliveryType || 'Delivery';

    const { INIT, CENTER, LEFT, BOLD_ON, BOLD_OFF, DOUBLE_SIZE, NORMAL_SIZE, CUT, NL } = CMD;

    const data: string[] = [
        INIT,

        // ── Header ──
        CENTER,
        BOLD_ON,
        'AROMA DHABA' + NL,
        BOLD_OFF,
        NORMAL_SIZE,
        (isPOS ? 'POS Receipt' : 'Kitchen Order') + NL,
        date + NL,
        NL,

        // ── Token (BIG) ──
        DOUBLE_SIZE,
        `#${token}` + NL,
        NORMAL_SIZE,
        NL,

        // ── Order Info ──
        LEFT,
        divider('=') + NL,
        twoCol('TIME', time) + NL,
        twoCol('TYPE', typeLabel) + NL,
        twoCol('PAYMENT', paymentLabel) + NL,
        divider('=') + NL,
        NL,

        // ── Items ──
        BOLD_ON,
        `${totalItems} ITEMS` + NL,
        BOLD_OFF,
        divider('-') + NL,
    ];

    // Item rows
    order.items.forEach((item) => {
        data.push(
            twoCol(
                `${item.quantity}x ${item.name}`,
                `Rs.${item.price * item.quantity}`,
            ) + NL,
        );
    });

    data.push(divider('-') + NL, NL);

    // ── Bill Summary ──
    data.push(twoCol('Item Total', `Rs.${subtotal}`) + NL);
    if (platformFee > 0) {
        data.push(twoCol('Platform Fee', `Rs.${platformFee}`) + NL);
    }
    data.push(
        twoCol('Delivery', 'FREE') + NL,
        divider('-') + NL,
        BOLD_ON,
        twoCol('GRAND TOTAL', `Rs.${order.grandTotal || subtotal}`) + NL,
        BOLD_OFF,
        divider('=') + NL,
        NL,
    );

    // ── Customer Info ──
    if (!isPOS && order.deliveryAddress) {
        data.push(BOLD_ON, 'DELIVER TO' + NL, BOLD_OFF);
        data.push((order.deliveryAddress.name || 'Guest') + NL);
        if (order.deliveryAddress.hostelNumber)
            data.push(`Hostel ${order.deliveryAddress.hostelNumber}` + NL);
        if (order.deliveryAddress.roomNumber)
            data.push(`Room ${order.deliveryAddress.roomNumber}` + NL);
        if (order.customerPhone || order.deliveryAddress.mobile)
            data.push(
                `Ph: ${order.customerPhone || order.deliveryAddress.mobile}` + NL,
            );
        data.push(divider('-') + NL, NL);
    }

    // ── Footer ──
    data.push(CENTER, 'Thank you!' + NL, NL, NL, NL, CUT);

    return data;
}
