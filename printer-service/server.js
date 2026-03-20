require('dotenv').config();
const express = require('express');
const cors = require('cors');
const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;

const app = express();
const PORT = process.env.PORT || 3001;

// ── Configuration ───────────────────────────────────────────────
const PRINTER_INTERFACE = process.env.PRINTER_INTERFACE || 'printer:Printer_POS_80'; // e.g., 'printer:192.168.1.100', '/dev/usb/lp0', etc.
const PRINTER_TYPE = process.env.PRINTER_TYPE === 'STAR' ? PrinterTypes.STAR : PrinterTypes.EPSON;

app.use(cors());
app.use(express.json());

// ── Helper to format receipt ──────────────────────────────────────
async function printOrderReceipt(printer, order, token) {
  const orderDate = new Date(order.orderDate || Date.now());
  const dateStr = orderDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = orderDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const platformFee = Math.max(0, (order.grandTotal || subtotal) - subtotal);
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  printer.alignCenter();
  printer.bold(true);
  printer.println('AROMA DHABA');
  printer.bold(false);
  printer.println(order.orderType === 'pos' ? 'POS Receipt' : 'Kitchen Order');
  printer.println(dateStr);
  printer.newLine();

  printer.setTextDoubleHeight();
  printer.setTextDoubleWidth();
  printer.println(`#${token}`);
  printer.setTextNormal();
  printer.newLine();

  printer.alignLeft();
  printer.drawLine();
  printer.leftRight('TIME', timeStr);
  printer.leftRight('TYPE', order.orderType === 'pos' ? 'Walk-in' : (order.deliveryAddress?.deliveryType || 'Delivery'));
  printer.drawLine();
  printer.newLine();

  printer.bold(true);
  printer.println(`${totalItems} ITEMS`);
  printer.bold(false);
  printer.drawLine('-');

  order.items.forEach(item => {
    printer.leftRight(`${item.quantity}x ${item.name}`, `Rs.${item.price * item.quantity}`);
  });

  printer.drawLine('-');
  printer.newLine();
  printer.leftRight('Item Total', `Rs.${subtotal}`);
  
  if (platformFee > 0) {
    printer.leftRight('Platform Fee', `Rs.${platformFee}`);
  }
  printer.leftRight('Delivery', 'FREE');
  
  printer.drawLine('-');
  printer.bold(true);
  printer.leftRight('GRAND TOTAL', `Rs.${order.grandTotal || subtotal}`);
  printer.bold(false);
  printer.drawLine('=');
  printer.newLine();

  printer.alignCenter();
  printer.println('Thank you!');
  printer.newLine();
  printer.newLine();
  printer.newLine();
}

// ── Routes ───────────────────────────────────────────────────────

app.get('/status', (req, res) => {
  res.send('Printer service running');
});

app.post('/print', async (req, res) => {
  try {
    const { text, order, token } = req.body;

    // Initialize printer connection per request (best practice for network/usb reliability)
    let printer = new ThermalPrinter({
      type: PRINTER_TYPE,
      interface: PRINTER_INTERFACE,
      characterSet: 'SLOVENIA',
      removeSpecialCharacters: false,
      lineCharacter: '=',
    });

    // Check if printer is connected
    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      console.error(`Printer not connected to ${PRINTER_INTERFACE}`);
      return res.status(503).json({ success: false, error: 'Printer not connected. Check power and cables.' });
    }

    // Print Logic
    if (order && token) {
      // Print structured order receipt
      await printOrderReceipt(printer, order, token);
    } else if (text) {
      // Print raw text
      printer.alignCenter();
      printer.bold(true);
      printer.println('AROMA DHABA');
      printer.bold(false);
      printer.drawLine();
      printer.alignLeft();
      printer.println(text);
      printer.drawLine();
      printer.alignCenter();
      printer.println('Thank you!');
      printer.newLine();
      printer.newLine();
      printer.newLine();
    } else {
      return res.status(400).json({ success: false, error: 'Request body must contain { text } or { order, token }' });
    }

    printer.cut();
    
    // Execute print job
    await printer.execute();
    console.log(`[SUCCESS] Print job executed. Source: ${order ? 'Order #' + token : 'Raw Text'}`);
    
    res.json({ success: true, message: 'Printed successfully' });

  } catch (err) {
    console.error(`[ERROR] Print failed:`, err);
    res.status(500).json({ success: false, error: 'Failed to print', details: err.message });
  }
});

// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('────────────────────────────────────────────────');
  console.log(`🖨️  Aroma Printer Service running on port ${PORT}`);
  console.log(`   Type: ${PRINTER_TYPE === PrinterTypes.EPSON ? 'EPSON' : 'STAR'}`);
  console.log(`   Interface: ${PRINTER_INTERFACE}`);
  console.log('────────────────────────────────────────────────');
});
