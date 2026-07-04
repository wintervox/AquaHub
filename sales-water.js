(function () {
  var state = {};
  var staffInput = document.getElementById('staffName');
  var welcomeEl = document.getElementById('staffWelcome');

  function updateWelcome() {
    var name = staffInput.value.trim();
    if (name) {
      welcomeEl.textContent = 'Welcome, ' + name + '!';
      welcomeEl.style.display = 'block';
    } else {
      welcomeEl.textContent = '';
      welcomeEl.style.display = 'none';
    }
  }

  /* restore staff name from session */
  try { staffInput.value = sessionStorage.getItem('staffName') || ''; } catch(e) {}
  staffInput.addEventListener('input', function(){
    try { sessionStorage.setItem('staffName', staffInput.value.trim()); } catch(e) {}
    updateWelcome();
  });
  updateWelcome();

  /* set date input to today */
  document.getElementById('mrDate').value = ShopData.today();

  async function init() {
    state = await ShopData.load();
    renderPOS();
    renderTodaySummary();
    renderSalesLog();
    renderMetreLog();
    prefillLastReading();
  }

  function persist() { return ShopData.save(state); }

  /* ---- POS buttons ---- */
  function renderPOS() {
    var grid = document.getElementById('posGrid');
    grid.innerHTML = '';
    var items = state.items.filter(function(i){ return i.category === 'water'; });

    if (!items.length) {
      var note = document.createElement('div');
      note.className = 'empty-note';
      note.textContent = 'No water items found. Add them from the Pricing page (admin view).';
      grid.appendChild(note);
      return;
    }

    items.forEach(function(item, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pos-btn water-btn' + (item.stock === 0 ? ' no-stock' : '');
      btn.setAttribute('aria-label', 'Sell ' + item.name);

      var name = document.createElement('div'); name.className = 'pos-name'; name.textContent = item.name;
      var price = document.createElement('div'); price.className = 'pos-price'; price.textContent = ShopData.money(item.price);
      var stock = document.createElement('div'); stock.className = 'pos-stock';
      stock.textContent = item.stock + ' in stock' + (item.litresPerUnit ? ' · ' + item.litresPerUnit + 'L' : '');

      var dot = document.createElement('div');
      dot.style.cssText = 'width:8px;height:8px;border-radius:50%;margin:0 auto;background:' +
        ShopData.CAP_COLORS[idx % ShopData.CAP_COLORS.length];

      btn.appendChild(dot);
      btn.appendChild(name);
      btn.appendChild(price);
      btn.appendChild(stock);

      btn.addEventListener('click', function(event) { event.preventDefault(); recordSale(item, btn); });
      grid.appendChild(btn);
    });
  }

  function recordSale(item, btn) {
    if (item.stock <= 0) { alert(item.name + ' is out of stock.'); return; }

    var staff = staffInput.value.trim() || 'Staff';
    if (!state.sales) state.sales = [];

    var saleRecord = {
      id: ShopData.uid('sale'),
      itemId: item.id,
      itemName: item.name,
      category: 'water',
      price: item.price,
      litresPerUnit: item.litresPerUnit || 0,
      qty: 1,
      staffName: staff,
      timestamp: Date.now(),
      synced: false,
      source: 'local-ui'
    };

    state.sales.push(saleRecord);

    if (typeof window !== 'undefined' && window.__queueSaleSync) {
      window.__queueSaleSync(saleRecord);
    }

    /* reduce stock */
    var stateItem = state.items.find(function(i){ return i.id === item.id; });
    if (stateItem && stateItem.stock > 0) stateItem.stock--;

    persist();

    /* flash effect */
    btn.classList.add('flashed');
    setTimeout(function(){ btn.classList.remove('flashed'); }, 420);

    renderPOS();
    renderTodaySummary();
    renderSalesLog();
    renderMetreLog(); /* re-check variance */
  }

  /* ---- today summary pills ---- */
  function renderTodaySummary() {
    var el = document.getElementById('todaySummary');
    var today = ShopData.today();
    var todaySales = (state.sales || []).filter(function(s){
      return s.category === 'water' && new Date(s.timestamp).toISOString().slice(0,10) === today;
    });

    if (!todaySales.length) { el.innerHTML = ''; return; }

    var rev = todaySales.reduce(function(s,x){ return s + x.price; }, 0);
    var litres = todaySales.reduce(function(s,x){ return s + (x.litresPerUnit||0); }, 0);

    el.innerHTML = '';
    function pill(label, val) {
      var d = document.createElement('div'); d.className = 'summary-pill';
      d.innerHTML = label + ' <strong>' + val + '</strong>';
      el.appendChild(d);
    }
    pill('Sales today:', todaySales.length);
    pill('Revenue:', ShopData.money(rev));
    if (litres > 0) pill('Litres sold:', litres + 'L');
  }

  /* ---- sales log ---- */
  function renderSalesLog() {
    var body = document.getElementById('salesBody');
    var table = document.getElementById('salesTable');
    var note = document.getElementById('noSalesNote');
    body.innerHTML = '';

    var today = ShopData.today();
    var rows = (state.sales || []).filter(function(s){
      return s.category === 'water' && new Date(s.timestamp).toISOString().slice(0,10) === today;
    }).slice().sort(function(a,b){ return b.timestamp - a.timestamp; });

    if (!rows.length) { table.classList.add('hide'); note.classList.remove('hide'); return; }
    table.classList.remove('hide'); note.classList.add('hide');

    rows.forEach(function(s) {
      var tr = document.createElement('tr');
      function cell(t, cls){ var td=document.createElement('td'); if(cls)td.className=cls;
        td.textContent=t; return td; }
      tr.appendChild(cell(s.itemName));
      tr.appendChild(cell(ShopData.money(s.price), 'num'));
      tr.appendChild(cell(s.staffName || 'Staff'));
      tr.appendChild(cell(new Date(s.timestamp).toLocaleTimeString()));
      body.appendChild(tr);
    });
  }

  /* ---- metre reading ---- */
  function prefillLastReading() {
    var readings = (state.metreReadings || []);
    var today = ShopData.today();
    var todayReading = readings.find(function(r){ return r.date === today; });
    if (todayReading) {
      document.getElementById('mrMorning').value = todayReading.morning;
      document.getElementById('mrEvening').value = todayReading.evening || '';
      showMetreResult(todayReading);
    }
  }

  function logMetre() {
    var date   = document.getElementById('mrDate').value || ShopData.today();
    var morning = parseFloat(document.getElementById('mrMorning').value);
    var evening = parseFloat(document.getElementById('mrEvening').value);

    if (isNaN(morning)) { alert('Enter the morning reading.'); return; }
    if (isNaN(evening)) { alert('Enter the evening reading.'); return; }
    if (evening < morning) { alert('Evening reading must be greater than morning reading.'); return; }

    if (!state.metreReadings) state.metreReadings = [];

    /* overwrite existing entry for that date */
    var existing = state.metreReadings.findIndex(function(r){ return r.date === date; });
    var entry = { id: ShopData.uid('mr'), date: date, morning: morning, evening: evening,
      litresUsed: Math.round((evening - morning) * 1000), timestamp: Date.now() };

    if (existing >= 0) state.metreReadings[existing] = entry;
    else state.metreReadings.push(entry);

    persist();
    showMetreResult(entry);
    renderMetreLog();
  }

  function litresSoldForDate(date) {
    return (state.sales || []).filter(function(s){
      return s.category === 'water' && new Date(s.timestamp).toISOString().slice(0,10) === date;
    }).reduce(function(s,x){ return s + (x.litresPerUnit||0); }, 0);
  }

  function showMetreResult(entry) {
    var result = document.getElementById('metreResult');
    result.style.display = 'flex';

    var metreLitres = entry.litresUsed;
    var soldLitres  = litresSoldForDate(entry.date);
    var diff        = metreLitres - soldLitres;
    var pct         = metreLitres > 0 ? ((diff / metreLitres) * 100).toFixed(1) : 0;

    document.getElementById('mrMetreLitres').textContent = metreLitres + ' L';
    document.getElementById('mrSaleLitres').textContent  = soldLitres  + ' L';

    var diffEl = document.getElementById('mrDiff');
    diffEl.textContent = (diff >= 0 ? '+' : '') + diff + ' L';
    diffEl.className   = 'm-val ' + (Math.abs(diff) <= 20 ? 'ok' : diff > 20 ? 'warn' : 'bad');

    var varEl = document.getElementById('mrVariance');
    varEl.textContent = Math.abs(pct) + '% ' + (diff > 0 ? 'unaccounted' : diff < 0 ? 'over-recorded' : 'exact');
    varEl.className   = 'm-val ' + (Math.abs(pct) <= 5 ? 'ok' : Math.abs(pct) <= 15 ? 'warn' : 'bad');
  }

  function renderMetreLog() {
    var body  = document.getElementById('metreBody');
    var table = document.getElementById('metreTable');
    var note  = document.getElementById('noMetreNote');
    body.innerHTML = '';

    var rows = (state.metreReadings || []).slice().sort(function(a,b){ return b.date.localeCompare(a.date); });

    if (!rows.length) { table.classList.add('hide'); note.classList.remove('hide'); return; }
    table.classList.remove('hide'); note.classList.add('hide');

    rows.forEach(function(r) {
      var soldL = litresSoldForDate(r.date);
      var diff  = r.litresUsed - soldL;
      var tr = document.createElement('tr');
      function cell(t,cls){ var td=document.createElement('td'); if(cls)td.className=cls;
        td.textContent=t; return td; }
      tr.appendChild(cell(r.date));
      tr.appendChild(cell(r.morning, 'num'));
      tr.appendChild(cell(r.evening, 'num'));
      tr.appendChild(cell(r.litresUsed, 'num'));
      tr.appendChild(cell(soldL, 'num'));
      var td=document.createElement('td'); td.className='num';
      td.style.color = Math.abs(diff)<=20 ? 'var(--aqua-deep)' : diff>20 ? 'var(--sun)' : 'var(--danger)';
      td.textContent = (diff>=0?'+':'')+diff;
      tr.appendChild(td);
      body.appendChild(tr);
    });

    /* update live variance if today's date is showing */
    var today = ShopData.today();
    var todayEntry = (state.metreReadings||[]).find(function(r){return r.date===today;});
    if (todayEntry) showMetreResult(todayEntry);
  }

  function collectSubmissionPayload() {
    var staffName = (staffInput.value || '').trim() || 'Staff';
    var today = ShopData.today();
    var salesForToday = (state.sales || []).filter(function(s){
      return s.category === 'water' && new Date(s.timestamp).toISOString().slice(0,10) === today;
    });
    var metreEntries = (state.metreReadings || []).filter(function(r){ return r.date === today; });

    return {
      staffName: staffName,
      submittedAt: new Date().toISOString(),
      sales: salesForToday,
      metreReadings: metreEntries,
      summary: {
        salesCount: salesForToday.length,
        revenue: salesForToday.reduce(function(sum, sale){ return sum + (sale.price || 0); }, 0),
        metreReadingsCount: metreEntries.length
      }
    };
  }

  function submitSales() {
    var payload = collectSubmissionPayload();
    if (!payload.sales.length && !payload.metreReadings.length) {
      alert('Nothing to submit yet.');
      return;
    }

    if (typeof window !== 'undefined' && window.__submitSalesPayload) {
      window.__submitSalesPayload(payload);
      alert('Sales payload prepared for submission.');
      return;
    }

    console.log('Sales payload ready:', payload);
    alert('Sales payload prepared for submission.');
  }

  document.getElementById('logMetreBtn').addEventListener('click', logMetre);
  document.getElementById('submitSalesBtn').addEventListener('click', submitSales);

  init();
})();
