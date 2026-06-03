
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
            'vendas','manutencoes','usuarios'];
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
