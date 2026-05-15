const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });
async function test() {
  const payload = {
    order_id: 'test_' + Date.now(),
    order_amount: 1,
    order_currency: 'INR',
    customer_details: {
      customer_id: 'cust_123',
      customer_phone: '9999999999'
    }
  };
  const res = await fetch('https://sandbox.cashfree.com/pg/orders', {
    method: 'POST',
    headers: {
      'x-client-id': process.env.CASHFREE_APP_ID || process.env.NEXT_PUBLIC_CASHFREE_APP_ID || 'TEST10279691b05cb2e33f3ebef21bed19697201',
      'x-client-secret': process.env.CASHFREE_SECRET_KEY || 'cfsk_ma_test_306ac29cf2a7b29d4db6b65ee0cb7dae_83f60b4a',
      'x-api-version': '2023-08-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
