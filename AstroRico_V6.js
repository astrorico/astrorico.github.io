// --- Helpers de data juliana / progressão (compartilhados por calculateDecenais, miniDecenais, computeProfectionContext) ---
function jd(y,m,d){if(m<=2){y--;m+=12;}const A=Math.floor(y/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+d+B-1524.5;}
function jdToDate(j){const z=Math.floor(j+0.5),a=Math.floor((z-1867216.25)/36524.25),b=z+1+a-Math.floor(a/4)+1524,c=Math.floor((b-122.1)/365.25),d=Math.floor(365.25*c),e=Math.floor((b-d)/30.6001),dy=b-d-Math.floor(30.6001*e),mo=e<14?e-1:e-13,yr=mo>2?c-4716:c-4715;return String(dy).padStart(2,'0')+'/'+String(mo).padStart(2,'0')+'/'+yr;}
function progDeg(cur) {
  if (!cur) return 0;
  const dur = cur.jd_end - cur.jd_start;
  return dur > 0 ? Math.min(29.99, (targetJD - cur.jd_start) / dur * 30) : 0;
}
function fmtDegMin(lon) {
  const deg = Math.floor(((lon%30)+30)%30);
  const mn = Math.floor(((lon-Math.floor(lon))*60+60)%60);
  return deg+'°'+String(mn).padStart(2,'0')+"'";
}

// Máscara DD/MM/AAAA
// ═══ 1. INIT — máscaras de data/hora de nascimento ══════════════════════════
document.addEventListener("DOMContentLoaded",function(){
  // Mapa do momento: nome automático (data de hoje) + data/hora atuais + cálculo já feito ao abrir
  var now = new Date();
  var dd = String(now.getDate()).padStart(2,'0');
  var mm = String(now.getMonth()+1).padStart(2,'0');
  var yyyy = now.getFullYear();
  document.getElementById('mapaNome').value = 'Hoje '+dd+'/'+mm+'/'+yyyy;
  document.getElementById('birthDate').value = dd+'/'+mm+'/'+yyyy;
  document.getElementById('birthTime').value = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
  document.getElementById('tr-target-date').value = dd+'/'+mm+'/'+yyyy;
  document.getElementById('prof-target-date').value = dd+'/'+mm+'/'+yyyy;
  document.getElementById('vl-target-date').value = dd+'/'+mm+'/'+yyyy;
  document.getElementById('dir-target-date').value = dd+'/'+mm+'/'+yyyy;
  document.getElementById('rs-event-date').value = dd+'/'+mm+'/'+yyyy;
  document.getElementById('ag-event-date').value = dd+'/'+mm+'/'+yyyy;
  calculateMapa();
  document.getElementById('mapas_url_input').value = MAPAS_DB_URL;
  loadMapasOnline();

  // Hora: qmFormatTime no oninput já cuida da formatação em tempo real
  // Formatação °'" para Grau/Min/Seg
  var adm=document.getElementById("ascDegMin");
  adm.addEventListener("focus",function(e){
    e.target.value=e.target.value.replace(/\D/g,'');
  });
  adm.addEventListener("blur",function(e){
    applyAscFormat(e.target);
  });
});
// Converte DD/MM/AAAA → AAAA-MM-DD (ou retorna yyyy-mm-dd se já estiver nesse formato)
// Confere se yyyy-mm-dd é uma data de calendário real (rejeita 31/02, mês 13, etc.)
function isValidCalendarDateISO(iso){
  var p=iso.split("-").map(Number);
  var y=p[0],m=p[1],d=p[2];
  if(!y||m<1||m>12||d<1||d>31)return false;
  var dt=new Date(Date.UTC(y,m-1,d));
  return dt.getUTCFullYear()===y && dt.getUTCMonth()===m-1 && dt.getUTCDate()===d;
}
function parseBirthDate(val){
  if(!val)return null;
  // Se já está no formato yyyy-mm-dd (do input type="date"), retorna direto
  if(/^\d{4}-\d{2}-\d{2}$/.test(val))return isValidCalendarDateISO(val) ? val : null;
  // Caso contrário, tenta converter dd/mm/aaaa → yyyy-mm-dd
  var p=val.split("/");
  if(p.length!==3)return null;
  var d=p[0],m=p[1],y=p[2];
  if(d.length!==2||m.length!==2||y.length!==4)return null;
  var iso=y+"-"+m+"-"+d;
  return isValidCalendarDateISO(iso) ? iso : null;
}
// Aviso visual (borda vermelha) quando a data de nascimento está completa e é inválida —
// não emite alerta; o cálculo (calculateMapa) já ignora silenciosamente os planetas nesse caso.
function markBirthDateValidity(input){
  var complete = input.value.length === 10;
  var invalid = complete && !parseBirthDate(input.value);
  input.style.borderColor = invalid ? 'var(--color-danger)' : '';
  input.style.boxShadow = invalid ? '0 0 0 1px var(--color-danger)' : '';
}

// ─── PONTO (ASC/planeta/Lote) ───────────────────────────────────────────────
// Rótulos e resolução de longitude compartilhados por Profecção e Direções
// (evita duplicar a mesma lógica de Fortuna/Espírito nos dois lugares)
const POINT_LABELS = {
  asc:'Ascendente', sol:'Sol', lua:'Lua', mer:'Mercúrio', ven:'Vênus',
  mar:'Marte', jup:'Júpiter', sat:'Saturno', fortune:'L. Fortuna', spirit:'L. Espírito'
};
// ═══ 2. Helper — resolve longitude de um ponto selecionado (planeta/lote) ═══
function resolvePointLon(pointSel, planets, ascLon) {
  if (!pointSel || pointSel === 'asc') return ascLon;
  const norm = v => ((v % 360) + 360) % 360;
  if (pointSel === 'fortune') {
    const isDay = norm(planets.sol - ascLon) >= 180;
    return isDay ? norm(ascLon + planets.lua - planets.sol) : norm(ascLon + planets.sol - planets.lua);
  }
  if (pointSel === 'spirit') {
    const isDay = norm(planets.sol - ascLon) >= 180;
    return isDay ? norm(ascLon + planets.sol - planets.lua) : norm(ascLon + planets.lua - planets.sol);
  }
  return planets[pointSel];
}

// ─── BANCO DE MAPAS (rico_RicoMapas.db) ────────────────────────────────────
// Coloque aqui o link "raw" do arquivo .db hospedado no GitHub (ou outro host)
// Ex: https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPO/main/rico_RicoMapas.db
const MAPAS_DB_URL = 'https://astrorico.github.io/mapas.map';

let _sqlJsLib = null;
let mapasDB = null;

// ═══ 3. Aba MAPAS — salvar/carregar mapas em banco sql.js ═══════════════════
async function _ensureSqlJs() {
  if (!_sqlJsLib) {
    _sqlJsLib = await initSqlJs({ locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}` });
  }
  return _sqlJsLib;
}

function _mapasSetStatus(msg, isError) {
  const el = document.getElementById('mapas_status');
  el.textContent = msg;
  el.style.color = isError ? 'var(--color-danger)' : 'var(--color-text-secondary)';
}

async function _mapasLoadFromArrayBuffer(buf) {
  try {
    const SQL = await _ensureSqlJs();
    mapasDB = new SQL.Database(new Uint8Array(buf));
    const r = mapasDB.exec("SELECT COUNT(*) FROM birth_info");
    const total = r[0]?.values?.[0]?.[0] ?? 0;
    document.getElementById('mapas_search_box').style.display = 'block';
    if (total === 1) {
      const idRes = mapasDB.exec("SELECT ID FROM birth_info LIMIT 1");
      mapaSelect(idRes[0]?.values?.[0]?.[0]);
      _mapasSetStatus('✅ 1 mapa encontrado e carregado automaticamente.');
    } else {
      _mapasSetStatus(`✅ ${total} mapas carregados. Digite um nome ou clique no campo para ver a lista.`);
      mapaSearch('');
    }
  } catch (e) {
    _mapasSetStatus('Erro ao abrir o banco: ' + e.message, true);
  }
}

function mapasFilePicked(input) {
  const file = input.files[0];
  if (!file) return;
  _mapasSetStatus('Lendo arquivo...');
  const reader = new FileReader();
  reader.onload = () => _mapasLoadFromArrayBuffer(reader.result);
  reader.onerror = () => _mapasSetStatus('Erro ao ler o arquivo.', true);
  reader.readAsArrayBuffer(file);
}

async function loadMapasOnline() {
  let url = (getVal('mapas_url_input') || '').trim();
  if (!url) {
    _mapasSetStatus('⚠️ Preencha o endereço do banco (raw GitHub) antes de carregar.', true);
    return;
  }
  // Corrige automaticamente links "blob" do GitHub (não servem para fetch/CORS) para o formato "raw"
  if (/github\.com\/.+\/blob\//.test(url)) {
    url = url.replace('github.com/', 'raw.githubusercontent.com/').replace('/blob/', '/');
    document.getElementById('mapas_url_input').value = url;
  }
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.hostname !== 'raw.githubusercontent.com') {
      _mapasSetStatus('⚠️ Por segurança, só é permitido carregar de https://raw.githubusercontent.com/...', true);
      return;
    }
  } catch (e) {
    _mapasSetStatus('⚠️ URL inválida.', true);
    return;
  }
  _mapasSetStatus('Baixando banco de mapas...');
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const buf = await resp.arrayBuffer();
    await _mapasLoadFromArrayBuffer(buf);
    localStorage.setItem('mapas_db_url', url);
  } catch (e) {
    _mapasSetStatus('Erro ao baixar: ' + e.message, true);
  }
}

function mapaSearch(q) {
  const ul = document.getElementById('mapas_ac_list');
  q = (q || '').trim();
  if (!mapasDB) { ul.style.display = 'none'; return; }
  const stmt = q.length
    ? mapasDB.prepare("SELECT ID,name,day,month,year FROM birth_info WHERE name LIKE ? ORDER BY name LIMIT 500")
    : mapasDB.prepare("SELECT ID,name,day,month,year FROM birth_info ORDER BY name LIMIT 500");
  if (q.length) stmt.bind(['%' + q + '%']);
  let html = '';
  while (stmt.step()) {
    const row = stmt.getAsObject();
    html += `<li style="padding:7px 12px;cursor:pointer" onmousedown="mapaSelect(${escapeHtml(row.ID)})">
      ${escapeHtml(row.name)} <span style="color:var(--color-border-input)">— ${escapeHtml(String(row.day).padStart(2,'0'))}/${escapeHtml(String(row.month).padStart(2,'0'))}/${escapeHtml(row.year)}</span></li>`;
  }
  stmt.free();
  ul.innerHTML = html || '<li style="padding:7px 12px;color:var(--color-text-secondary);font-style:italic">Nenhum resultado.</li>';
  ul.style.display = 'block';
}

function mapaSelect(id) {
  const stmt = mapasDB.prepare("SELECT * FROM birth_info WHERE ID = ?");
  stmt.bind([id]);
  if (!stmt.step()) { stmt.free(); return; }
  const r = stmt.getAsObject();
  stmt.free();

  document.getElementById('birthDate').value =
    String(r.day).padStart(2,'0') + '/' + String(r.month).padStart(2,'0') + '/' + r.year;
  document.getElementById('birthTime').value =
    String(r.hour).padStart(2,'0') + ':' + String(r.minute).padStart(2,'0');
  // dst não é alterado automaticamente: o "timezone" do banco já é o fuso efetivo usado na entrada original.
  document.getElementById('lat').value = (r.lat_deg + r.lat_min/60) * r.ns;
  document.getElementById('lon').value = (r.long_deg + r.long_min/60) * r.ew;
  document.getElementById('tzOffset').value = r.timezone;

  document.getElementById('mapaNome').value = r.name;
  document.getElementById('mapas_search_input').value = r.name;
  document.getElementById('mapas_ac_list').style.display = 'none';
  _mapasSetStatus(`✅ "${r.name}" carregado nos campos abaixo.`);
}

document.addEventListener('mousedown', function(e){
  const list = document.getElementById('mapas_ac_list');
  const inp = document.getElementById('mapas_search_input');
  if (list && inp && !list.contains(e.target) && e.target !== inp) {
    list.style.display = 'none';
  }
});

// Salva o mapa atualmente preenchido no formulário dentro do mapasDB (cria banco novo se ainda não houver um carregado)
async function mapaSaveCurrent() {
  if (!mapasDB) {
    const SQL = await _ensureSqlJs();
    mapasDB = new SQL.Database();
    mapasDB.run(`CREATE TABLE birth_info (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      entered_by TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      sex TEXT NOT NULL DEFAULT 'm',
      month INTEGER NOT NULL DEFAULT 1,
      day INTEGER NOT NULL DEFAULT 1,
      year INTEGER NOT NULL DEFAULT 2000,
      hour INTEGER NOT NULL DEFAULT 12,
      minute INTEGER NOT NULL DEFAULT 0,
      timezone REAL NOT NULL DEFAULT 0,
      long_deg INTEGER NOT NULL DEFAULT 0,
      long_min INTEGER NOT NULL DEFAULT 0,
      ew INTEGER NOT NULL DEFAULT 1,
      lat_deg INTEGER NOT NULL DEFAULT 0,
      lat_min INTEGER NOT NULL DEFAULT 0,
      ns INTEGER NOT NULL DEFAULT 1,
      dst INTEGER NOT NULL DEFAULT 0,
      entry_date TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT ''
    )`);
    document.getElementById('mapas_search_box').style.display = 'block';
  }

  const nome = (getVal('mapaNome') || '').trim();
  if (!nome) { _mapasSetStatus('⚠️ Preencha o "Nome do Mapa" antes de salvar.', true); return; }

  const dataISO = parseBirthDate(getVal('birthDate'));
  if (!dataISO) { _mapasSetStatus('⚠️ Data de nascimento inválida.', true); return; }
  const [yyyy, mmS, ddS] = dataISO.split('-');
  const mm = parseInt(mmS, 10), dd = parseInt(ddS, 10), yyyyN = parseInt(yyyy, 10);

  const horaPart = (getVal('birthTime') || '12:00:00').split(':');
  const hour = parseInt(horaPart[0] || '12', 10);
  const minute = parseInt(horaPart[1] || '0', 10);

  const latVal = parseFloat(getVal('lat')) || 0;
  const lonVal = parseFloat(getVal('lon')) || 0;
  const tz = parseFloat(getVal('tzOffset')) || 0;
  const dst = document.getElementById('dst').checked ? 1 : 0;

  const ns = latVal < 0 ? -1 : 1;
  const latAbs = Math.abs(latVal);
  const lat_deg = Math.floor(latAbs);
  const lat_min = Math.round((latAbs - lat_deg) * 60);

  const ew = lonVal < 0 ? -1 : 1;
  const lonAbs = Math.abs(lonVal);
  const long_deg = Math.floor(lonAbs);
  const long_min = Math.round((lonAbs - long_deg) * 60);

  const entryDate = new Date().toISOString().slice(0, 10);

  mapasDB.run(
    `INSERT INTO birth_info (entered_by,name,sex,month,day,year,hour,minute,timezone,long_deg,long_min,ew,lat_deg,lat_min,ns,dst,entry_date,bio)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ['app', nome, 'm', mm, dd, yyyyN, hour, minute, tz, long_deg, long_min, ew, lat_deg, lat_min, ns, dst, entryDate, '']
  );

  const r = mapasDB.exec("SELECT COUNT(*) FROM birth_info");
  const total = r[0]?.values?.[0]?.[0] ?? 0;
  document.getElementById('mapas_search_box').style.display = 'block';
  mapaSearch('');
  _mapasSetStatus(`✅ "${nome}" salvo. ${total} mapas no banco. Baixando arquivo atualizado...`);
  _mapasDownload();
}

// Baixa o mapasDB atual (em memória) como arquivo .map
function _mapasDownload() {
  const data = mapasDB.export();
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `mapas_${stamp}.map`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const SIGN_NAMES = ['Áries','Touro','Gêmeos','Câncer','Leão','Virgem',
                    'Libra','Escorpião','Sagitário','Capricórnio','Aquário','Peixes'];

// Unicode glifos de signos ♈♉♊♋♌♍♎♏♐♑♒♓
const SIGN_CHARS = [0x2648,0x2649,0x264A,0x264B,0x264C,0x264D,0x264E,0x264F,0x2650,0x2651,0x2652,0x2653];
// Unicode glifos de planetas ☉☽☿♀♂♃♄♅♆♇☊☋
const PLANET_CHARS = {
  sol:0x2609,lua:0x263D,mer:0x263F,ven:0x2640,mar:0x2642,
  jup:0x2643,sat:0x2644,ura:0x2645,net:0x2646,plu:0x2647,
  nnode:0x260A,snode:0x260B
};
const GF = s => `bold ${s}px "Noto Sans Symbols","Noto Sans Symbols2","Segoe UI Symbol","Apple Symbols",sans-serif`;

// Termos egípcios: [planetIdx, grauFim] por signo
// planeta idx: 0=Sol,1=Lua,2=Mer,3=Ven,4=Mar,5=Jup,6=Sat
const EGYPTIAN_TERMS = [
  [[5,6],[3,12],[2,20],[4,25],[6,30]],  // Áries
  [[3,8],[2,14],[5,22],[6,27],[4,30]],  // Touro
  [[2,6],[5,12],[3,17],[4,24],[6,30]],  // Gêmeos
  [[4,7],[3,13],[2,19],[5,26],[6,30]],  // Câncer
  [[5,6],[3,11],[6,18],[2,24],[4,30]],  // Leão
  [[2,7],[3,17],[5,21],[4,28],[6,30]],  // Virgem
  [[6,6],[2,14],[5,21],[3,28],[4,30]],  // Libra
  [[4,7],[3,11],[2,19],[5,24],[6,30]],  // Escorpião
  [[5,12],[3,17],[2,21],[6,26],[4,30]],  // Sagitário
  [[2,7],[5,14],[3,22],[6,26],[4,30]],  // Capricórnio
  [[2,7],[3,13],[5,20],[4,25],[6,30]],  // Aquário
  [[3,12],[5,16],[2,19],[4,28],[6,30]], // Peixes
];

const TERM_PLANETS = ['Sol','Lua','Mercúrio','Vênus','Marte','Júpiter','Saturno'];

// ── Painel completo de Profecção Anual (Valens) — regências/exaltação/aspectos ──
// Índices de planeta 0=Sol,1=Lua,2=Mer,3=Ven,4=Mar,5=Jup,6=Sat (mesma ordem de TERM_PLANETS)
const PROF_SIGN_RULERS = ['Marte','Vênus','Mercúrio','Lua','Sol','Mercúrio','Vênus','Marte','Júpiter','Saturno','Saturno','Júpiter'];
const PROF_RULER_IDX   = [4,3,2,1,0,2,3,4,5,6,6,5];
const PROF_PLANET_SYMS = ['☉','☽','☿','♀','♂','♃','♄'];
// Exaltação por signo (sign_idx => planet_idx): Áries→Sol, Touro→Lua, Câncer→Júpiter, Virgem→Mercúrio, Libra→Saturno, Capricórnio→Marte, Peixes→Vênus
const PROF_EXALT_IDX   = {0:0, 1:1, 3:5, 5:2, 6:6, 9:4, 11:3};
const PROF_ASP_ORBS  = {0:8, 60:5, 90:7, 120:7, 180:8};
const PROF_ASP_NAMES = {0:'Conjunção', 60:'Sêxtil', 90:'Quadratura', 120:'Trígono', 180:'Oposição'};

// ─── FONTE ────────────────────────────────────────────────────────────────────
let fontLoaded = false;
// ═══ 4. Desenho do mandala (canvas) — fonte + funções de projeção ═══════════
async function loadFont() {
  if (fontLoaded) return;
  try {
    await document.fonts.load('22px HamburgSymbols');
    await document.fonts.load('27px HamburgSymbols');
    await document.fonts.ready;
    fontLoaded = true;
  } catch(e) {}
}

// ─── MANDALA ──────────────────────────────────────────────────────────────────
// Canvas 800×800, centro (400,400)
const CX=430, CY=430;
const R_TICK_OUT=390, R_ZO=370, R_ZI=318;
const R_DODECA_INNER=370, R_DODECA_MID=407;
const R_TERMS_O=R_ZI, R_TERMS_I=295;
const R_PL=258, R_PL_LINE_O=275, R_PL_LINE_I=286;
const R_IN=150;

function z2a(lon, asc) { return Math.PI - ((lon - asc + 3600) % 360) * Math.PI / 180; }
function px(r, a) { return CX + r * Math.cos(a); }
function py(r, a) { return CY + r * Math.sin(a); }

// Fórmula única de dodecatemoria (lon eclíptica → posição dodecatemoria).
// Unifica as antigas calcDodec/trDodecaLon/dodecaLon (corpos idênticos).
function dodecaLon(lon) {
  lon = ((lon % 360) + 360) % 360;
  const sign = Math.floor(lon / 30);
  const rel  = lon - sign * 30;
  return ((sign * 30 + rel * 12) % 360 + 360) % 360;
}

// Anti-colisão genérica: afasta itens muito próximos ao longo de um círculo (graus).
// items: array de objetos; lonKey: propriedade mutável de longitude; minDist: distância mínima em graus.
// Itens com item.virtual=true não se movem (o outro absorve o deslocamento completo).
function resolveCollisions(items, lonKey, minDist) {
  for (let it = 0; it < 5; it++) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        let d = ((items[j][lonKey] - items[i][lonKey]) % 360 + 360) % 360;
        if (d > 180) d -= 360;
        if (Math.abs(d) < minDist) {
          const p = (minDist - Math.abs(d)) / 2;
          const sgn = Math.sign(d) || 1; // d=0 (empate exato): força direção padrão pra não travar em sign(0)=0
          const iFix = items[i].virtual, jFix = items[j].virtual;
          if (iFix && jFix) { /* ambos fixos: nada a fazer */ }
          else if (iFix) { items[j][lonKey] += p * 2 * sgn; }
          else if (jFix) { items[i][lonKey] -= p * 2 * sgn; }
          else { items[i][lonKey] -= p * sgn; items[j][lonKey] += p * sgn; }
        }
      }
    }
  }
}

function arcSector(ctx, rO, rI, lon1, lon2, asc) {
  const a1 = z2a(lon1, asc), a2 = z2a(lon2, asc);
  ctx.beginPath();
  ctx.arc(CX, CY, rO, a2, a1, false);
  ctx.arc(CX, CY, rI, a1, a2, true);
  ctx.closePath();
}

function drawMandala(canvas, ascLon, planets, meta) {
  const ctx = canvas.getContext('2d');
  canvas.width = 860; canvas.height = 860;
  ctx.clearRect(0, 0, 860, 860);

  // ── Fundo branco ──
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 860, 860);

  const asc = ascLon;
  const GF = (s, w='normal') => `${w} ${s}px "Noto Sans Symbols","Noto Sans Symbols2","Segoe UI Symbol","Apple Symbols",sans-serif`;
  const sigColor = ['#FFF2F0','#F0FFF0','#FFFFF0','#F0F0FF','#FFF2F0','#F0FFF0','#FFFFF0','#F0F0FF','#FFF2F0','#F0FFF0','#FFFFF0','#F0F0FF'];

  // 1. Ticks de grau (exterior ao anel zodiacal)
  for (let i = 0; i < 360; i++) {
    const ang = z2a(asc + i, asc);
    let len = 4; if (i%10===0) len=12; else if (i%5===0) len=8;
    ctx.beginPath(); ctx.moveTo(px(R_ZO,ang),py(R_ZO,ang)); ctx.lineTo(px(R_ZO+len,ang),py(R_ZO+len,ang));
    ctx.strokeStyle='#333'; ctx.lineWidth=i%10===0?1.2:0.7; ctx.stroke();
  }

  // 2. Anel zodiacal
  const SIGN_U=[0x2648,0x2649,0x264A,0x264B,0x264C,0x264D,0x264E,0x264F,0x2650,0x2651,0x2652,0x2653];
  // Cor escura por elemento (mesmo agrupamento de sigColor/dodecColor, tom mais escuro p/ planetas e lotes)
  function signElementColorDark(lon){
    const s=Math.floor(norm360(lon)/30);
    if([0,4,8].includes(s))  return '#7A1010'; // Fogo escuro
    if([1,5,9].includes(s))  return '#045C1E'; // Terra escuro
    if([2,6,10].includes(s)) return '#6B4400'; // Ar escuro
    return '#0D3A66';                           // Água escuro
  }
  for (let s=0;s<12;s++) {
    arcSector(ctx,R_ZO,R_ZI,s*30,s*30+30,asc);
    ctx.fillStyle=sigColor[s]; ctx.fill();
    ctx.strokeStyle='#666'; ctx.lineWidth=0.8; ctx.stroke();
    const a=z2a(s*30+15,asc), r=(R_ZO+R_ZI)/2;
    ctx.font=GF(26,'bold'); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=signElementColorDark(s*30);
    ctx.fillText(String.fromCodePoint(SIGN_U[s])+'\uFE0E',px(r,a),py(r,a));
  }

  // 4. Termos egípcios
  const EGYPT_TERMS = EGYPTIAN_TERMS;
  const PL_U_T=[0x2609,0x263D,0x263F,0x2640,0x2642,0x2643,0x2644];
  for (let si=0;si<12;si++){let prev=0;for(const [pi,end] of EGYPT_TERMS[si]){const l1=si*30+prev,l2=si*30+end;arcSector(ctx,R_TERMS_O,R_TERMS_I,l1,l2,asc);ctx.fillStyle='rgba(0,0,0,0)';ctx.fill();ctx.strokeStyle='#999';ctx.lineWidth=1.1;ctx.stroke();const a=z2a((l1+l2)/2,asc),r=(R_TERMS_O+R_TERMS_I)/2;ctx.font=GF(15);ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String.fromCodePoint(PL_U_T[pi])+'\uFE0E',px(r,a),py(r,a));prev=end;}}

  // 4b. Ticks de grau internos (borda interna dos termos → centro), igual ao natal_wheel.php
  for (let i = 0; i < 360; i++) {
    const ang = z2a(asc + i, asc);
    let len = 4;
    if (i % 10 === 0) len = 12;
    else if (i % 5 === 0) len = 8;
    ctx.beginPath();
    ctx.moveTo(px(R_TERMS_I, ang), py(R_TERMS_I, ang));
    ctx.lineTo(px(R_TERMS_I - len, ang), py(R_TERMS_I - len, ang));
    ctx.strokeStyle = '#333';
    ctx.lineWidth = i % 10 === 0 ? 1.2 : 0.7;
    ctx.stroke();
  }

  // 5. Linhas de casas
  for (let h=0;h<12;h++){
    const a=z2a(asc+h*30,asc),isA=(h===0||h===3||h===6||h===9);
    ctx.beginPath();ctx.moveTo(px(R_IN,a),py(R_IN,a));ctx.lineTo(px(R_TERMS_I,a),py(R_TERMS_I,a));
    ctx.strokeStyle=isA?'#000':'#aaa';ctx.lineWidth=isA?1.8:0.8;ctx.stroke();
  }

  // 6. Círculos estruturais
  [[R_ZO,'#444',1.5],[R_ZI,'#444',1.2],[R_TERMS_I,'#bbb',0.7],[R_IN,'#555',1.5]].forEach(([r,c,w])=>{ctx.beginPath();ctx.arc(CX,CY,r,0,2*Math.PI);ctx.strokeStyle=c;ctx.lineWidth=w;ctx.stroke();});
  ctx.beginPath();ctx.arc(CX,CY,R_IN-1,0,2*Math.PI);ctx.fillStyle='#fff';ctx.fill();

  // 6b. Dados usados no mapa, escritos no centro
  if (meta) {
    const fmtCoord = (v,posLbl,negLbl) => (typeof v==='number' && !isNaN(v)) ? (Math.abs(v).toFixed(4)+'°'+(v>=0?posLbl:negLbl)) : '';
    const linhas = [
      meta.nome,
      meta.dataStr,
      meta.horaStr,
      [fmtCoord(meta.lat,'N','S'), fmtCoord(meta.lon,'E','O')].filter(Boolean).join('  '),
      (typeof meta.tz==='number' && !isNaN(meta.tz)) ? ('UTC'+(meta.tz>=0?'+':'')+meta.tz) : ''
    ].filter(Boolean);
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#333';
    ctx.font='bold 15px Arial';
    const lh=18, startY=CY-((linhas.length-1)*lh)/2;
    linhas.forEach((txt,i)=>{
      if(i>0) ctx.font='13px Arial';
      ctx.fillText(txt, CX, startY+i*lh);
    });
  }

  // 6c. Seta fina (estilo "V" aberto) + grau, usada para ASC e MC
  const drawAxisArrow = (lon, label, color) => {
    const a = z2a(lon, asc);
    const rBase = R_ZO + 2;        // cauda encosta no anel zodiacal
    const rTip  = R_TICK_OUT + 6;  // ponta logo após os ticks externos (seta mais curta)
    const baseX = px(rBase,a), baseY = py(rBase,a);
    const tipX  = px(rTip,a),  tipY  = py(rTip,a);
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(tipX, tipY);
    ctx.strokeStyle = color; ctx.lineWidth = 1.1; ctx.stroke();
    const backR = rTip - 6, spread = 3, perp = a + Math.PI/2;
    const p1x = px(backR,a)+spread*Math.cos(perp), p1y = py(backR,a)+spread*Math.sin(perp);
    const p2x = px(backR,a)-spread*Math.cos(perp), p2y = py(backR,a)-spread*Math.sin(perp);
    ctx.beginPath();
    ctx.moveTo(p1x,p1y); ctx.lineTo(tipX,tipY); ctx.lineTo(p2x,p2y);
    ctx.strokeStyle = color; ctx.lineWidth = 1.1; ctx.stroke();
    // Texto do grau: deslocado para o lado da seta (tangencial) e ancorado para
    // dentro do canvas — assim a haste não cruza por cima dos números.
    const rTxt = rTip + 6, tangOffset = 13;
    const txX = px(rTxt,a) + tangOffset*Math.cos(perp);
    const txY = py(rTxt,a) + tangOffset*Math.sin(perp);
    ctx.font='bold 12px Arial'; ctx.fillStyle=color;
    ctx.textAlign = Math.cos(a) < -0.15 ? 'left' : Math.cos(a) > 0.15 ? 'right' : 'center';
    ctx.textBaseline = Math.sin(a) < -0.15 ? 'bottom' : Math.sin(a) > 0.15 ? 'top' : 'middle';
    ctx.fillText(fmtDegMin(lon), txX, txY);
  };
  drawAxisArrow(asc, 'ASC', '#000000');

  if (!planets) return;

  // 6d. Seta + grau do Meio do Céu (MC)
  if (typeof planets.mc === 'number') drawAxisArrow(planets.mc, 'MC', '#000000');

  // 7. Planetas + Lotes (Fortuna/Espírito) — anti-colisão conjunta
  const PL_U={sol:0x2609,lua:0x263D,mer:0x263F,ven:0x2640,mar:0x2642,jup:0x2643,sat:0x2644,ura:0x2645,net:0x2646,plu:0x2647,nnode:0x260A,snode:0x260B};
  const items=Object.entries(planets).filter(([n])=>n in PL_U&&typeof planets[n]==='number').map(([n,lon])=>({n,lon,drawn:lon,type:'planet',sp:planets[n+'Speed']}));
  if (planets.sol !== undefined && planets.lua !== undefined) {
    const isDay = ((planets.sol - asc) % 360 + 360) % 360 >= 180;
    const fortunaLon = isDay
      ? ((asc + planets.lua - planets.sol) % 360 + 360) % 360
      : ((asc + planets.sol - planets.lua) % 360 + 360) % 360;
    const spiritLon  = ((2 * asc - fortunaLon) % 360 + 720) % 360;
    items.push({n:'_fortuna', lon:fortunaLon, drawn:fortunaLon, type:'fortuna'});
    items.push({n:'_spirit',  lon:spiritLon,  drawn:spiritLon,  type:'spirit'});
  }
  resolveCollisions(items, 'drawn', 13);
  ctx.textAlign='center';ctx.textBaseline='middle';
  // Distância radial signo→grau adaptativa: pequena quando o ponto está mais na vertical
  // (onde o espaçamento aparece inteiro na tela e não precisa ser grande) e maior quando está
  // mais na horizontal (onde precisa de mais raio pra não sobrepor, já que aí o gap vira
  // separação horizontal disputada com a largura do texto).
  const plDegRadius = (aAng) => (R_PL-26) - (20 + 14*Math.abs(Math.cos(aAng)));
  for(const {n,lon,drawn,type,sp} of items){
    const c=signElementColorDark(lon),aE=z2a(lon,asc),aD=z2a(drawn,asc);
    ctx.beginPath();ctx.moveTo(px(R_PL_LINE_I,aE),py(R_PL_LINE_I,aE));ctx.lineTo(px(R_PL_LINE_O,aE),py(R_PL_LINE_O,aE));ctx.strokeStyle=c+'AA';ctx.lineWidth=0.9;ctx.stroke();
    if (type === 'spirit') {
      const fx=px(R_PL,aD), fy=py(R_PL,aD), fh=14;
      ctx.beginPath(); ctx.moveTo(fx,fy-fh); ctx.lineTo(fx+fh,fy); ctx.lineTo(fx,fy+fh); ctx.lineTo(fx-fh,fy); ctx.closePath();
      ctx.strokeStyle=c; ctx.lineWidth=2; ctx.stroke();
    } else if (type === 'fortuna') {
      ctx.font='27px HamburgSymbols'; ctx.fillStyle=c;
      ctx.fillText(String.fromCharCode(60), px(R_PL,aD), py(R_PL,aD));
    } else {
      ctx.font=GF(38,'bold');ctx.fillStyle=c;ctx.fillText(String.fromCodePoint(PL_U[n])+'\uFE0E',px(R_PL,aD),py(R_PL,aD));
    }
    const signIdx=Math.floor(norm360(lon)/30);
    const rSign=R_PL-26, rDeg=plDegRadius(aD);
    ctx.font=GF(16,'bold');ctx.fillStyle=c;
    ctx.fillText(String.fromCodePoint(SIGN_U[signIdx])+'\uFE0E',px(rSign,aD),py(rSign,aD));
    ctx.font='bold 14px Arial';ctx.fillStyle=c;
    const degStr=fmtDegMin(lon);
    ctx.fillText(degStr,px(rDeg,aD),py(rDeg,aD));
  }
  // 7b. Marcador de retrógrado (R) — passada separada, desenhada por cima de tudo,
  // num raio próprio (abaixo do grau) para nunca ser encoberta pelo texto do vizinho.
  for(const {lon,drawn,sp} of items){
    if (!(sp<0)) continue;
    const c=signElementColorDark(lon),aD=z2a(drawn,asc),rR=plDegRadius(aD)-18;
    ctx.font='bold 12px Arial';ctx.fillStyle=c;
    ctx.fillText('R',px(rR,aD),py(rR,aD));
  }

  // 8. Anel dodecatemoria (fora do zodíaco)
  {
    // Cor por elemento (Fogo=vermelho, Terra=verde, Ar=laranja, Água=azul)
    function dodecColor(dlon) {
      const s = Math.floor(((dlon % 360) + 360) % 360 / 30);
      if ([0,4,8].includes(s))  return '#BE1E1E'; // Fogo
      if ([1,5,9].includes(s))  return '#008032'; // Terra
      if ([2,6,10].includes(s)) return '#B47800'; // Ar
      return '#1E5AA0';                            // Água
    }

    // Coletar planetas com posição dodeca
    const PL_U_DOD = {sol:0x2609,lua:0x263D,mer:0x263F,ven:0x2640,mar:0x2642,jup:0x2643,sat:0x2644,ura:0x2645,net:0x2646,plu:0x2647,nnode:0x260A,snode:0x260B};
    const dodItems = [];
    for (const [n, lon] of Object.entries(planets)) {
      if (!(n in PL_U_DOD) || typeof lon !== 'number') continue;
      dodItems.push({ n, exactLon: lon, dodLon: dodecaLon(lon), drawnLon: dodecaLon(lon) });
    }

    // Fortuna, Espírito e Ascendente no dodecatemoria
    if (planets.sol !== undefined && planets.lua !== undefined) {
      const fLon = ((asc + planets.lua - planets.sol) % 360 + 360) % 360;
      const sLon = ((2 * asc - fLon) % 360 + 720) % 360;
      dodItems.push({ n: '_fortuna', exactLon: fLon, dodLon: dodecaLon(fLon), drawnLon: dodecaLon(fLon) });
      dodItems.push({ n: '_spirit',  exactLon: sLon, dodLon: dodecaLon(sLon), drawnLon: dodecaLon(sLon) });
    }
    dodItems.push({ n: '_asc', exactLon: asc, dodLon: dodecaLon(asc), drawnLon: dodecaLon(asc) });

    // Bloqueadores virtuais: reconhecem a posição real da seta+grau do ASC e do MC
    // (desenhadas fora do zodíaco, na mesma faixa radial do anel dodecatemoria) para que
    // os glifos dodeca sejam repelidos dali e não fiquem sobrepostos às setas/graus.
    dodItems.push({ n: '_ascAxis', exactLon: asc, dodLon: asc, drawnLon: asc, virtual: true });
    if (typeof planets.mc === 'number') {
      dodItems.push({ n: '_mcAxis', exactLon: planets.mc, dodLon: planets.mc, drawnLon: planets.mc, virtual: true });
    }

    // Anti-colisão: repulsão mútua (mesmo algoritmo do anel de planetas, seção 7).
    // Itens virtuais (seta do ASC/MC) não se movem — apenas empurram os demais.
    resolveCollisions(dodItems, 'drawnLon', 9);

    // Desenhar cada item
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const di of dodItems) {
      if (di.virtual) continue; // bloqueador de colisão do ASC/MC — não é desenhado
      const aExact = z2a(di.dodLon,  asc);   // posição dodecatemória exata (base da haste)
      const aDrawn = z2a(di.drawnLon, asc);   // ângulo deslocado (anti-colisão)
      const clr = (di.n === '_fortuna' || di.n === '_spirit') ? '#000000'
                : di.n === '_asc' ? '#CC0000'
                : dodecColor(di.dodLon);

      // Ordem radial (de dentro pra fora): planeta (perto da mandala) → signo → grau.
      // rPlanetDod tem 16px de folga do R_ZO (370) pra nunca invadir a faixa de signos da mandala;
      // rDegDod (mais externo) fica com folga da borda do canvas (860x860, raio máx. útil ~425).
      const rPlanetDod = 386, rSignDod = 406, rDegDod = 422;

      // Haste: borda externa do zodíaco → base do glifo do planeta
      const rHasteEnd = rPlanetDod - 13;
      ctx.beginPath();
      ctx.moveTo(px(R_ZO, aExact), py(R_ZO, aExact));
      ctx.lineTo(px(rHasteEnd, aDrawn), py(rHasteEnd, aDrawn));
      ctx.strokeStyle = clr + '99'; ctx.lineWidth = 0.8; ctx.stroke();

      // Glifo do planeta
      const gx = px(rPlanetDod, aDrawn), gy = py(rPlanetDod, aDrawn);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

      // Direção do deslocamento de signo/grau (a partir do planeta): puramente radial quando
      // o ponto está mais na vertical (topo/base do mapa); dobra para "reto pra cima/baixo"
      // quando está mais na horizontal (3h/9h) — é ali que o deslocamento radial puro faria o
      // texto sair pela lateral do canvas. A dobra sempre reforça o lado (cima ou baixo) em que
      // o ponto já está — nunca inverte —, senão puxaria o texto de volta pra perto da mandala.
      const bendFactor = Math.abs(Math.cos(aDrawn));
      const vSign = Math.sin(aDrawn) >= 0 ? 1 : -1;
      const dirX = (1 - bendFactor) * Math.cos(aDrawn);
      const dirY = (1 - bendFactor) * Math.sin(aDrawn) + bendFactor * vSign;
      const dirMag = Math.hypot(dirX, dirY) || 1;
      const ux = dirX / dirMag, uy = dirY / dirMag;
      const signX = gx + ux * (rSignDod - rPlanetDod), signY = gy + uy * (rSignDod - rPlanetDod);
      const degX  = gx + ux * (rDegDod  - rPlanetDod), degY  = gy + uy * (rDegDod  - rPlanetDod);

      if (di.n === '_spirit') {
        // Diamante do Espírito
        const fh = 10;
        ctx.beginPath(); ctx.moveTo(gx, gy-fh); ctx.lineTo(gx+fh, gy); ctx.lineTo(gx, gy+fh); ctx.lineTo(gx-fh, gy); ctx.closePath();
        ctx.strokeStyle = clr; ctx.lineWidth = 1.8; ctx.stroke();
      } else if (di.n === '_fortuna') {
        // Glifo da Fortuna (HamburgSymbols)
        ctx.font = '22px HamburgSymbols'; ctx.fillStyle = clr;
        ctx.fillText(String.fromCharCode(60), gx, gy);
      } else if (di.n === '_asc') {
        // Ascendente: "AC" em vermelho
        ctx.font = 'bold 13px Arial'; ctx.fillStyle = clr;
        ctx.fillText('AC', gx, gy);
      } else {
        ctx.font = `bold 26px "Noto Sans Symbols","Noto Sans Symbols2","Segoe UI Symbol","Apple Symbols",sans-serif`;
        ctx.fillStyle = clr;
        ctx.fillText(String.fromCodePoint(PL_U_DOD[di.n])+'\uFE0E', gx, gy);
      }

      // Signo dodeca (entre o glifo do planeta e o grau)
      const dodSignIdx = Math.floor((((di.dodLon % 360) + 360) % 360) / 30);
      ctx.font = GF(15, 'bold'); ctx.fillStyle = clr;
      ctx.fillText(String.fromCodePoint(SIGN_U[dodSignIdx]) + '\uFE0E', signX, signY);

      // Grau + minuto (elemento mais externo do trio)
      const dodInSign = ((di.dodLon % 30) + 30) % 30;
      const dodDeg = Math.floor(dodInSign);
      const dodMin = Math.round((dodInSign - dodDeg) * 60);
      ctx.font = `bold 13px Arial`; ctx.fillStyle = clr;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(dodDeg + '°' + String(dodMin).padStart(2,'0') + "'", degX, degY);
    }
  }


}

let lastPlanetsData = null; // compartilhado com aba Lotes
// ═══ 5. Formatação de inputs (data/hora/grau-minuto do ASC) ═════════════════
function qmFormatDate(input) {
  var raw = input.value.replace(/\D/g, '').slice(0, 8);
  if (raw.length > 4)      input.value = raw.slice(0,2) + '/' + raw.slice(2,4) + '/' + raw.slice(4);
  else if (raw.length > 2) input.value = raw.slice(0,2) + '/' + raw.slice(2);
  else                     input.value = raw;
}
function qmFormatTime(input) {
  var raw = input.value.replace(/\D/g, '').slice(0, 6);
  if (raw.length > 4)      input.value = raw.slice(0,2) + ':' + raw.slice(2,4) + ':' + raw.slice(4,6);
  else if (raw.length > 2) input.value = raw.slice(0,2) + ':' + raw.slice(2,4);
  else                     input.value = raw;
}
function applyBirthTimeFormat(el){
  var s=(el.value||'').replace(/\D/g,'');
  if(!s)return;
  var out=s.slice(0,2).padStart(2,'0');
  if(s.length>=4)out+=':'+s.slice(2,4).padStart(2,'0');
  if(s.length>=6)out+=':'+s.slice(4,6).padStart(2,'0');
  el.value=out;
}
function applyAscFormat(el){
  var s=(el.value||'').replace(/\D/g,'');
  if(!s)return;
  var out=s.slice(0,2).padStart(2,'0')+'°';
  if(s.length>=4)out+=s.slice(2,4).padStart(2,'0')+"'";
  if(s.length>=6)out+=s.slice(4,6).padStart(2,'0')+'"';
  el.value=out;
}
// Converte campo combinado: 2 dígitos=grau, 4=grau+min, 6=grau+min+seg
function parseAscDegMin(val) {
  const s = String(val || '').replace(/\D/g, '');
  const deg = parseInt(s.slice(0, 2) || '0', 10) || 0;
  const min = s.length >= 4 ? (parseInt(s.slice(2, 4), 10) || 0) : 0;
  const sec = s.length >= 6 ? (parseInt(s.slice(4, 6), 10) || 0) : 0;
  return { deg, min, sec };
}
function getAscDegMin() {
  return parseAscDegMin(getVal('ascDegMin'));
}
function setAscDegMin(deg, min) {
  const d = String(Math.max(0, Math.min(29, deg))).padStart(2, '0');
  const m = String(Math.max(0, Math.min(59, min))).padStart(2, '0');
  document.getElementById('ascDegMin').value = d + "°" + m + "'";
}
// ─── WASM ─────────────────────────────────────────────────────────────────────
let sweModule = null;

function setStatus(msg) {
  document.getElementById('wasm-status').textContent = msg;
}

// ═══ 6. Cálculo astronômico via swisseph (WASM) ═════════════════════════════
async function loadWasm() {
  if (sweModule) return sweModule;
  setStatus('Carregando Swiss Ephemeris WASM...');
  try {
    sweModule = await Swisseph();
    setStatus('');
    return sweModule;
  } catch(e) {
    setStatus('Erro ao carregar WASM: ' + e.message);
    throw e;
  }
}

async function calcChart(year, month, day, localHour, tzOffset, dst, lat, lon) {
  const swe = await loadWasm();

  // Converter para UTC
  let utcH = localHour - tzOffset - (dst ? 1 : 0);
  let d = day, m = month, y = year;
  if (utcH < 0)  { utcH += 24; d--; if (d < 1) { m--; if (m<1){m=12;y--;}; d = new Date(y,m,0).getDate(); } }
  if (utcH >= 24){ utcH -= 24; d++; if (d > new Date(y,m,0).getDate()){d=1;m++;if(m>12){m=1;y++;}} }

  // Julian Day
  const jd = swe._swe_julday(y, m, d, utcH, 1);

  const SEFLG_SWIEPH = 2;
  const SEFLG_SPEED = 256;
  const result = {};

  // Planetas
  const pids = {sol:0,lua:1,mer:2,ven:3,mar:4,jup:5,sat:6,ura:7,net:8,plu:9,nnode:10};
  for (const [name, id] of Object.entries(pids)) {
    const xxPtr  = swe._malloc(6*8);
    const errPtr = swe._malloc(256);
    swe._swe_calc_ut(jd, id, SEFLG_SWIEPH | SEFLG_SPEED, xxPtr, errPtr);
    result[name] = swe.HEAPF64[xxPtr >> 3];
    result[name+'Speed'] = swe.HEAPF64[(xxPtr >> 3) + 3]; // xx[3] = velocidade em longitude (°/dia); negativo = retrógrado
    swe._free(xxPtr);
    swe._free(errPtr);
  }
  result.snode = ((result.nnode + 180) % 360 + 360) % 360;

  // Casas iguais + ASC/MC
  const cusPtr  = swe._malloc(14*8);
  const ascPtr  = swe._malloc(10*8);
  swe._swe_houses(jd, lat, lon, 69, cusPtr, ascPtr); // 69 = 'E'.charCodeAt(0) para casas iguais
  result.asc = swe.HEAPF64[ascPtr >> 3];      // ascmc[0] = ASC
  result.mc  = swe.HEAPF64[(ascPtr >> 3) + 1]; // ascmc[1] = MC
  swe._free(cusPtr);
  swe._free(ascPtr);

  return result;
}

// Diferença angular normalizada entre -180 e +180 (evita erro de "virada" 359°→0°)
// ═══ 7. Ascendente por hora / busca de troca de signo do ASC ════════════════
function _angDiff(a, b) {
  return (((a - b) % 360) + 540) % 360 - 180;
}

// Longitude do ASC para uma hora local específica (reaproveita calcChart já existente)
async function _ascLongitudeAtHour(y, mo, d, tzOff, dst, lat, lon, hour) {
  const chart = await calcChart(y, mo, d, hour, tzOff, dst, lat, lon);
  return chart.asc;
}

// Acha, por busca binária, a hora local (0h-24h) em que o ASC cai exatamente no
// início (0°) do signo alvo, na data e local já preenchidos no formulário.
async function _findHoraInicioSigno(y, mo, d, tzOff, dst, lat, lon, targetLon) {
  const passos = 48; // varredura inicial a cada 30 min pra achar a faixa onde o ASC cruza o alvo
  let hPrev = 0, dPrev = _angDiff(await _ascLongitudeAtHour(y, mo, d, tzOff, dst, lat, lon, 0), targetLon);
  let loH = null, hiH = null;
  for (let i = 1; i <= passos; i++) {
    const h = i * 24 / passos;
    const dCur = _angDiff(await _ascLongitudeAtHour(y, mo, d, tzOff, dst, lat, lon, h), targetLon);
    if (dPrev < 0 && dCur >= 0) { loH = hPrev; hiH = h; break; }
    hPrev = h; dPrev = dCur;
  }
  if (loH === null) return null; // não achou cruzamento (caso raro/latitude extrema)

  for (let iter = 0; iter < 20; iter++) {
    const mid = (loH + hiH) / 2;
    const dMid = _angDiff(await _ascLongitudeAtHour(y, mo, d, tzOff, dst, lat, lon, mid), targetLon);
    if (dMid < 0) loH = mid; else hiH = mid;
  }
  return (loH + hiH) / 2;
}

// Disparado ao trocar o "Signo do ASC" manualmente: ajusta a Hora de Nascimento
// para o instante em que o Ascendente entra no início daquele signo, e recalcula o mapa.
async function ascSignChanged() {
  const sign = parseInt(getVal('ascSign'));
  const latVal = parseFloat(getVal('lat'));
  const lonVal = parseFloat(getVal('lon'));
  const birthDateISO = parseBirthDate(getVal('birthDate'));

  if (isNaN(latVal) || isNaN(lonVal) || !birthDateISO) {
    // Sem coordenadas ou sem data ainda: não dá pra calcular a hora do ASC real,
    // então só zera o grau do campo manual (comportamento mínimo, sem quebrar nada).
    setAscDegMin(0, 0);
    return;
  }

  const tzOff = parseFloat(getVal('tzOffset')) || 0;
  const dst = document.getElementById('dst').checked;
  const [y, mo, d] = birthDateISO.split('-').map(Number);
  const targetLon = sign * 30;

  setStatus('Ajustando hora para o início do signo...');
  const hora = await _findHoraInicioSigno(y, mo, d, tzOff, dst, latVal, lonVal, targetLon);
  setStatus('');

  if (hora === null) {
    setStatus('Não foi possível calcular a hora para esse signo nesta data/local.');
    return;
  }

  const hh = Math.floor(hora);
  const mmFloat = (hora - hh) * 60;
  const mm = Math.floor(mmFloat);
  const ss = Math.round((mmFloat - mm) * 60);
  document.getElementById('birthTime').value =
    String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');

  setAscDegMin(0, 0);
  calculateMapa();
}

// ─── TAB SYSTEM ──────────────────────────────────────────────────────────────
// ═══ 8. Navegação entre abas + cálculo principal do mapa natal ═════════════
function showTab(tab) {
  const tabs = ['mandala','lotes','profecao','firdaria','liberacao','direcoes','revolucao','decenais','antigenesis','transitos','geral'];
  tabs.forEach(t => {
    document.getElementById('tab-'+t).style.display = t===tab ? '' : 'none';
  });
  document.querySelectorAll('.tab-btn').forEach((btn,i) => {
    btn.classList.toggle('active', tabs[i] === tab);
  });
  document.getElementById('results').style.display = (tab==='firdaria'||tab==='profecao') ? '' : 'none';
  document.getElementById('mandala-container').style.display = tab==='mandala' ? '' : 'none';
  document.getElementById('lotes-container').style.display = tab==='lotes' ? '' : 'none';
  // profecao: começa com data vazia, sem auto-cálculo
  if (tab==='decenais') {
    const dateEl = document.getElementById('dec-target-date');
    if (!dateEl.value) {
      const hoje = new Date();
      dateEl.value = String(hoje.getDate()).padStart(2,'0')+'/'+String(hoje.getMonth()+1).padStart(2,'0')+'/'+hoje.getFullYear();
    }
  }
  if (tab==='geral') {
    const dateEl = document.getElementById('vg-target-date');
    if (!dateEl.value) {
      const hoje = new Date();
      dateEl.value = String(hoje.getDate()).padStart(2,'0')+'/'+String(hoje.getMonth()+1).padStart(2,'0')+'/'+hoje.getFullYear();
    }
  }
}

// ─── CALCULATE MAPA ───────────────────────────────────────────────────────────
async function calculateMapa() {
  await loadFont();

  const birthDateInput = parseBirthDate(getVal('birthDate')) || '';
  const birthTimeInput = getVal('birthTime') || '12:00';
  const ascSign   = parseInt(getVal('ascSign'));
  const { deg: ascDegree, min: ascMinute, sec: ascSecond } = getAscDegMin();
  const ascLon = ascSign*30 + ascDegree + ascMinute/60 + ascSecond/3600;

  const latVal  = parseFloat(getVal('lat'));
  const lonVal  = parseFloat(getVal('lon'));
  const tzOff   = parseFloat(getVal('tzOffset'))||0;
  const dst     = document.getElementById('dst').checked;

  let planets = null;
  let usedAsc = ascLon;

  if (birthDateInput && birthTimeInput) {
    try {
      const [hStr,mStr,sStr] = birthTimeInput.split(':');
      const localHour = parseInt(hStr) + parseInt(mStr)/60 + (parseInt(sStr)||0)/3600;
      const [y,mo,d] = birthDateInput.split('-').map(Number);
      setStatus('Calculando posições planetárias...');

      if (!isNaN(latVal) && !isNaN(lonVal)) {
        // Coordenadas fornecidas — calcular tudo incluindo ASC
        planets = await calcChart(y, mo, d, localHour, tzOff, dst, latVal, lonVal);
        usedAsc = planets.asc;
        const ascSignCalc = Math.floor(usedAsc/30);
        const ascDegCalc  = Math.floor(usedAsc%30);
        const ascMinCalc  = Math.round((usedAsc%30 - ascDegCalc)*60);
        document.getElementById('ascSign').value = ascSignCalc;
        setAscDegMin(ascDegCalc, ascMinCalc);
      } else {
        // Sem coordenadas — calcular planetas com ASC manual
        // Usa lat=0/lon=0 só para posições eclípticas; ASC vem do campo manual
        const tmpLat = 0, tmpLon = 0;
        let tmp;
        tmp = await calcChart(y, mo, d, localHour, tzOff, dst, tmpLat, tmpLon);
        // Preservar ASC manual, copiar planetas
        planets = {...tmp, asc: usedAsc};
      }
      setStatus('');
    } catch(e) {
      // Sem cálculo — usar só ASC manual e mostrar casas
      setStatus('WASM indisponível. Mostrando casas com ASC manual.');
    }
  }

  // Desenhar
  const canvas = document.getElementById('mandala-canvas');
  const meta = {
    nome: getVal('mapaNome') || '',
    dataStr: getVal('birthDate') || '',
    horaStr: getVal('birthTime') || '',
    lat: latVal, lon: lonVal, tz: tzOff
  };
  drawMandala(canvas, usedAsc, planets, meta);
  document.getElementById('mandala-container').style.display = '';
  lastPlanetsData = planets ? { planets, asc: usedAsc } : null;

  // Info texto
  const infoDiv = document.getElementById('mandala-info');
  if (planets) {
    const fmtLon = lon => {
      const s = Math.floor(((lon+3600)%360)/30);
      const g = Math.floor(((lon+3600)%360)%30);
      const m = Math.round((((lon+3600)%360)%30 - g)*60);
      return SIGN_NAMES[s]+' '+g+'°'+String(m).padStart(2,'0')+'\'';
    };
    // mesma fórmula de dodecaLon() usada no desenho da mandala (anel dodecatemoria)
    const dodLon = lon => {
      const l = norm360(lon);
      const s = Math.floor(l/30);
      return norm360(s*30 + (l-s*30)*12);
    };
    const mainList = [
      ['Sol',planets.sol],['Lua',planets.lua],['Mer',planets.mer,planets.merSpeed],
      ['Vên',planets.ven,planets.venSpeed],['Mar',planets.mar,planets.marSpeed],['Júp',planets.jup,planets.jupSpeed],
      ['Sat',planets.sat,planets.satSpeed],['Ura',planets.ura,planets.uraSpeed],['Net',planets.net,planets.netSpeed],
      ['Plu',planets.plu,planets.pluSpeed],['ASC',planets.asc],['MC',planets.mc],
    ];
    if (planets.sol !== undefined && planets.lua !== undefined) {
      const isDay = ((planets.sol - usedAsc) % 360 + 360) % 360 >= 180;
      const fortunaLon = isDay
        ? ((usedAsc + planets.lua - planets.sol) % 360 + 360) % 360
        : ((usedAsc + planets.sol - planets.lua) % 360 + 360) % 360;
      const spiritLon  = ((2*usedAsc - fortunaLon) % 360 + 720) % 360;
      mainList.push(['Fortuna', fortunaLon], ['Espírito', spiritLon]);
    }
    const rowSpan = ([n,l,sp])=>'<span style="display:inline-block;min-width:140px;margin-right:12px"><strong>'+n+':</strong> '+fmtLon(l)+(sp<0?' R':'')+'</span>';
    const rows = mainList.map(rowSpan).join('');
    // Dodecatemoria: mesmos itens (exceto MC, que não entra no anel dodeca)
    const dodRows = mainList.filter(([n])=>n!=='MC').map(([n,l])=>rowSpan([n, dodLon(l)])).join('');
    infoDiv.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:4px;font-size:12px">'+rows+'</div>'
      + '<div style="margin-top:10px;margin-bottom:2px;font-weight:700;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#888">Dodecatemoria</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:4px;font-size:12px">'+dodRows+'</div>';
  } else {
    infoDiv.innerHTML = '<em style="color:#888">ASC: '+SIGN_NAMES[Math.floor(usedAsc/30)]+' '+Math.floor(usedAsc%30)+'°'+String(Math.round((usedAsc%30-Math.floor(usedAsc%30))*60)).padStart(2,'0')+'\'</em>';
  }
}

// ─── V4 FIRDARIA (inalterado) ─────────────────────────────────────────────────
let chartType = 'auto';
let yearDays  = 360;

const firdariaDay = [
  {planeta:'☉ Sol',anos:10,subs:[{sub:'☉',anos:0,dias:0},{sub:'♀',anos:1,dias:156},{sub:'☿',anos:2,dias:313},{sub:'☽',anos:4,dias:104},{sub:'♄',anos:5,dias:261},{sub:'♃',anos:7,dias:52},{sub:'♂',anos:8,dias:209}]},
  {planeta:'♀ Vênus',anos:8,subs:[{sub:'♀',anos:10,dias:0},{sub:'☿',anos:11,dias:52},{sub:'☽',anos:12,dias:104},{sub:'♄',anos:13,dias:156},{sub:'♃',anos:14,dias:208},{sub:'♂',anos:15,dias:261},{sub:'☉',anos:16,dias:313}]},
  {planeta:'☿ Mercúrio',anos:13,subs:[{sub:'☿',anos:18,dias:0},{sub:'☽',anos:19,dias:313},{sub:'♄',anos:21,dias:261},{sub:'♃',anos:23,dias:209},{sub:'♂',anos:25,dias:156},{sub:'☉',anos:27,dias:104},{sub:'♀',anos:29,dias:52}]},
  {planeta:'☽ Lua',anos:9,subs:[{sub:'☽',anos:31,dias:0},{sub:'♄',anos:32,dias:104},{sub:'♃',anos:33,dias:208},{sub:'♂',anos:34,dias:312},{sub:'☉',anos:36,dias:52},{sub:'♀',anos:37,dias:156},{sub:'☿',anos:38,dias:261}]},
  {planeta:'♄ Saturno',anos:11,subs:[{sub:'♄',anos:40,dias:0},{sub:'♃',anos:41,dias:209},{sub:'♂',anos:43,dias:52},{sub:'☉',anos:44,dias:261},{sub:'♀',anos:46,dias:104},{sub:'☿',anos:47,dias:313},{sub:'☽',anos:49,dias:156}]},
  {planeta:'♃ Júpiter',anos:12,subs:[{sub:'♃',anos:51,dias:0},{sub:'♂',anos:52,dias:260},{sub:'☉',anos:54,dias:156},{sub:'♀',anos:56,dias:52},{sub:'☿',anos:57,dias:312},{sub:'☽',anos:59,dias:208},{sub:'♄',anos:61,dias:105}]},
  {planeta:'♂ Marte',anos:7,subs:[{sub:'♂',anos:63,dias:0},{sub:'☉',anos:64,dias:0},{sub:'♀',anos:65,dias:0},{sub:'☿',anos:66,dias:0},{sub:'☽',anos:67,dias:0},{sub:'♄',anos:68,dias:0},{sub:'♃',anos:69,dias:0}]},
  {planeta:'☊ Nodo Norte',anos:3,subs:[]},
  {planeta:'☋ Nodo Sul',anos:2,subs:[]}
];

const firdariaNight = [
  {planeta:'☽ Lua',anos:9,subs:[{sub:'☽',anos:0,dias:0},{sub:'♄',anos:1,dias:104},{sub:'♃',anos:2,dias:208},{sub:'♂',anos:3,dias:312},{sub:'☉',anos:5,dias:52},{sub:'♀',anos:6,dias:156},{sub:'☿',anos:7,dias:261}]},
  {planeta:'♄ Saturno',anos:11,subs:[{sub:'♄',anos:9,dias:0},{sub:'♃',anos:10,dias:209},{sub:'♂',anos:12,dias:52},{sub:'☉',anos:13,dias:261},{sub:'♀',anos:15,dias:104},{sub:'☿',anos:16,dias:313},{sub:'☽',anos:18,dias:156}]},
  {planeta:'♃ Júpiter',anos:12,subs:[{sub:'♃',anos:20,dias:0},{sub:'♂',anos:21,dias:260},{sub:'☉',anos:23,dias:156},{sub:'♀',anos:25,dias:52},{sub:'☿',anos:26,dias:312},{sub:'☽',anos:28,dias:208},{sub:'♄',anos:30,dias:105}]},
  {planeta:'♂ Marte',anos:7,subs:[{sub:'♂',anos:32,dias:0},{sub:'☉',anos:33,dias:0},{sub:'♀',anos:34,dias:0},{sub:'☿',anos:35,dias:0},{sub:'☽',anos:36,dias:0},{sub:'♄',anos:37,dias:0},{sub:'♃',anos:38,dias:0}]},
  {planeta:'☉ Sol',anos:10,subs:[{sub:'☉',anos:39,dias:0},{sub:'♀',anos:40,dias:156},{sub:'☿',anos:41,dias:313},{sub:'☽',anos:43,dias:104},{sub:'♄',anos:44,dias:261},{sub:'♃',anos:46,dias:52},{sub:'♂',anos:47,dias:209}]},
  {planeta:'♀ Vênus',anos:8,subs:[{sub:'♀',anos:49,dias:0},{sub:'☿',anos:50,dias:52},{sub:'☽',anos:51,dias:104},{sub:'♄',anos:52,dias:156},{sub:'♃',anos:53,dias:208},{sub:'♂',anos:54,dias:261},{sub:'☉',anos:55,dias:313}]},
  {planeta:'☿ Mercúrio',anos:13,subs:[{sub:'☿',anos:57,dias:0},{sub:'☽',anos:58,dias:313},{sub:'♄',anos:60,dias:261},{sub:'♃',anos:62,dias:209},{sub:'♂',anos:64,dias:156},{sub:'☉',anos:66,dias:104},{sub:'♀',anos:68,dias:52}]},
  {planeta:'☊ Nodo Norte',anos:3,subs:[]},
  {planeta:'☋ Nodo Sul',anos:2,subs:[]}
];

function setChartType(type) {
  chartType = type;
  document.querySelector('.btn-day').classList.toggle('active',type==='day');
  document.querySelector('.btn-night').classList.toggle('active',type==='night');
  document.querySelector('.btn-auto').classList.toggle('active',type==='auto');
  const lbl = document.getElementById('fird-auto-label');
  if (lbl && type !== 'auto') lbl.textContent = '';
}
// ═══ 9. Utilidades de data + termos egípcios ════════════════════════════════
function addYearsAndDays(date, anos, dias) {
  const nd = new Date(date);
  const totalDays = Math.round((anos+dias/365.25)*360);
  nd.setDate(nd.getDate()+totalDays);
  return nd;
}
function formatDate(date) { return date.toLocaleDateString('pt-BR'); }

function getInputs() {
  const birthDateInput = parseBirthDate(getVal('birthDate')) || '';
  const birthTimeInput = getVal('birthTime');
  const ascSign   = parseInt(getVal('ascSign'));
  const { deg: ascDegree, min: ascMinute, sec: ascSecond } = getAscDegMin();
  const ascLon = ascSign*30 + ascDegree + ascMinute/60.0 + ascSecond/3600;
  const birthDate = birthTimeInput
    ? new Date(birthDateInput+'T'+birthTimeInput)
    : new Date(birthDateInput+'T12:00:00');
  return {birthDateInput,birthDate,ascLon};
}

function getEgyptianTerm(signIdx, degreeInSign) {
  const terms = EGYPTIAN_TERMS[signIdx];
  for (const [pl,end] of terms) if (degreeInSign<end) return TERM_PLANETS[pl];
  return TERM_PLANETS[6];
}

// ═══ 10. Aba PROFECÇÃO ANUAL ═════════════════════════════════════════════════
function getProfectionDetails(dataAlvo, ascLon) {
  const {birthDate} = getInputs();
  let diffDias = (dataAlvo.getTime()-birthDate.getTime())/(1000*60*60*24);
  if (diffDias<0) diffDias=0;
  const prof_advance = diffDias*(30.0/yearDays);
  const prof_asc_lon = (ascLon+prof_advance)%360;
  let prof_sign = Math.floor(prof_asc_lon/30);
  const asc_sign_idx = Math.floor(ascLon/30);
  const prof_house = ((prof_sign-asc_sign_idx+12)%12)+1;
  const grauRaw = prof_asc_lon%30;
  let grau = Math.floor(grauRaw);
  let min  = Math.round((grauRaw-grau)*60);
  if (min===60){grau++;min=0;}
  if (grau===30){grau=0;prof_sign=(prof_sign+1)%12;}
  return {casa:prof_house,signoNome:SIGN_NAMES[prof_sign],grau,minuto:String(min).padStart(2,'0'),termo:getEgyptianTerm(prof_sign,grauRaw)};
}

// ── Helpers do painel completo de profecção ─────────────────────────────────
function profDodecatemorion(lon, ascSignIdx) {
  lon = ((lon % 360) + 360) % 360;
  const s = Math.floor(lon / 30);
  const d = lon - s * 30;
  let dl = (s * 30 + d * 12) % 360; if (dl < 0) dl += 360;
  const ds = Math.floor(dl / 30);
  const dr = dl - ds * 30;
  let deg = Math.floor(dr);
  let min = Math.round((dr - deg) * 60);
  if (min === 60) { deg++; min = 0; }
  return { sign: SIGN_NAMES[ds], deg, min, house: ((ds - ascSignIdx + 12) % 12) + 1 };
}
function profLonOf(lon0, adv) { return ((lon0 + adv) % 360 + 360) % 360; }
function profDegMin(lonInSign) {
  let g = Math.floor(lonInSign), m = Math.round((lonInSign - g) * 60);
  if (m === 60) { g++; m = 0; }
  return { g, m };
}
function addDaysFrac(date, days) { return new Date(date.getTime() + days * 86400000); }

// Planetas natais (Sol..Saturno) a partir dos dados de nascimento, sem depender de ter calculado a mandala
async function getNatalPlanetsForProf() {
  const birthDateInput = parseBirthDate(getVal('birthDate')) || '';
  const birthTimeInput = getVal('birthTime') || '12:00';
  const [y, mo, d] = birthDateInput.split('-').map(Number);
  const [hStr, mStr, sStr] = birthTimeInput.split(':');
  const localHour = parseInt(hStr) + (parseInt(mStr) || 0) / 60 + (parseInt(sStr) || 0) / 3600;
  const tzOff = parseFloat(getVal('tzOffset')) || 0;
  const dst = document.getElementById('dst').checked;
  const pl = await calcChart(y, mo, d, localHour, tzOff, dst, 0, 0);
  return [pl.sol, pl.lua, pl.mer, pl.ven, pl.mar, pl.jup, pl.sat];
}
// Planetas em trânsito "agora" (Sol..Saturno)
async function getTransitPlanetsNow() {
  const now = new Date();
  const pl = await calcChart(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(),
    now.getUTCHours() + now.getUTCMinutes() / 60, 0, false, 0, 0);
  return [pl.sol, pl.lua, pl.mer, pl.ven, pl.mar, pl.jup, pl.sat];
}

// Calcula o painel completo de profecção anual (casa/signo, senhor, exaltação, grupos A/B,
// mês operativo, dodecatemoria das profectadas e trânsito atual com suas dodecatemorias)
async function computeProfecaoCompleta(dataAlvo, ascLon) {
  const { birthDate } = getInputs();
  let diffDias = (dataAlvo.getTime() - birthDate.getTime()) / 86400000;
  if (diffDias < 0) diffDias = 0;
  const advance = diffDias * (30.0 / yearDays);
  const age = Math.floor(diffDias / yearDays);
  const ascSignIdx = Math.floor(ascLon / 30);

  const natLon = await getNatalPlanetsForProf();       // [sol,lua,mer,ven,mar,jup,sat]
  const trLon  = await getTransitPlanetsNow();

  const profAscLon = profLonOf(((ascLon % 360) + 360) % 360, advance);
  let profSign = Math.floor(profAscLon / 30);
  const { g: grau0, m: min0 } = profDegMin(profAscLon - profSign * 30);
  let grau = grau0, min = min0;
  if (grau === 30) { grau = 0; profSign = (profSign + 1) % 12; }
  const casa = ((profSign - ascSignIdx + 12) % 12) + 1;

  const lordIdx = PROF_RULER_IDX[profSign];
  const lordName = PROF_SIGN_RULERS[profSign];
  const lordProfLon = profLonOf(natLon[lordIdx], advance);
  const lordSign = Math.floor(lordProfLon / 30);
  const { g: lordGrau, m: lordMin } = profDegMin(lordProfLon - lordSign * 30);
  const lordHouse = ((lordSign - ascSignIdx + 12) % 12) + 1;

  let exalt = null;
  const ei = PROF_EXALT_IDX[profSign];
  if (ei !== undefined && ei !== lordIdx) {
    const exaltProfLon = profLonOf(natLon[ei], advance);
    const exaltSign = Math.floor(exaltProfLon / 30);
    const { g: exG, m: exM } = profDegMin(exaltProfLon - exaltSign * 30);
    exalt = {
      nome: TERM_PLANETS[ei], sym: PROF_PLANET_SYMS[ei], grau: exG, min: exM,
      house: ((exaltSign - ascSignIdx + 12) % 12) + 1, profSign: SIGN_NAMES[exaltSign],
      dodecaProf: profDodecatemorion(exaltProfLon, ascSignIdx), transitLon: trLon[ei]
    };
  }

  // Grupo A: planetas natais no signo profectado (exceto senhor e exaltação)
  const shown = [lordIdx]; if (ei !== undefined) shown.push(ei);
  const inSignIdx = [];
  const planetsInSign = [];
  for (let pi = 0; pi <= 6; pi++) {
    if (shown.includes(pi)) continue;
    const natSign = Math.floor((((natLon[pi] % 360) + 360) % 360) / 30);
    if (natSign !== profSign) continue;
    inSignIdx.push(pi);
    const pLon = profLonOf(natLon[pi], advance);
    const ps = Math.floor(pLon / 30);
    const { g: pg, m: pm } = profDegMin(pLon - ps * 30);
    planetsInSign.push({ pi, sym: PROF_PLANET_SYMS[pi], nome: TERM_PLANETS[pi], profLon: pLon,
      profSign: SIGN_NAMES[ps], grau: pg, min: pm, house: ((ps - ascSignIdx + 12) % 12) + 1 });
  }

  // Grupo B: planetas natais em aspecto ao senhor do domicílio
  const excl = shown.concat(inSignIdx);
  const lordNat = ((natLon[lordIdx] % 360) + 360) % 360;
  const planetsAspLord = [];
  for (let pi = 0; pi <= 6; pi++) {
    if (excl.includes(pi)) continue;
    const nat = ((natLon[pi] % 360) + 360) % 360;
    let diff = Math.abs(nat - lordNat) % 360; if (diff > 180) diff = 360 - diff;
    let matched = null;
    for (const ad of [0, 60, 90, 120, 180]) { if (Math.abs(diff - ad) <= PROF_ASP_ORBS[ad]) { matched = ad; break; } }
    if (matched === null) continue;
    const pLon = profLonOf(natLon[pi], advance);
    const ps = Math.floor(pLon / 30);
    const { g: pg, m: pm } = profDegMin(pLon - ps * 30);
    planetsAspLord.push({ pi, sym: PROF_PLANET_SYMS[pi], nome: TERM_PLANETS[pi], aspecto: PROF_ASP_NAMES[matched],
      profLon: pLon, profSign: SIGN_NAMES[ps], grau: pg, min: pm, house: ((ps - ascSignIdx + 12) % 12) + 1 });
  }

  // Trânsito + dodecatemoria de trânsito para senhor, exaltação e grupos A/B
  function transitOf(pi) {
    const tl = trLon[pi];
    const ts = Math.floor(tl / 30);
    return { grau: Math.floor(tl - ts * 30), sign: SIGN_NAMES[ts], dodecaTransit: profDodecatemorion(tl, ascSignIdx) };
  }
  const transitLord = Object.assign({ nome: lordName, sym: PROF_PLANET_SYMS[lordIdx] }, transitOf(lordIdx));
  const transitExalt = exalt ? Object.assign({ nome: exalt.nome, sym: exalt.sym }, transitOf(ei)) : null;
  planetsInSign.forEach(pl => { pl.dodecaProf = profDodecatemorion(pl.profLon, ascSignIdx); Object.assign(pl, { transit: transitOf(pl.pi) }); });
  planetsAspLord.forEach(pl => { pl.dodecaProf = profDodecatemorion(pl.profLon, ascSignIdx); Object.assign(pl, { transit: transitOf(pl.pi) }); });

  // Mês operativo
  let mes;
  const targetJdDays = dataAlvo;
  if (yearDays === 360) {
    const diasEmAno = ((diffDias % 360) + 360) % 360;
    const monthOffset = Math.floor(diasEmAno / 30);
    const monthNum = monthOffset + 1;
    const monthSign = (profSign + monthOffset) % 12;
    const yearStart = addDaysFrac(birthDate, age * 360);
    const monthStart = addDaysFrac(yearStart, monthOffset * 30);
    const monthEnd = addDaysFrac(yearStart, monthOffset * 30 + 30);
    const monthLordI = PROF_RULER_IDX[monthSign];
    mes = { num: monthNum, signo: SIGN_NAMES[monthSign], senhor: PROF_SIGN_RULERS[monthSign],
      senhorSym: PROF_PLANET_SYMS[monthLordI], inicio: formatDate(monthStart), fim: formatDate(monthEnd) };
    var anoInicio = yearStart, anoFim = addDaysFrac(yearStart, 360);
  } else {
    const sunNat = ((natLon[0] % 360) + 360) % 360, moonNat = ((natLon[1] % 360) + 360) % 360;
    const isDay = (((sunNat - ascLon) % 360 + 360) % 360) > 180;
    const lumTr = isDay ? trLon[0] : trLon[1];
    const lumNat = isDay ? sunNat : moonNat;
    const distLum = ((lumTr - lumNat) % 360 + 360) % 360;
    const monthNum = Math.floor(distLum / 30) + 1;
    const monthSign = Math.floor((((profSign * 30 + distLum) % 360) + 360) % 360 / 30);
    const vDegDay = isDay ? (360 / 365.256) : (360 / 27.3216);
    const degInMonth = distLum % 30;
    const monthStart = addDaysFrac(targetJdDays, -(degInMonth / vDegDay));
    const monthEnd = addDaysFrac(targetJdDays, (30 - degInMonth) / vDegDay);
    const monthLordI = PROF_RULER_IDX[monthSign];
    mes = { num: monthNum, signo: SIGN_NAMES[monthSign], senhor: PROF_SIGN_RULERS[monthSign],
      senhorSym: PROF_PLANET_SYMS[monthLordI], inicio: formatDate(monthStart), fim: formatDate(monthEnd) };
    var anoInicio2 = addDaysFrac(birthDate, age * 365.25);
    anoInicio = anoInicio2; anoFim = addDaysFrac(anoInicio2, 365.25);
  }

  // Dodecatemoria das profectadas (Vênus + Lua sempre) e trânsito atual (Vênus + Lua sempre)
  const venusProfLon = profLonOf(natLon[3], advance), moonProfLon = profLonOf(natLon[1], advance);
  const dodecaProf = [
    { sym: '♀', nome: 'Vênus', dodeca: profDodecatemorion(venusProfLon, ascSignIdx) },
    { sym: '☽', nome: 'Lua', dodeca: profDodecatemorion(moonProfLon, ascSignIdx) },
  ];
  const transitVenusMoon = [3, 1].map(pi => {
    const t = transitOf(pi);
    return { sym: PROF_PLANET_SYMS[pi], nome: TERM_PLANETS[pi], grau: t.grau, sign: t.sign };
  });
  const dodecaTransit = [3, 1].map(pi => ({ sym: PROF_PLANET_SYMS[pi], nome: TERM_PLANETS[pi], dodeca: transitOf(pi).dodecaTransit }));

  return {
    casa, signoNome: SIGN_NAMES[profSign], grau, min, age,
    ano: { inicio: formatDate(anoInicio), fim: formatDate(anoFim) },
    senhor: lordName, senhorSym: PROF_PLANET_SYMS[lordIdx], senhorGrau: lordGrau, senhorMin: lordMin,
    senhorProfSign: SIGN_NAMES[lordSign], lordHouse, lordDodecaProf: profDodecatemorion(lordProfLon, ascSignIdx),
    exalt, planetsInSign, planetsAspLord, mes,
    dodecaProf, transitVenusMoon, dodecaTransit, transitLord, transitExalt,
  };
}

// Monta o HTML do painel completo a partir do resultado de computeProfecaoCompleta
function renderProfecaoPanel(p) {
  const pad2 = n => String(n).padStart(2, '0');
  const linha = (sym, nome, grau, min, sign, house, extra) =>
    '<div style="font-size:13px;color:#333;margin-top:2px">' + grau + 'º' + pad2(min) + "' " + sign + ' '
    + sym + ' ' + nome + ' (' + house + ')' + (extra || '') + '</div>';

  let html = '<div class="card">';
  html += '<h2 style="text-align:center;color:var(--color-brand-day);margin-bottom:6px">Profecção — ' + (p._profPointName || 'Ascendente') + '</h2>';
  html += '<p style="text-align:center;color:#777;margin-bottom:10px">Anos ' + p.age + ' &nbsp;·&nbsp; ' + p.ano.inicio + ' — ' + p.ano.fim + '</p>';
  html += '<p style="text-align:center;font-size:16px;margin-bottom:4px"><span class="casa-badge">Casa ' + p.casa + '</span></p>';
  html += '<p style="text-align:center;color:#555;margin-bottom:12px">' + p.signoNome + ' ' + p.grau + 'º' + pad2(p.min) + "'</p>";

  html += '<div style="max-width:480px;margin:0 auto">';

  // Profectados: senhor + exaltação (mesma linha) + grupos A/B
  html += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;color:#888;margin-bottom:3px">Profectados</div>';
  html += '<div style="font-size:13px;color:#333;margin-bottom:2px">' + p.senhorGrau + 'º' + pad2(p.senhorMin) + "' " + p.senhorProfSign + ' '
    + p.senhorSym + ' ' + p.senhor + ' (' + p.lordHouse + ')';
  if (p.exalt) {
    html += ' &nbsp;·&nbsp; ' + p.exalt.grau + 'º' + pad2(p.exalt.min) + "' " + p.exalt.profSign + ' '
      + p.exalt.sym + ' ' + p.exalt.nome + ' (' + p.exalt.house + ')';
  }
  html += '</div>';
  p.planetsInSign.forEach(pl => { html += linha(pl.sym, pl.nome, pl.grau, pl.min, pl.profSign, pl.house); });
  p.planetsAspLord.forEach(pl => {
    const asp = ' <span style="font-size:10px;color:#999">' + pl.aspecto + '</span>';
    html += linha(pl.sym, pl.nome, pl.grau, pl.min, pl.profSign, pl.house, asp);
  });

  // Mês operativo
  html += '<div style="margin-top:8px;padding-top:8px;border-top:1px dotted var(--color-divider)">';
  html += '<span style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;color:var(--color-brand-day)">Mês ' + p.mes.num + '</span> '
    + p.mes.signo + ' ' + p.mes.senhorSym + ' ' + p.mes.senhor
    + ' &nbsp;<span style="color:#888">' + p.mes.inicio + ' — ' + p.mes.fim + '</span></div>';

  // Seções de dodecatemoria/trânsito, com dedupe de nomes (mesma lógica do site de referência)
  function secaoDodeca(titulo, base, extras) {
    const covered = {}; base.forEach(d => covered[d.nome] = true);
    let body = base.map(d => '<div style="font-size:13px;color:#333;margin-top:2px">' + d.sym + ' ' + d.nome + ' &nbsp;'
      + d.dodeca.sign + ' ' + d.dodeca.deg + 'º' + pad2(d.dodeca.min) + "' C" + d.dodeca.house + '</div>').join('');
    extras.forEach(e => {
      if (!e || covered[e.nome]) return; covered[e.nome] = true;
      body += '<div style="font-size:13px;color:#333;margin-top:2px">' + e.sym + ' ' + e.nome + ' &nbsp;'
        + e.dodeca.sign + ' ' + e.dodeca.deg + 'º' + pad2(e.dodeca.min) + "' C" + e.dodeca.house + '</div>';
    });
    return '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--color-divider)">'
      + '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;color:#888;margin-bottom:3px">' + titulo + '</div>' + body + '</div>';
  }
  function secaoTransito(titulo, base, extras) {
    const covered = {}; base.forEach(t => covered[t.nome] = true);
    let body = base.map(t => '<div style="font-size:13px;color:#333;margin-top:2px">' + t.sym + ' ' + t.nome + ' &nbsp;' + t.grau + '° ' + t.sign + '</div>').join('');
    extras.forEach(e => {
      if (!e || covered[e.nome]) return; covered[e.nome] = true;
      body += '<div style="font-size:13px;color:#333;margin-top:2px">' + e.sym + ' ' + e.nome + ' &nbsp;' + e.grau + '° ' + e.sign
        + (e.aspecto ? ' <span style="font-size:10px;color:#999">' + e.aspecto + '</span>' : '') + '</div>';
    });
    return '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--color-divider)">'
      + '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;color:#888;margin-bottom:3px">' + titulo + '</div>' + body + '</div>';
  }

  const dodecaExtras = [
    { nome: p.senhor, sym: p.senhorSym, dodeca: p.lordDodecaProf },
    p.exalt ? { nome: p.exalt.nome, sym: p.exalt.sym, dodeca: p.exalt.dodecaProf } : null,
    ...p.planetsInSign.map(pl => ({ nome: pl.nome, sym: pl.sym, dodeca: pl.dodecaProf })),
    ...p.planetsAspLord.map(pl => ({ nome: pl.nome, sym: pl.sym, dodeca: pl.dodecaProf })),
  ];
  html += secaoDodeca('Dodeca das profectadas', p.dodecaProf, dodecaExtras);

  const transitExtras = [
    { nome: p.transitLord.nome, sym: p.transitLord.sym, grau: p.transitLord.grau, sign: p.transitLord.sign },
    p.exalt ? { nome: p.transitExalt.nome, sym: p.transitExalt.sym, grau: p.transitExalt.grau, sign: p.transitExalt.sign } : null,
    ...p.planetsInSign.map(pl => ({ nome: pl.nome, sym: pl.sym, grau: pl.transit.grau, sign: pl.transit.sign })),
    ...p.planetsAspLord.map(pl => ({ nome: pl.nome, sym: pl.sym, grau: pl.transit.grau, sign: pl.transit.sign, aspecto: pl.aspecto })),
  ];
  html += secaoTransito('Trânsito atual', p.transitVenusMoon, transitExtras);

  const dodecaTrExtras = [
    { nome: p.transitLord.nome, sym: p.transitLord.sym, dodeca: p.transitLord.dodecaTransit },
    p.exalt ? { nome: p.transitExalt.nome, sym: p.transitExalt.sym, dodeca: p.transitExalt.dodecaTransit } : null,
    ...p.planetsInSign.map(pl => ({ nome: pl.nome, sym: pl.sym, dodeca: pl.transit.dodecaTransit })),
    ...p.planetsAspLord.map(pl => ({ nome: pl.nome, sym: pl.sym, dodeca: pl.transit.dodecaTransit })),
  ];
  html += secaoDodeca('Dodeca do trânsito atual', p.dodecaTransit, dodecaTrExtras);

  html += '</div></div>';
  return html;
}

function calculate() {
  const {birthDateInput,birthDate,ascLon} = getInputs();
  if (!birthDateInput){alert('Insira a data de nascimento');return;}
  // Auto-detectar dia/noite a partir do mapa natal calculado
  let effectiveType = chartType;
  if (chartType === 'auto') {
    if (lastPlanetsData) {
      const sol = lastPlanetsData.planets.sol;
      const asc = lastPlanetsData.asc;
      const dsc = (asc + 180) % 360;
      let isDay;
      if (asc < dsc) {
        isDay = (sol >= dsc || sol < asc);
      } else {
        isDay = (sol >= dsc && sol < asc);
      }
      effectiveType = isDay ? 'day' : 'night';
      document.querySelector('.btn-day').classList.toggle('active', isDay);
      document.querySelector('.btn-night').classList.toggle('active', !isDay);
      document.querySelector('.btn-auto').classList.toggle('active', true);
      const lbl = document.getElementById('fird-auto-label');
      if (lbl) lbl.textContent = '(auto: ' + (isDay ? 'diurno' : 'noturno') + ')';
    } else {
      effectiveType = 'day'; // fallback sem mapa
    }
  }
  const baseSequence = effectiveType==='day' ? firdariaDay : firdariaNight;
  const sequence = [...baseSequence];
  let offset=75;
  while(offset<120){
    baseSequence.forEach(p=>{
      sequence.push({planeta:p.planeta,anos:p.anos,
        subs:p.subs.map(s=>({sub:s.sub,anos:s.anos+offset,dias:s.dias}))});
    });
    offset+=75;
  }
  let html='<div class="card"><h2 style="text-align:center;color:var(--color-brand-day);margin-bottom:20px">Sequência '+(effectiveType==='day'?'Diurna':'Noturna')+'</h2>';
  sequence.forEach((periodo,periodoIndex)=>{
    html+='<div class="periodo-card">';
    html+='<div class="periodo-title"><span class="symbol">'+periodo.planeta+'</span> ('+periodo.anos+' anos)</div>';
    if(periodo.subs.length>0){
      periodo.subs.forEach((sub,idx)=>{
        const dInicio=addYearsAndDays(birthDate,sub.anos,sub.dias);
        let dFim;
        if(idx<periodo.subs.length-1){const ps=periodo.subs[idx+1];dFim=addYearsAndDays(birthDate,ps.anos,ps.dias);}
        else{const pp=sequence[periodoIndex+1];if(pp&&pp.subs.length>0)dFim=addYearsAndDays(birthDate,pp.subs[0].anos,pp.subs[0].dias);else dFim=addYearsAndDays(dInicio,periodo.anos/7.0,0);}
        const pI=getProfectionDetails(dInicio,ascLon);
        const pF=getProfectionDetails(dFim,ascLon);
        html+='<div class="subperiodo" style="display:flex;flex-wrap:wrap;width:100%">';
        html+='<div style="display:flex;width:100%;justify-content:space-between;align-items:center">';
        html+='<span class="sub-name"><span class="symbol">'+sub.sub+'</span></span>';
        html+='<span class="sub-dates" style="font-weight:bold">'+formatDate(dInicio)+' - '+formatDate(dFim)+'</span>';
        html+='</div>';
        html+='<div style="display:flex;width:100%;justify-content:space-between;margin-top:8px;padding:6px;background:#f8f9fa;border-radius:6px;border:1px solid var(--color-divider)">';
        html+='<span class="casa-profecao"><strong style="color:var(--color-brand-day)">Profecção:</strong><br>Início: Casa '+pI.casa+' — '+pI.signoNome+' '+pI.grau+'°'+pI.minuto+"'<br>Fim: Casa '"+pF.casa+' — '+pF.signoNome+' '+pF.grau+'°'+pF.minuto+"'</span>";
        html+='<span class="circumanbulacao"><strong style="color:#0366d6">Direção Primária (Termos):</strong><br>'+formatDate(dInicio)+' ➔ Termo de '+pI.termo+'<br>'+formatDate(dFim)+' ➔ Termo de '+pF.termo+'</span>';
        html+='</div>';
        html+='<details style="margin-top:10px;font-size:12.5px"><summary style="cursor:pointer;color:#0366d6;font-weight:600;padding:2px 0;user-select:none">Micro-Firdaria (Divisão em 7)</summary>';
        html+='<div style="margin-top:6px;padding:6px 10px;border-left:3px solid var(--color-divider);background:#fbfbfc;border-radius:0 4px 4px 0;color:#333">';
        const caldeanOrder=['♄','♃','♂','☉','♀','☿','☽'];
        const caldeanNames=['Saturno','Júpiter','Marte','Sol','Vênus','Mercúrio','Lua'];
        let subStartIdx=caldeanOrder.indexOf(sub.sub); if(subStartIdx===-1)subStartIdx=0;
        const diffMs=dFim.getTime()-dInicio.getTime(); const subSubMs=diffMs/7.0;
        for(let j=0;j<7;j++){
          const ssP=caldeanNames[(subStartIdx+j)%7];
          const di=new Date(dInicio.getTime()+j*subSubMs);
          const df=new Date(dInicio.getTime()+(j+1)*subSubMs-86400000);
          html+='<div style="display:flex;justify-content:space-between;margin-bottom:4px;padding-bottom:3px;border-bottom:1px dashed #e5e5e5">';
          html+='<span style="font-weight:500">'+(j+1)+'. '+ssP+'</span>';
          html+='<span style="color:#666">'+formatDate(di)+' a '+formatDate(df)+'</span></div>';
        }
        html+='</div></details></div>';
      });
    } else {
      let cum=0;
      for(let k=0;k<periodoIndex;k++) cum+=sequence[k].anos;
      const dI=addYearsAndDays(birthDate,cum,0);
      const dF=addYearsAndDays(birthDate,cum+periodo.anos,0);
      html+='<div class="subperiodo"><span class="sub-dates" style="width:100%;text-align:center">'+formatDate(dI)+' - '+formatDate(dF)+'</span></div>';
    }
    html+='</div>';
  });
  html+='</div>';
  document.getElementById('results').innerHTML=html;
}

async function calculateProfecao() {
  const {birthDateInput,birthDate,ascLon}=getInputs();
  if(!birthDateInput){alert('Insira a data de nascimento');return;}

  // Resolver longitude do ponto profectado
  const pointSel = getVal('prof-point-sel');
  let profLonBase = ascLon;
  const profPointName = POINT_LABELS[pointSel] || 'Ascendente';

  if (pointSel !== 'asc') {
    if (!lastPlanetsData) {
      document.getElementById('results').innerHTML = '<div class="card"><p style="color:var(--color-danger);text-align:center;padding:20px">Para profectar de ' + profPointName + ', calcule o Mapa Natal primeiro (aba Mandala).</p></div>';
      return;
    }
    profLonBase = resolvePointLon(pointSel, lastPlanetsData.planets, lastPlanetsData.asc);
  }

  const profDateVal=parseBirthDate(getVal('prof-target-date'));
  if(profDateVal){
    const dataAlvo=new Date(profDateVal+'T12:00:00');
    const p=await computeProfecaoCompleta(dataAlvo,profLonBase);
    p._profPointName = profPointName;
    document.getElementById('results').innerHTML=renderProfecaoPanel(p);
    return;
  }
  let html='<div class="card"><h2 style="text-align:center;color:var(--color-brand-day);margin-bottom:20px">Tabela de Profecção — '+profPointName+' (360 dias)</h2>';
  html+='<table class="profecao-table"><thead><tr><th>Ano</th><th>Casa/Signo</th><th>Início</th><th>Fim</th></tr></thead><tbody>';
  for(let ano=0;ano<120;ano++){
    const inicio=new Date(birthDate); inicio.setDate(inicio.getDate()+Math.round(ano*yearDays));
    const fim=new Date(birthDate);    fim.setDate(fim.getDate()+Math.round((ano+1)*yearDays)-1);
    const pI=getProfectionDetails(inicio,profLonBase);
    const pF=getProfectionDetails(fim,profLonBase);
    html+='<tr><td>'+ano+'</td><td><span class="casa-badge">Casa '+pI.casa+'</span></td>';
    html+='<td>'+formatDate(inicio)+' <br><small style="color:#666">('+pI.signoNome+' '+pI.grau+'°'+pI.minuto+'\' — T. '+pI.termo+')</small></td>';
    html+='<td>'+formatDate(fim)+' <br><small style="color:#666">('+pF.signoNome+' '+pF.grau+'°'+pF.minuto+'\' — T. '+pF.termo+')</small></td></tr>';
  }
  html+='</tbody></table></div>';
  document.getElementById('results').innerHTML=html;
}

// ─── EXPOR PARA onclick ────────────────────────────────────────────────────────
// ─── CALCULATE LOTES ÁRABES ──────────────────────────────────────────────────
// ═══ 11. Aba LOTES (Fortuna/Espírito) ════════════════════════════════════════
function calculateLotes() {
  const container = document.getElementById('lotes-container');
  if (!lastPlanetsData) {
    container.innerHTML = '<div class="card"><p style="color:#888;text-align:center;padding:20px">Calcule primeiro o Mapa (aba Mandala).</p></div>';
    return;
  }
  const { planets: p, asc } = lastPlanetsData;
  const norm = v => ((v % 360) + 360) % 360;
  const lot  = (add, sub) => norm(asc + add - sub);

  // Casas iguais: HC_n = asc + (n-1)*30
  const hc = n => norm(asc + (n - 1) * 30);

  // Regentes tradicionais por signo (0=Ari…11=Pei)
  const TRAD = ['mar','ven','mer','lua','sol','mer','ven','mar','jup','sat','sat','jup'];
  const ru = n => p[TRAD[Math.floor(hc(n) / 30)]];
  const dispositor = lon => p[TRAD[Math.floor(norm(lon) / 30)]];

  // Carta diurna: Sol acima do horizonte → (sol - asc + 360)%360 >= 180
  const isDay = norm(p.sol - asc) >= 180;
  const DN = isDay ? 'D' : 'N';

  // Abreviações de signos (igual ao site de referência)
  const SABR = ['Ari','Tau','Gem','Can','Leo','Vir','Lib','Esc','Sag','Cap','Aqu','Pei'];
  const fmtLon = lon => {
    lon = norm(lon);
    const s   = Math.floor(lon / 30);
    const deg = Math.floor(lon % 30);
    const mf  = (lon % 30 - deg) * 60;
    const min = Math.floor(mf);
    const sec = Math.floor((mf - min) * 60);
    return `${String(deg).padStart(2,'0')} ${SABR[s]} ${String(min).padStart(2,'0')}'${String(sec).padStart(2,'0')}"`;
  };

  // Espírito/Fortuna internos (não exibidos na tabela) — usados só como base de Eros/Necessidade
  const spiritD = lot(p.sol, p.lua);
  const spiritN = lot(p.lua, p.sol);
  const fortD   = lot(p.lua, p.sol);
  const fortN   = lot(p.sol, p.lua);

  // Definição dos lotes (fórmula: ASC + add - sub, mod 360)
  // Para lotes com D/N separados no nome: ambos sempre exibidos
  // Para lotes com variação dia/noite sem sufixo: exibe o da carta
  const LOTS = [
    { name: 'Pai-D',       lon: lot(p.sat, p.sol)  },
    { name: 'Pai-N',       lon: lot(p.sol, p.sat)  },
    { name: 'Mae-D',       lon: lot(p.lua, p.ven)  },
    { name: 'Mae-N',       lon: lot(p.ven, p.lua)  },
    { name: 'Menina',      lon: lot(p.ven, p.lua)  },
    { name: 'Menino',      lon: lot(p.jup, p.lua)  },
    { name: 'Filhos',      lon: isDay ? lot(p.sat, p.jup) : lot(p.jup, p.sat) },
    { name: 'Irmaos',      lon: isDay ? lot(p.jup, p.sat) : lot(p.sat, p.jup) },
    { name: 'Primeira',    lon: lot(hc(1),  ru(1))  },
    { name: 'Substancia',  lon: lot(hc(2),  ru(2))  },
    { name: 'Terceira',    lon: lot(hc(3),  ru(3))  },
    { name: 'Quarta',      lon: lot(hc(4),  ru(4))  },
    { name: 'Quinta',      lon: lot(hc(5),  ru(5))  },
    { name: 'Sexta',       lon: lot(hc(6),  ru(6))  },
    { name: 'Setima',      lon: lot(hc(7),  ru(7))  },
    { name: 'Oitava',      lon: lot(hc(8),  ru(8))  },
    { name: 'Viagem',      lon: lot(hc(9),  ru(9))  },
    { name: 'Decima',      lon: lot(hc(10), ru(10)) },
    { name: 'Onze',        lon: lot(hc(11), ru(11)) },
    { name: 'Inimigos',    lon: lot(hc(12), ru(12)) },
    { name: 'Cativeiro',   lon: isDay ? lot(p.sat, p.lua) : lot(p.lua, p.sat) },
    { name: 'Avos',        lon: isDay ? lot(dispositor(p.sol), p.sat) : lot(p.sat, dispositor(p.sol)) },
    { name: 'Exaltacao',   lon: isDay ? lot(19,    p.sol) : lot(33, p.lua) },
    { name: 'Realeza',     lon: isDay ? lot(p.lua, p.mar) : lot(p.mar, p.lua) },
    { name: 'Prazer-D',    lon: lot(p.ven, p.jup)  },
    { name: 'Prazer-N',    lon: lot(p.jup, p.ven)  },
    { name: 'Disputas',    lon: isDay ? lot(p.jup, p.mar) : lot(p.mar, p.jup) },
    { name: 'Amigos',      lon: lot(p.mer, p.lua)  },
    { name: 'Crenca',      lon: isDay ? lot(p.mer, p.lua) : lot(p.lua, p.mer) },
    { name: 'Servidao',    lon: isDay ? lot(p.lua, p.mer) : lot(p.mer, p.lua) },
    { name: 'Trapaca',     lon: isDay ? lot(p.mar, p.sol) : lot(p.sol, p.mar) },
    { name: 'Doenca-D',    lon: lot(p.mar, p.sat)  },
    { name: 'Doenca-N',    lon: lot(p.sat, p.mar)  },
    { name: 'Acidente',    lon: isDay ? lot(p.mar, p.mer) : lot(p.mer, p.mar) },
    { name: 'Avó',         lon: isDay ? lot(dispositor(p.lua), p.ven) : lot(p.ven, dispositor(p.lua)) },
    { name: 'Divida-D',    lon: lot(p.sat, p.mer) },
    { name: 'Divida-N',    lon: lot(p.mer, p.sat) },
    { name: 'NIrmaos-D',   lon: lot(p.mer, p.jup) },
    { name: 'NIrmaos-N',   lon: lot(p.jup, p.mer) },
    { name: 'Casamento-D', lon: lot(p.ven, p.sat) },
    { name: 'Casamento-N', lon: lot(p.sat, p.ven) },
    { name: 'Eros (Valens)',          lon: isDay ? lot(spiritD, fortD) : lot(fortN, spiritN) },
    { name: 'Eros (Paulus)',          lon: lot(p.ven, spiritD) },
    { name: 'Necessidade (Valens)',   lon: isDay ? lot(fortD, spiritD) : lot(spiritN, fortN) },
    { name: 'Necessidade (Paulus)',   lon: lot(p.mer, fortD) },
  ];

  let rows = LOTS.map((l, i) =>
    `<tr><td>${i+1}</td><td><strong>${l.name}</strong></td><td style="font-family:monospace">${fmtLon(l.lon)}</td><td>${SIGN_NAMES[Math.floor(norm(l.lon)/30)]}</td></tr>`
  ).join('');

  container.innerHTML = `<div class="card">
    <h2 style="text-align:center;color:var(--color-brand-day);margin-bottom:4px">Lotes Árabes</h2>
    <div style="text-align:center;font-size:12px;color:#888;margin-bottom:16px">Carta ${isDay?'Diurna (Sol acima do horizonte)':'Noturna (Sol abaixo do horizonte)'}</div>
    <table class="profecao-table">
      <thead><tr><th>#</th><th>Lote</th><th>Posição</th><th>Signo</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

// ─── CALCULATE REVOLUÇÃO SOLAR ────────────────────────────────────────────────
// ═══ 12. Aba REVOLUÇÃO SOLAR ═════════════════════════════════════════════════
async function calculateRevolucaoSolar() {
  const resultDiv = document.getElementById('rs-result');
  
  if (!lastPlanetsData) {
    resultDiv.innerHTML = '<div class="card"><p style="color:var(--color-danger);text-align:center;padding:20px">Por favor, calcule o Mapa Natal primeiro (aba Mandala).</p></div>';
    return;
  }
  
  // Validar data de nascimento
  const birthDateInput = parseBirthDate(getVal('birthDate')) || '';
  if (!birthDateInput) {
    resultDiv.innerHTML = '<div class="card"><p style="color:var(--color-danger);text-align:center;padding:20px">Por favor, insira a data de nascimento primeiro.</p></div>';
    return;
  }
  
  // Validar data do evento (formato yyyy-mm-dd do input type="date")
  const eventDateInput = getVal('rs-event-date').trim();
  if (!eventDateInput) {
    resultDiv.innerHTML = '<div class="card"><p style="color:var(--color-danger);text-align:center;padding:20px">Por favor, insira a data do evento.</p></div>';
    return;
  }
  
  // Parse da data do evento
  let eventYear, eventMonth, eventDay;
  if (eventDateInput.includes('/')) {
    const p = eventDateInput.split('/');
    eventDay = parseInt(p[0]); eventMonth = parseInt(p[1]); eventYear = parseInt(p[2]);
  } else {
    [eventYear, eventMonth, eventDay] = eventDateInput.split('-').map(Number);
  }
  
  if (isNaN(eventDay) || isNaN(eventMonth) || isNaN(eventYear)) {
    resultDiv.innerHTML = '<div class="card"><p style="color:var(--color-danger);text-align:center;padding:20px">Data inválida</p></div>';
    return;
  }
  
  // Parse da data de nascimento (yyyy-mm-dd)
  const [birthYear, birthMonth, birthDay] = birthDateInput.split('-').map(Number);
  
  let solarReturnYear = eventYear;
  const eventDate = new Date(eventYear, eventMonth - 1, eventDay);
  const birthdayThisYear = new Date(eventYear, birthMonth - 1, birthDay);
  
  if (eventDate < birthdayThisYear) {
    solarReturnYear = eventYear - 1;
  }
  
  const lat = parseFloat(getVal('lat')) || 0;
  const lon = parseFloat(getVal('lon')) || 0;
  const tz = parseFloat(getVal('tzOffset')) || 0;
  const dst = document.getElementById('dst').checked;
  
  resultDiv.innerHTML = '<div class="card"><p style="text-align:center;padding:20px;color:#888">Calculando revolução solar (pode demorar alguns segundos)...</p></div>';
  
  try {
    const natalSol = lastPlanetsData.planets.sol;
    
    let curY = solarReturnYear;
    let curM = birthMonth;
    let curD = birthDay;
    let curH = 12; // Começa meio-dia local
    
    let exactPlanets = null;
    let iter = 0;
    while (iter < 15) {
      exactPlanets = await calcChart(curY, curM, curD, curH, tz, dst, lat, lon);
      let diff = natalSol - exactPlanets.sol;
      
      // Normalizar para -180 a +180
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      
      if (Math.abs(diff) < 0.0001) break; // Precisão atingida
      
      // Ajuste de horas (Sol move ~0.04106 graus por hora)
      curH += diff / 0.04106;
      
      // Normalizar data e hora
      const dObj = new Date(curY, curM - 1, curD, Math.floor(curH), Math.floor((curH % 1) * 60), Math.floor(((curH * 60) % 1) * 60));
      curY = dObj.getFullYear();
      curM = dObj.getMonth() + 1;
      curD = dObj.getDate();
      curH = dObj.getHours() + dObj.getMinutes() / 60 + dObj.getSeconds() / 3600;
      iter++;
    }
    
    const meta = {
      nome: (getVal('mapaNome') || 'Revolução Solar') + ` (${solarReturnYear})`,
      dataStr: `${String(curD).padStart(2,'0')}/${String(curM).padStart(2,'0')}/${curY}`,
      horaStr: `${String(Math.floor(curH)).padStart(2,'0')}:${String(Math.floor((curH%1)*60)).padStart(2,'0')}`,
      lat: lat, lon: lon, tz: tz
    };
    
    resultDiv.innerHTML = `<div class="card">
      <h2 style="text-align:center;color:var(--color-brand-day);margin-bottom:12px">Revolução Solar ${solarReturnYear}</h2>
      <div id="rs-canvas-container" style="text-align:center">
        <canvas id="rs-canvas" width="860" height="860" style="max-width:100%;box-shadow:0 4px 24px rgba(0,0,0,.15)"></canvas>
      </div>
    </div>`;
    
    const canvas = document.getElementById('rs-canvas');
    drawMandala(canvas, exactPlanets.asc, exactPlanets, meta);
    
  } catch (e) {
    resultDiv.innerHTML = `<div class="card"><p style="color:var(--color-danger);text-align:center;padding:20px">Erro ao calcular Revolução Solar: ${e.message}</p></div>`;
  }
}

// ─── Resolução do Apheta (Decenais) — compartilhada entre a aba Decenais e o resumo da Análise Geral ───
// Extraída de calculateDecenais() sem mudança de lógica, apenas para reuso (evita duplicar a regra do Valens).
// ═══ 13. Aba DIREÇÕES (Firdaria/Decenais) ════════════════════════════════════
function resolveDecApheta(planets, asc, aphetaSel) {
  const SIGN_RULER = ['MA','VE','ME','MO','SU','ME','VE','MA','JU','SA','SA','JU'];
  const dsc = (asc + 180) % 360;
  const isDay = asc > dsc ? (planets.sol <= asc && planets.sol > dsc) : !(planets.sol > asc && planets.sol <= dsc);
  const ascSign = Math.floor(((asc % 360) + 360) % 360 / 30);
  const ascRuler = SIGN_RULER[ascSign];
  const SEL_MAP = {sun:'SU',moo:'MO',mer:'ME',ven:'VE',mar:'MA',jup:'JU',sat:'SA'};
  let aphetaCode;
  if (aphetaSel === 'asc_ruler') {
    aphetaCode = ascRuler;
  } else if (aphetaSel === 'sect') {
    aphetaCode = isDay ? 'SU' : 'MO';
  } else if (aphetaSel === 'valens') {
    const sunH = ((Math.floor(norm360(planets.sol)/30) - ascSign + 12)%12)+1;
    const moonH= ((Math.floor(norm360(planets.lua)/30) - ascSign + 12)%12)+1;
    const angular = [1,4,7,10], sucedente = [2,5,8,11];
    const goodH = h => angular.includes(h) || sucedente.includes(h);
    const sectLum = isDay ? 'SU' : 'MO';
    const otherLum = isDay ? 'MO' : 'SU';
    const sectH = isDay ? sunH : moonH;
    const otherH = isDay ? moonH : sunH;
    aphetaCode = goodH(sectH) ? sectLum : goodH(otherH) ? otherLum : ascRuler;
  } else {
    aphetaCode = SEL_MAP[aphetaSel] || ascRuler;
  }
  return aphetaCode;
}

// ─── CALCULATE DECENAIS (129 MESES) — Port do PHP ────────────────────────────
function calculateDecenais() {
  const resultDiv = document.getElementById('dec-result');
  if (!lastPlanetsData) { resultDiv.innerHTML = '<span style="color:var(--color-danger);font-size:12px">Calcule o Mapa primeiro (aba Mandala).</span>'; return; }
  const birthDateInput = parseBirthDate(getVal('birthDate')) || '';
  if (!birthDateInput) { resultDiv.innerHTML = '<span style="color:var(--color-danger);font-size:12px">Insira a data de nascimento.</span>'; return; }
  const targetDateInput = parseBirthDate(getVal('dec-target-date')) || '';
  if (!targetDateInput) { resultDiv.innerHTML = '<span style="color:var(--color-danger);font-size:12px">Informe a data alvo.</span>'; return; }

  const [birthYear, birthMonth, birthDay] = birthDateInput.split('-').map(Number);
  const [targetYear, targetMonth, targetDay] = targetDateInput.split('-').map(Number);


  const birthJD = jd(birthYear, birthMonth, birthDay);
  const targetJD = jd(targetYear, targetMonth, targetDay);
  const { planets, asc } = lastPlanetsData;

  // Constantes
  const SIGN_NAMES = ['Áries','Touro','Gêmeos','Câncer','Leão','Virgem','Libra','Escorpião','Sagitário','Capricórnio','Aquário','Peixes'];
  const SIGN_SYMS  = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
  const SIGN_RULER = ['MA','VE','ME','MO','SU','ME','VE','MA','JU','SA','SA','JU'];
  const MINOR_YEARS = {MO:25,JU:12,SA:30,SU:19,ME:20,VE:8,MA:15};
  const P_NAME = {MO:'Lua',JU:'Júpiter',SA:'Saturno',SU:'Sol',ME:'Mercúrio',VE:'Vênus',MA:'Marte'};
  const P_SYM  = {MO:'☽',JU:'♃',SA:'♄',SU:'☉',ME:'☿',VE:'♀',MA:'♂'};
  const P_NAT  = {MO:'neutral',JU:'benef',SA:'malef',SU:'neutral',ME:'neutral',VE:'benef',MA:'malef'};
  const NAT_LBL= {benef:'Benéfico',malef:'Maléfico',neutral:'Neutro'};
  const HOUSE_MEAN = {1:'vida e corpo',2:'bens e sustento',3:'irmãos e viagens curtas',4:'pai e fundações',5:'filhos e prazeres',6:'doença e servidão',7:'cônjuge e parcerias',8:'morte e herança',9:'viagens longas e religião',10:'carreira e honra',11:'amigos e esperanças',12:'inimigos e sofrimento'};

  // Mapa de longitudes: código → grau
  const pLons = {SU:planets.sol,MO:planets.lua,ME:planets.mer,VE:planets.ven,MA:planets.mar,JU:planets.jup,SA:planets.sat};

  // Determinar sect (mantido aqui pois usado mais abaixo neste escopo)
  const dsc = (asc + 180) % 360;
  const isDay = asc > dsc ? (planets.sol <= asc && planets.sol > dsc) : !(planets.sol > asc && planets.sol <= dsc);

  // Apheta — lido do select (lógica compartilhada com o resumo da Análise Geral)
  const ascSign = Math.floor(((asc % 360) + 360) % 360 / 30);
  const aphetaSel = getVal('dec-apheta-sel');
  const aphetaCode = resolveDecApheta(planets, asc, aphetaSel);

  // Ordem natal: 7 planetas ordenados por longitude a partir do apheta
  const codes7 = ['SU','MO','ME','VE','MA','JU','SA'];
  const aphLon = pLons[aphetaCode];
  const natOrder = [...codes7].sort((a,b) => {
    const da = ((pLons[a] - aphLon) % 360 + 360) % 360;
    const db = ((pLons[b] - aphLon) % 360 + 360) % 360;
    return da - db;
  });

  // Signos natais
  const pSigns = {};
  for (const c of codes7) pSigns[c] = Math.floor(((pLons[c] % 360) + 360) % 360 / 30);

  // Calcular períodos L1 cobrindo até a data alvo + 1 ciclo
  const L1_DUR = 129;
  const targetMonths = (targetJD - birthJD) / 30.0;
  const maxMonths = Math.max(1806, targetMonths + 903);
  const periods = [];
  let elapsedM = 0, l1Idx = 0, safety = 0;

  while (elapsedM < maxMonths && safety++ < 500) {
    const lord = natOrder[l1Idx % 7];
    const jdS = birthJD + elapsedM * 30;
    const jdE = birthJD + (elapsedM + L1_DUR) * 30;
    const isCur = targetJD >= jdS && targetJD < jdE;

    // L2
    const lordNatIdx = natOrder.indexOf(lord);
    const l2 = [];
    let l2El = 0;
    for (let i = 0; i < 7; i++) {
      const l2Lord = natOrder[(lordNatIdx + i) % 7];
      const l2Months = MINOR_YEARS[l2Lord];
      const l2JdS = jdS + l2El * 30;
      const l2JdE = jdS + (l2El + l2Months) * 30;
      const l2TotalDays = l2Months * 30;

      // L3
      const l2LordNatIdx = natOrder.indexOf(l2Lord);
      const l3 = [];
      let l3El = 0;
      for (let j = 0; j < 7; j++) {
        const l3Lord = natOrder[(l2LordNatIdx + j) % 7];
        const l3Days = l2TotalDays * (MINOR_YEARS[l3Lord] / 129);
        const l3JdS = l2JdS + l3El;
        const l3JdE = l2JdS + l3El + l3Days;
        l3.push({lord:l3Lord, days:l3Days, jd_start:l3JdS, jd_end:l3JdE, is_cur: targetJD >= l3JdS && targetJD < l3JdE});
        l3El += l3Days;
      }

      l2.push({lord:l2Lord, months:l2Months, jd_start:l2JdS, jd_end:l2JdE, is_cur: targetJD >= l2JdS && targetJD < l2JdE, l3});
      l2El += l2Months;
    }

    periods.push({sign:pSigns[lord], lord, months:L1_DUR, jd_start:jdS, jd_end:jdE, is_cur:isCur, l2});
    elapsedM += L1_DUR;
    l1Idx++;
  }

  // Achar período ativo
  let curL1 = null, curL2 = null, curL3 = null;
  for (const p of periods) {
    if (p.is_cur) {
      curL1 = p;
      for (const l2 of p.l2) {
        if (l2.is_cur) {
          curL2 = l2;
          for (const l3 of l2.l3) { if (l3.is_cur) { curL3 = l3; break; } }
          break;
        }
      }
      break;
    }
  }

  const l1d = progDeg(curL1), l2d = progDeg(curL2), l3d = progDeg(curL3);

  function fmtProgDeg(d, lordCode) {
    const sign = Math.floor(((pLons[lordCode] % 360 + 360) % 360) / 30);
    return String(Math.floor(d)).padStart(2,'0') + '°' + SIGN_SYMS[sign] + String(Math.floor((d - Math.floor(d)) * 60)).padStart(2,'0') + "'";
  }

  function pct(cur) {
    if (!cur) return 0;
    const dur = cur.jd_end - cur.jd_start;
    return dur > 0 ? Math.min(100, Math.max(0, Math.round((targetJD - cur.jd_start) / dur * 100))) : 0;
  }

  function housesRuled(lord) {
    const h = [];
    for (let s = 0; s < 12; s++) { if (SIGN_RULER[s] === lord) h.push((s - ascSign + 12) % 12 + 1); }
    return h;
  }

  function interp(lord) {
    const nat = P_NAT[lord], name = P_NAME[lord];
    let txt = nat === 'benef' ? `${name} governa com natureza benéfica — favorece crescimento, proteção e boas oportunidades.`
            : nat === 'malef' ? `${name} governa com natureza maléfica — período de provações, obstáculos ou perdas.`
            : `${name} governa de forma mista — resultado depende da posição e aspectos no mapa natal.`;
    const houses = housesRuled(lord);
    if (houses.length) {
      const hl = houses.map(h => `Casa ${h} (${HOUSE_MEAN[h]||''})`).join(' e ');
      txt += ` Os temas da ${hl} ficam em primeiro plano.`;
    }
    return txt;
  }

  // ── Montar HTML ──
  let html = '';

  // Cabeçalho
  const nome = getVal('mapaNome') || '';
  html += `<div style="background:#fff;border:1px solid var(--color-border);border-radius:10px;padding:14px 24px;margin-bottom:16px">
    <div style="font-size:17px;font-weight:700;color:var(--color-text-primary);margin-bottom:4px">${nome || 'Decenais'}</div>
    <div style="font-size:14px;display:flex;flex-wrap:wrap;gap:16px">
      <span>Nascimento: ${String(birthDay).padStart(2,'0')}/${String(birthMonth).padStart(2,'0')}/${birthYear}</span>
      <span>Data alvo: ${String(targetDay).padStart(2,'0')}/${String(targetMonth).padStart(2,'0')}/${targetYear}</span>
      <span>Apheta: <strong>${P_SYM[aphetaCode]} ${P_NAME[aphetaCode]}</strong> (Reg. ASC ${SIGN_SYMS[ascSign]} ${SIGN_NAMES[ascSign]})</span>
      <span>${isDay ? '☀ Diurno' : '☽ Noturno'}</span>
    </div>
  </div>`;

  // Summary card
  if (curL1) {
    function levelBlock(label, sub, cur, deg, barColor) {
      if (!cur) return '';
      const p = pct(cur);
      const durLabel = cur.months ? cur.months + ' meses' : Math.round(cur.days) + ' dias';
      return `<div style="flex:1;min-width:200px">
        <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--color-text-primary);margin-bottom:6px">${label}</div>
        <div style="font-size:26px;font-weight:700;display:flex;align-items:center;gap:10px;margin-bottom:4px">
          ${P_SYM[cur.lord]} <span>${P_NAME[cur.lord]}</span>
          <span style="display:inline-block;font-size:13px;font-weight:700;padding:2px 8px;border-radius:12px;border:1px solid var(--color-text-primary)">${NAT_LBL[P_NAT[cur.lord]]}</span>
        </div>
        <div style="font-size:15px">${fmtProgDeg(deg, cur.lord)} · ${durLabel}</div>
        <div style="font-size:14px;color:var(--color-text-primary);margin-top:4px">${jdToDate(cur.jd_start)} → ${jdToDate(cur.jd_end)}</div>
        <div style="height:4px;background:var(--color-border);border-radius:2px;margin-top:8px;overflow:hidden"><div style="height:100%;background:${barColor};border-radius:2px;width:${p}%"></div></div>
        <div style="font-size:13px;margin-top:3px">${p}% decorrido</div>
      </div>`;
    }

    html += `<div style="background:#fff;border:1px solid var(--color-border);border-radius:12px;padding:22px 26px;margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--color-text-primary);margin-bottom:16px">Período ativo na data</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:16px">
        ${levelBlock('L1 — Chronocrator','',curL1,l1d,'var(--color-accent)')}
        ${curL2 ? levelBlock('L2 — Subperíodo (Paradosis)','',curL2,l2d,'#7c3aed') : ''}
        ${curL3 ? levelBlock('L3 — Sub-subperíodo','',curL3,l3d,'#be185d') : ''}
      </div>
      <div style="font-size:15px;color:var(--color-text-primary);line-height:1.6;padding:12px 14px;background:var(--color-surface);border-radius:8px;margin-top:14px">${interp(curL1.lord)}</div>
    </div>`;
  }

  // Tabela L1
  html += `<div style="background:#fff;border:1px solid var(--color-border);border-radius:10px;padding:16px 20px;overflow-x:auto;margin-bottom:16px">
    <div style="font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--color-text-primary);margin-bottom:14px">Chronocratores L1 — Sequência</div>
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      <thead><tr>
        <th style="background:var(--color-surface);padding:7px 12px;text-align:left;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--color-text-primary);border-bottom:1px solid var(--color-border)">#</th>
        <th style="background:var(--color-surface);padding:7px 12px;text-align:left;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--color-text-primary);border-bottom:1px solid var(--color-border)">Planeta (L1)</th>
        <th style="background:var(--color-surface);padding:7px 12px;text-align:left;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--color-text-primary);border-bottom:1px solid var(--color-border)">Signo Natal</th>
        <th style="background:var(--color-surface);padding:7px 12px;text-align:left;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--color-text-primary);border-bottom:1px solid var(--color-border)">Meses</th>
        <th style="background:var(--color-surface);padding:7px 12px;text-align:left;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--color-text-primary);border-bottom:1px solid var(--color-border)">Início</th>
        <th style="background:var(--color-surface);padding:7px 12px;text-align:left;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--color-text-primary);border-bottom:1px solid var(--color-border)">Fim</th>
        <th style="background:var(--color-surface);padding:7px 12px;text-align:left;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--color-text-primary);border-bottom:1px solid var(--color-border)">L2 / L3</th>
      </tr></thead><tbody>`;

  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    const rowStyle = p.is_cur ? 'border-left:3px solid var(--color-text-primary);font-weight:700;' : '';
    const arrow = p.is_cur ? ' ◀' : '';
    const natCls = P_NAT[p.lord];

    // L2 chips
    let l2chips = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">';
    for (const l2 of p.l2) {
      const chipStyle = l2.is_cur ? 'outline:2px solid var(--color-text-primary);outline-offset:1px;font-weight:700;' : '';
      l2chips += `<span style="display:inline-flex;align-items:center;gap:4px;font-size:13px;padding:2px 8px;border-radius:10px;border:1px solid var(--color-border);background:var(--color-surface);${chipStyle}" title="${P_NAME[l2.lord]} · ${l2.months}m · ${jdToDate(l2.jd_start)} → ${jdToDate(l2.jd_end)}">${P_SYM[l2.lord]} ${l2.months}m</span>`;
    }
    l2chips += '</div>';

    // L3 chips (do L2 ativo ou primeiro)
    let activeL2 = p.l2[0];
    for (const l2 of p.l2) { if (l2.is_cur) { activeL2 = l2; break; } }
    let l3chips = '<div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:4px;border-top:1px dashed var(--color-border);padding-top:8px">Subperíodos L3</div><div style="display:flex;flex-wrap:wrap;gap:4px">';
    for (const l3 of activeL2.l3) {
      const chipStyle = l3.is_cur ? 'outline:2px solid var(--color-text-primary);outline-offset:1px;font-weight:700;' : '';
      l3chips += `<span style="display:inline-flex;align-items:center;gap:4px;font-size:13px;padding:2px 8px;border-radius:10px;border:1px solid var(--color-border);background:var(--color-surface);${chipStyle}" title="${P_NAME[l3.lord]} · ${Math.round(l3.days)}d · ${jdToDate(l3.jd_start)} → ${jdToDate(l3.jd_end)}">${P_SYM[l3.lord]} ${Math.round(l3.days)}d</span>`;
    }
    l3chips += '</div>';

    html += `<tr>
      <td style="padding:7px 12px;border-bottom:1px solid var(--color-border);${rowStyle}font-size:14px">${i+1}${arrow}</td>
      <td style="padding:7px 12px;border-bottom:1px solid var(--color-border);${rowStyle}"><span style="font-size:17px">${P_SYM[p.lord]}</span> <span style="font-weight:600;margin-left:4px">${P_NAME[p.lord]}</span> <span style="display:inline-block;font-size:13px;font-weight:700;padding:2px 8px;border-radius:12px;border:1px solid var(--color-text-primary);margin-left:6px">${NAT_LBL[P_NAT[p.lord]]}</span></td>
      <td style="padding:7px 12px;border-bottom:1px solid var(--color-border);${rowStyle}font-size:14px">${SIGN_SYMS[p.sign]} ${SIGN_NAMES[p.sign]}</td>
      <td style="padding:7px 12px;border-bottom:1px solid var(--color-border);${rowStyle}">${p.months}m</td>
      <td style="padding:7px 12px;border-bottom:1px solid var(--color-border);${rowStyle}font-size:14px">${jdToDate(p.jd_start)}</td>
      <td style="padding:7px 12px;border-bottom:1px solid var(--color-border);${rowStyle}font-size:14px">${jdToDate(p.jd_end)}</td>
      <td style="padding:7px 12px;border-bottom:1px solid var(--color-border);${rowStyle}padding-bottom:12px">${l2chips}${l3chips}</td>
    </tr>`;
  }

  html += `</tbody></table>
    <div style="font-size:11px;margin-top:8px">◀ = período L1 ativo · Passe o mouse nos chips L2/L3 para ver datas</div>
  </div>`;

  // Legenda
  html += `<div style="background:#fff;border:1px solid var(--color-border);border-radius:10px;padding:18px 22px">
    <h3 style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--color-text-primary);margin-bottom:12px">Como ler o Sistema dos 129 Meses</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
      <div style="padding:12px 14px;background:var(--color-surface);border-radius:8px;border:1px solid var(--color-border)"><h4 style="font-size:13px;font-weight:700;text-transform:uppercase;color:var(--color-text-primary);margin-bottom:6px">O que é</h4><p style="font-size:14px;line-height:1.6">O tempo de vida é distribuído em ciclos de 129 meses (10a 9m) — soma dos anos menores: ☽25 + ♃12 + ♄30 + ☉19 + ☿20 + ♀8 + ♂15 = 129.</p></div>
      <div style="padding:12px 14px;background:var(--color-surface);border-radius:8px;border:1px solid var(--color-border)"><h4 style="font-size:13px;font-weight:700;text-transform:uppercase;color:var(--color-text-primary);margin-bottom:6px">L1 — Chronocrator</h4><p style="font-size:14px;line-height:1.6">O Apheta governa os primeiros 129 meses. Após, a regência passa ao próximo planeta em ordem natal. Ciclo completo = 7 × 129 = 903 meses (~75 anos).</p></div>
      <div style="padding:12px 14px;background:var(--color-surface);border-radius:8px;border:1px solid var(--color-border)"><h4 style="font-size:13px;font-weight:700;text-transform:uppercase;color:var(--color-text-primary);margin-bottom:6px">L2 — Paradosis</h4><p style="font-size:14px;line-height:1.6">Dentro dos 129 meses de cada L1, os planetas subdividem o período na mesma ordem natal. Cada um governa seus anos menores como meses.</p></div>
      <div style="padding:12px 14px;background:var(--color-surface);border-radius:8px;border:1px solid var(--color-border)"><h4 style="font-size:13px;font-weight:700;text-transform:uppercase;color:var(--color-text-primary);margin-bottom:6px">Apheta</h4><p style="font-size:14px;line-height:1.6">Ponto de partida: Regente do Ascendente. Os planetas seguem em ordem de longitude natal a partir dele.</p></div>
    </div>
  </div>`;

  resultDiv.innerHTML = html;
}

// ─── CALCULATE ANTIGENESIS (Luni-Solar — Valens) ─────────────────────────────
// ═══ 14. Aba ANTIGÊNESE ══════════════════════════════════════════════════════
async function calculateAntigenesis() {
  const resultDiv = document.getElementById('ag-result');

  if (!lastPlanetsData) {
    resultDiv.innerHTML = '<div class="card"><p style="color:var(--color-danger);text-align:center;padding:20px">Por favor, calcule o Mapa Natal primeiro (aba Mandala).</p></div>';
    return;
  }

  const birthDateInput = parseBirthDate(getVal('birthDate')) || '';
  if (!birthDateInput) {
    resultDiv.innerHTML = '<div class="card"><p style="color:var(--color-danger);text-align:center;padding:20px">Por favor, insira a data de nascimento primeiro.</p></div>';
    return;
  }

  const eventDateInput = getVal('ag-event-date').trim();
  if (!eventDateInput) {
    resultDiv.innerHTML = '<div class="card"><p style="color:var(--color-danger);text-align:center;padding:20px">Por favor, insira a data do evento.</p></div>';
    return;
  }

  let eventYear, eventMonth, eventDay;
  if (eventDateInput.includes('/')) {
    const p = eventDateInput.split('/');
    eventDay = parseInt(p[0]); eventMonth = parseInt(p[1]); eventYear = parseInt(p[2]);
  } else {
    [eventYear, eventMonth, eventDay] = eventDateInput.split('-').map(Number);
  }
  if (isNaN(eventDay) || isNaN(eventMonth) || isNaN(eventYear)) {
    resultDiv.innerHTML = '<div class="card"><p style="color:var(--color-danger);text-align:center;padding:20px">Data inválida</p></div>';
    return;
  }

  const [birthYear, birthMonth, birthDay] = birthDateInput.split('-').map(Number);
  const lat = parseFloat(getVal('lat')) || 0;
  const lon = parseFloat(getVal('lon')) || 0;
  const tz  = parseFloat(getVal('tzOffset')) || 0;
  const dst = document.getElementById('dst').checked;

  // Natal Sun & Moon
  const natalSol  = lastPlanetsData.planets.sol;
  const natalLua  = lastPlanetsData.planets.lua;
  const natalSunSign = Math.floor(natalSol / 30);

  // Determinar ano do retorno solar
  let solarReturnYear = eventYear;
  const eventDate = new Date(eventYear, eventMonth - 1, eventDay);
  const birthdayThisYear = new Date(eventYear, birthMonth - 1, birthDay);
  if (eventDate < birthdayThisYear) solarReturnYear = eventYear - 1;

  resultDiv.innerHTML = '<div class="card"><p style="text-align:center;padding:20px;color:#888">Calculando Antigenesis (pode demorar alguns segundos)...</p></div>';

  try {
    // ── Passo 1: Encontrar Retorno Solar (mesma lógica da aba Rev. Solar) ──
    let curY = solarReturnYear, curM = birthMonth, curD = birthDay, curH = 12;
    let srPlanets = null;
    for (let iter = 0; iter < 15; iter++) {
      srPlanets = await calcChart(curY, curM, curD, curH, tz, dst, lat, lon);
      let diff = natalSol - srPlanets.sol;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      if (Math.abs(diff) < 0.0001) break;
      curH += diff / 0.04106;
      const dObj = new Date(curY, curM - 1, curD, Math.floor(curH), Math.floor((curH % 1) * 60), Math.floor(((curH * 60) % 1) * 60));
      curY = dObj.getFullYear(); curM = dObj.getMonth() + 1; curD = dObj.getDate();
      curH = dObj.getHours() + dObj.getMinutes() / 60 + dObj.getSeconds() / 3600;
    }

    // Verificar se RS ocorreu depois da data do evento → recuar 1 ano
    const srDate = new Date(curY, curM - 1, curD);
    if (srDate > eventDate) {
      solarReturnYear--;
      curY = solarReturnYear; curM = birthMonth; curD = birthDay; curH = 12;
      for (let iter = 0; iter < 15; iter++) {
        srPlanets = await calcChart(curY, curM, curD, curH, tz, dst, lat, lon);
        let diff = natalSol - srPlanets.sol;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        if (Math.abs(diff) < 0.0001) break;
        curH += diff / 0.04106;
        const dObj = new Date(curY, curM - 1, curD, Math.floor(curH), Math.floor((curH % 1) * 60), Math.floor(((curH * 60) % 1) * 60));
        curY = dObj.getFullYear(); curM = dObj.getMonth() + 1; curD = dObj.getDate();
        curH = dObj.getHours() + dObj.getMinutes() / 60 + dObj.getSeconds() / 3600;
      }
    }

    const srYear = curY, srMonth = curM, srDay = curD, srHour = curH;

    // ── Passo 2: Encontrar Antigenesis ──
    // Varrer ~40 dias a partir da RS, em passos de 2h, procurando
    // quando a Lua cruza o grau natal da Lua com o Sol ainda no signo natal.
    let agPlanets = null;
    // Começar na meia-noite do dia da RS (igual ao floor($SR_JD) do PHP),
    // não na hora exata da RS — senão perde cruzamentos da Lua que ocorrem
    // mais cedo no mesmo dia, antes do instante exato do retorno solar.
    let agY = srYear, agM = srMonth, agD = srDay, agH = 0;
    let prevLuaDiff = null;
    let found = false;
    const stepHours = 2; // passo de 2 horas
    const maxSteps = 40 * 12; // ~40 dias

    for (let step = 0; step < maxSteps; step++) {
      const pl = await calcChart(agY, agM, agD, agH, tz, dst, lat, lon);
      const sunSign = Math.floor(pl.sol / 30);

      // Diferença Lua - grau natal (normalizada a [-180, 180])
      let luaDiff = ((pl.lua - natalLua + 540) % 360) - 180;

      // Detectar cruzamento (troca de sinal) enquanto Sol está no signo natal
      if (prevLuaDiff !== null && sunSign === natalSunSign) {
        if (prevLuaDiff * luaDiff <= 0 && Math.abs(prevLuaDiff - luaDiff) < 180) {
          // Interpolar fração
          const frac = (prevLuaDiff === luaDiff) ? 0.5 : prevLuaDiff / (prevLuaDiff - luaDiff);
          const exactH = agH - stepHours + frac * stepHours;

          // Refinar com passos de ~6 minutos
          let rY = agY, rM = agM, rD = agD, rH = exactH - 1;
          let rPrev = null;
          for (let r = 0; r < 20; r++) {
            const rPl = await calcChart(rY, rM, rD, rH, tz, dst, lat, lon);
            let rDiff = ((rPl.lua - natalLua + 540) % 360) - 180;
            if (rPrev !== null && rPrev.diff * rDiff <= 0 && Math.abs(rPrev.diff - rDiff) < 180) {
              const f2 = (rPrev.diff === rDiff) ? 0.5 : rPrev.diff / (rPrev.diff - rDiff);
              rH = rPrev.h + f2 * 0.1;
              agPlanets = await calcChart(rY, rM, rD, rH, tz, dst, lat, lon);
              // Normalizar data
              const fObj = new Date(rY, rM - 1, rD, Math.floor(rH), Math.floor((rH % 1) * 60));
              agY = fObj.getFullYear(); agM = fObj.getMonth() + 1; agD = fObj.getDate();
              agH = fObj.getHours() + fObj.getMinutes() / 60;
              found = true;
              break;
            }
            rPrev = { diff: rDiff, h: rH };
            rH += 0.1; // ~6 min
          }
          if (found) break;

          // Fallback: usar a interpolação grossa
          const dObj = new Date(agY, agM - 1, agD, Math.floor(exactH), Math.floor((exactH % 1) * 60));
          agY = dObj.getFullYear(); agM = dObj.getMonth() + 1; agD = dObj.getDate();
          agH = dObj.getHours() + dObj.getMinutes() / 60;
          agPlanets = await calcChart(agY, agM, agD, agH, tz, dst, lat, lon);
          found = true;
          break;
        }
      }

      prevLuaDiff = luaDiff;
      agH += stepHours;
      // Normalizar data
      const dObj = new Date(agY, agM - 1, agD, Math.floor(agH), Math.floor((agH % 1) * 60));
      agY = dObj.getFullYear(); agM = dObj.getMonth() + 1; agD = dObj.getDate();
      agH = dObj.getHours() + dObj.getMinutes() / 60 + dObj.getSeconds() / 3600;
    }

    if (!found || !agPlanets) {
      // Fallback: usar o retorno solar
      agPlanets = srPlanets;
      agY = srYear; agM = srMonth; agD = srDay; agH = srHour;
      resultDiv.innerHTML = `<div class="card">
        <p style="color:#e67e22;text-align:center;padding:12px;font-size:13px">
          ⚠️ Não foi possível encontrar Antigenesis (Lua no grau natal com Sol no signo natal).<br>
          Exibindo Retorno Solar como fallback.
        </p>
      </div>`;
    }

    const mapaNome = getVal('mapaNome') || 'Antigenesis';
    const meta = {
      nome: mapaNome + ` — Antigenesis (${solarReturnYear})`,
      dataStr: `${String(agD).padStart(2,'0')}/${String(agM).padStart(2,'0')}/${agY}`,
      horaStr: `${String(Math.floor(agH)).padStart(2,'0')}:${String(Math.floor((agH%1)*60)).padStart(2,'0')}`,
      lat: lat, lon: lon, tz: tz
    };

    resultDiv.innerHTML = `<div class="card">
      <h2 style="text-align:center;color:var(--color-brand-day);margin-bottom:12px">Antigenesis — ${solarReturnYear}</h2>
      <div id="ag-canvas-container" style="text-align:center">
        <canvas id="ag-canvas" width="860" height="860" style="max-width:100%;box-shadow:0 4px 24px rgba(0,0,0,.15)"></canvas>
      </div>
    </div>`;

    const canvas = document.getElementById('ag-canvas');
    drawMandala(canvas, agPlanets.asc, agPlanets, meta);

  } catch (e) {
    resultDiv.innerHTML = `<div class="card"><p style="color:var(--color-danger);text-align:center;padding:20px">Erro ao calcular Antigenesis: ${e.message}</p></div>`;
  }
}

// ─── CALCULATE TRÂNSITOS ──────────────────────────────────────────────────────
const TR_PL_SYMS  = ['☉','☽','☿','♀','♂','♃','♄','♅','♆','♇'];
const TR_PL_NAMES = ['Sol','Lua','Mercúrio','Vênus','Marte','Júpiter','Saturno','Urano','Netuno','Plutão'];
const TR_PL_KEYS  = ['sol','lua','mer','ven','mar','jup','sat','ura','net','plu'];
const TR_ASPECTS  = [{a:0,label:'Conjunção'},{a:60,label:'Sextil'},{a:90,label:'Quadratura'},{a:120,label:'Trígono'},{a:180,label:'Oposição'}];
const TR_ORB = 3; // orbe em graus, mesmo padrão já usado na aba Lotes

// Formata longitude em "signo grau°min'" (mesmo padrão usado em fmtLon/fmtDegSign das outras abas)
// ═══ 15. Aba TRÂNSITOS ═══════════════════════════════════════════════════════
function trFmtSignPos(lon) {
  const l = ((lon % 360) + 360) % 360;
  const s = Math.floor(l / 30);
  const deg = Math.floor(l % 30);
  const min = Math.round((l % 30 - deg) * 60);
  return SIGN_NAMES[s] + ' ' + deg + '°' + String(min < 60 ? min : 0).padStart(2,'0') + "'";
}

// Aspecto mais próximo (dentro do orbe) entre duas longitudes. Retorna {label, orb} ou null.
function trBestAspect(lonA, lonB, orbMax) {
  const diff = Math.abs(_angDiff(lonA, lonB)); // 0..180
  let best = null;
  for (const { a, label } of TR_ASPECTS) {
    const orb = Math.abs(diff - a);
    if (orb <= orbMax && (!best || orb < best.orb)) best = { label, orb };
  }
  return best;
}

async function calculateTransitos() {
  const resultDiv = document.getElementById('tr-result');

  if (!lastPlanetsData) {
    resultDiv.innerHTML = '<div class="card"><p style="color:var(--color-danger);text-align:center;padding:20px">Por favor, calcule o Mapa Natal primeiro (aba Mandala).</p></div>';
    return;
  }

  const targetInput = getVal('tr-target-date').trim();
  if (!targetInput) {
    resultDiv.innerHTML = '<div class="card"><p style="color:var(--color-danger);text-align:center;padding:20px">Por favor, insira a data do trânsito.</p></div>';
    return;
  }

  let trYear, trMonth, trDay;
  if (targetInput.includes('/')) {
    const p = targetInput.split('/');
    trDay = parseInt(p[0]); trMonth = parseInt(p[1]); trYear = parseInt(p[2]);
  } else {
    [trYear, trMonth, trDay] = targetInput.split('-').map(Number);
  }
  if (isNaN(trDay) || isNaN(trMonth) || isNaN(trYear)) {
    resultDiv.innerHTML = '<div class="card"><p style="color:var(--color-danger);text-align:center;padding:20px">Data inválida</p></div>';
    return;
  }

  const lat = parseFloat(getVal('lat')) || 0;
  const lon = parseFloat(getVal('lon')) || 0;
  const tz  = parseFloat(getVal('tzOffset')) || 0;
  const dst = document.getElementById('dst').checked;

  resultDiv.innerHTML = '<div class="card"><p style="text-align:center;padding:20px;color:#888">Calculando trânsitos...</p></div>';

  try {
    const trChart = await calcChart(trYear, trMonth, trDay, 12, tz, dst, lat, lon); // meio-dia local
    const natal = lastPlanetsData.planets;

    // ── Lista 1: planetas em trânsito × planetas natais ──
    const planetAsps = [];
    TR_PL_KEYS.forEach((tk, ti) => {
      const trLon = trChart[tk];
      TR_PL_KEYS.forEach((nk, ni) => {
        const asp = trBestAspect(trLon, natal[nk], TR_ORB);
        if (asp) {
          planetAsps.push({
            trSym: TR_PL_SYMS[ti], trName: TR_PL_NAMES[ti], trPos: trFmtSignPos(trLon),
            natSym: TR_PL_SYMS[ni], natName: TR_PL_NAMES[ni], natPos: trFmtSignPos(natal[nk]),
            asp: asp.label, orb: asp.orb
          });
        }
      });
    });
    planetAsps.sort((a, b) => a.orb - b.orb);

    // ── Lista 2: dodecatemoria dos planetas em trânsito × planetas natais ──
    const dodecaAsps = [];
    TR_PL_KEYS.forEach((tk, ti) => {
      const trDod = dodecaLon(trChart[tk]);
      TR_PL_KEYS.forEach((nk, ni) => {
        const asp = trBestAspect(trDod, natal[nk], TR_ORB);
        if (asp) {
          dodecaAsps.push({
            trSym: TR_PL_SYMS[ti], trName: TR_PL_NAMES[ti], trPos: trFmtSignPos(trDod),
            natSym: TR_PL_SYMS[ni], natName: TR_PL_NAMES[ni], natPos: trFmtSignPos(natal[nk]),
            asp: asp.label, orb: asp.orb
          });
        }
      });
    });
    dodecaAsps.sort((a, b) => a.orb - b.orb);

    const tableHead = `<thead><tr>
        <th style="text-align:left;padding:4px 8px;font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#888">Trânsito</th>
        <th style="text-align:left;padding:4px 8px;font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#888">Aspecto</th>
        <th style="text-align:left;padding:4px 8px;font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#888">Natal</th>
        <th style="text-align:left;padding:4px 8px;font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#888">Orbe</th>
      </tr></thead>`;

    const rowsHtml = (list) => list.length
      ? list.map(r => `<tr style="border-bottom:1px solid var(--color-surface)">
          <td style="padding:5px 8px;white-space:nowrap">${r.trSym} ${r.trName} <small style="color:#888;font-family:monospace">(${r.trPos})</small></td>
          <td style="padding:5px 8px;white-space:nowrap;color:var(--color-accent)">${r.asp}</td>
          <td style="padding:5px 8px;white-space:nowrap">${r.natSym} ${r.natName} <small style="color:#888;font-family:monospace">(${r.natPos})</small></td>
          <td style="padding:5px 8px;white-space:nowrap;color:#888;font-family:monospace">${r.orb.toFixed(2)}°</td>
        </tr>`).join('')
      : `<tr><td colspan="4" style="padding:10px;text-align:center;color:#888">Nenhum aspecto dentro do orbe (${TR_ORB}°)</td></tr>`;

    resultDiv.innerHTML = `<div class="card">
      <h2 style="text-align:center;color:var(--color-brand-day);margin-bottom:4px">Trânsitos — ${String(trDay).padStart(2,'0')}/${String(trMonth).padStart(2,'0')}/${trYear}</h2>
      <div style="text-align:center;font-size:11px;color:#888;margin-bottom:16px">Calculado ao meio-dia local (12:00) &middot; orbe ${TR_ORB}°</div>

      <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#555;margin:10px 0 6px">Planetas em Trânsito × Mapa Natal</div>
      <table style="border-collapse:collapse;font-size:13px;width:100%;max-width:520px;margin:0 auto">
        ${tableHead}<tbody>${rowsHtml(planetAsps)}</tbody>
      </table>

      <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#555;margin:20px 0 6px">Dodecatemoria em Trânsito × Mapa Natal</div>
      <table style="border-collapse:collapse;font-size:13px;width:100%;max-width:520px;margin:0 auto">
        ${tableHead}<tbody>${rowsHtml(dodecaAsps)}</tbody>
      </table>
    </div>`;

  } catch (e) {
    resultDiv.innerHTML = `<div class="card"><p style="color:var(--color-danger);text-align:center;padding:20px">Erro ao calcular Trânsitos: ${e.message}</p></div>`;
  }
}

// ─── ANÁLISE GERAL (resumo em cards — versões MINI, não as abas completas) ────

// Firdaria Natal, versão resumida: só o período + subperíodo + micro-período ativos na data
// ═══ 16. Mini-widgets Firdaria/Decenais (usados no dashboard) ══════════════
function miniFirdaria(targetDate) {
  const { birthDateInput, birthDate } = getInputs();
  if (!birthDateInput) return '<span style="color:var(--color-danger);font-size:12px">Insira a data de nascimento.</span>';

  const sol = lastPlanetsData.planets.sol, asc = lastPlanetsData.asc;
  const dsc = (asc + 180) % 360;
  const isDay = asc < dsc ? (sol >= dsc || sol < asc) : (sol >= dsc && sol < asc);

  const baseSequence = isDay ? firdariaDay : firdariaNight;
  const sequence = [...baseSequence];
  let offset = 75;
  while (offset < 120) {
    baseSequence.forEach(p => sequence.push({ planeta: p.planeta, anos: p.anos, subs: p.subs.map(s => ({ sub: s.sub, anos: s.anos + offset, dias: s.dias })) }));
    offset += 75;
  }

  const caldeanOrder = ['♄','♃','♂','☉','♀','☿','☽'];
  const caldeanNames = ['Saturno','Júpiter','Marte','Sol','Vênus','Mercúrio','Lua'];

  let mainReg = null, mainI = null, mainF = null, subReg = null, subI = null, subF = null, microReg = null, microI = null, microF = null;

  for (let periodoIndex = 0; periodoIndex < sequence.length && !mainReg; periodoIndex++) {
    const periodo = sequence[periodoIndex];
    if (periodo.subs.length === 0) continue; // Nodos (sem subperíodos) — não tratado no resumo
    for (let idx = 0; idx < periodo.subs.length; idx++) {
      const sub = periodo.subs[idx];
      const dInicio = addYearsAndDays(birthDate, sub.anos, sub.dias);
      let dFim;
      if (idx < periodo.subs.length - 1) { const ps = periodo.subs[idx+1]; dFim = addYearsAndDays(birthDate, ps.anos, ps.dias); }
      else { const pp = sequence[periodoIndex+1]; dFim = (pp && pp.subs.length>0) ? addYearsAndDays(birthDate, pp.subs[0].anos, pp.subs[0].dias) : addYearsAndDays(dInicio, periodo.anos/7.0, 0); }

      if (targetDate >= dInicio && targetDate < dFim) {
        mainReg = periodo.planeta;
        mainI = addYearsAndDays(birthDate, periodo.subs[0].anos, periodo.subs[0].dias);
        const nextPeriodo = sequence[periodoIndex+1];
        mainF = (nextPeriodo && nextPeriodo.subs.length>0) ? addYearsAndDays(birthDate, nextPeriodo.subs[0].anos, nextPeriodo.subs[0].dias) : addYearsAndDays(mainI, periodo.anos, 0);
        subReg = sub.sub; subI = dInicio; subF = dFim;

        let subStartIdx = caldeanOrder.indexOf(sub.sub); if (subStartIdx === -1) subStartIdx = 0;
        const subSubMs = (dFim.getTime() - dInicio.getTime()) / 7.0;
        for (let j = 0; j < 7; j++) {
          const di = new Date(dInicio.getTime() + j*subSubMs), df = new Date(dInicio.getTime() + (j+1)*subSubMs);
          if (targetDate >= di && targetDate < df) { microReg = caldeanNames[(subStartIdx+j)%7]; microI = di; microF = new Date(df.getTime()-86400000); break; }
        }
        break;
      }
    }
  }
  if (!mainReg) return '<span style="color:#888;font-size:12px">Sem período ativo.</span>';

  let html = `<div style="font-size:13px;font-weight:600">${mainReg} <span style="font-weight:400;color:#888">${formatDate(mainI)} — ${formatDate(mainF)}</span></div>`;
  html += `<div style="font-size:13px;margin-top:2px">${subReg} <span style="color:#888">${formatDate(subI)} — ${formatDate(subF)}</span></div>`;
  if (microReg) html += `<div style="font-size:13px;margin-top:1px"><span style="opacity:.6">↳</span> ${microReg} <span style="color:#888">${formatDate(microI)} — ${formatDate(microF)}</span></div>`;
  return html;
}

// Decenais (129 meses), versão resumida: L1/L2/L3 ativos na data + Aspectos (mesma técnica "grau corrido" da Liberação)
function miniDecenais(targetDate, aphetaSel) {
  aphetaSel = aphetaSel || 'asc_ruler';
  const birthVal = parseBirthDate(getVal('birthDate')) || '';
  if (!birthVal) return '<span style="color:var(--color-danger);font-size:12px">Insira a data de nascimento.</span>';
  const [birthYear, birthMonth, birthDay] = birthVal.split('-').map(Number);
  const targetYear = targetDate.getFullYear(), targetMonth = targetDate.getMonth()+1, targetDay = targetDate.getDate();

  const birthJD = jd(birthYear,birthMonth,birthDay), targetJD = jd(targetYear,targetMonth,targetDay);
  const { planets, asc } = lastPlanetsData;

  const SIGN_SYMS   = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
  const SIGN_RULER  = ['MA','VE','ME','MO','SU','ME','VE','MA','JU','SA','SA','JU'];
  const MINOR_YEARS = {MO:25,JU:12,SA:30,SU:19,ME:20,VE:8,MA:15};
  const P_NAME = {MO:'Lua',JU:'Júpiter',SA:'Saturno',SU:'Sol',ME:'Mercúrio',VE:'Vênus',MA:'Marte'};
  const P_SYM  = {MO:'☽',JU:'♃',SA:'♄',SU:'☉',ME:'☿',VE:'♀',MA:'♂'};
  const pLons  = {SU:planets.sol,MO:planets.lua,ME:planets.mer,VE:planets.ven,MA:planets.mar,JU:planets.jup,SA:planets.sat};

  const aphetaCode = resolveDecApheta(planets, asc, aphetaSel);
  const codes7 = ['SU','MO','ME','VE','MA','JU','SA'];
  const aphLon = pLons[aphetaCode];
  const natOrder = [...codes7].sort((a,b) => norm360(pLons[a]-aphLon) - norm360(pLons[b]-aphLon));
  const pSigns = {}; for (const c of codes7) pSigns[c] = Math.floor(norm360(pLons[c])/30);

  const L1_DUR = 129;
  const targetMonths = (targetJD-birthJD)/30.0;
  const maxMonths = Math.max(1806, targetMonths+903);
  let elapsedM = 0, l1Idx = 0, safety = 0, curL1 = null, curL2 = null, curL3 = null;
  while (elapsedM < maxMonths && safety++ < 500) {
    const lord = natOrder[l1Idx % 7];
    const jdS = birthJD + elapsedM*30, jdE = birthJD + (elapsedM+L1_DUR)*30;
    if (targetJD >= jdS && targetJD < jdE) {
      curL1 = { sign: pSigns[lord], lord, jd_start: jdS, jd_end: jdE };
      const lordNatIdx = natOrder.indexOf(lord);
      let l2El = 0;
      for (let i = 0; i < 7; i++) {
        const l2Lord = natOrder[(lordNatIdx+i)%7], l2Months = MINOR_YEARS[l2Lord];
        const l2JdS = jdS + l2El*30, l2JdE = jdS + (l2El+l2Months)*30;
        if (targetJD >= l2JdS && targetJD < l2JdE) {
          curL2 = { sign: pSigns[l2Lord], lord: l2Lord, jd_start: l2JdS, jd_end: l2JdE };
          const l2TotalDays = l2Months*30, l2LordNatIdx = natOrder.indexOf(l2Lord);
          let l3El = 0;
          for (let j = 0; j < 7; j++) {
            const l3Lord = natOrder[(l2LordNatIdx+j)%7], l3Days = l2TotalDays*(MINOR_YEARS[l3Lord]/129);
            const l3JdS = l2JdS + l3El, l3JdE = l2JdS + l3El + l3Days;
            if (targetJD >= l3JdS && targetJD < l3JdE) { curL3 = { sign: pSigns[l3Lord], lord: l3Lord, jd_start: l3JdS, jd_end: l3JdE }; break; }
            l3El += l3Days;
          }
          break;
        }
        l2El += l2Months;
      }
      break;
    }
    elapsedM += L1_DUR; l1Idx++;
  }
  if (!curL1) return '<span style="color:#888;font-size:12px">Sem período ativo.</span>';

  function fmtDegSign(d, sign){ return String(Math.floor(d)).padStart(2,'0')+'°'+SIGN_SYMS[sign]+String(Math.floor((d-Math.floor(d))*60)).padStart(2,'0')+"'"; }

  // Aspectos naturais + dodecas contra o "grau corrido" do período — mesma técnica de calcLibAsps (Liberação)
  const aspAngles = {0:'Cnj',60:'Sex',90:'Qua',120:'Tri',180:'Opo'};
  function calcDecAsps(sign, degInSign, dur, baseJD, excludeCode) {
    const targetLon = sign*30 + degInSign, found = [];
    codes7.forEach(code => {
      const natLon = norm360(pLons[code]);
      const sn = Math.floor(natLon/30), rel = natLon%30;
      const dodLon = norm360(sn*30 + rel*12);
      [{lon:natLon,tag:''},{lon:dodLon,tag:' dod'}].forEach(body => {
        if (code === excludeCode && body.tag === '') return; // pula só o natal do próprio regente do período (dodeca continua valendo, igual ao site)
        let diff = Math.abs(targetLon-body.lon)%360; if (diff>180) diff = 360-diff;
        for (const [aDeg,aLabel] of Object.entries(aspAngles)) {
          if (Math.abs(diff-Number(aDeg)) <= 3.0) {
            let aspDate = '';
            for (const dir of [1,-1]) {
              const tlon = norm360(body.lon+dir*Number(aDeg));
              if (Math.floor(tlon/30) === sign) { aspDate = jdToDate(baseJD + ((tlon%30)/30)*dur); break; }
            }
            found.push({ sym: P_SYM[code], name: P_NAME[code]+body.tag, asp: aLabel, date: aspDate });
            break;
          }
        }
      });
    });
    return found;
  }
  const aspL1 = calcDecAsps(curL1.sign, progDeg(curL1), curL1.jd_end-curL1.jd_start, curL1.jd_start, curL1.lord);
  const aspL2 = curL2 ? calcDecAsps(curL2.sign, progDeg(curL2), curL2.jd_end-curL2.jd_start, curL2.jd_start, curL2.lord) : [];
  const aspL3 = curL3 ? calcDecAsps(curL3.sign, progDeg(curL3), curL3.jd_end-curL3.jd_start, curL3.jd_start, curL3.lord) : [];

  function aspRows(list){ return list.map(a => `<div style="font-size:12px;margin-top:1px">${a.sym} ${a.name} ${a.asp} <span style="color:#888;font-family:monospace">${a.date}</span></div>`).join(''); }
  function levelBlock(cur, deg, label){
    return `<div style="font-size:13px;margin-top:6px">${P_SYM[cur.lord]} ${P_NAME[cur.lord]} <span style="color:#888">${label}  ${fmtDegSign(deg,cur.sign)}</span></div>
      <div style="font-size:12px;color:#888;margin-bottom:2px">${jdToDate(cur.jd_start)} → ${jdToDate(cur.jd_end)}</div>`;
  }

  const DEC_OPTS = [
    {v:'asc_ruler', l:'Reg. Asc'}, {v:'sect', l:'Luminar sect'}, {v:'valens', l:'⚖ Método Valens'},
    {v:'sun', l:'☉ Sol'}, {v:'moo', l:'☽ Lua'}, {v:'mer', l:'☿ Mercúrio'}, {v:'ven', l:'♀ Vênus'},
    {v:'mar', l:'♂ Marte'}, {v:'jup', l:'♃ Júpiter'}, {v:'sat', l:'♄ Saturno'}
  ];
  let selHtml = '<select onchange="vgRerenderDecenais(this)" style="font-size:11px;padding:3px 6px;border:1px solid var(--color-border-input);border-radius:5px;background:#fff;cursor:pointer;margin-bottom:6px;max-width:100%">';
  DEC_OPTS.forEach(o => { selHtml += `<option value="${o.v}" ${o.v===aphetaSel?'selected':''}>${o.l}</option>`; });
  selHtml += '</select>';

  let html = selHtml;
  html += `<div style="font-size:13px;font-weight:600;margin-bottom:2px">${P_SYM[aphetaCode]} ${P_NAME[aphetaCode]}</div>`;
  html += levelBlock(curL1, progDeg(curL1), 'L1') + aspRows(aspL1);
  if (curL2) html += levelBlock(curL2, progDeg(curL2), 'L2') + aspRows(aspL2);
  if (curL3) html += levelBlock(curL3, progDeg(curL3), 'L3') + aspRows(aspL3);
  return html;
}

// ═══ 17. Aba ANÁLISE GERAL (dashboard) ══════════════════════════════════════
async function calculateAnaliseGeral() {
  const el = document.getElementById('vg-result');
  if (!lastPlanetsData) {
    el.innerHTML = '<div class="card"><p style="color:var(--color-danger);text-align:center;padding:20px">Calcule o Mapa Natal primeiro (aba Mandala).</p></div>';
    return;
  }
  el.innerHTML = '<div class="card"><p style="text-align:center;padding:20px;color:#888">Calculando análise geral…</p></div>';

  // Data alvo (padrão: hoje)
  const raw = getVal('vg-target-date').trim();
  let dStr, targetDate;
  if (raw) {
    dStr = raw;
    const [d,m,y] = raw.split('/').map(Number);
    targetDate = new Date(y, m-1, d);
  } else {
    targetDate = new Date();
    dStr = String(targetDate.getDate()).padStart(2,'0') + '/' + String(targetDate.getMonth()+1).padStart(2,'0') + '/' + targetDate.getFullYear();
  }

  // Propaga a data alvo pro campo de Profecção e Liberação (essas duas reaproveitam a aba já existente)
  ['prof-target-date','vl-target-date'].forEach(id => { const f = document.getElementById(id); if (f) f.value = dStr; });

  // Liberação Zodiacal: método "Reg. Asc." = signo natal ocupado pelo regente do Ascendente
  const VG_SIGN_RULER = ['MA','VE','ME','MO','SU','ME','VE','MA','JU','SA','SA','JU'];
  const VG_RULER_LON = {MA:lastPlanetsData.planets.mar, VE:lastPlanetsData.planets.ven, ME:lastPlanetsData.planets.mer,
                         MO:lastPlanetsData.planets.lua, SU:lastPlanetsData.planets.sol, JU:lastPlanetsData.planets.jup,
                         SA:lastPlanetsData.planets.sat};
  const ascSignIdx = Math.floor(((lastPlanetsData.asc % 360) + 360) % 360 / 30);
  const ascRulerCode = VG_SIGN_RULER[ascSignIdx];
  const ascRulerSign = Math.floor(((VG_RULER_LON[ascRulerCode] % 360) + 360) % 360 / 30);
  const vlSel = document.getElementById('vl-sign-sel'); if (vlSel) vlSel.value = String(ascRulerSign);
  const profSel = document.getElementById('prof-point-sel'); if (profSel) profSel.value = 'asc';

  const resultsDiv = document.getElementById('results');

  // ── Profecção (já é resumida — reaproveita a aba) ──
  await calculateProfecao();
  const profHtml = resultsDiv ? resultsDiv.innerHTML : '';

  // ── Liberação Zodiacal (já é resumida — reaproveita a aba) ──
  calculateLiberacao();
  const libHtml = document.getElementById('vl-result').innerHTML;

  // ── Firdaria Natal (versão resumida nova) ──
  const firdariaHtml = miniFirdaria(targetDate);

  // ── Decenais (versão resumida nova) ──
  window._vgTargetDate = targetDate; // guardado para o select de apheta poder re-renderizar só este card
  const decHtml = miniDecenais(targetDate, 'asc_ruler');

  // ── Direções (versão resumida — reaproveita a aba já existente) ──
  const direcoesHtml = (typeof window.miniDirecoes === 'function')
    ? window.miniDirecoes(targetDate, 'asc')
    : '<span style="color:var(--color-danger);font-size:12px">Indisponível.</span>';

  function card(title, html, contentId) {
    return `<div class="card" style="padding:14px 16px;display:inline-block;width:100%;box-sizing:border-box;margin-bottom:16px;break-inside:avoid;-webkit-column-break-inside:avoid;page-break-inside:avoid">
      <h3 style="margin:0 0 10px 0;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--color-brand-day);padding-bottom:6px;border-bottom:1px solid var(--color-border)">${title}</h3>
      <div${contentId ? ' id="'+contentId+'" aria-live="polite"' : ''}>${html}</div>
    </div>`;
  }

  const profSelHtml = vgMiniSelectFrom('prof-point-sel', profSel ? profSel.value : 'asc', 'vgRerenderProfecao');
  const vlSelHtml = vgMiniSelectFrom('vl-sign-sel', vlSel ? vlSel.value : '-1', 'vgRerenderLiberacao');
  const dirSelHtml = vgMiniSelectFrom('dir-point-sel', 'asc', 'vgRerenderDirecoes');

  el.innerHTML = `
    <div style="text-align:center;font-size:11px;color:#888;margin-bottom:14px">Análise Geral — ${dStr}</div>
    <div role="region" aria-label="Resumo da Análise Geral" style="column-width:340px;column-gap:16px">
      ${card('Firdaria Natal', firdariaHtml)}
      ${card('Profecção', profSelHtml + profHtml, 'vg-prof-content')}
      ${card('Liberação Zodiacal', vlSelHtml + libHtml, 'vg-lib-content')}
      ${card('Decenais', decHtml, 'vg-dec-content')}
      ${card('Direções', dirSelHtml + direcoesHtml, 'vg-dir-content')}
    </div>`;
}

// Constrói um <select> mini reaproveitando as options de um select já existente na página
// (usado para expor os selects de Profecção/Liberação dentro dos cards da Análise Geral,
// já que calculateProfecao()/calculateLiberacao() só copiam o resultado, não o select da aba)
// ═══ 18. Helpers de re-render dos mini-selects do dashboard (vg*) ══════════
function vgMiniSelectFrom(sourceId, selectedVal, handlerName) {
  const src = document.getElementById(sourceId);
  if (!src) return '';
  let html = `<select onchange="${handlerName}(this)" style="font-size:11px;padding:3px 6px;border:1px solid var(--color-border-input);border-radius:5px;background:#fff;cursor:pointer;margin-bottom:6px;max-width:100%">`;
  Array.from(src.options).forEach(o => {
    html += `<option value="${o.value}" ${o.value===String(selectedVal)?'selected':''}>${o.textContent}</option>`;
  });
  html += '</select>';
  return html;
}

// Re-renderiza só o card de Profecção quando o select mini muda (não recalcula os outros cards)
async function vgRerenderProfecao(selEl) {
  const profSel = document.getElementById('prof-point-sel');
  if (profSel) profSel.value = selEl.value;
  await calculateProfecao();
  const cont = document.getElementById('vg-prof-content');
  const resultsDiv = document.getElementById('results');
  if (cont && resultsDiv) cont.innerHTML = vgMiniSelectFrom('prof-point-sel', selEl.value, 'vgRerenderProfecao') + resultsDiv.innerHTML;
}

// Re-renderiza só o card de Liberação Zodiacal quando o select mini muda (não recalcula os outros cards)
function vgRerenderLiberacao(selEl) {
  const vlSel = document.getElementById('vl-sign-sel');
  if (vlSel) vlSel.value = selEl.value;
  calculateLiberacao();
  const cont = document.getElementById('vg-lib-content');
  const libResultDiv = document.getElementById('vl-result');
  if (cont && libResultDiv) cont.innerHTML = vgMiniSelectFrom('vl-sign-sel', selEl.value, 'vgRerenderLiberacao') + libResultDiv.innerHTML;
}

// Re-renderiza só o card de Decenais quando o select de Apheta muda (não recalcula os outros cards)
function vgRerenderDecenais(selEl) {
  const cont = document.getElementById('vg-dec-content');
  if (!cont || !window._vgTargetDate) return;
  cont.innerHTML = miniDecenais(window._vgTargetDate, selEl.value);
}

// Re-renderiza só o card de Direções quando o select de Ponto Direcionado muda (não recalcula os outros cards)
function vgRerenderDirecoes(selEl) {
  const cont = document.getElementById('vg-dir-content');
  if (!cont || !window._vgTargetDate || typeof window.miniDirecoes !== 'function') return;
  cont.innerHTML = vgMiniSelectFrom('dir-point-sel', selEl.value, 'vgRerenderDirecoes') + window.miniDirecoes(window._vgTargetDate, selEl.value);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
loadFont();

// Normaliza qualquer ângulo para o intervalo [0,360)
function norm360(x){ return ((x%360)+360)%360; }

// Lê .value de um elemento com guarda contra elemento ausente no DOM.
// Retorna '' (ou 'def', se informado) e avisa no console em vez de lançar erro.
function getVal(id, def) {
  var el = document.getElementById(id);
  if (!el) {
    console.warn('getVal: elemento #' + id + ' não encontrado no DOM');
    return def !== undefined ? def : '';
  }
  return el.value;
}

// Escapa HTML de textos vindos de fontes externas (API GeoNames, banco de
// mapas salvos, etc.) antes de inserir via innerHTML, evitando injeção de
// markup/script.
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

// ── GeoNames autocomplete ─────────────────────────────────────────────────
(function(){
  var inp = document.getElementById('loc_search_input');
  var ul  = document.getElementById('loc_ac_list');
  var _timer = null;

  inp.addEventListener('input', function(){ locSearch(this.value); });

  function getUser() {
    return (getVal('geonames_user').trim()) || '';
  }

  function locSearch(q) {
    q = (q||'').trim();
    if (q.length < 2) { ul.style.display='none'; return; }
    var user = getUser();
    if (!user) {
      ul.innerHTML = '<li style="padding:7px 12px;color:var(--color-danger)">Preencha o GeoNames Username antes de buscar.</li>';
      ul.style.display = 'block';
      return;
    }
    clearTimeout(_timer);
    _timer = setTimeout(function(){
      ul.innerHTML = '<li style="padding:7px 12px;color:var(--color-text-secondary);font-style:italic">Buscando...</li>';
      ul.style.display = 'block';
      var url = 'https://secure.geonames.org/searchJSON?q='+encodeURIComponent(q)
              + '&maxRows=20&featureClass=P&style=FULL&username='+encodeURIComponent(user);
      fetch(url)
        .then(function(r){ return r.json(); })
        .then(function(data){
          ul.innerHTML = '';
          if (data.status) {
            ul.innerHTML = '<li style="padding:7px 12px;color:var(--color-danger)">Erro GeoNames: '+escapeHtml(data.status.message)+'</li>';
            ul.style.display = 'block';
            return;
          }
          var list = data.geonames || [];
          if (!list.length) {
            ul.innerHTML = '<li style="padding:7px 12px;color:var(--color-text-secondary);font-style:italic">Nenhum resultado.</li>';
            ul.style.display = 'block';
            return;
          }
          list.forEach(function(p){
            var tzId  = (p.timezone && p.timezone.timeZoneId) || '';
            var off   = (p.timezone && p.timezone.gmtOffset != null) ? p.timezone.gmtOffset : 0;
            var lat   = parseFloat(p.lat||0);
            var lng   = parseFloat(p.lng||0);
            var state = p.adminName1 || '';
            var cntry = p.countryName || '';
            var li = document.createElement('li');
            li.style.cssText = 'padding:7px 12px;cursor:pointer;color:var(--color-text-primary);border-bottom:1px solid #f1f5f9';
            li.className = 'loc-suggestion-item';
            li.innerHTML = '<strong>'+escapeHtml(p.name)+'</strong>'
              +'<span style="color:#555;font-size:12px;margin-left:6px">'
              +[state,cntry].filter(Boolean).map(escapeHtml).join(', ')+'</span>'
              +'<div style="font-size:11px;color:#888;margin-top:1px;font-family:monospace">'
              +'Lat: '+lat.toFixed(4)+'  Lon: '+lng.toFixed(4)
              +(tzId ? '  UTC'+(off>=0?'+':'')+off : '')+'</div>';
            li.addEventListener('mousedown', function(e){
              e.preventDefault();
              locSelect({name:p.name, state:state, country:cntry, lat:lat, lng:lng, offset:off, tz:tzId});
            });
            ul.appendChild(li);
          });
          ul.style.display = 'block';
        })
        .catch(function(err){
          ul.innerHTML = '<li style="padding:7px 12px;color:var(--color-danger)">Erro de conexão. Tente novamente.</li>';
          ul.style.display = 'block';
        });
    }, 350);
  }

  // Botão Testar
  window.testGeonames = function() {
    var user = getUser();
    var res = document.getElementById('geonames_test_result');
    res.style.display = 'block';
    if (!user) { res.style.color='var(--color-danger)'; res.textContent='Preencha o username.'; return; }
    res.style.color = 'var(--color-text-secondary)';
    res.textContent = 'Testando...';
    var url = 'https://secure.geonames.org/searchJSON?q=London&maxRows=1&username='+encodeURIComponent(user);
    fetch(url)
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status) {
          res.style.color = 'var(--color-danger)';
          res.textContent = '✗ Erro: '+data.status.message;
        } else if (data.geonames && data.geonames.length > 0) {
          res.style.color = '#16a34a';
          res.textContent = '✓ Username válido e funcionando!';
        } else {
          res.style.color = 'var(--color-danger)';
          res.textContent = '✗ Resposta inesperada. Verifique o username.';
        }
      })
      .catch(function(){
        res.style.color = 'var(--color-danger)';
        res.textContent = '✗ Erro de conexão.';
      });
  };

  document.addEventListener('mousedown', function(e){
    if (!ul.contains(e.target) && e.target !== inp) ul.style.display='none';
  });

  function locSelect(p) {
    document.getElementById('lat').value      = p.lat.toFixed(5);
    document.getElementById('lon').value      = p.lng.toFixed(5);
    document.getElementById('tzOffset').value = p.offset;
    document.getElementById('loc_sel_name').textContent   = p.name;
    document.getElementById('loc_sel_detail').textContent =
      [p.state, p.country].filter(Boolean).join(', ')
      + ' · Lat '+p.lat.toFixed(4)+' · Lon '+p.lng.toFixed(4)
      + ' · UTC'+(p.offset>=0?'+':'')+p.offset;
    document.getElementById('loc_selected_box').style.display = 'block';
    inp.value = '';
    ul.style.display = 'none';
  }

  window.locClear = function(){
    document.getElementById('lat').value = '';
    document.getElementById('lon').value = '';
    document.getElementById('tzOffset').value = '-3';
    document.getElementById('loc_selected_box').style.display = 'none';
    inp.value = '';
  };
})(); // fim GeoNames IIFE
// ─── DIREÇÕES DE VALENS (Circumambulações pelos Termos Egípcios) ──────────────
(function(){
  const EPS = 23.4367 * Math.PI / 180; // obliquidade eclíptica

  function obliqueAsc(lonDeg, latDeg) {
    const lon = ((lonDeg % 360) + 360) % 360 * Math.PI / 180;
    const lat = latDeg * Math.PI / 180;
    const ra  = Math.atan2(Math.sin(lon) * Math.cos(EPS), Math.cos(lon)) * 180 / Math.PI;
    const dec = Math.asin(Math.sin(EPS) * Math.sin(lon));
    const ad  = Math.asin(Math.max(-1, Math.min(1, Math.tan(lat) * Math.tan(dec)))) * 180 / Math.PI;
    return ((ra - ad) % 360 + 360) % 360;
  }

  function risingTime(from, to, latDeg) {
    const d = (obliqueAsc(to, latDeg) - obliqueAsc(from, latDeg) + 360) % 360;
    return d;
  }

  function getTerm(lon) {
    const l   = ((lon % 360) + 360) % 360;
    const s   = Math.floor(l / 30);
    const deg = l - s * 30;
    let prev  = 0;
    for (const [pi, end] of EGYPTIAN_TERMS[s]) {
      if (deg < end) return { planet: pi, startLon: s * 30 + prev, endLon: s * 30 + end };
      prev = end;
    }
    return { planet: 6, startLon: s * 30 + 25, endLon: (s + 1) * 30 };
  }

  // Encontra longitude dirigida para uma idade (em anos) via ascensão oblíqua
  function directedLon(startLon, ageYears, latDeg) {
    let curLon   = norm360(startLon);
    let ageAccum = 0;
    for (let safety = 0; safety < 300 && ageAccum < ageYears; safety++) {
      const term   = getTerm(curLon);
      const rt     = risingTime(curLon, term.endLon, latDeg);
      if (rt < 0.001) { curLon = (term.endLon + 0.01 + 360) % 360; continue; }
      if (ageAccum + rt > ageYears) {
        // interpola dentro do termo por busca binária
        const remaining = ageYears - ageAccum;
        let lo = curLon, hi = term.endLon;
        for (let i = 0; i < 50; i++) {
          const mid = (lo + hi) / 2;
          const rt2 = risingTime(curLon, mid, latDeg);
          if (Math.abs(rt2 - remaining) < 0.0001) break;
          if (rt2 < remaining) lo = mid; else hi = mid;
        }
        return ((lo + hi) / 2 % 360 + 360) % 360;
      }
      ageAccum += rt;
      curLon = (term.endLon + 360) % 360;
    }
    if (ageAccum < ageYears) {
      console.warn('directedLon: loop de segurança encerrou sem convergir (ageAccum=' + ageAccum.toFixed(4) + ', ageYears=' + ageYears + ')');
    }
    return curLon;
  }

  function fmtLon(lon) {
    const l   = ((lon % 360) + 360) % 360;
    const s   = Math.floor(l / 30);
    const deg = Math.floor(l % 30);
    const min = Math.round((l % 30 - deg) * 60);
    const sym = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
    const nm  = SIGN_NAMES[s];
    return `${sym[s]} ${nm} ${deg}°${String(min < 60 ? min : 0).padStart(2,'0')}'`;
  }

  // ── Direções de Valens (Parte 1/6) ──────────────────────────────────────────
  // Portado de circumambulacoes_panel.php (Vécio Valente — Termos Egípcios)

  // Grau/min sem signo, ex: "18°24'" — equivale a $deg_only do PHP
  function degOnly(lon) {
    const l = ((lon % 360) + 360) % 360;
    const s = Math.floor(l / 30);
    let deg = Math.floor(l - s * 30);
    let min = Math.round((l - s * 30 - deg) * 60);
    if (min >= 60) { deg++; min = 0; }
    return `${deg}°${String(min).padStart(2,'0')}'`;
  }

  // Idade (anos) → "dd/mm/aaaa", a partir da data de nascimento (equivale a dist_jd_to_date)
  function ageToDateStr(birthDate, ageYears) {
    const d  = new Date(birthDate.getTime() + ageYears * 365.25 * 86400000);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  // Caminha pelos Termos Egípcios desde a idade 0 até maxAgeYears, devolvendo os períodos
  // percorridos (planeta regente do termo, longitudes e idades de entrada/saída).
  // Equivale a dist_calc() do PHP (linhas 137-194), sem os "encounters" (isso é a Parte 4).
  function buildValensPeriods(aphetaLon, latDeg, targetAgeYears, maxAgeYears = 120) {
    const periods = [];
    let curLon   = norm360(aphetaLon);
    let ageStart = 0;
    let safety   = 0;
    while (ageStart < maxAgeYears && safety++ < 300) {
      const term   = getTerm(curLon);
      const endLon = term.endLon;
      const rt     = risingTime(curLon, endLon, latDeg);
      if (rt < 0.001) { curLon = (endLon + 0.01 + 360) % 360; continue; }
      const ageEnd = Math.min(ageStart + rt, maxAgeYears);
      const isCurrent = targetAgeYears >= ageStart && targetAgeYears < ageEnd;
      periods.push({ planet: term.planet, lonStart: curLon, lonEnd: endLon, ageStart, ageEnd, isCurrent });
      ageStart += rt;
      curLon = (endLon + 360) % 360;
    }
    return periods;
  }

  // Bloco Direta: posição dirigida do apheta na idade-alvo + termo egípcio atual + datas
  // de entrada/saída do termo. Equivale à parte "Direta" do JSON do PHP (linhas 682-687).
  // Ainda SEM hits (nearby_hits fica para a Parte 4).
  function computeDireta(natalLon, latDeg, birthDate, targetAgeYears) {
    const aphetaCurLon = directedLon(natalLon, targetAgeYears, latDeg);
    const periods = buildValensPeriods(natalLon, latDeg, targetAgeYears);
    const cur = periods.find(p => p.isCurrent) || periods[periods.length - 1] || null;
    return {
      aphetaCurLon,
      termPlanet:     cur ? cur.planet : null,
      termPlanetSym:  cur ? PROF_PLANET_SYMS[cur.planet] : '',
      termPlanetName: cur ? TERM_PLANETS[cur.planet]     : '',
      termStart: cur ? `${ageToDateStr(birthDate, cur.ageStart)} - ${degOnly(cur.lonStart)}` : '',
      termEnd:   cur ? `${ageToDateStr(birthDate, cur.ageEnd)} - ${degOnly(cur.lonEnd)}`     : '',
    };
  }

  // Bloco Conversa: reflexão do arco direto (ponto espelhado através do apheta natal) +
  // termo egípcio da conversa + datas. Percurso invertido: entra pelo END do termo, sai pelo
  // START (equivale às linhas 663-678 do PHP).
  function computeConversa(natalLon, latDeg, birthDate, aphetaCurLon) {
    const directArc = ((aphetaCurLon - natalLon) % 360 + 360) % 360;
    const convLon   = ((natalLon - directArc) % 360 + 360) % 360;
    const term      = getTerm(convLon);
    const convAgeEnter = risingTime(term.endLon,   natalLon, latDeg);
    const convAgeExit  = risingTime(term.startLon, natalLon, latDeg);
    return {
      convLon,
      termPlanet:     term.planet,
      termPlanetSym:  PROF_PLANET_SYMS[term.planet],
      termPlanetName: TERM_PLANETS[term.planet],
      termStart: `${ageToDateStr(birthDate, convAgeEnter)} - ${degOnly(term.endLon)}`,
      termEnd:   `${ageToDateStr(birthDate, convAgeExit)} - ${degOnly(term.startLon)}`,
    };
  }

  // ── Motor de hits (Parte 4/6) ────────────────────────────────────────────
  // Equivale às linhas 494-659 do PHP: 4 camadas de encontros (Apantesis) dentro de 3° de
  // orbe zodiacal da posição dirigida atual (Direta ou Conversa).
  const VALENS_ASP_OFFSETS = { Cnj:0, Sex:60, Qua:90, Tri:120, Opo:180, SexD:300, QuaD:270, TriD:240 };
  const VALENS_ASP_NAMES   = { Cnj:'Conjunção', Sex:'Sextil', Qua:'Quadratura', Tri:'Trígono', Opo:'Oposição',
                                SexD:'Sextil', QuaD:'Quadratura', TriD:'Trígono' };
  const VALENS_ASP_SYMS    = { 'Conjunção':'☌', 'Sextil':'⚹', 'Quadratura':'□', 'Trígono':'△', 'Oposição':'☍' };

  // Distância zodiacal mínima entre dois pontos (0-180°)
  function zodiacDist(a, b) {
    return Math.abs((((a - b) % 360) + 540) % 360 - 180);
  }

  // "18°24' Capricórnio" — grau depois do signo (equivale a $lon_str do PHP)
  function degSignStr(lon) {
    const l = ((lon % 360) + 360) % 360;
    return `${degOnly(l)} ${SIGN_NAMES[Math.floor(l / 30)]}`;
  }

  // "Escorpião 18°24'" — signo antes do grau (equivale a $clean_lon do PHP)
  function signDegStr(lon) {
    const l = ((lon % 360) + 360) % 360;
    return `${SIGN_NAMES[Math.floor(l / 30)]} ${degOnly(l)}`;
  }

  function houseOf(lon, ascSign) {
    return (((Math.floor((((lon % 360) + 360) % 360) / 30) - ascSign + 12) % 12) + 1);
  }

  // "Escorpião 18°24' C5" — dodecatemória formatada com casa (equivale a $dodeca_str do PHP)
  function dodecaStr(lon, ascSign) {
    const dl = dodecaLon(lon);
    return `${signDegStr(dl)} C${houseOf(dl, ascSign)}`;
  }

  // planetLons: array de 7 longitudes natais na ordem Sol,Lua,Mercúrio,Vênus,Marte,Júpiter,Saturno
  // (mesma ordem de TERM_PLANETS/PROF_PLANET_SYMS)
  function computeValensHits(natalLon, aphetaCurLon, convLon, latDeg, ascLon, planetLons) {
    const ascSign = Math.floor((((ascLon % 360) + 360) % 360) / 30);
    const hits = [];

    for (let pidx = 0; pidx < 7; pidx++) {
      const plon = planetLons[pidx];
      if (plon == null || isNaN(plon)) continue;
      const house = houseOf(plon, ascSign);

      for (const aspKey in VALENS_ASP_OFFSETS) {
        const offset = VALENS_ASP_OFFSETS[aspKey];
        const aspFull = VALENS_ASP_NAMES[aspKey];
        const target = ((plon + offset) % 360 + 360) % 360;

        // Camada A — planeta natal, Direta
        if (zodiacDist(aphetaCurLon, target) <= 3.0) {
          const ageHit = risingTime(natalLon, target, latDeg);
          hits.push({
            planetName: TERM_PLANETS[pidx], planetSym: PROF_PLANET_SYMS[pidx],
            lonStr: degSignStr(plon), dirLonStr: signDegStr(target),
            dodecaDir: dodecaStr(target, ascSign), dodecaPlanet: dodecaStr(plon, ascSign),
            house, aspect: aspFull, aspectSym: VALENS_ASP_SYMS[aspFull],
            age: Math.round(ageHit * 10000) / 10000, isDodeca: false, isConv: false,
          });
        }

        // Camada B — planeta natal, Conversa
        if (zodiacDist(convLon, target) <= 3.0) {
          const sym    = ((2 * natalLon - target) % 360 + 360) % 360;
          const ageConv = risingTime(natalLon, sym, latDeg);
          hits.push({
            planetName: TERM_PLANETS[pidx], planetSym: PROF_PLANET_SYMS[pidx],
            lonStr: degSignStr(plon), dirLonStr: signDegStr(target),
            dodecaDir: dodecaStr(target, ascSign), dodecaPlanet: dodecaStr(plon, ascSign),
            house, aspect: aspFull, aspectSym: VALENS_ASP_SYMS[aspFull],
            age: Math.round(ageConv * 10000) / 10000, isDodeca: false, isConv: true,
          });
        }
      }

      // Dodecatemória do planeta natal (camadas C e D)
      const dlon    = dodecaLon(plon);
      const dHouse  = houseOf(dlon, ascSign);

      for (const aspKey in VALENS_ASP_OFFSETS) {
        const offset = VALENS_ASP_OFFSETS[aspKey];
        const aspFull = VALENS_ASP_NAMES[aspKey];
        const target = ((dlon + offset) % 360 + 360) % 360;

        // Camada C — dodecatemória, Direta (peculiaridade fiel ao PHP linha 613:
        // dir_lon_str usa dlon-offset, não dlon+offset)
        if (zodiacDist(aphetaCurLon, target) <= 3.0) {
          const ageHit = risingTime(natalLon, target, latDeg);
          const dirLonPeculiar = ((dlon - offset) % 360 + 360) % 360;
          hits.push({
            planetName: TERM_PLANETS[pidx], planetSym: PROF_PLANET_SYMS[pidx],
            lonStr: degSignStr(dlon), dirLonStr: signDegStr(dirLonPeculiar),
            dodecaDir: '', dodecaPlanet: '',
            house: dHouse, aspect: aspFull, aspectSym: VALENS_ASP_SYMS[aspFull],
            age: Math.round(ageHit * 10000) / 10000, isDodeca: true, isConv: false,
          });
        }

        // Camada D — dodecatemória, Conversa (aqui dir_lon_str usa dlon+offset = target, PHP linha 647)
        if (zodiacDist(convLon, target) <= 3.0) {
          const sym     = ((2 * natalLon - target) % 360 + 360) % 360;
          const ageConv = risingTime(natalLon, sym, latDeg);
          hits.push({
            planetName: TERM_PLANETS[pidx], planetSym: PROF_PLANET_SYMS[pidx],
            lonStr: degSignStr(dlon), dirLonStr: signDegStr(target),
            dodecaDir: '', dodecaPlanet: '',
            house: dHouse, aspect: aspFull, aspectSym: VALENS_ASP_SYMS[aspFull],
            age: Math.round(ageConv * 10000) / 10000, isDodeca: true, isConv: true,
          });
        }
      }
    }

    hits.sort((a, b) => a.age - b.age);
    return hits;
  }

  // ── Contexto Profecção (Parte 5/6) ───────────────────────────────────────
  // Posições Direta/Conversa (+dodecatemória) do Regente do Ascendente natal e do
  // Regente da Profecção do ano-alvo. Reaproveita PROF_RULER_IDX/PROF_SIGN_RULERS/
  // PROF_PLANET_SYMS/profLonOf/yearDays já existentes (usados por getProfectionDetails).
  // natLonArray: [sol,lua,mer,ven,mar,jup,sat] — mesma ordem de TERM_PLANETS.
  function computeProfectionContext(natLonArray, ascLon, latDeg, birthDate, targetDate, targetAgeYears) {
    const ascLonNorm = ((ascLon % 360) + 360) % 360;
    const ascSign    = Math.floor(ascLonNorm / 30);

    let diffDias = (targetDate.getTime() - birthDate.getTime()) / 86400000;
    if (diffDias < 0) diffDias = 0;
    const advance    = diffDias * (30.0 / yearDays);
    const profAscLon = profLonOf(ascLonNorm, advance);
    const profSign   = Math.floor(profAscLon / 30);

    function rulerBlock(signIdx) {
      const idx    = PROF_RULER_IDX[signIdx];
      const natLon = natLonArray[idx];
      const dLon   = directedLon(natLon, targetAgeYears, latDeg);
      const dDod   = dodecaLon(dLon);
      const directArc = ((dLon - natLon) % 360 + 360) % 360;
      const cLon   = ((natLon - directArc) % 360 + 360) % 360;
      const cDod   = dodecaLon(cLon);
      return { idx, name: PROF_SIGN_RULERS[signIdx], sym: PROF_PLANET_SYMS[idx], dLon, dDod, cLon, cDod };
    }

    return { ascRuler: rulerBlock(ascSign), profRuler: rulerBlock(profSign) };
  }

  window.calculateDirecoes = function() {
    const el = document.getElementById('dir-result');
    el.innerHTML = '<span style="color:#888;font-size:12px">Calculando…</span>';

    if (!lastPlanetsData) {
      el.innerHTML = '<span style="color:var(--color-danger);font-size:12px">Calcule o Mapa primeiro (aba Mandala).</span>'; return;
    }
    const bdRaw = parseBirthDate(getVal('birthDate')) || '';
    if (!bdRaw) {
      el.innerHTML = '<span style="color:var(--color-danger);font-size:12px">Insira a data de nascimento.</span>'; return;
    }
    const dateVal = parseBirthDate(getVal('dir-target-date'));
    if (!dateVal) {
      el.innerHTML = '<span style="color:var(--color-danger);font-size:12px">Informe a data alvo.</span>'; return;
    }
    const latDeg = parseFloat(getVal('lat'));
    if (isNaN(latDeg)) {
      el.innerHTML = '<span style="color:var(--color-danger);font-size:12px">Preencha a Latitude (campo Lat) para calcular ascensão oblíqua.</span>'; return;
    }

    const [by,bm,bd_] = bdRaw.split('-').map(Number);
    const [ty,tm,td]  = dateVal.split('-').map(Number);
    const birthJD  = jd(by, bm, bd_);
    const targetJD = jd(ty, tm, td);
    const ageYears = Math.max(0, (targetJD - birthJD) / 365.25);

    const { planets, asc } = lastPlanetsData;
    const isDay = ((planets.sol - asc + 360) % 360) >= 180;
    const fortunaLon = isDay
      ? ((asc + planets.lua - planets.sol) % 360 + 360) % 360
      : ((asc + planets.sol - planets.lua) % 360 + 360) % 360;
    const spiritLon = ((2 * asc - fortunaLon) % 360 + 720) % 360;

    const points = [
      { label: 'ASC',      lon: asc },
      { label: '☉ Sol',    lon: planets.sol },
      { label: '☽ Lua',    lon: planets.lua },
      { label: '☿ Mer',    lon: planets.mer },
      { label: '♀ Vên',    lon: planets.ven },
      { label: '♂ Mar',    lon: planets.mar },
      { label: '♃ Júp',    lon: planets.jup },
      { label: '♄ Sat',    lon: planets.sat },
      { label: '⊕ Fortuna',lon: fortunaLon  },
      { label: '⊗ Espírito',lon: spiritLon  },
    ];

    const [d_,m_,y_] = [String(td).padStart(2,'0'), String(tm).padStart(2,'0'), ty];
    let html = `<div style="font-size:11px;color:#888;margin-bottom:8px">Data: ${d_}/${m_}/${y_} · Idade: ${ageYears.toFixed(2)}a · Lat: ${latDeg.toFixed(4)}°</div>`;
    html += `<table style="border-collapse:collapse;font-size:12px;width:100%">
      <thead><tr style="border-bottom:2px solid var(--color-border)">
        <th style="text-align:left;padding:4px 8px;font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#888">Ponto</th>
        <th style="text-align:left;padding:4px 8px;font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#888">Natal</th>
        <th style="text-align:left;padding:4px 8px;font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#888">Dirigido</th>
        <th style="text-align:left;padding:4px 8px;font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#888">Termo</th>
        <th style="text-align:left;padding:4px 8px;font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#888">Dodeca</th>
      </tr></thead><tbody>`;

    for (const pt of points) {
      if (pt.lon == null || isNaN(pt.lon)) continue;
      const dirLon  = directedLon(pt.lon, ageYears, latDeg);
      const term    = getTerm(dirLon);
      const termName= TERM_PLANETS[term.planet];
      const dod     = dodecaLon(dirLon);
      const termDod = getTerm(dod);

      html += `<tr style="border-bottom:1px solid var(--color-surface)">
        <td style="padding:5px 8px;font-weight:700;white-space:nowrap">${pt.label}</td>
        <td style="padding:5px 8px;white-space:nowrap;color:#888;font-size:11px">${fmtLon(pt.lon)}</td>
        <td style="padding:5px 8px;white-space:nowrap">${fmtLon(dirLon)}</td>
        <td style="padding:5px 8px;white-space:nowrap;color:var(--color-accent)">${termName}</td>
        <td style="padding:5px 8px;white-space:nowrap">${fmtLon(dod)} <span style="color:#888;font-size:11px">${TERM_PLANETS[termDod.planet]}</span></td>
      </tr>`;
    }
    html += '</tbody></table>';
    el.innerHTML = html;
  };

  // Linha de um hit: "☿ Mercúrio ⬡18°24' Capricórnio ⚹ → Escorpião 18°24'"
  function valensHitLine(h) {
    const dodMark = h.isDodeca ? '⬡' : '';
    return `<div style="font-size:12px;padding:1px 0;white-space:nowrap">${h.planetSym} ${h.planetName} ${dodMark}${h.lonStr} ${h.aspectSym} → ${h.dirLonStr}</div>`;
  }

  // Bloco "D / Dod / C / Dod" de um regente no Contexto Profecção
  function valensRulerBlock(r, label) {
    return `
      <div style="font-size:12px;margin-top:6px"><b>${r.sym} ${r.name}</b> <span style="color:#888;font-size:11px">(${label})</span></div>
      <div style="font-size:11px;color:#555">D: &nbsp;${degSignStr(r.dLon)}</div>
      <div style="font-size:11px;color:#888;padding-left:10px">Dod: ${degSignStr(r.dDod)}</div>
      <div style="font-size:11px;color:#555">C: &nbsp;${degSignStr(r.cLon)}</div>
      <div style="font-size:11px;color:#888;padding-left:10px">Dod: ${degSignStr(r.cDod)}</div>`;
  }

  // "Direções de Valens": card da aba Análise Geral (circumambulação pelos Termos Egípcios do
  // Ascendente natal). Substitui a tabela simples anterior. Reaproveita computeDireta/
  // computeConversa/computeValensHits/computeProfectionContext (Partes 1-5).
  window.miniDirecoes = function(targetDate, pointSel) {
    if (!lastPlanetsData) return '<span style="color:var(--color-danger);font-size:12px">Calcule o Mapa primeiro (aba Mandala).</span>';
    const { birthDateInput, birthDate } = getInputs();
    if (!birthDateInput) return '<span style="color:var(--color-danger);font-size:12px">Insira a data de nascimento.</span>';
    const latDeg = parseFloat(getVal('lat'));
    if (isNaN(latDeg)) return '<span style="color:var(--color-danger);font-size:12px">Preencha a Latitude (campo Lat) para calcular ascensao obliqua.</span>';

    const ageYears = Math.max(0, (targetDate.getTime() - birthDate.getTime()) / (1000*60*60*24*365.25));
    const { planets, asc } = lastPlanetsData;
    const natLonArray = [planets.sol, planets.lua, planets.mer, planets.ven, planets.mar, planets.jup, planets.sat];

    // Resolve o Ponto Direcionado (mesma função compartilhada usada em calculateProfecao)
    pointSel = pointSel || 'asc';
    const pointLabel = POINT_LABELS[pointSel] || 'Ascendente';
    const pointLon = resolvePointLon(pointSel, planets, asc);

    const direta   = computeDireta(pointLon, latDeg, birthDate, ageYears);
    const conversa = computeConversa(pointLon, latDeg, birthDate, direta.aphetaCurLon);
    const hits     = computeValensHits(pointLon, direta.aphetaCurLon, conversa.convLon, latDeg, asc, natLonArray);
    const hitsDireta   = hits.filter(h => !h.isConv);
    const hitsConversa = hits.filter(h =>  h.isConv);
    const profCtx  = computeProfectionContext(natLonArray, asc, latDeg, birthDate, targetDate, ageYears);

    let html = `<div style="font-size:11px;color:#888;margin-bottom:6px">Idade: ${ageYears.toFixed(2)}a · Lat: ${latDeg.toFixed(4)}°</div>`;
    html += `<div style="font-weight:700;font-size:13px;margin-bottom:6px">Direções de Valens</div>`;

    // ── Direta ──
    html += `<div style="font-weight:700;color:var(--color-accent);font-size:12px;margin:4px 0 2px">Direta</div>`;
    html += `<div style="font-size:12px"><b>${pointLabel}</b> &nbsp; ${signDegStr(direta.aphetaCurLon)}</div>`;
    html += `<div style="font-size:11px;color:#888">Termos egípcios - ${direta.termPlanetName}</div>`;
    html += `<div style="font-size:11px;color:#888;margin-bottom:3px">${direta.termStart} → ${direta.termEnd}</div>`;
    html += hitsDireta.length
      ? hitsDireta.map(valensHitLine).join('')
      : `<div style="font-size:11px;color:#bbb">Sem encontros próximos</div>`;

    // ── Conversa ──
    html += `<div style="font-weight:700;color:var(--color-accent);font-size:12px;margin:8px 0 2px">Conversa</div>`;
    html += `<div style="font-size:12px"><b>${pointLabel}</b> &nbsp; ${signDegStr(conversa.convLon)}</div>`;
    html += `<div style="font-size:11px;color:#888">Termos egípcios - ${conversa.termPlanetName}</div>`;
    html += `<div style="font-size:11px;color:#888;margin-bottom:3px">${conversa.termStart} → ${conversa.termEnd}</div>`;
    html += hitsConversa.length
      ? hitsConversa.map(valensHitLine).join('')
      : `<div style="font-size:11px;color:#bbb">Sem encontros próximos</div>`;

    // ── Contexto Profecção ──
    html += `<div style="font-weight:700;color:var(--color-accent);font-size:12px;margin:8px 0 2px">Contexto Profecção <span style="font-weight:400;color:#888;font-size:10px">(planeta e abaixo sua dodeca)</span></div>`;
    html += valensRulerBlock(profCtx.ascRuler,  'Reg. Ascendente');
    html += valensRulerBlock(profCtx.profRuler, 'Reg. Profecção');

    return html;
  };
})();
// ─── LIBERAÇÃO ZODIACAL (mini-card) ──────────────────────────────────────────

(function(){
  const VL_SY   = [15,8,20,25,19,20,8,15,12,27,30,12]; // anos por signo
  const VL_TM   = 211; // total meses (sum)
  const VL_SYMS = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
  const VL_NAMES= ['Áries','Touro','Gêmeos','Câncer','Leão','Virgem',
                   'Libra','Escorpião','Sagitário','Capricórnio','Aquário','Peixes'];
  const VL_PL_SYMS  = ['☉','☽','☿','♀','♂','♃','♄','♅','♆','♇'];
  const VL_PL_NAMES = ['Sol','Lua','Mercúrio','Vênus','Marte','Júpiter','Saturno','Urano','Netuno','Plutão'];
  const VL_PL_KEYS  = ['sol','lua','mer','ven','mar','jup','sat','ura','net','plu'];

  function vlJD(y,m,d){
    if(m<=2){y--;m+=12;}
    const A=Math.floor(y/100),B=2-A+Math.floor(A/4);
    return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+d+B-1524.5;
  }
  function vlJDtoStr(jd){
    // JD → dd/mm/aaaa
    const z=Math.floor(jd+0.5),f=jd+0.5-z;
    let A=z; if(z>=2299161){const a=Math.floor((z-1867216.25)/36524.25);A=z+1+a-Math.floor(a/4);}
    const B=A+1524,C=Math.floor((B-122.1)/365.25),D=Math.floor(365.25*C),E=Math.floor((B-D)/30.6001);
    const day=B-D-Math.floor(30.6001*E);
    const month=E<14?E-1:E-13;
    const year=month>2?C-4716:C-4715;
    return String(day).padStart(2,'0')+'/'+String(month).padStart(2,'0')+'/'+year;
  }
  function fmtDeg(fdeg){
    const d=Math.floor(fdeg),m=Math.round((fdeg-d)*60);
    return (m===60?d+1:d)+'°'+String(m===60?0:m).padStart(2,'0')+"'";
  }

  // Cálculo principal (conversão direta do vl_calc_date do PHP) — L1, L2, L3
  function vlCalcDate(lotSign, birthJD, targetJD, startDeg){
    const L1D=365.25, L2D=365.25/12, L3D=1.0;
    const days=Math.max(0, targetJD-birthJD);
    // L1
    let l1Elapsed=0,l1Sign=lotSign,l1Start=0,l1Idx=0;
    for(let i=0;i<200;i++){
      const s=(lotSign+i)%12;
      const frac=(i===0&&startDeg>0)?(1-startDeg/30):1;
      const dur=VL_SY[s]*L1D*frac;
      if(days<l1Elapsed+dur){l1Sign=s;l1Start=l1Elapsed;l1Idx=i;break;}
      l1Elapsed+=dur;
    }
    const intoL1=days-l1Start;
    const l1Frac=(l1Idx===0&&startDeg>0)?(1-startDeg/30):1;
    const l1Dur=VL_SY[l1Sign]*L1D*l1Frac;
    const lobDays=VL_TM*(L2D);
    const afterLob=(l1Dur>lobDays&&intoL1>=lobDays);
    const l2Ref=afterLob?intoL1-lobDays:intoL1;
    const l2Ss=afterLob?(l1Sign+6)%12:l1Sign;
    // L2
    let l2Elapsed=0,l2Sign=l2Ss,l2Idx=0;
    for(let j=0;j<200;j++){
      const s2=(l2Ss+j)%12,d2=VL_SY[s2]*L2D;
      if(l2Ref<l2Elapsed+d2){l2Sign=s2;l2Idx=j;break;}
      l2Elapsed+=d2;
    }
    const intoL2=l2Ref-l2Elapsed;
    const l2Dur=VL_SY[l2Sign]*L2D;
    const lob2Days=VL_TM*L3D;
    const afterLob2=(l2Dur>lob2Days&&intoL2>=lob2Days);
    const l3Ref=afterLob2?intoL2-lob2Days:intoL2;
    const l3Ss=afterLob2?(l2Sign+6)%12:l2Sign;
    // L3
    let l3El=0,l3Sign=l3Ss;
    for(let k=0;k<1000;k++){
      const s3=(l3Ss+k)%12,d3=VL_SY[s3]*L3D;
      if(l3Ref<l3El+d3){l3Sign=s3;break;}
      l3El+=d3;
    }
    const intoL3=l3Ref-l3El;
    const l3Dur=VL_SY[l3Sign]*L3D;
    return {days,l1Sign,l1Start,l1Idx,l1Dur,lobDays,intoL1,afterLob,
            l2Sign,l2Ss,l2Elapsed,intoL2,l2Dur,lob2Days,afterLob2,
            l3Sign,l3Ss,intoL3,l3Dur,
            lobInL1:(l1Dur>lobDays), lob2InL2:(l2Dur>lob2Days)};
  }

  window.calculateLiberacao = function(){
    const el=document.getElementById('vl-result');
    el.innerHTML='<span style="color:#888;font-size:12px">Calculando…</span>';

    // Dados de nascimento
    const bdRaw=parseBirthDate(getVal('birthDate'))||'';
    if(!bdRaw){el.innerHTML='<span style="color:var(--color-danger);font-size:12px">Insira a data de nascimento.</span>';return;}
    const [by,bm,bd_]=bdRaw.split('-').map(Number);
    const birthJD=vlJD(by,bm,bd_);

    // Precisa do mapa calculado para planetas
    if(!lastPlanetsData){
      el.innerHTML='<span style="color:var(--color-danger);font-size:12px">Calcule o Mapa primeiro (aba Mandala).</span>';return;
    }
    const {planets,asc}=lastPlanetsData;

    // Ponto de liberação
    const selVal=getVal('vl-sign-sel');
    let lotSign,startDeg=0;
    if(selVal==='-1'){
      // Fortuna: dia=(asc+lua-sol), noite=(asc+sol-lua)
      const isDay=norm360(planets.sol-asc)>=180;
      const fortunaLon=isDay?norm360(asc+planets.lua-planets.sol)
                             :norm360(asc+planets.sol-planets.lua);
      lotSign=Math.floor(fortunaLon/30);
      startDeg=fortunaLon%30;
    } else {
      lotSign=parseInt(selVal);
      startDeg=0;
    }

    // Data alvo (input) ou hoje
    const vlDateVal = parseBirthDate(getVal('vl-target-date'));
    let targetY,targetM,targetD;
    if(vlDateVal){
      [targetY,targetM,targetD]=vlDateVal.split('-').map(Number);
    } else {
      const now=new Date();
      targetY=now.getFullYear();targetM=now.getMonth()+1;targetD=now.getDate();
    }
    const targetJD=vlJD(targetY,targetM,targetD);

    const c=vlCalcDate(lotSign,birthJD,targetJD,startDeg);

    // Graus de progresso
    const l1Deg=c.l1Dur>0?Math.min(29.99,c.intoL1/c.l1Dur*30):0;
    const l2Deg=c.l2Dur>0?Math.min(29.99,c.intoL2/c.l2Dur*30):0;
    const l3Deg=c.l3Dur>0?Math.min(29.99,c.intoL3/c.l3Dur*30):0;

    // Data de saída do L1
    const l1ExitJD=birthJD+c.l1Start+c.l1Dur;
    const l1ExitDate=vlJDtoStr(l1ExitJD);
    const l1NextSign=(c.l1Sign+1)%12;

    // Data do salto (LoB) do L1
    let lobDateStr=null,nextLobStr=null;
    if(c.lobInL1){
      const lobJD=birthJD+c.l1Start+c.lobDays;
      lobDateStr=vlJDtoStr(lobJD);
      if(!c.afterLob) nextLobStr=lobDateStr;
    }

    // Base JDs de cada nível (igual ao valens_panel.php)
    const l1BaseJD=birthJD+c.l1Start;
    const l2RefStart=l1BaseJD+(c.afterLob?c.lobDays:0);
    const l2BaseJD=l2RefStart+c.l2Elapsed;
    const l3IntoL2Offset=c.afterLob2?(c.intoL2-c.lob2Days):c.intoL2;
    const l3BaseJD=l2BaseJD+l3IntoL2Offset-c.intoL3;

    // Data do salto (LoB) do L2
    let lob2DateStr=null;
    if(c.lob2InL2){
      const lob2JD=l2BaseJD+c.lob2Days;
      lob2DateStr=vlJDtoStr(lob2JD);
    }

    // Aspectos natais futuros (natal + dodeca) contra um grau liberado — igual a calc_lib_asps do PHP
    const aspAngles={0:'conj.',60:'sext.',90:'quad.',120:'tríg.',180:'opas.'};
    function calcLibAsps(sign, degInSign, dur, baseJD){
      const libLon=sign*30+degInSign;
      const found=[];
      VL_PL_KEYS.forEach((k,pi)=>{
        if(pi>=10) return;
        const natLon=norm360(planets[k]||0);
        const sn=Math.floor(natLon/30), rel=natLon%30;
        const dodLon=norm360(sn*30+rel*12);
        [{lon:natLon,tag:''},{lon:dodLon,tag:' dod'}].forEach(body=>{
          let diff=Math.abs(libLon-body.lon)%360; if(diff>180) diff=360-diff;
          for(const [aspDeg,aspLabel] of Object.entries(aspAngles)){
            const orbVal=Math.abs(diff-Number(aspDeg));
            if(orbVal<=3.0){
              let aspDate='';
              if(dur>0&&baseJD>0){
                for(const dir of [1,-1]){
                  const tlon=norm360(body.lon+dir*Number(aspDeg));
                  if(Math.floor(tlon/30)===sign){
                    const exactFdeg=tlon%30;
                    aspDate=vlJDtoStr(baseJD+(exactFdeg/30)*dur);
                    break;
                  }
                }
              }
              found.push({sym:VL_PL_SYMS[pi],name:VL_PL_NAMES[pi]+body.tag,asp:aspLabel,deg:fmtDeg(degInSign),date:aspDate});
              break;
            }
          }
        });
      });
      return found;
    }
    const aspRowsL1=calcLibAsps(c.l1Sign,l1Deg,c.l1Dur,l1BaseJD);
    const aspRowsL2=calcLibAsps(c.l2Sign,l2Deg,c.l2Dur,l2BaseJD);
    const aspRowsL3=calcLibAsps(c.l3Sign,l3Deg,c.l3Dur,l3BaseJD);

    // Monta HTML
    const lobBadge=c.afterLob?'<span style="color:var(--color-danger);font-weight:bold;margin-left:4px">⚠ pós-salto</span>':'';
    const lob2Badge=c.afterLob2?'<span style="color:var(--color-danger);font-weight:bold;margin-left:4px">⚠</span>':'';

    const exitRow=`<tr><td colspan="3" style="padding:3px 0 1px;font-size:11px;color:#888;">→ entra em ${VL_SYMS[l1NextSign]} ${VL_NAMES[l1NextSign]} em ${l1ExitDate}</td></tr>`;
    const nextLobRow=nextLobStr?`<tr><td colspan="3" style="padding:2px 0 1px;font-size:11px;color:var(--color-danger);">⚠ próx. salto: ${nextLobStr}</td></tr>`:'';
    const lobRow=(lobDateStr&&c.afterLob)?`<tr><td colspan="3" style="padding:3px 0;font-size:11px;color:#888;">salto em ${lobDateStr}</td></tr>`:'';
    const lob2Row=lob2DateStr?`<tr><td colspan="3" style="padding:3px 0;font-size:11px;color:#888;">salto em ${lob2DateStr}</td></tr>`:'';

    function aspTable(rows,label){
      if(!rows.length) return '';
      let h=`<tr><td colspan="3" style="padding:5px 0 2px;font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#888;border-top:1px solid var(--color-border)">Aspectos ${label} (orbe 3°)</td></tr>`;
      rows.forEach(a=>{
        h+=`<tr>
          <td style="padding:1px 8px 1px 0;white-space:nowrap;font-size:12px">${a.sym} ${a.name}</td>
          <td style="padding:1px 6px 1px 0;white-space:nowrap;font-size:12px;color:#888">${a.asp} ${a.deg}</td>
          <td style="padding:1px 0;white-space:nowrap;font-size:12px;font-family:monospace">${a.date}</td>
        </tr>`;
      });
      return h;
    }

    el.innerHTML=`
      <div style="font-size:11px;color:#888;margin-bottom:6px">Data: ${String(targetD).padStart(2,'0')}/${String(targetM).padStart(2,'0')}/${targetY}</div>
      <table style="border-collapse:collapse;font-size:13px;width:100%;max-width:400px">
        <tr>
          <td style="padding:2px 10px 2px 0;white-space:nowrap">${VL_SYMS[c.l1Sign]} ${VL_NAMES[c.l1Sign]}</td>
          <td style="padding:2px 6px 2px 0;white-space:nowrap;font-family:monospace">${fmtDeg(l1Deg)}</td>
          <td style="padding:2px 0;white-space:nowrap;color:#888">L1${lobBadge}</td>
        </tr>
        ${exitRow}${nextLobRow}
        ${aspTable(aspRowsL1,'L1')}
        <tr>
          <td style="padding:2px 10px 2px 0;white-space:nowrap">${VL_SYMS[c.l2Sign]} ${VL_NAMES[c.l2Sign]}</td>
          <td style="padding:2px 6px 2px 0;white-space:nowrap;font-family:monospace">${fmtDeg(l2Deg)}</td>
          <td style="padding:2px 0;white-space:nowrap;color:#888">L2${lob2Badge}</td>
        </tr>
        ${lobRow}${lob2Row}
        ${aspTable(aspRowsL2,'L2')}
        <tr>
          <td style="padding:2px 10px 2px 0;white-space:nowrap">${VL_SYMS[c.l3Sign]} ${VL_NAMES[c.l3Sign]}</td>
          <td style="padding:2px 6px 2px 0;white-space:nowrap;font-family:monospace">${fmtDeg(l3Deg)}</td>
          <td style="padding:2px 0;white-space:nowrap;color:#888">L3</td>
        </tr>
        ${aspTable(aspRowsL3,'L3')}
      </table>`;
  };
})();

