/* 손주마켓 데이터 계층 (서버 연동판)
 * - API_BASE 가 채워지면: Cloudflare Worker(KV) 서버와 동기화 → 여러 기기 공유.
 * - API_BASE 가 비어있으면: localStorage 로만 동작(단일 기기, 폴백).
 * - 화면(app/admin)은 Store.orders() 등을 그대로 씀. 캐시는 6초마다 서버와 동기화(폴링).
 */
(function (global) {
  // ⚙️ 서버 배포 후 이 값만 채우면 여러 기기 공유가 켜짐 (비어있으면 이 기기에만 저장)
  var API_BASE = '';

  var CACHE_KEY = 'sonju_cache_v2';
  var PROFILE_KEY = 'sonju_profile_v1';
  var listeners = [];
  var cache = [];
  var profileCache = null;

  // 주문 단계 (7단계)
  var STAGES = [
    { key: 'requested', step: 0, th: 0, adminLabel: '접수됨', userLabel: '접수됐어요', emoji: '📨',
      userMsg: '주문이 잘 들어왔어요.\n어디서 파는지, 얼마인지 확인할게요.' },
    { key: 'checking', step: 1, th: 1, adminLabel: '확인중', userLabel: '확인하고 있어요', emoji: '🔎',
      userMsg: '어느 브랜드인지, 어디가 제일 싼지\n찾고 있어요. 곧 금액을 알려드릴게요.' },
    { key: 'quoted', step: 2, th: 1, adminLabel: '금액안내', userLabel: '금액이 나왔어요', emoji: '💰',
      userMsg: '가격이 나왔어요!\n이 금액으로 주문 넣을게요.\n비싸면 전화 주세요.' },
    { key: 'ordered', step: 3, th: 2, adminLabel: '주문함', userLabel: '주문했어요', emoji: '🛒',
      userMsg: '가게에 주문을 넣었어요.\n최대한 빨리 보내드릴게요.' },
    { key: 'shipping', step: 4, th: 3, adminLabel: '배송중', userLabel: '오고 있어요', emoji: '🚚',
      userMsg: '물건이 집으로 오고 있어요.\n조금만 기다려 주세요.' },
    { key: 'arrived', step: 5, th: 4, adminLabel: '도착', userLabel: '도착했어요', emoji: '🏠',
      userMsg: '물건이 도착했어요!\n받으시고 아래 계좌로 넣어주세요.' },
    { key: 'done', step: 6, th: 4, adminLabel: '완료', userLabel: '다 끝났어요', emoji: '✅',
      userMsg: '입금까지 확인됐어요.\n이용해 주셔서 고맙습니다!' }
  ];
  // 할머니 진행바에 보여줄 5개 마디
  var STEPPER = [
    { label: '접수', emoji: '📨', th: 0 },
    { label: '확인', emoji: '🔎', th: 1 },
    { label: '주문', emoji: '🛒', th: 3 },
    { label: '배송', emoji: '🚚', th: 4 },
    { label: '도착', emoji: '🏠', th: 5 }
  ];
  function stage(key) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].key === key) return STAGES[i];
    return STAGES[0];
  }

  function emit() { for (var i = 0; i < listeners.length; i++) { try { listeners[i](); } catch (e) {} } }
  function saveCache() { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {} }
  function loadCache() { try { cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || []; } catch (e) { cache = []; } }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = { 'Content-Type': 'application/json' };
    return fetch(API_BASE + path, opts).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status); return r.json();
    });
  }
  function refetch() {
    if (!API_BASE) return Promise.resolve();
    return api('/api/orders').then(function (list) {
      if (Array.isArray(list)) { cache = list; saveCache(); emit(); }
    }).catch(function () {}); // 실패 시 캐시 유지(오프라인)
  }

  function defaultProfile() {
    return { name: '김순자', phone: '010-1234-5678',
      address: '경상북도 ○○군 ○○면 ○○길 12', account: '농협 123-4567-8901 (손주마켓)' };
  }

  var pollTimer = null;
  var Store = {
    STAGES: STAGES, STEPPER: STEPPER, stage: stage, API_BASE: API_BASE,
    onChange: function (fn) { listeners.push(fn); },

    init: function () {
      loadCache(); emit();
      refetch();
      if (API_BASE && !pollTimer) pollTimer = setInterval(refetch, 6000);
      global.addEventListener('storage', function (e) { if (e.key === CACHE_KEY) { loadCache(); emit(); } });
      document.addEventListener('visibilitychange', function () { if (!document.hidden) refetch(); });
    },

    orders: function () { return cache.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }); },
    get: function (id) { for (var i = 0; i < cache.length; i++) if (cache[i].id === id) return cache[i]; return null; },

    profile: function () {
      if (profileCache) return profileCache;
      try { profileCache = JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch (e) {}
      return profileCache || defaultProfile();
    },
    saveProfile: function (p) {
      profileCache = p; try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) {}
      if (API_BASE) api('/api/profile', { method: 'PUT', body: JSON.stringify(p) }).catch(function () {});
    },

    create: function (data) {
      var now = Date.now();
      var o = { id: 'tmp' + now, seq: cache.length + 1, createdAt: now,
        photo: (data && data.photo) || '', memo: (data && data.memo) || '',
        status: 'requested', history: [{ status: 'requested', at: now }],
        itemName: '', price: null, fee: null, siteUrl: '', adminNote: '', trackingNo: '', paid: false };
      cache.push(o); saveCache(); emit(); // 낙관적 즉시 표시
      if (API_BASE) api('/api/orders', { method: 'POST', body: JSON.stringify({ photo: o.photo, memo: o.memo }) })
        .then(refetch).catch(function () {});
      return o;
    },
    update: function (id, patch) {
      var o = this.get(id);
      if (o) { for (var k in patch) o[k] = patch[k]; saveCache(); emit(); }
      if (API_BASE) api('/api/orders/' + id, { method: 'PATCH', body: JSON.stringify(patch) }).then(refetch).catch(function () {});
      return o;
    },
    setStatus: function (id, status) {
      var o = this.get(id);
      if (o) { o.status = status; o.history = o.history || []; o.history.push({ status: status, at: Date.now() });
        if (status === 'done') o.paid = true; saveCache(); emit(); }
      if (API_BASE) api('/api/orders/' + id + '/status', { method: 'POST', body: JSON.stringify({ status: status }) }).then(refetch).catch(function () {});
      return o;
    },
    remove: function (id) {
      cache = cache.filter(function (o) { return o.id !== id; }); saveCache(); emit();
      if (API_BASE) api('/api/orders/' + id, { method: 'DELETE' }).then(refetch).catch(function () {});
    },

    // 당일처리 원칙 (오후 3시 기준)
    processing: function () {
      var h = new Date().getHours();
      if (h < 15) return { today: true, badge: '⚡ 오늘 오후 3시 전 주문 · 오늘 바로 처리',
        line: '지금 주문하시면\n오늘 안에 확인해서 알려드려요! 🚀' };
      return { today: false, badge: '오후 3시 이후 · 내일 처리해요',
        line: '오후 3시가 지났어요.\n내일 확인해서 알려드릴게요.' };
    }
  };
  global.Store = Store;
})(window);
