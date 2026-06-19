
// ── Firebase Config (Firestore apenas) ───────────────────────
var firebaseConfig = {
  apiKey: "AIzaSyCMCeez7sN3G-R7AqWbPbS1XbbNBwDNdg0",
  authDomain: "automais-6afbb.firebaseapp.com",
  projectId: "automais-6afbb",
  storageBucket: "automais-6afbb.firebasestorage.app",
  messagingSenderId: "490669375760",
  appId: "1:490669375760:web:5023fca52e8eeee7466595"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
var fdb = firebase.firestore();

// ── Sessão local ──────────────────────────────────────────────
function getSession(){
  try{ return JSON.parse(sessionStorage.getItem('am_user')); }catch(e){ return null; }
}

function checkAuth(onOk){
  var user = getSession();
  if(!user){
    window.location.href='login.html';
    return;
  }
  var el=document.getElementById('lu');
  if(el) el.textContent=user.nome;
  onOk(user);
}

function logout(){
  if(!confirm('Deseja sair do sistema?')) return;
  sessionStorage.removeItem('am_user');
  window.location.href='login.html';
}

// ── Firestore CRUD ────────────────────────────────────────────
async function fsave(col, obj){
  if(!obj||!obj.id) return;
  try{
    await fdb.collection(col).doc(String(obj.id)).set(obj);
  }catch(e){
    console.warn('[Firestore] save error:',col,e.message);
  }
}

async function fdel(col, id){
  if(!id) return;
  try{
    await fdb.collection(col).doc(String(id)).delete();
  }catch(e){
    console.warn('[Firestore] delete error:',col,e.message);
  }
}

async function loadFromFirestore(){
  var cols=['veiculos','clientes','fornecedores','contratos',
            'vendas','manutencoes','usuarios','despesas'];
  var loaded=false;
  for(var i=0;i<cols.length;i++){
    var col=cols[i];
    try{
      var snap=await fdb.collection(col).get();
      if(!snap.empty){
        DB[col]=snap.docs.map(function(d){ return d.data(); });
        loaded=true;
      }
    }catch(e){
      console.warn('[Firestore] load error:',col,e.message);
    }
  }
  try{
    var empSnap=await fdb.collection('config').doc('empresa').get();
    if(empSnap.exists) DB.empresa=empSnap.data();
  }catch(e){}
  try{ localStorage.setItem('automais_v3',JSON.stringify(DB)); }catch(e){}
  return loaded;
}

// ── Loading overlay ───────────────────────────────────────────
function showLoading(msg){
  var el=document.getElementById('main');
  if(el) el.innerHTML=
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:16px;">'+
    '<div style="width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 1s linear infinite"></div>'+
    '<div style="color:var(--t2);font-size:13px">'+(msg||'Carregando...')+'</div></div>'+
    '<style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
}


// ── Toast Notifications ───────────────────────────────────────
(function(){
  var style = document.createElement('style');
  style.textContent = [
    '.am-toast{position:fixed;top:20px;right:20px;padding:12px 18px;border-radius:8px;',
    'font-size:13px;font-weight:700;color:#fff;z-index:99999;',
    'animation:amIn .3s ease;max-width:340px;min-width:200px;',
    'box-shadow:0 4px 20px rgba(0,0,0,.4);display:flex;align-items:center;gap:8px;',
    'border-left:4px solid rgba(255,255,255,.4);line-height:1.4}',
    '.am-toast+.am-toast{margin-top:8px}',
    '.am-toast.ok{background:#16a34a}',
    '.am-toast.err{background:#dc2626}',
    '.am-toast.warn{background:#d97706}',
    '.am-toast.info{background:#2563eb}',
    '@keyframes amIn{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}',
    '@keyframes amOut{to{transform:translateX(120%);opacity:0}}'
  ].join('');
  document.head.appendChild(style);
})();

var _toastOffset = 0;
function toast(msg, type, dur) {
  type = type || 'ok';
  dur  = dur  || 3000;
  var icons = {ok:'✓', err:'✗', warn:'⚠', info:'ℹ'};
  var el = document.createElement('div');
  el.className = 'am-toast ' + type;
  el.innerHTML = '<span style="font-size:16px">' + (icons[type]||'') + '</span><span>' + msg + '</span>';
  // Stack toasts
  var existing = document.querySelectorAll('.am-toast');
  var top = 20;
  existing.forEach(function(e){ top += e.offsetHeight + 8; });
  el.style.top = top + 'px';
  document.body.appendChild(el);
  setTimeout(function(){
    el.style.animation = 'amOut .3s ease forwards';
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 300);
  }, dur);
}

// ── Máscaras de entrada ───────────────────────────────────────
function maskCPF(v) {
  v = v.replace(/\D/g,'').slice(0,11);
  if(v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/,'$1.$2.$3-$4');
  if(v.length > 6) return v.replace(/(\d{3})(\d{3})(\d+)/,'$1.$2.$3');
  if(v.length > 3) return v.replace(/(\d{3})(\d+)/,'$1.$2');
  return v;
}
function maskCNPJ(v) {
  v = v.replace(/\D/g,'').slice(0,14);
  if(v.length > 12) return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/,'$1.$2.$3/$4-$5');
  if(v.length > 8)  return v.replace(/(\d{2})(\d{3})(\d{3})(\d+)/,'$1.$2.$3/$4');
  if(v.length > 5)  return v.replace(/(\d{2})(\d{3})(\d+)/,'$1.$2.$3');
  if(v.length > 2)  return v.replace(/(\d{2})(\d+)/,'$1.$2');
  return v;
}
function maskCPFCNPJ(v) {
  var digits = v.replace(/\D/g,'');
  return digits.length <= 11 ? maskCPF(v) : maskCNPJ(v);
}
function maskPhone(v) {
  v = v.replace(/\D/g,'').slice(0,11);
  if(v.length > 10) return v.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3');
  if(v.length > 6)  return v.replace(/(\d{2})(\d{4,5})(\d*)/,'($1) $2-$3');
  if(v.length > 2)  return v.replace(/(\d{2})(\d+)/,'($1) $2');
  return v;
}
function maskPlate(v) {
  v = v.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7);
  if(v.length > 3) return v.slice(0,3) + '-' + v.slice(3);
  return v;
}
function maskCEP(v) {
  v = v.replace(/\D/g,'').slice(0,8);
  if(v.length > 5) return v.replace(/(\d{5})(\d+)/,'$1-$2');
  return v;
}

// ── Controle de Perfil ────────────────────────────────────────
function isAdmin(){
  var s=getSession();
  return s&&(s.perfil==='admin'||s.login==='rogel');
}

function applyProfile(){
  if(!isAdmin()){
    // Esconde itens admin-only no nav
    document.querySelectorAll('.admin-nav').forEach(function(el){
      el.style.display='none';
    });
    // Remove botoes de excluir
    document.querySelectorAll('.btn-del').forEach(function(el){
      el.style.display='none';
    });
  }
}

// ── Exportação de Dados (Bloco 11) ───────────────────────────
function exportCSV(data, filename, colunas) {
  // Gera CSV com BOM UTF-8 para Excel abrir corretamente
  var header = colunas.map(function(c){return c.label;}).join(';');
  var rows = data.map(function(item){
    return colunas.map(function(c){
      var val = typeof c.fn==='function' ? c.fn(item) : (item[c.key]||'');
      val = String(val).replace(/"/g,'""').replace(/;/g,',');
      return '"'+val+'"';
    }).join(';');
  });
  var csv = '\uFEFF' + header + '\n' + rows.join('\n');
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href   = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Arquivo exportado com sucesso','ok');
}

function exportPrint(titulo, colunas, data, subtitle) {
  var w = window.open('','_blank');
  var rows = data.map(function(item){
    return '<tr>'+colunas.map(function(c){
      var val = typeof c.fn==='function' ? c.fn(item) : (item[c.key]||'-');
      return '<td>'+val+'</td>';
    }).join('')+'</tr>';
  }).join('');
  var header = colunas.map(function(c){return '<th>'+c.label+'</th>';}).join('');
  w.document.write([
    '<!DOCTYPE html><html><head><meta charset=UTF-8>',
    '<title>'+titulo+'</title>',
    '<style>',
    'body{font-family:Segoe UI,sans-serif;font-size:11px;padding:20px;color:#000}',
    'h1{font-size:16px;margin-bottom:4px}',
    '.sub{font-size:11px;color:#666;margin-bottom:16px}',
    'table{width:100%;border-collapse:collapse;font-size:11px}',
    'th{background:#f97316;color:#fff;padding:7px 8px;text-align:left;font-weight:700}',
    'td{padding:6px 8px;border-bottom:1px solid #eee}',
    'tr:nth-child(even) td{background:#fafafa}',
    '.footer{margin-top:20px;font-size:10px;color:#999;text-align:center}',
    '@media print{.no-print{display:none}}',
    '</style></head><body>',
    '<div class=no-print style="margin-bottom:12px">',
    '<button onclick="window.print()" style="padding:8px 16px;background:#f97316;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:700">&#128438; Imprimir</button>',
    '</div>',
    '<h1>'+titulo+'</h1>',
    subtitle?'<div class=sub>'+subtitle+'</div>':'',
    '<table><thead><tr>'+header+'</tr></thead><tbody>'+rows+'</tbody></table>',
    '<div class=footer>Gerado em '+new Date().toLocaleString('pt-BR')+' &bull; AUTO MAIS VEICULOS LTDA</div>',
    '</body></html>'
  ].join(''));
  w.document.close();
}

// ── Paginação (Bloco 16) ──────────────────────────────────────
var PAG_SIZE = 20;

function pagSlice(arr, pag){
  var p = Math.max(1, Math.min(pag, Math.ceil(arr.length/PAG_SIZE)||1));
  return arr.slice((p-1)*PAG_SIZE, p*PAG_SIZE);
}

function pagHtml(pag, total, onPrev, onNext){
  var pages = Math.ceil(total/PAG_SIZE)||1;
  if(pages<=1) return '';
  var start = (pag-1)*PAG_SIZE+1;
  var end   = Math.min(pag*PAG_SIZE, total);
  return '<div style="display:flex;align-items:center;justify-content:space-between;'+
    'padding:10px 16px;font-size:12px;color:var(--t2);border-top:1px solid var(--border)">'+
    '<button class="btn bg2 bsm" '+(pag<=1?'disabled style="opacity:.4"':'')+' onclick="'+onPrev+'">&#8592; Anterior</button>'+
    '<span>Pagina <b style="color:var(--text)">'+pag+'</b> de <b style="color:var(--text)">'+pages+'</b> &bull; '+
    start+'&ndash;'+end+' de '+total+' registros</span>'+
    '<button class="btn bg2 bsm" '+(pag>=pages?'disabled style="opacity:.4"':'')+' onclick="'+onNext+'">Proxima &#8594;</button>'+
    '</div>';
}

// ── Modo Offline (Bloco 17) ────────────────────────────────────
var _offlineQueue = [];
var _isOnline = navigator.onLine;

(function(){
  var bannerId = 'am-offline-banner';

  function showBanner(offline){
    var ex = document.getElementById(bannerId);
    if(offline){
      if(!ex){
        var el = document.createElement('div');
        el.id = bannerId;
        el.style.cssText = [
          'position:fixed;top:0;left:0;right:0;z-index:9998;',
          'background:#dc2626;color:#fff;text-align:center;',
          'padding:9px 16px;font-size:13px;font-weight:700;',
          'letter-spacing:.2px;display:flex;align-items:center;',
          'justify-content:center;gap:8px;box-shadow:0 2px 8px rgba(0,0,0,.3)'
        ].join('');
        el.innerHTML = '&#128994; Voce esta <b>offline</b> &mdash; os dados serao sincronizados quando a conexao voltar.';
        document.body.appendChild(el);
        // Empurrar conteúdo para baixo
        var main = document.getElementById('main');
        if(main) main.style.paddingTop = '52px';
      }
    } else {
      if(ex){
        ex.remove();
        var main = document.getElementById('main');
        if(main) main.style.paddingTop = '';
      }
    }
  }

  function syncQueue(){
    if(!_offlineQueue.length) return;
    var q = _offlineQueue.slice();
    _offlineQueue = [];
    q.forEach(function(op){
      try{
        if(op.type==='save') fdb.collection(op.col).doc(String(op.obj.id)).set(op.obj);
        if(op.type==='del')  fdb.collection(op.col).doc(String(op.id)).delete();
      }catch(e){}
    });
    toast('Conexao restaurada &mdash; '+q.length+' operacao(es) sincronizadas!','ok',4000);
  }

  window.addEventListener('offline', function(){
    _isOnline = false;
    showBanner(true);
    toast('Voce esta offline. Os dados serao salvos localmente.','warn',4000);
  });

  window.addEventListener('online', function(){
    _isOnline = true;
    showBanner(false);
    syncQueue();
  });

  // Check on load
  if(!navigator.onLine) showBanner(true);
})();

// Sobrescrever fsave e fdel para usar fila quando offline
var _fsaveOrig = typeof fsave === 'function' ? fsave : null;
var _fdelOrig  = typeof fdel  === 'function' ? fdel  : null;

function fsaveQ(col, obj){
  if(!_isOnline){ _offlineQueue.push({type:'save',col:col,obj:obj}); return; }
  return fsave(col, obj);
}
function fdelQ(col, id){
  if(!_isOnline){ _offlineQueue.push({type:'del',col:col,id:id}); return; }
  return fdel(col, id);
}
