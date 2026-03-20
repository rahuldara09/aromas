# Aroma Printer Service

A lightweight, robust Node.js service that controls POS thermal printers (EPSON/STAR) using ESC/POS commands over USB, Network, or LPT limits. Exposes a local HTTP server ensuring silent printing from web browsers.

## 1. Setup

Navigate into the directory and install dependencies:

```bash
cd printer-service
npm install
```

Copy the environment file and edit your printer configuration:

```bash
cp .env.example .env
```

### Configuration (`.env`)
- **`PRINTER_INTERFACE`**: Crucial connection argument.
  - MacOS USB Printer: `printer:Printer_POS_80` (uses CUPS `lp` system queue)
  - Windows USB: `//./usb/Vid_xxxx&Pid_xxxx` (Get from device manager)
  - Network (LAN/WiFi): `tcp://192.168.1.100`

## 2. Running for Development

Run natively in your terminal:
```bash
npm run dev
```
The server will boot on `http://localhost:3001`.

## 3. Running in Production (PM2)

For the background production daemon, install PM2 globally:

```bash
npm install -g pm2
```

Start the service:
```bash
npm run pm2:start
```

Useful PM2 commands:
- View logs: `npm run pm2:logs`
- Restart service: `npm run pm2:restart`
- Stop service: `npm run pm2:stop`

## API Reference

### Health Check
`GET http://localhost:3001/status`
Returns: `"Printer service running"`

### Print Endpoint
`POST http://localhost:3001/print`

Accepts JSON formatted loosely as:
```json
{
  "text": "Hello World!"
}
```
*Or rich POS objects:*
```json
{
  "token": "012",
  "order": {
    "orderType": "pos",
    "orderDate": "2026-03-21T01:28:42",
    "items": [{ "name": "Biryani", "quantity": 1, "price": 100 }],
    "grandTotal": 100 
  }
}
```
