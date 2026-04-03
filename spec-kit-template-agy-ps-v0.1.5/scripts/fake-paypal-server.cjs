const http = require('node:http');
const { randomUUID } = require('node:crypto');

const host = process.env.FAKE_PAYPAL_HOST ?? '127.0.0.1';
const port = Number(process.env.FAKE_PAYPAL_PORT ?? 3499);
const orders = new Map();

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendHtml(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function notFound(res) {
  sendJson(res, 404, { message: 'Not Found' });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function getOrderResponse(orderId, order) {
  return {
    id: orderId,
    status: order.status,
    purchase_units: [
      {
        custom_id: order.customId,
        payments:
          order.status === 'COMPLETED'
            ? {
                captures: [
                  {
                    id: `CAP-${orderId}`,
                    status: 'COMPLETED',
                  },
                ],
              }
            : undefined,
      },
    ],
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `${host}:${port}`}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (
    req.method === 'POST' &&
    url.pathname === '/v1/notifications/verify-webhook-signature'
  ) {
    sendJson(res, 200, { verification_status: 'SUCCESS' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/v1/oauth2/token') {
    sendJson(res, 200, {
      access_token: 'fake-paypal-access-token',
      token_type: 'Bearer',
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/v2/checkout/orders') {
    const body = await readJson(req).catch(() => ({}));
    const orderId = `FAKE-${randomUUID()}`;
    const returnUrl = body?.application_context?.return_url;
    const cancelUrl = body?.application_context?.cancel_url;
    const customId = body?.purchase_units?.[0]?.custom_id ?? null;

    orders.set(orderId, {
      status: 'CREATED',
      returnUrl,
      cancelUrl,
      customId,
    });

    sendJson(res, 201, {
      id: orderId,
      status: 'CREATED',
      links: [
        {
          rel: 'approve',
          href: `http://${host}:${port}/approve?token=${encodeURIComponent(orderId)}`,
        },
      ],
    });
    return;
  }

  const orderIdMatch = url.pathname.match(/^\/v2\/checkout\/orders\/([^/]+)(?:\/capture)?$/);
  if (orderIdMatch) {
    const orderId = decodeURIComponent(orderIdMatch[1]);
    const order = orders.get(orderId);
    if (!order) {
      sendJson(res, 404, { message: 'Unknown fake PayPal order' });
      return;
    }

    if (req.method === 'GET' && !url.pathname.endsWith('/capture')) {
      sendJson(res, 200, getOrderResponse(orderId, order));
      return;
    }

    if (req.method === 'POST' && url.pathname.endsWith('/capture')) {
      order.status = 'COMPLETED';
      orders.set(orderId, order);
      sendJson(res, 201, getOrderResponse(orderId, order));
      return;
    }
  }

  if (req.method === 'GET' && url.pathname === '/approve') {
    const token = url.searchParams.get('token');
    const order = token ? orders.get(token) : undefined;
    if (!token || !order) {
      notFound(res);
      return;
    }

    sendHtml(
      res,
      200,
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Fake PayPal Approval</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; background: #f7f7f7; color: #1f2937; }
      .card { max-width: 480px; margin: 0 auto; background: white; padding: 24px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.08); }
      button { display: inline-flex; align-items: center; justify-content: center; margin-right: 12px; margin-top: 16px; min-width: 140px; padding: 12px 16px; border-radius: 999px; border: none; cursor: pointer; font-weight: 600; }
      .approve { background: #0070ba; color: white; }
      .cancel { background: #e5e7eb; color: #111827; }
      code { background: #f3f4f6; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Fake PayPal approval</h1>
      <p>This local stub simulates the buyer approval step for Playwright.</p>
      <p>Order token: <code>${token}</code></p>
      <form action="/approve/complete" method="get">
        <input type="hidden" name="token" value="${token}" />
        <button class="approve" type="submit">Approve payment</button>
      </form>
      <form action="/approve/cancel" method="get">
        <input type="hidden" name="token" value="${token}" />
        <button class="cancel" type="submit">Cancel payment</button>
      </form>
    </div>
  </body>
</html>`,
    );
    return;
  }

  if (
    req.method === 'GET' &&
    (url.pathname === '/approve/complete' || url.pathname === '/approve/cancel')
  ) {
    const token = url.searchParams.get('token');
    const order = token ? orders.get(token) : undefined;
    if (!token || !order) {
      notFound(res);
      return;
    }

    if (url.pathname === '/approve/complete' && order.returnUrl) {
      const destination = new URL(order.returnUrl);
      destination.searchParams.set('token', token);
      redirect(res, destination.toString());
      return;
    }

    if (url.pathname === '/approve/cancel' && order.cancelUrl) {
      const destination = new URL(order.cancelUrl);
      destination.searchParams.set('token', token);
      redirect(res, destination.toString());
      return;
    }
  }

  notFound(res);
});

server.listen(port, host, () => {
  console.log(`[fake-paypal] listening on http://${host}:${port}`);
});
