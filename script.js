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
    fragmentos: {}, // Formato objeto: { "CATEGORIA": cantidad }
    precios: { click: 50, auto: 100 }
};

// --- CARGA INICIAL ---
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
        console.error("Error cargando archivos CSV. Revisa las URLs."); 
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
            tags: tags.split(';'), 
            imagen: `Cromos/${id}.png` 
        };
    });
}

function parsearAlbumes(csv) {
    const filas = csv.split('\n').filter(f => f.trim() !== '').slice(1);
    filas.forEach(f => {
        const [id, nombre, tags, inicio, fin, costo] = f.split(',').map(s => s.trim());
        const tagsArr = tags.split(';');
        const rutaImg = `Portadas/${id}.png`;
        
        CONFIG_ALBUMES.push({ id, nombre, portada: rutaImg, tags: tagsArr });
        SOBRES_TIENDA[id] = { 
            costo: parseInt(costo), 
            portada: rutaImg, 
            tags: tagsArr 
        };
    });
}

function init() {
    const local = localStorage.getItem('tototo_save_pro');
    if (local) {
        gameState = JSON.parse(local);
        // SANITIZACIÓN: Si fragmentos era un número (sistema viejo), lo convertimos a objeto
        if (typeof gameState.fragmentos !== 'object' || gameState.fragmentos === null) {
            gameState.fragmentos = {};
        }
    }
    
    renderShop();
    renderAlbums();
    actualizarInterfaz();
    
    // Bucle de minería automática
    setInterval(() => { 
        if (gameState.autoValue > 0) { 
            gameState.coins += gameState.autoValue; 
            actualizarInterfaz(); 
        } 
    }, 1000);
}

// --- TIENDA Y SOBRES ---
function comprarSobre(id, conFrag = false) {
    const s = SOBRES_TIENDA[id];
    const tagBase = (s.tags && s.tags.length > 0) ? s.tags[0] : "General";

    if (conFrag) {
        if ((gameState.fragmentos[tagBase] || 0) < 50) return alert("¡No tienes suficientes fragmentos!");
        gameState.fragmentos[tagBase] -= 50;
    } else {
        if (gameState.coins < s.costo) return alert("¡Monedas insuficientes!");
        gameState.coins -= s.costo;
    }

    // Lógica de probabilidad de rareza
    const rand = Math.random();
    let rareza = rand < 0.01 ? "UR" : rand < 0.05 ? "SSR" : rand < 0.15 ? "SR" : rand < 0.40 ? "R" : "N";
    
    let posibles = BASE_DE_CROMOS.filter(c => c.tags.some(t => s.tags.includes(t)) && c.rareza === rareza);
    if (posibles.length === 0) {
        posibles = BASE_DE_CROMOS.filter(c => c.tags.some(t => s.tags.includes(t)));
    }
    
    const premio = posibles[Math.floor(Math.random() * posibles.length)];

    // Lógica de Repetidas -> Fragmentos
    if (gameState.inventario.includes(premio.id)) {
        const valores = { "N": 1, "R": 2, "SR": 5, "SSR": 10, "UR": 25 };
        const puntos = valores[premio.rareza] || 1;
        
        // El fragmento va a la primera tag de la carta o a la del sobre
        const tagGana = (premio.tags && premio.tags.length > 0) ? premio.tags[0] : tagBase;
        
        gameState.fragmentos[tagGana] = (gameState.fragmentos[tagGana] || 0) + puntos;
        alert(`¡Repetida: ${premio.nombre}!\n+${puntos} fragmentos de "${tagGana}" 🎒`);
    } else {
        gameState.inventario.push(premio.id);
        alert(`¡NUEVO CROMO! 🎉\nHas conseguido: ${premio.nombre} (${premio.rareza})`);
    }

    save();
    renderShop();
    renderAlbums();
    actualizarInterfaz();
}

function renderShop() {
    const container = document.getElementById('pack-list');
    if (!container) return;
    container.innerHTML = '';

    for (let id in SOBRES_TIENDA) {
        const s = SOBRES_TIENDA[id];
        const tagBase = s.tags[0];
        const fActuales = gameState.fragmentos[tagBase] || 0;
        
        const div = document.createElement('div');
        div.className = 'shop-card';
        div.innerHTML = `
            <img src="${s.portada}" class="pack-img">
            <strong>${id}</strong>
            <p>${s.costo} 🪙</p>
            <button onclick="comprarSobre('${id}', false)">Comprar</button>
            <button style="margin-top:5px; background:${fActuales >= 50 ? '#3498db' : '#ccc'}; color:white;" 
                    ${fActuales < 50 ? 'disabled' : ''} 
                    onclick="comprarSobre('${id}', true)">Canjear (50 F)</button>
        `;
        container.appendChild(div);
    }
}

// --- MOCHILA (INVENTARIO FRAGMENTOS) ---
function abrirInventario() {
    const grid = document.getElementById('inv-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const tagsDisponibles = Object.keys(gameState.fragmentos);
    const tagsConValor = tagsDisponibles.filter(t => gameState.fragmentos[t] > 0);

    if (tagsConValor.length === 0) {
        grid.innerHTML = "<p style='grid-column: 1/-1'>Tu mochila está vacía. ¡Consigue repetidas para obtener fragmentos!</p>";
    } else {
        tagsConValor.forEach(tag => {
            const cant = gameState.fragmentos[tag];
            const progreso = Math.min((cant / 50) * 100, 100);
            
            const div = document.createElement('div');
            div.className = 'frag-item';
            div.innerHTML = `
                <strong>${tag}</strong>
                <div>${cant} / 50</div>
                <div class="frag-bar-bg">
                    <div class="frag-bar-fill" style="width: ${progreso}%"></div>
                </div>
            `;
            grid.appendChild(div);
        });
    }
    document.getElementById('inv-modal').style.display = 'block';
}

function cerrarModales() {
    document.getElementById('album-modal').style.display = 'none';
    document.getElementById('inv-modal').style.display = 'none';
}

// --- CLICKER Y MEJORAS ---
function actualizarInterfaz() {
    document.getElementById('coin-count').innerText = Math.floor(gameState.coins);
    document.getElementById('cps-count').innerText = gameState.autoValue;
    document.getElementById('click-lvl').innerText = gameState.lvlClick;
    document.getElementById('auto-lvl').innerText = gameState.lvlAuto;

    const btnClick = document.getElementById('btn-upgrade-click');
    if (gameState.lvlClick >= 10) {
        btnClick.disabled = true;
        btnClick.innerText = "MÁXIMO";
    } else {
        btnClick.innerHTML = `Mejorar (${gameState.precios.click} 🪙)`;
    }

    const btnAuto = document.getElementById('btn-upgrade-auto');
    if (gameState.lvlAuto >= 100) {
        btnAuto.disabled = true;
        btnAuto.innerText = "MÁXIMO";
    } else {
        btnAuto.innerHTML = `Mejorar (${gameState.precios.auto} 🪙)`;
    }
}

function mejorarClick() {
    if (gameState.lvlClick >= 10 || gameState.coins < gameState.precios.click) return;
    gameState.coins -= gameState.precios.click;
    gameState.clickValue++;
    gameState.lvlClick++;
    gameState.precios.click = Math.round(gameState.precios.click * 1.8);
    save();
    actualizarInterfaz();
}

function mejorarAuto() {
    if (gameState.lvlAuto >= 100 || gameState.coins < gameState.precios.auto) return;
    gameState.coins -= gameState.precios.auto;
    gameState.autoValue++;
    gameState.lvlAuto++;
    gameState.precios.auto = Math.round(gameState.precios.auto * 1.5);
    save();
    actualizarInterfaz();
}

// --- ÁLBUMES Y COLECCIÓN ---
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

    // Stats Globales
    document.getElementById('global-total-percent').innerHTML = `<h3>Progreso Total: ${Math.round((gameState.inventario.length / BASE_DE_CROMOS.length) * 100) || 0}%</h3>`;
    document.getElementById('global-albums-completed').innerText = `Álbumes Completados: ${completados} / ${CONFIG_ALBUMES.length}`;
    
    let htmlRarezas = "";
    for (let r in statsRareza) {
        if (statsRareza[r] > 0) {
            htmlRarezas += `<span style="margin:0 10px">${r}: ${miosRareza[r]}/${statsRareza[r]}</span>`;
        }
    }
    document.getElementById('global-rareza-counts').innerHTML = htmlRarezas;
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

// --- SISTEMA ---
function save() {
    localStorage.setItem('tototo_save_pro', JSON.stringify(gameState));
}

document.getElementById('main-button').onclick = () => {
    gameState.coins += gameState.clickValue;
    actualizarInterfaz();
};

function exportarPartida() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gameState));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "tototo_save.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function importarPartida(event) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            gameState = JSON.parse(e.target.result);
            save();
            location.reload();
        } catch (err) {
            alert("Error al importar el archivo.");
        }
    };
    reader.readAsText(event.target.files[0]);
}

// Lanzar carga
cargarJuego();
