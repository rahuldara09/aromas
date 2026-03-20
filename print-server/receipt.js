/**
 * receipt.js - Receipt Formatter
 * 
 * Two formats:
 * 1. formatReceiptRaw()  → ESC/POS byte sequences for thermal printers
 * 2. formatReceiptText() → Plain text for console / visual preview
 * 
 * 80mm paper = 48 chars per line, 58mm = 32 chars.
 */

const COLS = 48;

// ─── ESC/POS constants ───────────────────────────────────────────
const ESC = '\x1B';
const GS  = '\x1D';

const CMD = {
  INIT:        `${ESC}\x40`,
  CENTER:      `${ESC}\x61\x01`,
  LEFT:        `${ESC}\x61\x00`,
  RIGHT:       `${ESC}\x61\x02`,
  BOLD_ON:     `${ESC}\x45\x01`,
  BOLD_OFF:    `${ESC}\x45\x00`,
  DOUBLE_SIZE: `${GS}\x21\x11`,
  NORMAL_SIZE: `${GS}\x21\x00`,
  CUT:         `${GS}\x56\x41`,
  FEED:        '\x0A',
};

// ─── Helpers ─────────────────────────────────────────────────────

function divider(char = '-') {
  return char.repeat(COLS);
}

function twoCol(left, right) {
  const l = String(left);
  const r = String(right);
  const gap = COLS - l.length - r.length;
  if (gap < 1) return l.substring(0, COLS - r.length - 1) + ' ' + r;
  return l + ' '.repeat(gap) + r;
}

function center(text) {
  const t = String(text);
  const pad = Math.max(0, Math.floor((COLS - t.length) / 2));
  return ' '.repeat(pad) + t;
}

// ─── Parse order fields ──────────────────────────────────────────

function parseOrder(order, token) {
  const orderDate = new Date(order.orderDate || Date.now());
  const time = orderDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const date = orderDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const isPOS = order.orderType === 'pos';
  const subtotal = order.items.reduce((s, i) => s + (i.price * i.quantity), 0);
  const platformFee = Math.max(0, (order.grandTotal || subtotal) - subtotal);
  const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);
  const paymentLabel = order.payment_status === 'success' ? 'PAID ONLINE' : (isPOS ? 'IN-STORE' : 'COD');
  const typeLabel = isPOS ? 'Walk-in' : (order.deliveryAddress?.deliveryType || 'Delivery');

  return { time, date, isPOS, subtotal, platformFee, totalItems, paymentLabel, typeLabel };
}

// ═══════════════════════════════════════════════════════════════════
//  PLAIN TEXT RECEIPT (for console / preview)
// ═══════════════════════════════════════════════════════════════════

function formatReceiptText(order, token) {
  const { time, date, isPOS, subtotal, platformFee, totalItems, paymentLabel, typeLabel } = parseOrder(order, token);

  const lines = [
    '',
    center('AROMA DHABA'),
    center(isPOS ? 'POS Receipt' : 'Kitchen Order'),
    center(date),
    '',
    center(`#${token}`),
    '',
    divider('='),
    twoCol('TIME', time),
    twoCol('TYPE', typeLabel),
    twoCol('PAYMENT', paymentLabel),
    divider('='),
    '',
    `${totalItems} ITEMS`,
    divider('-'),
  ];

  order.items.forEach(item => {
    lines.push(twoCol(`${item.quantity}x ${item.name}`, `Rs.${item.price * item.quantity}`));
  });

  lines.push(
    divider('-'),
    '',
    twoCol('Item Total', `Rs.${subtotal}`),
  );

  if (platformFee > 0) {
    lines.push(twoCol('Platform Fee', `Rs.${platformFee}`));
  }

  lines.push(
    twoCol('Delivery', 'FREE'),
    divider('-'),
    twoCol('GRAND TOTAL', `Rs.${order.grandTotal || subtotal}`),
    divider('='),
    '',
  );

  if (!isPOS && order.deliveryAddress) {
    lines.push(
      'DELIVER TO',
      order.deliveryAddress.name || 'Guest',
    );
    if (order.deliveryAddress.hostelNumber) lines.push(`Hostel ${order.deliveryAddress.hostelNumber}`);
    if (order.deliveryAddress.roomNumber) lines.push(`Room ${order.deliveryAddress.roomNumber}`);
    if (order.customerPhone || order.deliveryAddress.mobile) {
      lines.push(`Ph: ${order.customerPhone || order.deliveryAddress.mobile}`);
    }
    lines.push(divider('-'), '');
  }

  lines.push(center('Thank you!'), '', '');

  return lines.join('\n');
}


// ═══════════════════════════════════════════════════════════════════
//  ESC/POS RAW RECEIPT (for thermal printer)
// ═══════════════════════════════════════════════════════════════════

function formatReceiptRaw(order, token) {
  const { time, date, isPOS, subtotal, platformFee, totalItems, paymentLabel, typeLabel } = parseOrder(order, token);
  const NL = CMD.FEED;

  const data = [
    CMD.INIT,
    CMD.CENTER, CMD.BOLD_ON,
    'AROMA DHABA' + NL,
    CMD.BOLD_OFF, CMD.NORMAL_SIZE,
    (isPOS ? 'POS Receipt' : 'Kitchen Order') + NL,
    date + NL, NL,

    CMD.DOUBLE_SIZE,
    `#${token}` + NL,
    CMD.NORMAL_SIZE, NL,

    CMD.LEFT,
    divider('=') + NL,
    twoCol('TIME', time) + NL,
    twoCol('TYPE', typeLabel) + NL,
    twoCol('PAYMENT', paymentLabel) + NL,
    divider('=') + NL, NL,

    CMD.BOLD_ON,
    `${totalItems} ITEMS` + NL,
    CMD.BOLD_OFF,
    divider('-') + NL,
  ];

  order.items.forEach(item => {
    data.push(twoCol(`${item.quantity}x ${item.name}`, `Rs.${item.price * item.quantity}`) + NL);
  });

  data.push(divider('-') + NL, NL);
  data.push(twoCol('Item Total', `Rs.${subtotal}`) + NL);
  if (platformFee > 0) data.push(twoCol('Platform Fee', `Rs.${platformFee}`) + NL);
  data.push(
    twoCol('Delivery', 'FREE') + NL,
    divider('-') + NL,
    CMD.BOLD_ON,
    twoCol('GRAND TOTAL', `Rs.${order.grandTotal || subtotal}`) + NL,
    CMD.BOLD_OFF,
    divider('=') + NL, NL,
  );

  if (!isPOS && order.deliveryAddress) {
    data.push(CMD.BOLD_ON, 'DELIVER TO' + NL, CMD.BOLD_OFF);
    data.push((order.deliveryAddress.name || 'Guest') + NL);
    if (order.deliveryAddress.hostelNumber) data.push(`Hostel ${order.deliveryAddress.hostelNumber}` + NL);
    if (order.deliveryAddress.roomNumber) data.push(`Room ${order.deliveryAddress.roomNumber}` + NL);
    if (order.customerPhone || order.deliveryAddress.mobile) {
      data.push(`Ph: ${order.customerPhone || order.deliveryAddress.mobile}` + NL);
    }
    data.push(divider('-') + NL, NL);
  }

  data.push(CMD.CENTER, 'Thank you!' + NL, NL, NL, NL, CMD.CUT);

  return data;
}

module.exports = { formatReceiptText, formatReceiptRaw };
