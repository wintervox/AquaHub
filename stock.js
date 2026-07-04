(function () {
  var state = { items: [], requests: [] };
  var role = 'staff';

  async function init() {
    state = await ShopData.load();
    document.getElementById('loadingNote').classList.add('hide');
    document.getElementById('inventoryTable').classList.remove('hide');
    render();
  }

  function persist() { return ShopData.save(state); }

  function setRole(r) {
    role = r;
    document.getElementById('roleStaffBtn').classList.toggle('active', r === 'staff');
    document.getElementById('roleAdminBtn').classList.toggle('active', r === 'admin');
    render();
  }

  function applyRole() {
    document.querySelectorAll('.admin-only').forEach(function (el) { el.classList.toggle('hide', role !== 'admin'); });
    document.querySelectorAll('.staff-only').forEach(function (el) { el.classList.toggle('hide', role !== 'staff'); });
  }

  function render() { renderInventory(); renderRequestOptions(); renderRequests(); renderStats(); applyRole(); }

  function renderInventory() {
    var body = document.getElementById('inventoryBody');
    body.innerHTML = '';

    state.items.forEach(function (item) {
      var tr = document.createElement('tr');

      var tdName = document.createElement('td');
      tdName.textContent = item.name;
      if (item.stock <= ShopData.LOW) {
        var t = document.createElement('span');
        t.className = 'tag tag-low';
        t.textContent = 'LOW';
        t.style.marginLeft = '8px';
        tdName.appendChild(t);
      }

      var tdCat = document.createElement('td');
      var catTag = document.createElement('span');
      catTag.className = 'tag tag-' + item.category;
      catTag.textContent = item.category.toUpperCase();
      tdCat.appendChild(catTag);

      var tdPrice = document.createElement('td');
      tdPrice.className = 'num';
      tdPrice.textContent = ShopData.money(item.price);

      var tdStock = document.createElement('td');
      tdStock.className = 'num';
      tdStock.textContent = item.stock;

      var tdAdmin = document.createElement('td');
      tdAdmin.className = 'admin-only';
      var stack = document.createElement('div');
      stack.className = 'admin-actions-stack';

      // price input
      var pg = document.createElement('div'); pg.className = 'row-actions';
      var pi = document.createElement('input'); pi.type='number'; pi.min='0'; pi.step='0.01';
      pi.value = item.price; pi.className = 'qty-input'; pi.style.width='76px';
      var pb = document.createElement('button'); pb.className='btn btn-ghost btn-small';
      pb.textContent = 'Update price';
      pb.addEventListener('click', function(){ updatePrice(item.id, parseFloat(pi.value)); });
      pg.appendChild(pi); pg.appendChild(pb);

      // stock input
      var sg = document.createElement('div'); sg.className='row-actions';
      var si = document.createElement('input'); si.type='number'; si.min='1'; si.value='1';
      si.className='qty-input';
      var sb = document.createElement('button'); sb.className='btn btn-ghost btn-small';
      sb.textContent='Add stock';
      sb.addEventListener('click', function(){ adjustStock(item.id, parseInt(si.value,10)); });
      sg.appendChild(si); sg.appendChild(sb);

      var rg = document.createElement('div'); rg.className='row-actions';
      var ri = document.createElement('input'); ri.type='number'; ri.min='1'; ri.value='1';
      ri.className='qty-input';
      var rb = document.createElement('button'); rb.className='btn btn-ghost btn-small';
      rb.textContent='Remove stock';
      rb.addEventListener('click', function(){ removeStock(item.id, parseInt(ri.value,10)); });
      rg.appendChild(ri); rg.appendChild(rb);

      // remove
      var rm = document.createElement('button'); rm.className='btn btn-ghost btn-small';
      rm.textContent='Remove item';
      rm.addEventListener('click', function(){ removeItem(item.id); });

      stack.appendChild(pg); stack.appendChild(sg); stack.appendChild(rg); stack.appendChild(rm);
      tdAdmin.appendChild(stack);

      tr.appendChild(tdName); tr.appendChild(tdCat); tr.appendChild(tdPrice);
      tr.appendChild(tdStock); tr.appendChild(tdAdmin);
      body.appendChild(tr);
    });

    if (!state.items.length) {
      var tr2 = document.createElement('tr');
      var td2 = document.createElement('td'); td2.colSpan=5;
      td2.className='empty-note'; td2.textContent='No items yet. Switch to Admin view to add one.';
      tr2.appendChild(td2); body.appendChild(tr2);
    }
  }

  function renderRequestOptions() {
    var sel = document.getElementById('requestItem');
    var prev = sel.value; sel.innerHTML = '';
    if (!state.items.length) {
      sel.innerHTML = '<option value="">No items yet</option>'; return;
    }
    state.items.forEach(function(item){
      var o = document.createElement('option'); o.value=item.id;
      o.textContent = item.name + ' (' + item.stock + ' left)';
      sel.appendChild(o);
    });
    if (state.items.some(function(i){return i.id===prev;})) sel.value=prev;
  }

  function renderRequests() {
    var body = document.getElementById('requestsBody');
    var table = document.getElementById('requestsTable');
    var note = document.getElementById('noRequestsNote');
    body.innerHTML = '';
    var sorted = state.requests.slice().sort(function(a,b){return b.timestamp-a.timestamp;}).slice(0,40);
    if (!sorted.length) { table.classList.add('hide'); note.classList.remove('hide'); return; }
    table.classList.remove('hide'); note.classList.add('hide');

    sorted.forEach(function(req){
      var tr = document.createElement('tr');
      function cell(t,cls){ var td=document.createElement('td'); if(cls)td.className=cls;
        td.textContent=t; return td; }
      tr.appendChild(cell(req.itemName));
      tr.appendChild(cell(req.qty,'num'));
      tr.appendChild(cell(req.requestedBy||'Staff'));
      var tn=document.createElement('td'); tn.textContent=req.note||'\u2014'; tn.style.color='var(--slate)';
      tr.appendChild(tn);
      var ts=document.createElement('td'); var st=document.createElement('span');
      st.className='tag tag-'+req.status; st.textContent=req.status.toUpperCase();
      ts.appendChild(st); tr.appendChild(ts);
      var ta=document.createElement('td'); ta.className='admin-only';
      if (req.status==='pending'){
        var aw=document.createElement('div'); aw.className='row-actions';
        var ab=document.createElement('button'); ab.className='btn btn-primary btn-small';
        ab.textContent='Approve & restock';
        ab.addEventListener('click', function(){approveReq(req.id);});
        var db=document.createElement('button'); db.className='btn btn-ghost btn-small';
        db.textContent='Decline';
        db.addEventListener('click', function(){declineReq(req.id);});
        aw.appendChild(ab); aw.appendChild(db); ta.appendChild(aw);
      }
      tr.appendChild(ta); body.appendChild(tr);
    });
  }

  function renderStats() {
    var total=state.items.reduce(function(s,i){return s+i.stock;},0);
    var low=state.items.filter(function(i){return i.stock<=ShopData.LOW;}).length;
    var pend=state.requests.filter(function(r){return r.status==='pending';}).length;
    document.getElementById('statStock').textContent=total;
    document.getElementById('statLow').textContent=low;
    document.getElementById('statPending').textContent=pend;
  }

  function updatePrice(id,p){ if(isNaN(p)||p<0){alert('Invalid price');return;}
    var it=state.items.find(function(i){return i.id===id;}); if(!it)return;
    it.price=p; persist(); render(); }

  function adjustStock(id,q){ if(!q||q<1)return;
    var it=state.items.find(function(i){return i.id===id;}); if(!it)return;
    it.stock+=q; persist(); render(); }

  function removeStock(id,q){ if(!q||q<1)return;
    var it=state.items.find(function(i){return i.id===id;}); if(!it)return;
    if(it.stock < q){ alert('Not enough stock to remove.'); return; }
    it.stock-=q; persist(); render(); }

  function removeItem(id){ if(!confirm('Remove this item?'))return;
    state.items=state.items.filter(function(i){return i.id!==id;});
    persist(); render(); }

  function openGalleryCreate(){
    var data={
      name: document.getElementById('newName').value.trim(),
      category: document.getElementById('newCategory').value,
      price: document.getElementById('newPrice').value,
      litresPerUnit: document.getElementById('newLitres').value,
      stock: document.getElementById('newStock').value
    };
    if(!data.name){ alert('Enter a name first.'); return; }
    sessionStorage.setItem('pendingStockItem', JSON.stringify(data));
    window.location.href = 'gallery.html?mode=add';
  }

  function submitRequest(){
    var name=document.getElementById('requesterName').value.trim();
    var sel=document.getElementById('requestItem'); var id=sel.value;
    var qty=parseInt(document.getElementById('requestQty').value,10);
    var note=document.getElementById('requestNote').value.trim();
    var item=state.items.find(function(i){return i.id===id;});
    if(!item){alert('Pick an item.');return;}
    if(isNaN(qty)||qty<1){alert('Enter quantity.');return;}
    state.requests.push({id:ShopData.uid('req'),itemId:item.id,itemName:item.name,
      qty:qty,requestedBy:name||'Staff',note:note,status:'pending',timestamp:Date.now()});
    document.getElementById('requestQty').value='';
    document.getElementById('requestNote').value='';
    persist(); render();
  }

  function approveReq(id){
    var req=state.requests.find(function(r){return r.id===id;}); if(!req||req.status!=='pending')return;
    var it=state.items.find(function(i){return i.id===req.itemId;}); if(it)it.stock+=req.qty;
    req.status='fulfilled'; req.resolvedAt=Date.now(); persist(); render();
  }
  function declineReq(id){
    var req=state.requests.find(function(r){return r.id===id;}); if(!req||req.status!=='pending')return;
    req.status='declined'; req.resolvedAt=Date.now(); persist(); render();
  }

  async function resetAll(){
    if(!confirm('Clear everything?'))return;
    state={items:[],requests:[],sales:[],metreReadings:[]};
    await persist(); render();
  }

  document.getElementById('roleStaffBtn').addEventListener('click',function(){setRole('staff');});
  document.getElementById('roleAdminBtn').addEventListener('click',function(){setRole('admin');});
  document.getElementById('goToGalleryBtn').addEventListener('click',openGalleryCreate);
  document.getElementById('submitRequestBtn').addEventListener('click',submitRequest);
  document.getElementById('resetBtn').addEventListener('click',resetAll);

  init();
})();
