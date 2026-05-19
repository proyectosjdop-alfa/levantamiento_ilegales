var mapP, markerP;
var capaGeoJSON = null; // <- NUEVA: Guardará las líneas del circuito en el mapa
var gpsIni = "No marcado", gpsFin = "No marcado";
var latIni = null, lngIni = null;
var latFin = null, lngFin = null;
var sectorActivo = "";
var circuitosData = []; // Guardará la lista completa desde Google Sheets
// Definición de iconos personalizados en Leaflet
var greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

var redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Variables adicionales para los marcadores fijos en el mapa
var markerInicial = null;
var markerFinal = null;

let fotoBlob = null; 

const USUARIOS = {
    "admin": "admin123",
    "brus laguna": "enee2026",
    "choluteca": "enee2026",
    "comayagua": "enee2026",
    "danli": "enee2026",
    "el progreso": "enee2026",
    "juticalpa": "enee2026",
    "la ceiba": "enee2026",
    "san pedro sula": "enee2026",
    "santa barbara": "enee2026",
    "santa rosa": "enee2026",
    "santa cruz": "enee2026",
    "tegucigalpa": "enee2026",
    "tocoa": "enee2026"
};

function validarLogin() {
    const u = document.getElementById('user').value.toLowerCase();
    const p = document.getElementById('pass').value;

    if (USUARIOS[u] && USUARIOS[u] === p) {
        sectorActivo = u.toUpperCase();
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('form-poda-container').style.display = 'block';
        document.getElementById('user-display').innerText = "Sector: " + sectorActivo;
        initMapPoda();
        // Cargar los circuitos filtrados por el sector que acaba de ingresar
        cargarCircuitosDesdeSheets(); // Carga el menú desplegable
                    
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
}

// Función para descargar los datos públicos de Google Sheets
async function cargarCircuitosDesdeSheets() {
    const sheetId = "15FfY5O9CXIBA0RUcwqJMqHLbrOFRmu4ssgZ9xhPa44A";
    const gid = "434622515"; // ID exacto de la pestaña de circuitos
    // Añadimos el parámetro &gid= para forzar la lectura de la pestaña correcta
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;

    try {
        const respuesta = await fetch(url);
        const textoCSV = await respuesta.text();
        
        const filas = textoCSV.split("\n").map(fila => 
            fila.split(",").map(celda => celda.replace(/^"(.*)"$/, '$1').trim())
        );

        circuitosData = filas.slice(1); 
        actualizarDesplegableCircuitos();
    } catch (error) {
        console.error("Error al conectar con Google Sheets:", error);
        alert("No se pudo cargar la lista de circuitos automáticamente. Por favor comprueba tu conexión.");
    }
}

// Función para filtrar y llenar el select según el sector activo
function actualizarDesplegableCircuitos() {
    const selectCircuito = document.getElementById('poda-circuito');
    
    selectCircuito.innerHTML = '<option value="">Seleccione un circuito...</option>';

    circuitosData.forEach(fila => {
        if (fila[0] && fila[0].toUpperCase() === sectorActivo) {
            const circuitoNombre = fila[1];
            if (circuitoNombre) {
                const option = document.createElement('option');
                option.value = circuitoNombre;
                option.textContent = circuitoNombre;
                selectCircuito.appendChild(option);
            }
        }
    });
}
function initMapPoda() {
    if (mapP) mapP.remove();
    mapP = L.map('map-poda').setView([14.65, -86.21], 15);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    }).addTo(mapP);
    markerP = L.marker([14.65, -86.21], { draggable: true }).addTo(mapP);
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            let lat = pos.coords.latitude;
            let lng = pos.coords.longitude;
            actualizarMarcador(lat, lng);
        }, () => {}, {enableHighAccuracy: true});
    }
    setTimeout(() => mapP.invalidateSize(), 300);
}

// Función para cargar las líneas del circuito desde el archivo GeoJSON de GitHub
async function cargarCapaCircuitos() {
    // Si ya existía una capa cargada previamente de otro sector, la removemos del mapa
    if (capaGeoJSON) {
        mapP.removeLayer(capaGeoJSON);
    }

    // Obtenemos el circuito que el usuario seleccionó en el menú desplegable
    const circuitoSeleccionado = document.getElementById('poda-circuito').value;

    // Si el usuario vuelve a poner "Seleccione un circuito...", dejamos el mapa limpio y salimos
    if (!circuitoSeleccionado) return;

    // URL en formato RAW para poder consultar los datos desde el navegador
    const geojsonUrl = "https://raw.githubusercontent.com/proyectosjdop-alfa/app_poda/main/Circuitos%20Honduras(2).geojson";
   
    try {
        const respuesta = await fetch(geojsonUrl);
        const datosGeoJSON = await respuesta.json();

        // Creamos la capa de Leaflet aplicando un filtro por SECTOR
        capaGeoJSON = L.geoJSON(datosGeoJSON, {
            filter: function(feature) {
                // --- CAMBIO CLAVE: Ahora filtramos por el nombre exacto del CIRCUITO ---
                if (feature.properties && feature.properties.CIRCUITO) {
                    return feature.properties.CIRCUITO.toUpperCase() === circuitoSeleccionado.toUpperCase();
                }
                return false; 
            },
            style: function(feature) {
                // Le damos un estilo visual llamativo a las líneas del circuito (Color naranja/rojo eléctrico)
                return {
                    color: "#ffff4d",   // Amarillo claro y brillante (puedes usar también "#ffeb3b")
                    weight: 3.5,        // Le subí un poquito el grosor (de 3 a 3.5) para que se vea mejor
                    opacity: 0.9        // Un toque más opaco para que resalte bastante
                };
            },
            onEachFeature: function(feature, layer) {
                // Si el tramo tiene un nombre de circuito o ID en sus propiedades, 
                // se mostrará un mensaje emergente al hacerle clic en el mapa
                if (feature.properties && feature.properties.CIRCUITO) {
                    layer.bindPopup("<b>Circuito:</b> " + feature.properties.CIRCUITO);
                }
            }
        }).addTo(mapP); // La agregamos directamente al mapa activo

        // EXTRA SEGURO: Hace que el mapa se mueva automáticamente y haga "zoom" 
        // directo hacia donde está la línea del circuito seleccionado
        const bounds = capaGeoJSON.getBounds();
        if (bounds.isValid()) {
            mapP.fitBounds(bounds);
        }

        console.log("Mostrando en mapa el circuito: " + circuitoSeleccionado);

    } catch (error) {
        console.error("Error al cargar el archivo GeoJSON desde GitHub:", error);
    }
}

function actualizarMarcador(lat, lng) {
    mapP.setView([lat, lng], 17);
    markerP.setLatLng([lat, lng]);
}

function ingresarManual(tipo) {
    // Dependiendo del tipo, leemos las cajas de texto correspondientes
    let latId = tipo === 'ini' ? 'manual-lat' : 'manual-lat-fin'; // Asegúrate de que coincidan con los IDs de tu HTML
    let lngId = tipo === 'ini' ? 'manual-lng' : 'manual-lng-fin'; // Asegúrate de que coincidan con los IDs de tu HTML

    const lat = parseFloat(document.getElementById(latId).value);
    const lng = parseFloat(document.getElementById(lngId).value);
    
    if (!isNaN(lat) && !isNaN(lng)) {
        // 1. Movemos el marcador azul principal a esa posición
        actualizarMarcador(lat, lng);
        
        // 2. Dibujamos el pin de color (Verde o Rojo) de forma automática
        marcarGPS(tipo); 
    } else {
        alert("Por favor, ingrese valores numéricos válidos para Latitud y Longitud.");
    }
}

function marcarGPS(tipo) {
    if (!markerP) {
        alert("Primero mueve el marcador principal en el mapa.");
        return;
    }

    let p = markerP.getLatLng();
    let lat = Number(p.lat.toFixed(6));
    let lng = Number(p.lng.toFixed(6));
    let c = lat + ", " + lng;
    
    if (tipo === 'ini') { 
        gpsIni = c; 
        latIni = lat; 
        lngIni = lng; 
        
        // Si ya existía un pin verde viejo, lo quitamos
        if (markerInicial) mapP.removeLayer(markerInicial);
        
        // Creamos el marcador fijo VERDE
        markerInicial = L.marker([latIni, lngIni], { icon: greenIcon })
            .addTo(mapP)
            .bindPopup("<b>Punto Inicial Guardado</b>");
            
    } else { 
        gpsFin = c; 
        latFin = lat; 
        lngFin = lng; 
        
        // Si ya existía un pin rojo viejo, lo quitamos
        if (markerFinal) mapP.removeLayer(markerFinal);
        
        // Creamos el marcador fijo ROJO
        markerFinal = L.marker([latFin, lngFin], { icon: redIcon })
            .addTo(mapP)
            .bindPopup("<b>Punto Final Guardado</b>");
    }
    
    // Mantiene tu etiqueta de texto original abajo del mapa actualizada
    document.getElementById('coords-display').innerText = `Inicio: ${gpsIni} | Fin: ${gpsFin}`;
}

// --- FUNCIÓN PARA SUBIR ARCHIVOS A R2 ---
async function enviarArchivoAR2(archivo, nombre, tipo) {
    try {
        await fetch("https://api-poda.proyectos-jdop.workers.dev/upload", {
            method: "POST",
            headers: {
                "X-File-Name": nombre,
                "X-File-Type": tipo
            },
            body: archivo
        });
        console.log(`✅ Archivo ${nombre} subido a R2`);
    } catch (e) {
        console.error(`❌ Error subiendo ${nombre}:`, e);
    }
}

async function guardarEnBaseDeDatos(nombre, mensaje) {
    const urlApi = "https://api-poda.proyectos-jdop.workers.dev/guardar";
    try {
        await fetch(urlApi, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario: nombre, mensaje: mensaje })
        });
        console.log("Datos respaldados en Cloudflare");
    } catch (error) {
        console.error("Error de respaldo:", error);
    }
}

async function generarPDFPoda() {
    const numEnergis = document.getElementById('poda-energis').value.trim();
    
    if (!numEnergis) {
        alert("Por favor, ingrese el Número de Reporte ENERGIS.");
        return;
    }

    // 1. DEFINIR ID_UNICO (Sector_Reporte)
    const ID_UNICO = `${sectorActivo}_${numEnergis}`; 
    const nombreArchivoFinal = `Informe_${ID_UNICO}.pdf`;

    // --- VALIDACIÓN ÚNICA POR ENERGIS ---
    try {
        const checkRes = await fetch(`https://api-poda.proyectos-jdop.workers.dev/validar-energis?num=${numEnergis}`);
        const checkData = await checkRes.json();
        if (checkData.existe) {
            const confirmar = confirm(`El reporte ENERGIS ${numEnergis} ya existe. ¿Desea sustituirlo?`);
            if (!confirmar) return; 
        }
    } catch (error) {
        console.error("Error validando:", error);
    }

      // 1. Recopilar datos para el respaldo
    const datosRespaldo = {
        sector: sectorActivo,
        circuito: document.getElementById('poda-circuito').value,
        zona: document.getElementById('poda-zona').value,
        fecha: document.getElementById('poda-fecha').value,
        personas: document.getElementById('poda-personas').value,
        brecha: document.getElementById('m-brecha').value,
        poda: document.getElementById('m-poda').value,
        postes: document.getElementById('m-postes').value,
        pago_mo: document.getElementById('pago-mo').value,
        pago_trans: document.getElementById('pago-trans').value,
        gps_ini: gpsIni,
        gps_fin: gpsFin,
        resp_super: document.getElementById('resp-super').value,
        resp_activ: document.getElementById('resp-activ').value,
        reporte_energis: numEnergis
    };

    // 2. Enviar a Cloudflare D1
    try {
        await fetch("https://api-poda.proyectos-jdop.workers.dev/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datosRespaldo)
        });
        console.log("✅ Respaldo exitoso en D1");
    } catch (e) {
        console.error("❌ Falló el respaldo en D1:", e);
    }

    // 4. GENERACIÓN DEL PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const logoUrl = "https://raw.githubusercontent.com/proyectosjdop-alfa/app_poda/refs/heads/main/imagenes/UTCD%20Vertical.png";

    // VERSIÓN REPARADA: Comprime el logo y le genera un fondo blanco para evitar el cuadro negro
    const getLogoBase64 = (url) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                
                // Redimensionamos a un tamaño óptimo para impresión (300px de ancho)
                const MAX_WIDTH = 300;
                const escala = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * escala;
                
                const ctx = canvas.getContext('2d');
                
                // --- TRUCO CLAVE: Pintamos un fondo blanco sólido ---
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Ahora dibujamos el logo transparente encima del fondo blanco
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Exportamos como JPEG ligero (calidad 85%)
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => {
                console.error("No se pudo cargar el logo, se generará el PDF sin él.");
                resolve(null);
            };
            img.src = url;
        });
    };

    const logoImg = await getLogoBase64(logoUrl);

    const dibujarEstructuraInstitucional = () => {
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.rect(5, 5, 200, 287); 
        doc.setLineWidth(0.3);
        doc.rect(10, 10, 190, 25); 
        doc.line(60, 10, 60, 35);  
        doc.line(150, 10, 150, 35); 
        doc.line(170, 10, 170, 35);
        doc.line(150, 18, 200, 18);
        doc.line(150, 26, 200, 26);
        if (logoImg) { doc.addImage(logoImg, 'PNG', 12, 12, 45, 20); }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("INFORME DE PODA COMUNITARIA", 105, 19, {align: "center"});
        doc.text("SECTOR: " + sectorActivo, 105, 27, {align: "center"});
        doc.setFontSize(8);
        doc.text("Código", 152, 15);
        doc.text("Versión", 152, 23);
        doc.setFont("helvetica", "normal");
        doc.text("1", 185, 23, {align: "center"}); 
        doc.setFont("helvetica", "bold");
        doc.text("Fecha", 152, 31);
    };

    // NUEVA FUNCIÓN: Lee, redimensiona y comprime la foto antes de meterla al PDF
const leerFoto = (id) => {
    const file = document.getElementById(id).files[0];
    if (!file) return null;
    
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Definimos un tamaño máximo (1024px es ideal para reportes)
                const MAX_WIDTH = 1024;
                const MAX_HEIGHT = 1024;
                let width = img.width;
                let height = img.height;
                
                // Mantenemos la proporción original de la foto
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Dibujamos la imagen en el lienzo con las nuevas medidas
                ctx.drawImage(img, 0, 0, width, height);
                
                // Exportamos como JPEG comprimido al 70% de calidad (0.7)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
};

    dibujarEstructuraInstitucional();
    doc.setLineWidth(0.2);
    doc.rect(10, 40, 190, 45); 
    doc.setFontSize(9);
    let yD = 47;

    // FILA 1: # REP. ENERGIS | CIRCUITO
    doc.setFont("helvetica", "bold");
    doc.text("# REP. ENERGIS:", 15, yD);
    doc.setFont("helvetica", "normal");
    doc.text(numEnergis, 45, yD);
    doc.setFont("helvetica", "bold");
    doc.text("CIRCUITO:", 125, yD);
    doc.setFont("helvetica", "normal");
    doc.text(document.getElementById('poda-circuito').value, 150, yD);
    yD += 6;

    // FILA 2: FECHA | HORARIO
    doc.setFont("helvetica", "bold");
    doc.text("FECHA:", 15, yD);
    doc.setFont("helvetica", "normal");
    let fechaInput = document.getElementById('poda-fecha').value; 
    let fechaFormateada = "";
    if(fechaInput) {
        const [anio, mes, dia] = fechaInput.split("-");
        fechaFormateada = `${dia}-${mes}-${anio}`;
    }
    doc.text(fechaFormateada, 45, yD);
    doc.setFont("helvetica", "bold");
    doc.text("HORARIO:", 125, yD);
    doc.setFont("helvetica", "normal");
    let horario = `H.INICIO ${document.getElementById('h-ini').value} / H.FINAL ${document.getElementById('h-fin').value}`;
    doc.text(horario.substring(0, 50), 150, yD); 
    yD += 6;

    // FILA 3: P. GPS INICIAL | P. GPS FINAL
    doc.setFont("helvetica", "bold");
    doc.text("P. GPS INICIAL:", 15, yD);
    doc.setFont("helvetica", "normal");
    const convertirA_UTM = (lat, lng) => {
        if (!lat || !lng) return "No marcado";
        const a = 6378137.0; const eccSquared = 0.00669438; const k0 = 0.9996;
        const zoneNumber = 16; const lonOrigin = (zoneNumber - 1) * 6 - 180 + 3;
        const latRad = lat * Math.PI / 180.0; const lonRad = lng * Math.PI / 180.0;
        const lonOriginRad = lonOrigin * Math.PI / 180.0;
        const N = a / Math.sqrt(1 - eccSquared * Math.sin(latRad) * Math.sin(latRad));
        const T = Math.tan(latRad) * Math.tan(latRad);
        const C = eccSquared * Math.cos(latRad) * Math.cos(latRad) / (1 - eccSquared);
        const A = Math.cos(latRad) * (lonRad - lonOriginRad);
        const M = a * ((1 - eccSquared / 4 - 3 * eccSquared * eccSquared / 64 - 5 * eccSquared * eccSquared / 256) * latRad - (3 * eccSquared / 8 + 3 * eccSquared * eccSquared / 32 + 45 * eccSquared * eccSquared * eccSquared / 1024) * Math.sin(2 * latRad) + (15 * eccSquared * eccSquared / 256 + 45 * eccSquared * eccSquared / 1024) * Math.sin(4 * latRad) - (35 * eccSquared * eccSquared * eccSquared / 3072) * Math.sin(6 * latRad));
        const easting = (k0 * N * (A + (1 - T + C) * A * A * A / 6 + (5 - 18 * T + T * T + 72 * C - 58 * eccSquared) * A * A * A * A * A / 120) + 500000.0);
        const northing = (k0 * (M + N * Math.tan(latRad) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24 + (61 - 58 * T + T * T + 600 * C - 330 * eccSquared) * A * A * A * A * A * A / 720)));
        return `${Math.round(easting)}, ${Math.round(northing)}`;
    };
    doc.text(`${convertirA_UTM(latIni, lngIni)}`, 45, yD);
    doc.setFont("helvetica", "bold");
    doc.text("P. GPS FINAL:", 125, yD);
    doc.setFont("helvetica", "normal");
    doc.text(`${convertirA_UTM(latFin, lngFin)}`, 150, yD);
    yD += 6;

    // FILA 4: ZONA DE TRABAJO | PERSONAS CONTRATADAS
    doc.setFont("helvetica", "bold");
    doc.text("ZONA DE TRABAJO:", 15, yD);
    doc.setFont("helvetica", "normal");
    doc.text(document.getElementById('poda-zona').value, 55, yD);
    doc.setFont("helvetica", "bold");
    doc.text("PERS. CONTRATADAS:", 125, yD);
    doc.setFont("helvetica", "normal");
    doc.text(document.getElementById('poda-personas').value, 165, yD);
    yD += 6;

    // FILA 5: PAGO MANO DE OBRA | PAGO TRANSPORTE
    doc.setFont("helvetica", "bold");
    doc.text("PAGO MANO DE OBRA:", 15, yD);
    doc.setFont("helvetica", "normal");
    doc.text(document.getElementById('pago-mo').value || "L. 0", 55, yD);
    doc.setFont("helvetica", "bold");
    doc.text("PAGO TRANSPORTE:", 125, yD);
    doc.setFont("helvetica", "normal");
    doc.text(document.getElementById('pago-trans').value || "L. 0", 165, yD);
    yD += 6;

    // FILA 6: TRABAJO EJECUTADO (fila completa)
    doc.setFont("helvetica", "bold");
    doc.text("TRABAJO EJECUTADO:", 15, yD);
    doc.setFont("helvetica", "normal");
    let trabajo = `Brecha: ${document.getElementById('m-brecha').value}m, Poda: ${document.getElementById('m-poda').value}m, Postes: ${document.getElementById('m-postes').value}`;
    doc.text(trabajo, 55, yD);
    yD += 6;

    // FILA 7: RESPONSABLES (fila completa)
    doc.setFont("helvetica", "bold");
    doc.text("RESPONSABLES:", 15, yD);
    doc.setFont("helvetica", "normal");
    let resps = `${document.getElementById('resp-super').value} / ${document.getElementById('resp-activ').value}`;
    doc.text(resps.substring(0, 70), 55, yD);

    const fGrupo = await leerFoto('f-grupo');
    const fVehiculo = await leerFoto('f-vehiculo');

    if (fGrupo) {
        doc.setFont("helvetica", "bold"); doc.text("FOTO GRUPO", 90, 93);
        doc.addImage(fGrupo, 'JPEG', 25, 95, 160, 95);
        doc.rect(25, 95, 160, 95);
    }
    if (fVehiculo) {
        doc.setFont("helvetica", "bold"); 
        doc.text("FOTO VEHÍCULO", 105, 200, { align: "center" });
        const vFotoW = 80; const vFotoH = 85; const centerX = (210 - vFotoW) / 2;
        doc.addImage(fVehiculo, 'JPEG', centerX, 202, vFotoW, vFotoH);
        doc.rect(centerX, 202, vFotoW, vFotoH);
    }

    // --- MANEJO DE IDENTIDADES Y OTRAS PÁGINAS (TUS BUCLES EXISTENTES) ---
    const fLiderF = await leerFoto('f-lider-f');
    const fLiderR = await leerFoto('f-lider-r');
    if (fLiderF || fLiderR) {
        doc.addPage(); dibujarEstructuraInstitucional();
        const cardW = 85; const cardH = 54; const centerX = (210 - cardW) / 2;
        if (fLiderF) {
            doc.setFont("helvetica", "bold"); doc.text("DNI LÍDER - FRONTAL", 105, 55, {align: "center"});
            doc.addImage(fLiderF, 'JPEG', centerX, 60, cardW, cardH); doc.rect(centerX, 60, cardW, cardH);
        }
        if (fLiderR) {
            doc.setFont("helvetica", "bold"); doc.text("DNI LÍDER - REVÉS", 105, 135, {align: "center"});
            doc.addImage(fLiderR, 'JPEG', centerX, 140, cardW, cardH); doc.rect(centerX, 140, cardW, cardH);
        }
    }

    const identidades = [
        {id:'f-id-f', t:'DNI PERSONAL FRENTE (1)'}, {id:'f-id-r', t:'DNI PERSONAL REVÉS (1)'},
        {id:'f-id-f2', t:'DNI PERSONAL FRENTE (2)'}, {id:'f-id-r2', t:'DNI PERSONAL REVÉS (2)'}
    ];
    for(let p of identidades){
        const img = await leerFoto(p.id);
        if(img) {
            doc.addPage(); dibujarEstructuraInstitucional();
            doc.setFont("helvetica", "bold"); doc.text(p.t, 105, 45, {align: "center"});
            doc.addImage(img, 'JPEG', 15, 50, 180, 230); doc.rect(15, 50, 180, 230);
        }
    }

    doc.addPage(); dibujarEstructuraInstitucional();
    const secciones = [
        {t:"FOTOS ANTES", ids:['f-ini-1','f-ini-2','f-ini-3']},
        {t:"FOTOS DURANTE", ids:['f-eje-1','f-eje-2','f-eje-3']},
        {t:"FOTOS DESPUÉS", ids:['f-fin-1','f-fin-2','f-fin-3']}
    ];
    let yImg = 45;
    for(let s of secciones){
        doc.setFont("helvetica", "bold"); doc.text(s.t, 15, yImg);
        yImg += 5; let xImg = 10;
        for(let id of s.ids){
            const img = await leerFoto(id);
            if(img){ doc.addImage(img, 'JPEG', xImg, yImg, 62, 70); doc.rect(xImg, yImg, 62, 70); }
            xImg += 64;
        }
        yImg += 75;
    }

    // --- 3. SUBIDA AUTOMÁTICA A R2 (PDF y FOTO) ---
    // Subir el PDF
    try {
        const pdfBlobResult = doc.output('blob');
        await enviarArchivoAR2(pdfBlobResult, nombreArchivoFinal, "application/pdf");
    } catch (e) {
        console.error("Error subiendo a R2:", e);
    }

    // Descarga local
    doc.save(nombreArchivoFinal);
    alert("✅ Proceso completado para el ID: " + ID_UNICO);
}

function previsualizar(input, idContenedor) {
    const contenedor = document.getElementById(idContenedor);
    contenedor.innerHTML = "";
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.width = "100%"; img.style.height = "100%";
            img.style.objectFit = "cover"; img.style.borderRadius = "4px";
            contenedor.appendChild(img);
        }
        reader.readAsDataURL(input.files[0]);
    }
}
// Función para formatear en tiempo real con "L. " y separador de miles
function formatearMoneda(input) {
    // 1. Quitamos todo lo que no sea un número
    let valor = input.value.replace(/\D/g, "");
    
    // Si el campo queda vacío, lo dejamos limpio
    if (!valor) {
        input.value = "";
        return;
    }
    
    // 2. Convertimos a formato con separador de miles usando la configuración regional
    let valorFormateado = Number(valor).toLocaleString('en-US');
    
    // 3. Asignamos el prefijo de Lempiras
    input.value = "L. " + valorFormateado;
}
