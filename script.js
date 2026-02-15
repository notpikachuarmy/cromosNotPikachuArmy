// === CONFIGURACIÓN ===
const LINK_CSV_CROMOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQVmg-Qn17A0Ms4NLdYAbQHcwkVrvwPD7ORJxKlMDNcY6JGTfQ7p_i4LCiy0-B74Wcs_9Jwc1nZ1KfO/pub?output=csv';
const LINK_CSV_ALBUMES = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwFTVpC8PBxaPzki-PImk153OhSllxX3_iot9FdLpnVzYWJpxq8DbU5NHTkiXsZN2peQI9XkbD9gh1/pub?output=csv';

let BASE_DE_CROMOS = [];
let CONFIG_ALBUMES = [];
let SOBRES_TIENDA = {}; 

let gameState = {
    coins: 0, 
    clickValue: 1, 
    lvlClick: 1, 
    autoValue: 0, 
    lvlAuto: 0,
    inventario: [], 
    fragmentos: {}, // Formato: { "TAG": cantidad }
    precios: { click: 50, auto: 100 }
};

// --- CARGA DE DATOS ---
async function cargarJuego() {
    try {
        const [resC, resA] = await Promise.all([
            fetch(LINK_CSV_CROMOS), 
            fetch(LINK_CSV_ALBUMES)
        ]);
        parsearCromos(await resC.text());
        parsearAlbumes(await resA.text());
        init();
    } catch (e) { 
        console.error("Error cargando los CSV."); 
    }
}

function parsearCromos(csv) {
    const filas = csv.split('\n').filter(f => f.trim() !== '').slice(1);
    BASE_DE_CROMOS = filas.map(f => {
        const [id, nombre, rareza, tags] = f.split(',').map(s => s.trim());
        return { 
            id, 
            nombre, 
            rareza, 
            tags: tags ? tags.split(';').map(t => t.toUpperCase().trim()) : [], 
            imagen: `Cromos/${id}.png` 
        };
    });
}

function parsearAlbumes(csv) {
    const filas = csv.split('\n').filter(f => f.trim() !== '').slice(1);
    filas.forEach(f => {
        const [id, nombre, tags, inicio, fin, costo] = f.split(',').map(s => s.trim());
        const tagsArr = tags ? tags.split(';').map(t => t.toUpperCase().trim()) : [];
        const rutaImg = `Portadas/${id}.png`;
        
        CONFIG_ALBUMES.push({ id, nombre, portada: rutaImg, tags: tagsArr });
        SOBRES_TIENDA[id] = { 
            costo: parseInt(costo) || 100, 
            portada: rutaImg, 
            tags: tagsArr 
        };
    });
}

function init() {
    const local = localStorage.getItem('tototo_save_pro');
    if (local) {
        gameState = JSON.parse(local);
        if (typeof gameState.fragmentos !== 'object' || gameState.fragmentos === null) {
            gameState.fragmentos = {};
        }
    }
    
    renderShop();
    renderAlbums();
    actualizarInterfaz();
    
    setInterval(() => { 
        if (gameState.autoValue > 0) { 
            gameState.coins += gameState.autoValue; 
            actualizarInterfaz(); 
        } 
    }, 1000);
}

// --- COMPRA SILENCIOSA (SIN ALERTS) ---
function comprarSobre(id, conFrag = false) {
    const s = SOBRES_TIENDA[id];
    if (!s) return;

    const tagBase = (s.tags && s.tags.length > 0) ? s.tags[0].toUpperCase().trim() : "GENERAL";

    if (conFrag) {
        if ((gameState.fragmentos[tagBase] || 0) < 50) return;
        gameState.fragmentos[tagBase] -= 50;
    } else {
        if (gameState.coins < s.costo) return;
        gameState.coins -= s.costo;
    }

    const rand = Math.random();
    let rareza = rand < 0.01 ? "UR" : rand < 0.05 ? "SSR" : rand < 0.15 ? "SR" : rand < 0.40 ? "R" : "N";
    
    let posibles = BASE_DE_CROMOS.filter(c => 
        c.tags.some(t => s.tags.includes(t)) && c.rareza === rareza
    );
    
    if (posibles.length === 0) {
        posibles = BASE_DE_CROMOS.filter(c => c.tags.some(t => s.tags.includes(t)));
    }
    
    if (posibles.length === 0) return;

    const premio = posibles[Math.floor(Math.random() * posibles.length)];

    if (gameState.inventario.includes(premio.id)) {
        const valores = { "N": 1, "R": 2, "SR": 5, "SSR": 10, "UR": 25 };
        const puntos = valores[premio.rareza] || 1;
        const tagDestino = (premio.tags && premio.tags.length > 0) ? premio.tags[0] : tagBase;
        
        gameState.fragmentos[tagDestino] = (gameState.fragmentos[tagDestino] || 0) + puntos;
        console.log(`Repetida: +${puntos} fragmentos en ${tagDestino}`);
    } else {
        gameState.inventario.push(premio.id);
        console.log(`Nuevo cromo: ${premio.nombre}`);
    }

    save();
    renderShop();
    renderAlbums();
    actualizarInterfaz();
}

// --- INTERFAZ ---
function renderShop() {
    const container = document.getElementById('pack-list');
    if (!container) return;
    container.innerHTML = '';

    for (let id in SOBRES_TIENDA) {
        const s = SOBRES_TIENDA[id];
        const tagBase = s.tags[0] || "GENERAL";
        const fActuales = gameState.fragmentos[tagBase] || 0;
        
        const div = document.createElement('div');
        div.className = 'shop-card';
        div.innerHTML = `
            <img src="${s.portada}" class="pack-img">
            <strong>${id}</strong>
            <p>${s.costo} 🪙</p>
            <button onclick="comprarSobre('${id}', false)">Comprar</button>
            <button style="margin-top:8px; background:${fActuales >= 50 ? '#3498db' : '#ccc'}; color:white;" 
                    ${fActuales < 50 ? 'disabled' : ''} 
                    onclick="comprarSobre('${id}', true)">Canjear (50 F)</button>
        `;
        container.appendChild(div);
    }
}

function abrirInventario() {
    const grid = document.getElementById('inv-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const tagsConFragmentos = Object.keys(gameState.fragmentos).filter(t => gameState.fragmentos[t] > 0);

    if (tagsConFragmentos.length === 0) {
        grid.innerHTML = "<p style='grid-column: 1/-1'>Mochila vacía.</p>";
    } else {
        tagsConFragmentos.forEach(tag => {
            const cant = gameState.fragmentos[tag];
            const progreso = Math.min((cant / 50) * 100, 100);
            const div = document.createElement('div');
            div.className = 'frag-item';
            div.innerHTML = `
                <strong>${tag}</strong>
                <div>${cant} / 50</div>
                <div class="frag-bar-bg"><div class="frag-bar-fill" style="width: ${progreso}%"></div></div>
            `;
            grid.appendChild(div);
        });
    }
    document.getElementById('inv-modal').style.display = 'block';
}

function renderAlbums() {
    const container = document.getElementById('album-container');
    if (!container) return;
    container.innerHTML = '';
    
    let completados = 0;
    const statsRareza = { "N":0, "R":0, "SR":0, "SSR":0, "UR":0 };
    const miosRareza = { "N":0, "R":0, "SR":0, "SSR":0, "UR":0 };

    BASE_DE_CROMOS.forEach(c => {
        statsRareza[c.rareza]++;
        if (gameState.inventario.includes(c.id)) miosRareza[c.rareza]++;
    });

    CONFIG_ALBUMES.forEach(alb => {
        const cromosAlb = BASE_DE_CROMOS.filter(c => c.tags.some(t => alb.tags.includes(t)));
        const mios = cromosAlb.filter(c => gameState.inventario.includes(c.id)).length;
        if (mios === cromosAlb.length && cromosAlb.length > 0) completados++;

        const div = document.createElement('div');
        div.className = 'album-cover-card';
        div.onclick = () => abrirAlbum(alb.id);
        div.innerHTML = `
            <img src="${alb.portada}" class="album-cover-img ${mios === cromosAlb.length ? '' : 'incompleto'}">
            <h4>${alb.nombre}</h4>
            <small>${mios} / ${cromosAlb.length}</small>
        `;
        container.appendChild(div);
    });

    document.getElementById('global-total-percent').innerHTML = `<h3>Progreso: ${Math.round((gameState.inventario.length / BASE_DE_CROMOS.length) * 100) || 0}%</h3>`;
    document.getElementById('global-albums-completed').innerText = `Álbumes: ${completados} / ${CONFIG_ALBUMES.length}`;
    
    let htmlR = "";
    for (let r in statsRareza) {
        if (statsRareza[r] > 0) htmlR += `<span style="margin:0 10px">${r}: ${miosRareza[r]}/${statsRareza[r]}</span>`;
    }
    document.getElementById('global-rareza-counts').innerHTML = htmlR;
}

function abrirAlbum(id) {
    const alb = CONFIG_ALBUMES.find(a => a.id === id);
    const cromos = BASE_DE_CROMOS.filter(c => c.tags.some(t => alb.tags.includes(t)));
    document.getElementById('modal-titulo').innerText = alb.nombre;
    const grid = document.getElementById('modal-grid');
    grid.innerHTML = '';
    cromos.forEach(c => {
        const tiene = gameState.inventario.includes(c.id);
        const img = document.createElement('img');
        img.src = c.imagen;
        img.className = `cromo-img ${tiene ? 'rareza-'+c.rareza : 'bloqueado'}`;
        grid.appendChild(img);
    });
    document.getElementById('album-modal').style.display = 'block';
}

function actualizarInterfaz() {
    document.getElementById('coin-count').innerText = Math.floor(gameState.coins);
    document.getElementById('cps-count').innerText = gameState.autoValue;
    document.getElementById('click-lvl').innerText = gameState.lvlClick;
    document.getElementById('auto-lvl').innerText = gameState.lvlAuto;

    const bC = document.getElementById('btn-upgrade-click');
    if (gameState.lvlClick >= 10) { bC.disabled = true; bC.innerText = "MÁX"; }
    else { bC.innerText = `Mejorar (${gameState.precios.click} 🪙)`; }

    const bA = document.getElementById('btn-upgrade-auto');
    if (gameState.lvlAuto >= 100) { bA.disabled = true; bA.innerText = "MÁX"; }
    else { bA.innerText = `Mejorar (${gameState.precios.auto} 🪙)`; }
}

function mejorarClick() {
    if (gameState.lvlClick >= 10 || gameState.coins < gameState.precios.click) return;
    gameState.coins -= gameState.precios.click;
    gameState.clickValue++;
    gameState.lvlClick++;
    gameState.precios.click = Math.round(gameState.precios.click * 1.8);
    save(); actualizarInterfaz();
}

function mejorarAuto() {
    if (gameState.lvlAuto >= 100 || gameState.coins < gameState.precios.auto) return;
    gameState.coins -= gameState.precios.auto;
    gameState.autoValue++;
    gameState.lvlAuto++;
    gameState.precios.auto = Math.round(gameState.precios.auto * 1.5);
    save(); actualizarInterfaz();
}

function cerrarModales() {
    document.getElementById('album-modal').style.display = 'none';
    document.getElementById('inv-modal').style.display = 'none';
}

function save() {
    localStorage.setItem('tototo_save_pro', JSON.stringify(gameState));
}

document.getElementById('main-button').onclick = () => {
    gameState.coins += gameState.clickValue;
    actualizarInterfaz();
};

function exportarPartida() {
    const blob = new Blob([JSON.stringify(gameState)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tototo_save.json';
    a.click();
}

function importarPartida(event) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            gameState = JSON.parse(e.target.result);
            save(); location.reload();
        } catch (err) { console.error("Error al importar."); }
    };
    reader.readAsText(event.target.files[0]);
}

cargarJuego();

