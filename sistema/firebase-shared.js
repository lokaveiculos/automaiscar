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
            'vendas','manutencoes','usuarios','despesas','leads'];

// ── Cache local ──────────────────────────────────────────────
// ── BUSCA SEM ACENTO ──────────────────────────────────────────
// "João" e "Joao" têm de se encontrar. NFD separa a letra do acento, e o
// intervalo \u0300-\u036f apaga só os acentos, sem tocar nas letras.
// Precisa valer nos DOIS lados da comparação: no que foi digitado e no que
// está gravado. Não usar em login, perfil nem chave — ali o texto é
// identidade, e ignorar acento faria dois cadastros distintos virarem um.
function semAcento(s) {
  s = String(s === null || s === undefined ? '' : s);
  return (s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s).toLowerCase();
}

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
    vendas:[],manutencoes:[], leads:[],usuarios:[],despesas:[],empresa:{},
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
  try {
    var raw = localStorage.getItem('am_user');
    if(!raw) return null;
    var obj = JSON.parse(raw);
    // Expirar após 8 horas
    if(obj && obj._ts && Date.now()-obj._ts > 8*60*60*1000){
      localStorage.removeItem('am_user'); return null;
    }
    return obj;
  } catch(e){ return null; }
}

function isAdmin(){
  var s = getSession();
  return s && (s.perfil === 'admin' || s.login === 'rogel');
}

function logout(){
  localStorage.removeItem('am_user');
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

// cb e opcional: os 10 usos que ja existiam continuam funcionando sem passar
// nada. Sem ele nao havia como saber se a exclusao deu certo.
function fdel(col, id, cb){
  fdb.collection(col).doc(String(id)).delete()
    .then(function(){ if(cb) cb(null); })
    .catch(function(e){ console.error('[fdel]', e); if(cb) cb(e); });
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


// ── Máscaras de digitação e exportação ───────────────────────
// RESTAURADAS em 15/09/2026. Estas 8 funções existiam no shared até 09/06/2026
// (commit 28b5874, que enxugou o arquivo de 11.662 para 8.831 bytes) e foram
// perdidas ali — mas as páginas nunca pararam de chamá-las. Resultado: por mais
// de tres meses TODA mascara de CPF/CNPJ/telefone/CEP/placa e TODO botao de
// exportar estavam quebrados, falhando calado no console.
// Copiadas sem alteracao da ultima versao que as tinha.
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
  // CORRIGIDO em 15/09/2026: a regra original usava (\d{4,5}), que e gulosa e
  // comia 5 digitos tambem no telefone FIXO de 10 digitos -- (75) 3225-2932
  // saia como (75) 32252-932. Agora o fixo tem a sua propria regra.
  if(v.length > 9)  return v.replace(/(\d{2})(\d{4})(\d{4})/,'($1) $2-$3');
  if(v.length > 6)  return v.replace(/(\d{2})(\d{4})(\d*)/,'($1) $2-$3');
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


// ── Fornecedores: sugestão ao digitar e cadastro rápido ──────
// Pedido do Rogel em 26/09/2026. Os campos de fornecedor (despesas) e oficina
// (manutenção) eram texto livre: dos 25 nomes já digitados, só 2 batiam com
// os 6 fornecedores cadastrados. Trocar por lista fechada apagaria os outros
// 23 ao reabrir o lançamento -- por isso é SUGESTÃO, não imposição: o campo
// continua aceitando nome novo.

function _fornNorm(x){ return String(x||'').trim().toUpperCase().replace(/\s+/g, ' '); }

// Acha o fornecedor cadastrado com esse nome (ignorando caixa e espaço extra)
function fornPorNome(nome){
  var k = _fornNorm(nome);
  if(!k) return null;
  return (DB.fornecedores||[]).find(function(f){ return _fornNorm(f.nome) === k; }) || null;
}

// <datalist> para o input sugerir enquanto se digita
function fornDatalist(id){
  var itens = (DB.fornecedores||[]).slice().sort(function(a,b){
    return String(a.nome||'').localeCompare(String(b.nome||''), 'pt-BR');
  });
  return '<datalist id="'+id+'">' + itens.map(function(f){
    return '<option value="' + String(f.nome||'').replace(/"/g, '&quot;') + '">';
  }).join('') + '</datalist>';
}

// Painel de cadastro rápido. NÃO usa om()/cm() de propósito: o formulário de
// despesa/manutenção já é um modal, e o om() troca o conteúdo dele -- abriria
// por cima e apagaria tudo que a pessoa digitou. Este painel é um overlay
// próprio, acima do modal, e devolve o foco sem tocar no que está embaixo.
// O campo pode ser <input> (despesas, manutencao) ou <select> (veiculos).
// Num select nao adianta atribuir o nome: e preciso existir a <option>.
function _preencherCampoForn(campo, forn){
  if(!campo || !forn) return;
  if(String(campo.tagName||'').toUpperCase() === 'SELECT'){
    var tem = false, i;
    for(i=0; i<campo.options.length; i++){
      if(String(campo.options[i].value) === String(forn.id)){ tem = true; break; }
    }
    if(!tem && campo.appendChild && document.createElement){
      var op = document.createElement('option');
      op.value = forn.id; op.textContent = forn.nome;
      campo.appendChild(op);
    }
    campo.value = String(forn.id);
  } else {
    campo.value = forn.nome;
  }
}

function novoFornecedorRapido(campoId){
  var velho = document.getElementById('am-forn-rapido');
  if(velho) velho.remove();

  var campo = document.getElementById(campoId);
  var jaDigitado = campo ? String(campo.value||'').trim() : '';

  var p = document.createElement('div');
  p.id = 'am-forn-rapido';
  p.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;'+
    'display:flex;align-items:center;justify-content:center;padding:16px';
  p.innerHTML =
    '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;'+
    'width:420px;max-width:100%;box-shadow:0 20px 48px rgba(0,0,0,.28)">'+
    '<div style="padding:14px 18px;font-weight:800;font-size:13px;border-bottom:1px solid var(--border)">'+
    '&#128100; Novo Fornecedor</div>'+
    '<div style="padding:18px">'+
    '<div class="fg"><label>Nome *</label>'+
    '<input id="fr-nome" value="'+jaDigitado.replace(/"/g,'&quot;')+'" placeholder="Oficina, loja, prestador..."></div>'+
    '<div class="fr" style="margin-top:10px">'+
    '<div class="fg"><label>Telefone</label>'+
    '<input id="fr-tel" oninput="this.value=maskPhone(this.value)" placeholder="(75) 99999-9999"></div>'+
    '<div class="fg"><label>CPF / CNPJ</label>'+
    '<input id="fr-doc" oninput="this.value=maskCPFCNPJ(this.value)" placeholder="opcional"></div>'+
    '</div>'+
    '<p style="font-size:11px;color:var(--t3);margin-top:10px;line-height:1.5">'+
    'Só o nome é obrigatório aqui. Os demais dados (endereço, banco) podem ser '+
    'completados depois em Clientes / Fornec.</p>'+
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">'+
    '<button class="btn bg2" id="fr-cancelar">Cancelar</button>'+
    '<button class="btn bp" id="fr-salvar">&#10004; Cadastrar</button>'+
    '</div></div></div>';
  document.body.appendChild(p);

  var fechar = function(){ p.remove(); };
  p.addEventListener('click', function(e){ if(e.target === p) fechar(); });
  document.getElementById('fr-cancelar').onclick = fechar;

  var nomeEl = document.getElementById('fr-nome');
  if(nomeEl) nomeEl.focus();

  document.getElementById('fr-salvar').onclick = function(){
    var btn = this;
    var nome = (document.getElementById('fr-nome')||{value:''}).value.trim();
    if(!nome){ toast('Informe o nome do fornecedor','err'); return; }

    // Já existe com esse nome? Aproveita em vez de criar duplicata.
    var ja = fornPorNome(nome);
    if(ja){
      _preencherCampoForn(campo, ja);
      fechar();
      toast('Esse fornecedor já estava cadastrado — usei o existente','ok');
      return;
    }

    if(!DB.fornecedores) DB.fornecedores = [];
    var obj = {
      id: nid(DB.fornecedores), nome: nome,
      cpf: (document.getElementById('fr-doc')||{value:''}).value.trim(),
      rg: '',
      telefone: (document.getElementById('fr-tel')||{value:''}).value.trim(),
      email: '', endereco: '', cidade: '', uf: '',
      tipo: 'pessoa_juridica', banco: '', agencia: '', conta: '', obs: ''
    };

    btn.disabled = true; btn.innerHTML = 'Cadastrando...';
    // só mexe na lista e no campo depois que o banco confirmar
    fsave('fornecedores', obj, function(err){
      btn.disabled = false; btn.innerHTML = '&#10004; Cadastrar';
      if(err){
        toast('NAO foi cadastrado: ' + (err.message || err.code || 'erro ao gravar'), 'err');
        return;   // painel fica aberto, nada se perde
      }
      DB.fornecedores.push(obj);
      sDB();
      _preencherCampoForn(campo, obj);
      fechar();
      toast('Fornecedor ' + obj.nome + ' cadastrado', 'ok');
    });
  };
}


// ── Redesenhar sem perder o que se está digitando ────────────
// Os campos de busca chamam um render que troca o #main inteiro. Isso destrói
// e recria o próprio campo: o cursor se perde e a tecla seguinte não entra em
// lugar nenhum -- na prática, só dava para digitar UMA letra por vez.
// comFoco() guarda quem estava focado e onde estava o cursor, redesenha, e
// devolve os dois. Conserta sem precisar reescrever os render.
function comFoco(render){
  var ativo = document.activeElement;
  var id = ativo && ativo.id;
  var ini = null, fim = null;
  // input de data/número não tem selectionStart em todo navegador
  try { ini = ativo.selectionStart; fim = ativo.selectionEnd; } catch(e){}

  render();

  if(!id) return;
  var novo = document.getElementById(id);
  if(!novo || novo === ativo) return;   // o render não recriou o campo
  try { novo.focus(); } catch(e){}
  try { if(ini != null && novo.setSelectionRange) novo.setSelectionRange(ini, fim); } catch(e){}
}
