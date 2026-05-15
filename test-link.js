const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });
async function test() {
  const payload = {
    link_id: 'test_link_' + Date.now(),
    link_amount: 1,
    link_currency: 'INR',
    link_purpose: 'Test Order Payment',
    customer_details: {
      customer_phone: '9999999999',
      customer_name: 'Test Customer'
    },
    link_notify: {
      send_sms: false,
      send_email: false
    },
    link_meta: {
      return_url: 'http://localhost:3000/order/123?cf_id={order_id}',
      notify_url: 'http://localhost:3000/api/payment/webhook'
    }
  };
  const res = await fetch('https://sandbox.cashfree.com/pg/links', {
    method: 'POST',
    headers: {
      'x-client-id': process.env.CASHFREE_APP_ID || process.env.NEXT_PUBLIC_CASHFREE_APP_ID,
      'x-client-secret': process.env.CASHFREE_SECRET_KEY,
      'x-api-version': '2023-08-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
