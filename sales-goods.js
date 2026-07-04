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

  try { staffInput.value = sessionStorage.getItem('staffName') || ''; } catch(e) {}
  staffInput.addEventListener('input', function(){
    try { sessionStorage.setItem('staffName', staffInput.value.trim()); } catch(e) {}
    updateWelcome();
  });
  updateWelcome();

  async function init() {
    state = await ShopData.load();
    renderPOS();
    renderTodaySummary();
    renderSalesLog();
  }

  function persist() { return ShopData.save(state); }

  function renderPOS() {
    var grid = document.getElementById('posGrid');
    grid.innerHTML = '';
    var items = state.items.filter(function(i){ return i.category === 'goods'; });

    if (!items.length) {
      var note = document.createElement('div'); note.className = 'empty-note';
      note.textContent = 'No goods items found. Add them from the Pricing page (admin view).';
      grid.appendChild(note); return;
    }

    items.forEach(function(item, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pos-btn goods-btn' + (item.stock === 0 ? ' no-stock' : '');
      btn.setAttribute('aria-label', 'Sell ' + item.name);

      var dot = document.createElement('div');
      dot.style.cssText = 'width:8px;height:8px;border-radius:50%;margin:0 auto;background:' +
        ShopData.CAP_COLORS[idx % ShopData.CAP_COLORS.length];

      var name  = document.createElement('div'); name.className  = 'pos-name';  name.textContent  = item.name;
      var price = document.createElement('div'); price.className = 'pos-price'; price.textContent = ShopData.money(item.price);
      var stock = document.createElement('div'); stock.className = 'pos-stock'; stock.textContent = item.stock + ' in stock';

      btn.appendChild(dot); btn.appendChild(name); btn.appendChild(price); btn.appendChild(stock);
      btn.addEventListener('click', function(event){ event.preventDefault(); recordSale(item, btn); });
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
      category: 'goods',
      price: item.price,
      litresPerUnit: 0,
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

    var stateItem = state.items.find(function(i){ return i.id === item.id; });
    if (stateItem && stateItem.stock > 0) stateItem.stock--;

    persist();

    btn.classList.add('flashed');
    setTimeout(function(){ btn.classList.remove('flashed'); }, 420);

    renderPOS();
    renderTodaySummary();
    renderSalesLog();
  }

  function renderTodaySummary() {
    var el = document.getElementById('todaySummary');
    var today = ShopData.today();
    var rows = (state.sales || []).filter(function(s){
      return s.category === 'goods' && new Date(s.timestamp).toISOString().slice(0,10) === today;
    });

    if (!rows.length) { el.innerHTML = ''; return; }
    var rev = rows.reduce(function(s,x){ return s + x.price; }, 0);
    el.innerHTML = '';
    function pill(label, val){
      var d = document.createElement('div'); d.className = 'summary-pill';
      d.innerHTML = label + ' <strong>' + val + '</strong>'; el.appendChild(d);
    }
    pill('Sales today:', rows.length);
    pill('Revenue:', ShopData.money(rev));
  }

  function renderSalesLog() {
    var body  = document.getElementById('salesBody');
    var table = document.getElementById('salesTable');
    var note  = document.getElementById('noSalesNote');
    body.innerHTML = '';

    var today = ShopData.today();
    var rows = (state.sales || []).filter(function(s){
      return s.category === 'goods' && new Date(s.timestamp).toISOString().slice(0,10) === today;
    }).slice().sort(function(a,b){ return b.timestamp - a.timestamp; });

    if (!rows.length) { table.classList.add('hide'); note.classList.remove('hide'); return; }
    table.classList.remove('hide'); note.classList.add('hide');

    rows.forEach(function(s) {
      var tr = document.createElement('tr');
      function cell(t,cls){ var td=document.createElement('td'); if(cls)td.className=cls;
        td.textContent=t; return td; }
      tr.appendChild(cell(s.itemName));
      tr.appendChild(cell(ShopData.money(s.price),'num'));
      tr.appendChild(cell(s.staffName||'Staff'));
      tr.appendChild(cell(new Date(s.timestamp).toLocaleTimeString()));
      body.appendChild(tr);
    });
  }

  function collectSubmissionPayload() {
    var staffName = (staffInput.value || '').trim() || 'Staff';
    var today = ShopData.today();
    var salesForToday = (state.sales || []).filter(function(s){
      return s.category === 'goods' && new Date(s.timestamp).toISOString().slice(0,10) === today;
    });

    return {
      staffName: staffName,
      submittedAt: new Date().toISOString(),
      sales: salesForToday,
      metreReadings: [],
      summary: {
        salesCount: salesForToday.length,
        revenue: salesForToday.reduce(function(sum, sale){ return sum + (sale.price || 0); }, 0),
        metreReadingsCount: 0
      }
    };
  }

  function submitSales() {
    var payload = collectSubmissionPayload();
    if (!payload.sales.length) {
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

  document.getElementById('submitSalesBtn').addEventListener('click', submitSales);

  init();
})();
