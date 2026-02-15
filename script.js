// === CONFIGURACIÓN ===
const LINK_CSV_CROMOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQVmg-Qn17A0Ms4NLdYAbQHcwkVrvwPD7ORJxKlMDNcY6JGTfQ7p_i4LCiy0-B74Wcs_9Jwc1nZ1KfO/pub?output=csv';
const LINK_CSV_ALBUMES = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwFTVpC8PBxaPzki-PImk153OhSllxX3_iot9FdLpnVzYWJpxq8DbU5NHTkiXsZN2peQI9XkbD9gh1/pub?output=csv';

let BASE_DE_CROMOS = [];
let CONFIG_ALBUMES = [];
let SOBRES_TIENDA = {}; 
let gameState = {
    coins: 0, clickValue: 1, lvlClick: 1, autoValue: 0, lvlAuto: 0,
    inventario: [], fragmentos: 0, precios: { click: 50, auto: 100 }
};

// --- CARGA ---
async function cargarJuego() {
    try {
        const [resC, resA] = await Promise.all([fetch(LINK_CSV_CROMOS), fetch(LINK_CSV_ALBUMES)]);
        parsearCromos(await resC.text());
        parsearAlbumes(await resA.text());
        init();
    } catch (e) { console.error("Error al conectar con Google Sheets"); }
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
        // CORRECCIÓN: Quitamos la columna 'portada' de la lectura
        const [id, nombre, tags, inicio, fin, costo] = f.split(',').map(s => s.trim());
        const tagsArr = tags.split(';');
        const rutaImagen = `Portadas/${id}.png`; // Generamos ruta por ID

        CONFIG_ALBUMES.push({ id, nombre, portada: rutaImagen, tags: tagsArr });
        SOBRES_TIENDA[id] = { costo: parseInt(costo), portada: rutaImagen, tags: tagsArr, fecha: (inicio === 'null') ? null : { inicio, fin } };
    });
}

// --- LÓGICA DE JUEGO ---
function init() {
    const local = localStorage.getItem('tototo_save_pro');
    if (local) gameState = JSON.parse(local);
    renderShop();
    renderAlbums();
    actualizarInterfaz();
    setInterval(() => { if (gameState.autoValue > 0) { gameState.coins += gameState.autoValue; actualizarInterfaz(); } }, 1000);
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

function comprarSobre(tipo) {
    const s = SOBRES_TIENDA[tipo];
    if (gameState.coins < s.costo) return alert("No tienes suficientes monedas 🪙");
    gameState.coins -= s.costo;
    
    const rand = Math.random();
    let rareza = rand < 0.01 ? "UR" : rand < 0.05 ? "SSR" : rand < 0.15 ? "SR" : rand < 0.40 ? "R" : "N";
    const posibles = BASE_DE_CROMOS.filter(c => c.tags.some(t => s.tags.includes(t)) && c.rareza === rareza);
    const pool = posibles.length ? posibles : BASE_DE_CROMOS.filter(c => c.tags.some(t => s.tags.includes(t)) && c.rareza === "N");
    const premio = pool[Math.floor(Math.random() * pool.length)];

    if (gameState.inventario.includes(premio.id)) {
        const val = { "N": 1, "R": 2, "SR": 3, "SSR": 4, "UR": 5 };
        gameState.fragmentos += val[premio.rareza];
        if (gameState.fragmentos >= 50) { gameState.fragmentos -= 50; gameState.coins += 50; }
    } else {
        gameState.inventario.push(premio.id);
    }
    renderAlbums(); save(); actualizarInterfaz();
}

function renderShop() {
    const container = document.getElementById('pack-list');
    container.innerHTML = '';
    const hoy = new Date();
    const hoyStr = `${(hoy.getMonth()+1).toString().padStart(2,'0')}-${hoy.getDate().toString().padStart(2,'0')}`;
    for (let id in SOBRES_TIENDA) {
        const s = SOBRES_TIENDA[id];
        if (!s.fecha || (hoyStr >= s.fecha.inicio && hoyStr <= s.fecha.fin)) {
            const div = document.createElement('div');
            div.className = 'shop-card';
            div.innerHTML = `<img src="${s.portada}" class="pack-img"><strong>${id}</strong><p>${s.costo} 🪙</p><button onclick="comprarSobre('${id}')">Comprar</button>`;
            container.appendChild(div);
        }
    }
}

function renderAlbums() {
    const container = document.getElementById('album-container');
    container.innerHTML = '';
    let completados = 0;
    const statsRareza = { "N":0, "R":0, "SR":0, "SSR":0, "UR":0 };
    const totalRareza = { "N":0, "R":0, "SR":0, "SSR":0, "UR":0 };

    BASE_DE_CROMOS.forEach(c => {
        totalRareza[c.rareza]++;
        if (gameState.inventario.includes(c.id)) statsRareza[c.rareza]++;
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

    document.getElementById('global-total-percent').innerHTML = `<h3>Progreso: ${Math.round((gameState.inventario.length / BASE_DE_CROMOS.length) * 100) || 0}% (${gameState.inventario.length}/${BASE_DE_CROMOS.length})</h3>`;
    document.getElementById('global-albums-completed').innerText = `Álbumes: ${completados}/${CONFIG_ALBUMES.length}`;
    let rHTML = "";
    for (let r in statsRareza) { if (totalRareza[r] > 0) rHTML += `<span style="margin:0 10px">${r}: ${statsRareza[r]}/${totalRareza[r]}</span>`; }
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

function cerrarAlbum() { document.getElementById('album-modal').style.display = 'none'; }

function actualizarInterfaz() {
    document.getElementById('coin-count').innerText = Math.floor(gameState.coins);
    document.getElementById('cps-count').innerText = gameState.autoValue;
    document.getElementById('frag-count').innerText = gameState.fragmentos;
    document.getElementById('click-lvl').innerText = gameState.lvlClick;
    document.getElementById('auto-lvl').innerText = gameState.lvlAuto;
    document.getElementById('cost-click').innerText = gameState.precios.click;
    document.getElementById('cost-auto').innerText = gameState.precios.auto;
    document.getElementById('btn-upgrade-click').disabled = (gameState.lvlClick >= 10);
    document.getElementById('btn-upgrade-auto').disabled = (gameState.lvlAuto >= 100);
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
