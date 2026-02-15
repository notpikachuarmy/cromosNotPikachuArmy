// === CONFIGURACIÓN ===
const LINK_CSV_CROMOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQVmg-Qn17A0Ms4NLdYAbQHcwkVrvwPD7ORJxKlMDNcY6JGTfQ7p_i4LCiy0-B74Wcs_9Jwc1nZ1KfO/pub?output=csv';
const LINK_CSV_ALBUMES = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwFTVpC8PBxaPzki-PImk153OhSllxX3_iot9FdLpnVzYWJpxq8DbU5NHTkiXsZN2peQI9XkbD9gh1/pub?output=csv';

let BASE_DE_CROMOS = [];
let CONFIG_ALBUMES = [];
let SOBRES_TIENDA = {}; 
let gameState = {
    coins: 0, clickValue: 1, lvlClick: 1, autoValue: 0, lvlAuto: 0,
    inventario: [], fragmentos: {}, // { "TAG": cantidad }
    precios: { click: 50, auto: 100 }
};

async function cargarJuego() {
    try {
        const [resC, resA] = await Promise.all([fetch(LINK_CSV_CROMOS), fetch(LINK_CSV_ALBUMES)]);
        parsearCromos(await resC.text());
        parsearAlbumes(await resA.text());
        init();
    } catch (e) { console.error("Error en carga"); }
}

function parsearCromos(csv) {
    const filas = csv.split('\n').filter(f => f.trim() !== '').slice(1);
    BASE_DE_CROMOS = filas.map(f => {
        const [id, nombre, rareza, tags] = f.split(',').map(s => s.trim());
        return { id, nombre, rareza, tags: tags.split(';'), imagen: `Cromos/${id}.png` };
    });
}

function parsearAlbumes(csv) {
    const filas = csv.split('\n').filter(f => f.trim() !== '').slice(1);
    filas.forEach(f => {
        const [id, nombre, tags, inicio, fin, costo] = f.split(',').map(s => s.trim());
        const tagsArr = tags.split(';');
        const rutaImg = `Portadas/${id}.png`;
        CONFIG_ALBUMES.push({ id, nombre, portada: rutaImg, tags: tagsArr });
        SOBRES_TIENDA[id] = { costo: parseInt(costo), portada: rutaImg, tags: tagsArr, fecha: (inicio === 'null') ? null : { inicio, fin } };
    });
}

function init() {
    const local = localStorage.getItem('tototo_save_pro');
    if (local) gameState = JSON.parse(local);
    if (!gameState.fragmentos) gameState.fragmentos = {};
    renderShop();
    renderAlbums();
    actualizarInterfaz();
    setInterval(() => { if (gameState.autoValue > 0) { gameState.coins += gameState.autoValue; actualizarInterfaz(); } }, 1000);
}

// --- TIENDA Y SOBRES ---
function comprarSobre(id, conFrag = false) {
    const s = SOBRES_TIENDA[id];
    const tagBase = s.tags[0];

    if (conFrag) {
        if ((gameState.fragmentos[tagBase] || 0) < 50) return;
        gameState.fragmentos[tagBase] -= 50;
    } else {
        if (gameState.coins < s.costo) return;
        gameState.coins -= s.costo;
    }

    const rand = Math.random();
    let rareza = rand < 0.01 ? "UR" : rand < 0.05 ? "SSR" : rand < 0.15 ? "SR" : rand < 0.40 ? "R" : "N";
    const posibles = BASE_DE_CROMOS.filter(c => c.tags.some(t => s.tags.includes(t)) && c.rareza === rareza);
    const pool = posibles.length ? posibles : BASE_DE_CROMOS.filter(c => c.tags.some(t => s.tags.includes(t)));
    const premio = pool[Math.floor(Math.random() * pool.length)];

    if (gameState.inventario.includes(premio.id)) {
        const val = { "N": 1, "R": 2, "SR": 5, "SSR": 10, "UR": 25 };
        const tagGana = premio.tags[Math.floor(Math.random() * premio.tags.length)];
        gameState.fragmentos[tagGana] = (gameState.fragmentos[tagGana] || 0) + val[premio.rareza];
    } else {
        gameState.inventario.push(premio.id);
    }

    renderShop(); renderAlbums(); save(); actualizarInterfaz();
}

function renderShop() {
    const container = document.getElementById('pack-list');
    container.innerHTML = '';
    for (let id in SOBRES_TIENDA) {
        const s = SOBRES_TIENDA[id];
        const tagBase = s.tags[0];
        const f = gameState.fragmentos[tagBase] || 0;
        const div = document.createElement('div');
        div.className = 'shop-card';
        div.innerHTML = `
            <img src="${s.portada}" class="pack-img">
            <strong>${id}</strong>
            <p>${s.costo} 🪙</p>
            <button onclick="comprarSobre('${id}', false)">Comprar</button>
            <button style="margin-top:5px; background:${f >= 50 ? '#3498db' : '#ccc'}" 
                    ${f < 50 ? 'disabled' : ''} onclick="comprarSobre('${id}', true)">Canjear Gratis</button>
        `;
        container.appendChild(div);
    }
}

// --- MOCHILA E INVENTARIO ---
function abrirInventario() {
    const grid = document.getElementById('inv-grid');
    grid.innerHTML = '';
    const tags = Object.keys(gameState.fragmentos);
    if (tags.length === 0) grid.innerHTML = "<p>No tienes fragmentos aún.</p>";
    tags.forEach(t => {
        const cant = gameState.fragmentos[t];
        if (cant <= 0) return;
        const div = document.createElement('div');
        div.className = 'frag-item';
        div.innerHTML = `<strong>${t}</strong><div>${cant}/50</div>
            <div class="frag-bar-bg"><div class="frag-bar-fill" style="width:${Math.min((cant/50)*100, 100)}%"></div></div>`;
        grid.appendChild(div);
    });
    document.getElementById('inv-modal').style.display = 'block';
}

function cerrarModales() {
    document.getElementById('album-modal').style.display = 'none';
    document.getElementById('inv-modal').style.display = 'none';
}

// --- INTERFAZ Y MEJORAS ---
function actualizarInterfaz() {
    document.getElementById('coin-count').innerText = Math.floor(gameState.coins);
    document.getElementById('cps-count').innerText = gameState.autoValue;
    document.getElementById('click-lvl').innerText = gameState.lvlClick;
    document.getElementById('auto-lvl').innerText = gameState.lvlAuto;

    const bC = document.getElementById('btn-upgrade-click');
    if (gameState.lvlClick >= 10) { bC.disabled = true; bC.innerText = "MÁXIMO"; }
    else { bC.innerHTML = `Mejorar (${gameState.precios.click} 🪙)`; }

    const bA = document.getElementById('btn-upgrade-auto');
    if (gameState.lvlAuto >= 100) { bA.disabled = true; bA.innerText = "MÁXIMO"; }
    else { bA.innerHTML = `Mejorar (${gameState.precios.auto} 🪙)`; }
}

function mejorarClick() {
    if (gameState.lvlClick >= 10 || gameState.coins < gameState.precios.click) return;
    gameState.coins -= gameState.precios.click;
    gameState.clickValue++; gameState.lvlClick++;
    gameState.precios.click = Math.round(gameState.precios.click * 1.8);
    save(); actualizarInterfaz();
}

function mejorarAuto() {
    if (gameState.lvlAuto >= 100 || gameState.coins < gameState.precios.auto) return;
    gameState.coins -= gameState.precios.auto;
    gameState.autoValue++; gameState.lvlAuto++;
    gameState.precios.auto = Math.round(gameState.precios.auto * 1.5);
    save(); actualizarInterfaz();
}

function renderAlbums() {
    const container = document.getElementById('album-container');
    container.innerHTML = '';
    let completados = 0;
    const tR = { "N":0, "R":0, "SR":0, "SSR":0, "UR":0 };
    const mR = { "N":0, "R":0, "SR":0, "SSR":0, "UR":0 };

    BASE_DE_CROMOS.forEach(c => {
        tR[c.rareza]++;
        if (gameState.inventario.includes(c.id)) mR[c.rareza]++;
    });

    CONFIG_ALBUMES.forEach(alb => {
        const cromosAlb = BASE_DE_CROMOS.filter(c => c.tags.some(t => alb.tags.includes(t)));
        const mios = cromosAlb.filter(c => gameState.inventario.includes(c.id)).length;
        if (mios === cromosAlb.length && cromosAlb.length > 0) completados++;
        const div = document.createElement('div');
        div.className = 'album-cover-card';
        div.onclick = () => abrirAlbum(alb.id);
        div.innerHTML = `<img src="${alb.portada}" class="album-cover-img ${mios === cromosAlb.length ? '' : 'incompleto'}"><h4>${alb.nombre}</h4><small>${mios}/${cromosAlb.length}</small>`;
        container.appendChild(div);
    });

    document.getElementById('global-total-percent').innerHTML = `<h3>Progreso: ${Math.round((gameState.inventario.length / BASE_DE_CROMOS.length) * 100) || 0}%</h3>`;
    document.getElementById('global-albums-completed').innerText = `Álbumes: ${completados}/${CONFIG_ALBUMES.length}`;
    let rHTML = "";
    for (let r in tR) { if (tR[r] > 0) rHTML += `<span style="margin:0 10px">${r}: ${mR[r]}/${tR[r]}</span>`; }
    document.getElementById('global-rareza-counts').innerHTML = rHTML;
}

function abrirAlbum(id) {
    const alb = CONFIG_ALBUMES.find(a => a.id === id);
    const cromos = BASE_DE_CROMOS.filter(c => c.tags.some(t => alb.tags.includes(t)));
    document.getElementById('modal-titulo').innerText = alb.nombre;
    const grid = document.getElementById('modal-grid'); grid.innerHTML = '';
    cromos.forEach(c => {
        const tiene = gameState.inventario.includes(c.id);
        const img = document.createElement('img');
        img.src = c.imagen;
        img.className = `cromo-img ${tiene ? 'rareza-'+c.rareza : 'bloqueado'}`;
        grid.appendChild(img);
    });
    document.getElementById('album-modal').style.display = 'block';
}

function save() { localStorage.setItem('tototo_save_pro', JSON.stringify(gameState)); }
document.getElementById('main-button').onclick = () => { gameState.coins += gameState.clickValue; actualizarInterfaz(); };
function exportarPartida() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(gameState)], {type: 'text/plain'}));
    a.download = 'partida.txt'; a.click();
}
function importarPartida(e) {
    const r = new FileReader();
    r.onload = (ev) => { try { gameState = JSON.parse(ev.target.result); save(); location.reload(); } catch(err) { alert("Error"); } };
    r.readAsText(e.target.files[0]);
}

cargarJuego();
