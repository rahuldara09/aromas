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
  // \x1d\x56\x00 is GS V 0 -> Full cut instantly
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
  const date = `${dd}/${mm}/${yy}`; // e.g. 22/03/26

  const isPOS = order.orderType === 'pos';
  const subtotal = order.items.reduce((s, i) => s + (i.price * i.quantity), 0);
  const platformFee = Math.max(0, (order.grandTotal || subtotal) - subtotal);
  const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);
  const paymentLabel = order.payment_status === 'success' ? 'PAID' : 'COD';
  const typeLabel = isPOS ? 'Walk-in' : (order.deliveryAddress?.deliveryType || 'Delivery');

  return { time, date, isPOS, subtotal, platformFee, totalItems, paymentLabel, typeLabel };
}

// ═══════════════════════════════════════════════════════════════════
//  PLAIN TEXT RECEIPT (for console / preview)
// ═══════════════════════════════════════════════════════════════════

function formatReceiptText(order, token) {
  const { time, date, isPOS, subtotal, platformFee, totalItems, paymentLabel, typeLabel } = parseOrder(order, token);

  return `
                  AROMA DHABA
          IIM Mumbai Campus, Powai
       Mumbai, Maharashtra 400087
  ${divider('-')}
  Date : ${date}       Bill No. : ${token}
  Type : ${typeLabel.padEnd(10)}   Payment  : ${paymentLabel}
  ${divider('-')}
  Particulars            Qty Rate   Amount
  ${divider('-')}
  ${order.items.map(item => {
    const name = item.name.substring(0, 20).padEnd(20);
    const qty = String(item.quantity).padStart(5);
    const rate = String(item.price).padStart(6);
    const amt = String(item.price * item.quantity).padStart(8);
    return `${name} ${qty} ${rate} ${amt}`;
  }).join('\n')}
  ${' '.repeat(28)}${divider('-').substring(0, 20)}
  ${twoCol('          Food Total :', subtotal.toFixed(2))}
  ${divider('-')}
  ${twoCol(`1/${totalItems}`, `Total :           ${order.grandTotal || subtotal}`)}
  ${divider('-')}
  GSTIN.27AA0CA6957F1Z8         (${time})
  E.&O.E.     Thank You         Visit Again
  `;
}

// ═══════════════════════════════════════════════════════════════════
//  ESC/POS RAW RECEIPT (for thermal printer)
// ═══════════════════════════════════════════════════════════════════

function formatReceiptRaw(order, token) {
  const { time, date, isPOS, subtotal, platformFee, totalItems, paymentLabel, typeLabel } = parseOrder(order, token);
  const NL = CMD.FEED;

  const data = [
    CMD.INIT,
    CMD.CENTER,
    'AROMA DHABA' + NL,
    'IIM Mumbai Campus, Powai' + NL,
    'Mumbai, Maharashtra 400087' + NL,
    '------------ Tax Invoice -------------' + NL, NL,
    CMD.LEFT,
    `Date : ${date}       Bill No. : ${token}` + NL,
    `Type : ${typeLabel.padEnd(10)}   Payment  : ${paymentLabel}` + NL,
    divider('-') + NL,
    'Particulars            Qty  Rate   Amount' + NL,
    divider('-') + NL,
  ];

  order.items.forEach(item => {
    // 20 chars for name, 5 for qty, 5 for rate, 8 for amount
    const name = item.name.substring(0, 20).padEnd(21);
    const qty = String(item.quantity).padStart(4);
    const rate = String(item.price).padStart(6);
    const amt = String(item.price * item.quantity).padStart(8);
    data.push(`${name} ${qty} ${rate} ${amt}` + NL);
  });

  data.push(' '.repeat(28) + divider('-').substring(0, 20) + NL);
  data.push(twoCol('          Food Total :', subtotal.toFixed(2)) + NL);

  if (platformFee > 0) {
    data.push(twoCol('          Pltfm Fee  :', platformFee.toFixed(2)) + NL);
  }

  data.push(divider('-') + NL);

  data.push(
    CMD.DOUBLE_SIZE,
    twoCol(`1/${totalItems}`, `Total:       ${order.grandTotal || subtotal}`) + NL,
    CMD.NORMAL_SIZE,
    divider('-') + NL,
  );

  if (!isPOS && order.deliveryAddress) {
    data.push(
      CMD.CENTER,
      'DELIVER TO' + NL,
      (order.deliveryAddress.name || 'Guest') + NL,
    );
    if (order.deliveryAddress.hostelNumber) data.push(`Hostel ${order.deliveryAddress.hostelNumber}` + NL);
    if (order.deliveryAddress.roomNumber) data.push(`Room ${order.deliveryAddress.roomNumber}` + NL);
    if (order.customerPhone || order.deliveryAddress.mobile) {
      data.push(`Ph: ${order.customerPhone || order.deliveryAddress.mobile}` + NL);
    }
    data.push(CMD.LEFT, divider('-') + NL);
  }

  data.push(
    twoCol('GSTIN.27AA0CA6957F1Z8', `(${time})`) + NL,
    twoCol('E.&O.E.     Thank You', 'Visit Again') + NL,
  );

  // Add 6 blank line feeds at the very bottom to push the paper entirely out of the blade
  data.push(NL, NL, NL, NL, NL, NL, CMD.CUT);

  return data;
}

// ═══════════════════════════════════════════════════════════════════
//  ANALYTICS REPORT (ESC/POS)
// ═══════════════════════════════════════════════════════════════════

/**
 * reportData: {
 *   title:   string          // e.g. "Daily Report"
 *   date:    string          // e.g. "01/05/26"
 *   range:   string          // e.g. "Today" | "Last 7 days"
 *   summary: { revenue, orders, cancelled }
 *   items:   [{ name, qty, revenue }]   // top items
 * }
 */
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
    NL, NL, NL, NL, NL, NL,
    CMD.CUT,
  );

  return data;
}

module.exports = { formatReceiptText, formatReceiptRaw, formatReportText, formatReportRaw };
