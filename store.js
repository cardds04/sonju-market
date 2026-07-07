/* 손주마켓 데이터 계층
 * 프로토타입: localStorage 사용 (같은 폰/브라우저 안에서 할머니앱 ↔ 관리자 공유).
 * 실제 배포(다른 기기 간 공유) 시 → 이 파일의 load/save/create/update/setStatus만
 *   서버 API(Cloudflare Worker+D1 등) 호출로 바꾸면 나머지 화면은 그대로 작동.
 */
(function (global) {
  var ORDERS_KEY = 'sonju_orders_v1';
  var PROFILE_KEY = 'sonju_profile_v1';
  var listeners = [];

  // 주문 단계 — 할머니용 말투(userLabel/userMsg)와 관리자용(adminLabel) 분리
  var STAGES = [
    { key: 'requested', step: 0, adminLabel: '접수됨', userLabel: '접수됐어요', emoji: '📨',
      userMsg: '주문이 잘 들어왔어요.\n손주마켓이 확인하고 있어요.' },
    { key: 'ordered', step: 1, adminLabel: '주문함', userLabel: '주문했어요', emoji: '🛒',
      userMsg: '가게에 주문을 넣었어요.\n곧 보내드릴게요.' },
    { key: 'shipping', step: 2, adminLabel: '배송중', userLabel: '오고 있어요', emoji: '🚚',
      userMsg: '물건이 집으로 오고 있어요.\n조금만 기다려 주세요.' },
    { key: 'arrived', step: 3, adminLabel: '도착', userLabel: '도착했어요', emoji: '🏠',
      userMsg: '물건이 도착했어요!\n받으시고 아래 계좌로 넣어주세요.' },
    { key: 'done', step: 4, adminLabel: '완료', userLabel: '다 끝났어요', emoji: '✅',
      userMsg: '입금까지 확인됐어요.\n이용해 주셔서 고맙습니다!' }
  ];
  function stage(key) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].key === key) return STAGES[i];
    return STAGES[0];
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; } catch (e) { return []; }
  }
  function save(arr) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(arr));
    emit();
  }
  function emit() { for (var i = 0; i < listeners.length; i++) { try { listeners[i](); } catch (e) {} } }

  function defaultProfile() {
    return {
      name: '김순자',
      phone: '010-1234-5678',
      address: '경상북도 ○○군 ○○면 ○○길 12',
      account: '농협 123-4567-8901 (손주마켓)'
    };
  }

  var Store = {
    STAGES: STAGES,
    stage: stage,
    onChange: function (fn) { listeners.push(fn); },

    profile: function () {
      try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || defaultProfile(); }
      catch (e) { return defaultProfile(); }
    },
    saveProfile: function (p) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); },

    // 최신순
    orders: function () { return load().sort(function (a, b) { return b.createdAt - a.createdAt; }); },
    get: function (id) { var a = load(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; },

    create: function (data) {
      var arr = load();
      var now = Date.now();
      var order = {
        id: 'o' + now,
        seq: arr.length + 1,
        createdAt: now,
        photo: (data && data.photo) || '',
        memo: (data && data.memo) || '',
        status: 'requested',
        history: [{ status: 'requested', at: now }],
        itemName: '', price: null, fee: null, adminNote: '', trackingNo: '', paid: false
      };
      arr.push(order); save(arr); return order;
    },
    update: function (id, patch) {
      var arr = load();
      for (var i = 0; i < arr.length; i++) if (arr[i].id === id) {
        for (var k in patch) arr[i][k] = patch[k];
        save(arr); return arr[i];
      }
      return null;
    },
    setStatus: function (id, status) {
      var arr = load();
      for (var i = 0; i < arr.length; i++) if (arr[i].id === id) {
        arr[i].status = status;
        arr[i].history = arr[i].history || [];
        arr[i].history.push({ status: status, at: Date.now() });
        if (status === 'done') arr[i].paid = true;
        save(arr); return arr[i];
      }
      return null;
    },
    remove: function (id) { save(load().filter(function (o) { return o.id !== id; })); }
  };

  // 다른 탭에서 바뀌면(프로토타입: 관리자 탭 ↔ 할머니 탭) 자동 갱신
  global.addEventListener('storage', function (e) { if (e.key === ORDERS_KEY) emit(); });

  global.Store = Store;
})(window);
