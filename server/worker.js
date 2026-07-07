/* 손주마켓 API — Cloudflare Worker + KV
 * 주문을 KV(order:<id>)에 저장, 프로필은 'profile'. 모든 응답에 CORS 허용.
 * 배포: 아래 wrangler.toml 참고
 */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', ...cors } });

    if (!env.ORDERS) return json({ error: 'KV binding ORDERS 없음' }, 500);

    try {
      // 목록
      if (p === '/api/orders' && req.method === 'GET') {
        const list = await env.ORDERS.list({ prefix: 'order:' });
        const orders = [];
        for (const k of list.keys) { const v = await env.ORDERS.get(k.name); if (v) orders.push(JSON.parse(v)); }
        orders.sort((a, b) => b.createdAt - a.createdAt);
        return json(orders);
      }
      // 생성
      if (p === '/api/orders' && req.method === 'POST') {
        const body = await req.json();
        const now = Date.now();
        const list = await env.ORDERS.list({ prefix: 'order:' });
        const order = {
          id: 'o' + now, seq: list.keys.length + 1, createdAt: now,
          photo: body.photo || '', memo: body.memo || '',
          status: 'requested', history: [{ status: 'requested', at: now }],
          itemName: '', price: null, fee: null, siteUrl: '', adminNote: '', trackingNo: '', paid: false
        };
        await env.ORDERS.put('order:' + order.id, JSON.stringify(order));
        return json(order);
      }
      // 개별 (PATCH / DELETE / .../status)
      const m = p.match(/^\/api\/orders\/([^\/]+)(\/status)?$/);
      if (m) {
        const key = 'order:' + m[1];
        if (req.method === 'DELETE') { await env.ORDERS.delete(key); return json({ ok: true }); }
        const cur = await env.ORDERS.get(key);
        if (!cur) return json({ error: 'not found' }, 404);
        const order = JSON.parse(cur);
        const body = await req.json();
        if (m[2] === '/status') {
          order.status = body.status;
          order.history = order.history || [];
          order.history.push({ status: body.status, at: Date.now() });
          if (body.status === 'done') order.paid = true;
        } else {
          for (const k in body) if (k !== 'id') order[k] = body[k];
        }
        await env.ORDERS.put(key, JSON.stringify(order));
        return json(order);
      }
      // 프로필
      if (p === '/api/profile' && req.method === 'GET') { const v = await env.ORDERS.get('profile'); return json(v ? JSON.parse(v) : null); }
      if (p === '/api/profile' && req.method === 'PUT') { const b = await req.json(); await env.ORDERS.put('profile', JSON.stringify(b)); return json(b); }

      if (p === '/' || p === '/api') return json({ ok: true, service: '손주마켓 API' });
      return json({ error: 'not found', path: p }, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
  }
};
