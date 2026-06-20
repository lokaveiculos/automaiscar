// ── Firebase Config ──────────────────────────────────────────
var firebaseConfig = {
  apiKey: "AIzaSyCMCeez7sN3G-R7AqWbPbS1XbbNBwDNdg0",
  authDomain: "automais-6afbb.firebaseapp.com",
  projectId: "automais-6afbb",
  storageBucket: "automais-6afbb.appspot.com",
  messagingSenderId: "1049013613532",
  appId: "1:1049013613532:web:1e9c3d7e5b5b5b5b5b5b5b"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
var fdb = firebase.firestore();

// ── Constantes ───────────────────────────────────────────────
var PAG_SIZE = 20;
var CACHE_KEY = 'automais_v3';
var COLS = ['veiculos','clientes','fornecedores','contratos',
            'vendas','manutencoes','usuarios','despesas'];

// ── Cache local ──────────────────────────────────────────────
function loadDB(){
  try {
    var raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      // Garantir que todos os arrays existem
      COLS.forEach(function(c){ if(!parsed[c]) parsed[c]=[]; });
      if(!parsed.empresa) parsed.empresa={};
      return parsed;
    }
  } catch(e) {}
  return {
    veiculos:[],clientes:[],fornecedores:[],contratos:[],
    vendas:[],manutencoes:[],usuarios:[],despesas:[],empresa:{},
    config: {}
  };
}

function sDB(){
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(DB)); } catch(e){}
}

// ── loadFromFirestore — PARALELO com Promise.all ─────────────
async function loadFromFirestore(){
  try {
    // Disparar TODAS as leituras em paralelo
    var colPromises = COLS.map(function(col){
      return fdb.collection(col).get()
        .then(function(snap){
          if (!snap.empty) {
            DB[col] = snap.docs.map(function(d){ return d.data(); });
          }
        })
        .catch(function(e){
          console.warn('[Firestore] erro em', col, e.message);
        });
    });

    // Config da empresa em paralelo também
    var empPromise = fdb.collection('config').doc('empresa').get()
      .then(function(snap){ if(snap.exists) DB.empresa = snap.data(); })
      .catch(function(){});

    // Aguardar TUDO de uma vez (não sequencial!)
    await Promise.all([...colPromises, empPromise]);

    sDB(); // salvar cache
    return true;
  } catch(e) {
    console.error('[Firestore] loadFromFirestore error:', e);
    return false;
  }
}

// ── Helpers de sessão ────────────────────────────────────────
function getSession(){
  try { return JSON.parse(sessionStorage.getItem('am_user')); } catch(e){ return null; }
}

function isAdmin(){
  var s = getSession();
  return s && (s.perfil === 'admin' || s.login === 'rogel');
}

function logout(){
  sessionStorage.removeItem('am_user');
  window.location.href = 'login.html';
}

function checkAuth(onOk){
  var user = getSession();
  if (!user) { window.location.href = 'login.html'; return; }
  var el = document.getElementById('lu');
  if (el) el.textContent = user.nome;
  var av = document.getElementById('avatar-initials');
  if (av) av.textContent = user.nome ? user.nome.charAt(0).toUpperCase() : 'U';
  onOk(user);
}

function applyProfile(){
  if (!isAdmin()) {
    document.querySelectorAll('[data-admin-only]').forEach(function(el){
      el.style.display = 'none';
    });
    document.querySelectorAll('.admin-nav').forEach(function(el){
      el.style.display = 'none';
    });
  }
}

// ── Formatters ───────────────────────────────────────────────
function brl(n){
  return Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function fd(s){
  if (!s) return '—';
  try { return new Date(s+'T12:00').toLocaleDateString('pt-BR'); } catch(e){ return s; }
}

function nid(arr){
  if (!arr || !arr.length) return 1;
  return Math.max.apply(null, arr.map(function(x){ return Number(x.id)||0; })) + 1;
}

// ── Lookup helpers ───────────────────────────────────────────
function vNome(id){ var v=DB.veiculos.find(function(x){return x.id==id;}); return v?(v.marca+' '+v.modelo+' '+v.ano):''; }
function vObj(id) { return DB.veiculos.find(function(x){return x.id==id;})||null; }
function cNome(id){ var c=DB.clientes.find(function(x){return x.id==id;}); return c?c.nome:''; }
function cObj(id) { return DB.clientes.find(function(x){return x.id==id;})||null; }
function fNome(id){ var f=DB.fornecedores.find(function(x){return x.id==id;}); return f?f.nome:''; }
function fObj(id) { return DB.fornecedores.find(function(x){return x.id==id;})||null; }

// ── Firestore write helpers ──────────────────────────────────
function fsave(col, obj, cb){
  fdb.collection(col).doc(String(obj.id)).set(obj)
    .then(function(){ if(cb) cb(null); })
    .catch(function(e){ console.error('[fsave]', e); if(cb) cb(e); });
}

function fdel(col, id){
  fdb.collection(col).doc(String(id)).delete()
    .catch(function(e){ console.error('[fdel]', e); });
}

// ── Paginação ────────────────────────────────────────────────
function pagSlice(arr, page){
  var start = (page-1) * PAG_SIZE;
  return arr.slice(start, start + PAG_SIZE);
}

function pagHtml(page, total, prevCall, nextCall){
  var pages = Math.ceil(total/PAG_SIZE)||1;
  if (pages <= 1) return '';
  var btns = '';
  btns += '<button class="btn bg2 bsm" '+(page<=1?'disabled':('onclick="'+prevCall+'"'))+'>&#8592;</button>';
  btns += '<span style="font-size:13px;color:var(--text-muted)">'+page+' / '+pages+'</span>';
  btns += '<button class="btn bg2 bsm" '+(page>=pages?'disabled':('onclick="'+nextCall+'"'))+'>&#8594;</button>';
  return '<div class="pg-nav"><span style="font-size:12px;color:var(--text-muted)">'+total+' registros</span><div style="display:flex;gap:6px;align-items:center">'+btns+'</div></div>';
}

// ── Máscara de status badge ──────────────────────────────────
function sbV(status){
  var map = {
    disponivel:  '<span class="badge bg-g">Disponível</span>',
    vendido:     '<span class="badge bg-b">Vendido</span>',
    consignado:  '<span class="badge bg-o">Consignado</span>',
    reservado:   '<span class="badge bg-y">Reservado</span>',
    manutencao:  '<span class="badge bg-r">Manutenção</span>',
  };
  return map[status] || '<span class="badge">'+status+'</span>';
}

// ── Loading state ────────────────────────────────────────────
function showLoading(msg){
  var el = document.getElementById('main');
  if (!el) return;
  el.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:16px;color:var(--text-muted)">'
    + '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>'
    + '<span style="font-size:14px">' + (msg||'Carregando...') + '</span>'
    + '</div>';
}

// ── Toast stub (implementado em cada página) ─────────────────
function toast(msg, type, dur){
  if (typeof window.toast_impl === 'function') {
    window.toast_impl(msg, type, dur);
  }
}

// ── Offline detection ────────────────────────────────────────
(function(){
  function updateBanner(){
    var el = document.getElementById('offline-banner');
    if (!el) return;
    if (!navigator.onLine) {
      el.textContent = 'Você está offline — os dados podem estar desatualizados.';
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  }
  window.addEventListener('online',  updateBanner);
  window.addEventListener('offline', updateBanner);
  document.addEventListener('DOMContentLoaded', updateBanner);
})();


// ── Status badges ─────────────────────────────────────────────
function sbC(s){
  var m={ativo:'bg-g',assinado:'bg-b',cancelado:'bg-r',concluido:'bg-gr',pendente:'bg-y'};
  return '<span class="badge '+(m[s]||'bg-gr')+'">'+s+'</span>';
}
function sbM(s){
  var m={concluida:'bg-g',andamento:'bg-y',pendente:'bg-gr',cancelada:'bg-r'};
  return '<span class="badge '+(m[s]||'bg-gr')+'">'+s+'</span>';
}
