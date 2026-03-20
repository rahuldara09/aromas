/**
 * receipt.js - ESC/POS Receipt Formatter
 * 
 * Formats order data into raw ESC/POS byte sequences for 80mm thermal printers.
 * Max 48 characters per line (80mm paper). Use 32 chars for 58mm.
 */

const COLS = 48; // 80mm paper

// ESC/POS constants
const ESC = '\x1B';
const GS = '\x1D';

const INIT = `${ESC}\x40`;             // Initialize printer
const CENTER = `${ESC}\x61\x01`;        // Center align
const LEFT = `${ESC}\x61\x00`;          // Left align
const RIGHT = `${ESC}\x61\x02`;         // Right align
const BOLD_ON = `${ESC}\x45\x01`;       // Bold on
const BOLD_OFF = `${ESC}\x45\x00`;      // Bold off
const DOUBLE_SIZE = `${GS}\x21\x11`;    // Double height + width
const NORMAL_SIZE = `${GS}\x21\x00`;    // Normal size
const CUT = `${GS}\x56\x41`;           // Paper cut (partial)
const FEED = '\x0A';                     // Line feed

function pad(str, len, char = ' ') {
  return str.toString().padEnd(len, char);
}

function rpad(str, len, char = ' ') {
  return str.toString().padStart(len, char);
}

function line(char = '-') {
  return char.repeat(COLS) + FEED;
}

function twoCol(left, right) {
  const gap = COLS - left.length - right.length;
  if (gap < 1) return left.substring(0, COLS - right.length - 1) + ' ' + right + FEED;
  return left + ' '.repeat(gap) + right + FEED;
}

/**
 * Format an order into ESC/POS receipt data
 * @param {Object} order - Order object from the frontend
 * @param {string} token - Display token (e.g. "027")
 * @returns {string[]} Array of ESC/POS data strings
 */
function formatReceipt(order, token) {
  const timestamp = new Date(order.orderDate || Date.now())
    .toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  
  const date = new Date(order.orderDate || Date.now())
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const isPOS = order.orderType === 'pos';
  const subtotal = order.items.reduce((s, i) => s + (i.price * i.quantity), 0);
  const platformFee = (order.grandTotal || 0) - subtotal;

  const data = [
    INIT,

    // ── HEADER ──
    CENTER,
    BOLD_ON,
    'AROMA DHABA' + FEED,
    BOLD_OFF,
    NORMAL_SIZE,
    (isPOS ? 'POS Receipt' : 'Kitchen Order') + FEED,
    date + FEED,
    FEED,

    // ── TOKEN (BIG) ──
    DOUBLE_SIZE,
    `#${token}` + FEED,
    NORMAL_SIZE,
    FEED,

    // ── TIME + TYPE ──
    LEFT,
    line('='),
    twoCol('TIME', timestamp),
    twoCol('TYPE', isPOS ? 'Walk-in' : (order.deliveryAddress?.deliveryType || 'Delivery')),
    twoCol('PAYMENT', order.payment_status === 'success' ? 'PAID ONLINE' : (isPOS ? 'IN-STORE' : 'COD')),
    line('='),
    FEED,

    // ── ITEMS ──
    BOLD_ON,
    `${order.items.reduce((s, i) => s + i.quantity, 0)} ITEMS` + FEED,
    BOLD_OFF,
    line('-'),
  ];

  // Item rows
  order.items.forEach(item => {
    const qty = `${item.quantity}x`;
    const name = item.name;
    const price = `Rs.${item.price * item.quantity}`;
    data.push(twoCol(`${qty} ${name}`, price));
  });

  data.push(
    line('-'),
    FEED,

    // ── BILL SUMMARY ──
    twoCol('Item Total', `Rs.${subtotal}`),
  );

  if (platformFee > 0) {
    data.push(twoCol('Platform Fee', `Rs.${platformFee}`));
  }

  data.push(
    twoCol('Delivery', 'FREE'),
    line('-'),
    BOLD_ON,
    twoCol('GRAND TOTAL', `Rs.${order.grandTotal || subtotal}`),
    BOLD_OFF,
    line('='),
    FEED,
  );

  // ── CUSTOMER INFO ──
  if (!isPOS) {
    data.push(
      BOLD_ON,
      'DELIVER TO' + FEED,
      BOLD_OFF,
      `${order.deliveryAddress?.name || 'Guest'}` + FEED,
    );

    if (order.deliveryAddress?.hostelNumber) {
      data.push(`Hostel ${order.deliveryAddress.hostelNumber}` + FEED);
    }
    if (order.deliveryAddress?.roomNumber) {
      data.push(`Room ${order.deliveryAddress.roomNumber}` + FEED);
    }
    if (order.customerPhone || order.deliveryAddress?.mobile) {
      data.push(`Ph: ${order.customerPhone || order.deliveryAddress?.mobile}` + FEED);
    }

    data.push(line('-'), FEED);
  }

  // ── FOOTER ──
  data.push(
    CENTER,
    'Thank you!' + FEED,
    FEED,
    FEED,
    FEED,
    CUT,
  );

  return data;
}

module.exports = { formatReceipt };
