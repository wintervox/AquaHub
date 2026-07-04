/*  shop-data.js  –  shared data layer for Pure Flow Refill
    Works inside Claude (window.storage) and on any real server (localStorage).
*/
(function (window) {
  var KEY = 'shop-data';

  var hasCloud = typeof window.storage !== 'undefined' &&
    window.storage && typeof window.storage.get === 'function';

  /* ---- storage wrappers ---- */
  async function sGet(k) {
    if (hasCloud) { try { return await window.storage.get(k, false); } catch (e) { return null; } }
    try { var v = localStorage.getItem(k); return v ? { value: v } : null; } catch (e) { return null; }
  }
  async function sSet(k, v) {
    if (hasCloud) { try { return await window.storage.set(k, v, false); } catch (e) { return null; } }
    try { localStorage.setItem(k, v); return { value: v }; } catch (e) { return null; }
  }

  /* ---- defaults ---- */
  function defaults() {
    return {
      items: [
        { id: 'itm-1', name: '5L Bottle', price: 80, stock: 40, category: 'water', litresPerUnit: 5, imageUrl: '' },
        { id: 'itm-2', name: '10L Bottle', price: 100, stock: 30, category: 'water', litresPerUnit: 10, imageUrl: '' },
        { id: 'itm-3', name: '20L BOTTLE (refill)', price: 150, stock: 20, category: 'water', litresPerUnit: 20, imageUrl: '' },
        { id: 'itm-4', name: 'New 20L Bottle', price: 400, stock: 10, category: 'water', litresPerUnit: 20, imageUrl: '' },
        { id: 'itm-5', name: 'glass', price: 5, stock: 200, category: 'goods', litresPerUnit: 0, imageUrl: '' },
        { id: 'itm-6', name: 'Mineral Water (500ml)', price: 50, stock: 60, category: 'goods', litresPerUnit: 0, imageUrl: '' }
      ],
      requests: [],
      sales: [],
      metreReadings: []
    };
  }

  /* ---- helpers ---- */
  function uid(p) { return p + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7); }
  function money(n) { return '$' + Number(n).toFixed(2); }
  function today() { return new Date().toISOString().slice(0,10); }

  /* ---- load / save ---- */
  async function load() {
    var state;
    try {
      var r = await sGet(KEY);
      if (r && r.value) {
        state = JSON.parse(r.value);
        if (!state.requests)     state.requests     = [];
        if (!state.sales)        state.sales        = [];
        if (!state.metreReadings)state.metreReadings= [];
        if (!state.items)        state.items        = [];
        state.items.forEach(function(i){
          if (!i.category)     i.category     = 'water';
          if (typeof i.litresPerUnit !== 'number') i.litresPerUnit = 0;
          if (typeof i.imageUrl !== 'string') i.imageUrl = '';
        });
      } else {
        state = defaults();
        await sSet(KEY, JSON.stringify(state));
      }
    } catch(e) {
      state = defaults();
      try { await sSet(KEY, JSON.stringify(state)); } catch(_) {}
    }
    return state;
  }

  function save(state) { return sSet(KEY, JSON.stringify(state)); }

  /* ---- export ---- */
  window.ShopData = {
    LOW: 5,
    CAP_COLORS: ['#2EC4B6','#FFC93C','#16324F','#D8553A','#6C5CE7','#00B894'],
    uid: uid, money: money, today: today,
    load: load, save: save
  };
})(window);
