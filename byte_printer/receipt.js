/**
 * receipt.js - Receipt Formatter
 *
 * Two formats:
 * 1. formatReceiptRaw()  → ESC/POS byte sequences for thermal printers
 * 2. formatReceiptText() → Plain text for console / visual preview
 *
 * 80mm paper = 48 chars per line
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
  CUT:         `${GS}\x56\x00`,
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

  const dObj = orderDate;
  const dd = String(dObj.getDate()).padStart(2, '0');
  const mm = String(dObj.getMonth() + 1).padStart(2, '0');
  const yy = String(dObj.getFullYear()).slice(-2);
  const date = `${dd}/${mm}/${yy}`;

  const isPOS = order.orderType === 'pos';
  const subtotal = order.items.reduce((s, i) => s + (i.price * i.quantity), 0);
  const platformFee = Math.max(0, (order.grandTotal || subtotal) - subtotal);
  const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);
  const paymentLabel = order.payment_status === 'success' ? 'PAID' : (isPOS ? 'CASH' : 'COD');
  const typeLabel = isPOS ? 'Walk-in' : (order.deliveryAddress?.deliveryType || 'Delivery');

  return { time, date, isPOS, subtotal, platformFee, totalItems, paymentLabel, typeLabel };
}

// ═══════════════════════════════════════════════════════════════════
//  PLAIN TEXT RECEIPT (for console / preview)
// ═══════════════════════════════════════════════════════════════════

function formatReceiptText(order, token) {
  const { time, date, isPOS, subtotal, platformFee, totalItems, paymentLabel, typeLabel } = parseOrder(order, token);

  let out = '';
  out += center('AROMA DHABA') + '\n';
  out += center('IIM Mumbai Campus, Powai') + '\n';
  out += center('Mumbai, Maharashtra 400087') + '\n';
  out += divider('-') + '\n';
  out += `Date : ${date}   Bill No. : ${token}   (${time})\n`;
  out += `Type : ${typeLabel.padEnd(10)}   Payment  : ${paymentLabel}\n`;
  out += divider('-') + '\n';
  out += 'Particulars            Qty Rate   Amount\n';
  out += divider('-') + '\n';
  order.items.forEach(item => {
    const name = item.name.substring(0, 20).padEnd(20);
    const qty  = String(item.quantity).padStart(5);
    const rate = String(item.price).padStart(6);
    const amt  = String(item.price * item.quantity).padStart(8);
    out += `${name} ${qty} ${rate} ${amt}\n`;
  });
  out += ' '.repeat(28) + divider('-').substring(0, 20) + '\n';
  out += twoCol('Food Total :', subtotal.toFixed(2)) + '\n';
  if (platformFee > 0) out += twoCol('Pltfm Fee  :', platformFee.toFixed(2)) + '\n';
  out += divider('-') + '\n';
  out += twoCol(`${totalItems} item(s)`, `Total: ${order.grandTotal || subtotal}`) + '\n';
  out += divider('-') + '\n';
  if (!isPOS && order.deliveryAddress) {
    out += `DELIVER TO: ${order.deliveryAddress.name || 'Guest'}`;
    if (order.deliveryAddress.hostelNumber) out += ` | H${order.deliveryAddress.hostelNumber}`;
    if (order.deliveryAddress.roomNumber)   out += ` Rm${order.deliveryAddress.roomNumber}`;
    const ph = order.customerPhone || order.deliveryAddress.mobile;
    if (ph) out += ` | Ph:${ph}`;
    out += '\n';
    out += divider('-') + '\n';
  }
  out += twoCol('GSTIN.27AA0CA6957F1Z8', 'Thank You') + '\n';
  return out;
}

// ═══════════════════════════════════════════════════════════════════
//  ESC/POS RAW RECEIPT (for thermal printer)
// ═══════════════════════════════════════════════════════════════════

function formatReceiptRaw(order, token) {
  const { time, date, isPOS, subtotal, platformFee, totalItems, paymentLabel, typeLabel } = parseOrder(order, token);
  const NL = CMD.FEED;

  const data = [
    CMD.INIT,
    // Feed 8 blank lines past the cutter-to-printhead dead zone.
    // This printer's dead zone is ~5 lines; 8 gives buffer for rapid back-to-back prints.
    NL, NL, NL, NL, NL, NL, NL, NL,
    // ── Header ──
    CMD.CENTER,
    CMD.BOLD_ON,
    'AROMA DHABA' + NL,
    CMD.BOLD_OFF,
    'IIM Mumbai Campus, Powai' + NL,
    'Mumbai, Maharashtra 400087' + NL,
    divider('-') + NL,
    // ── Meta ──
    CMD.LEFT,
    `Date:${date}  Bill:${token}  ${time}` + NL,
    `Type:${typeLabel.padEnd(9)}  Payment:${paymentLabel}` + NL,
    divider('-') + NL,
    // ── Column header ──
    'Particulars            Qty  Rate   Amt' + NL,
    divider('-') + NL,
  ];

  // ── Items ──
  order.items.forEach(item => {
    const name = item.name.substring(0, 20).padEnd(21);
    const qty  = String(item.quantity).padStart(4);
    const rate = String(item.price).padStart(6);
    const amt  = String(item.price * item.quantity).padStart(6);
    data.push(`${name} ${qty} ${rate} ${amt}` + NL);
  });

  // ── Totals ──
  data.push(divider('-') + NL);
  data.push(twoCol('Food Total:', subtotal.toFixed(2)) + NL);
  if (platformFee > 0) data.push(twoCol('Pltfm Fee :', platformFee.toFixed(2)) + NL);
  data.push(divider('-') + NL);

  // Total line — bold but NOT double-size to save paper
  data.push(
    CMD.BOLD_ON,
    twoCol(`${totalItems} item(s)`, `TOTAL: Rs.${order.grandTotal || subtotal}`) + NL,
    CMD.BOLD_OFF,
    divider('-') + NL,
  );

  // ── Delivery address (online orders only) ──
  if (!isPOS && order.deliveryAddress) {
    const addr = order.deliveryAddress;
    const ph   = order.customerPhone || addr.mobile;
    // Single compact line: name | Hostel X Rm Y | phone
    let deliverLine = `>> ${(addr.name || 'Guest').substring(0, 20)}`;
    if (addr.hostelNumber) deliverLine += ` H${addr.hostelNumber}`;
    if (addr.roomNumber)   deliverLine += ` Rm${addr.roomNumber}`;
    data.push(CMD.BOLD_ON, deliverLine + NL, CMD.BOLD_OFF);
    if (ph) data.push(`   Ph: ${ph}` + NL);
    data.push(divider('-') + NL);
  }

  // ── Footer ──
  data.push(
    CMD.CENTER,
    twoCol('GSTIN.27AA0CA6957F1Z8', `(${time})`) + NL,
    'Thank You  *  Visit Again' + NL,
  );

  // 6 feeds before cut — ensures complete buffer flush on all thermal models
  data.push(NL, NL, NL, NL, NL, NL, CMD.CUT);

  return data;
}

// ═══════════════════════════════════════════════════════════════════
//  ANALYTICS REPORT (ESC/POS)
// ═══════════════════════════════════════════════════════════════════

function formatReportText(reportData) {
  const { title, date, range, summary, items } = reportData;
  const NL = '\n';
  let out = NL;
  out += center('AROMA DHABA') + NL;
  out += center('IIM Mumbai Campus, Powai') + NL;
  out += divider('=') + NL;
  out += center(title || 'ANALYTICS REPORT') + NL;
  out += center(date || new Date().toLocaleDateString('en-IN')) + NL;
  out += center(`(${range || ''})`) + NL;
  out += divider('=') + NL;
  out += twoCol('REVENUE', `Rs.${(summary.revenue || 0).toLocaleString()}`) + NL;
  out += twoCol('ORDERS', String(summary.orders || 0)) + NL;
  out += twoCol('CANCELLED', String(summary.cancelled || 0)) + NL;
  out += divider('-') + NL;
  if (items && items.length > 0) {
    out += center('TOP ITEMS') + NL;
    out += divider('-') + NL;
    out += 'Item Name              Qty     Revenue' + NL;
    out += divider('-') + NL;
    items.forEach(item => {
      const name = String(item.name || '').substring(0, 20).padEnd(21);
      const qty  = String(item.qty || 0).padStart(5);
      const rev  = `Rs.${(item.revenue || 0)}`.padStart(11);
      out += `${name} ${qty} ${rev}` + NL;
    });
    out += divider('-') + NL;
  }
  out += center('--- End of Report ---') + NL;
  return out;
}

function formatReportRaw(reportData) {
  const { title, date, range, summary, items } = reportData;
  const NL = CMD.FEED;

  const data = [
    CMD.INIT,
    CMD.CENTER,
    CMD.BOLD_ON,
    'AROMA DHABA' + NL,
    CMD.BOLD_OFF,
    'IIM Mumbai Campus, Powai' + NL,
    divider('=') + NL,
    CMD.BOLD_ON,
    (title || 'ANALYTICS REPORT') + NL,
    CMD.BOLD_OFF,
    (date || new Date().toLocaleDateString('en-IN')) + NL,
  ];

  if (range) data.push(`(${range})` + NL);

  data.push(
    divider('=') + NL,
    CMD.LEFT,
    CMD.DOUBLE_SIZE,
    twoCol('REVENUE', `Rs.${(summary.revenue || 0).toLocaleString()}`) + NL,
    CMD.NORMAL_SIZE,
    twoCol('ORDERS', String(summary.orders || 0)) + NL,
    twoCol('CANCELLED', String(summary.cancelled || 0)) + NL,
    divider('-') + NL,
  );

  if (items && items.length > 0) {
    data.push(
      CMD.CENTER,
      CMD.BOLD_ON,
      'TOP ITEMS' + NL,
      CMD.BOLD_OFF,
      CMD.LEFT,
      divider('-') + NL,
      'Item Name              Qty     Revenue' + NL,
      divider('-') + NL,
    );

    items.forEach(item => {
      const name = String(item.name || '').substring(0, 20).padEnd(21);
      const qty  = String(item.qty || 0).padStart(5);
      const rev  = `Rs.${(item.revenue || 0)}`.padStart(11);
      data.push(`${name} ${qty} ${rev}` + NL);
    });

    data.push(divider('-') + NL);
  }

  data.push(
    CMD.CENTER,
    '--- End of Report ---' + NL,
    NL, NL, NL, NL,
    CMD.CUT,
  );

  return data;
}

module.exports = { formatReceiptText, formatReceiptRaw, formatReportText, formatReportRaw };
