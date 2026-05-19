// URL oficial de Google Sheets para los Circuitos (heredada de tu repositorio)
const SHEETS_CIRCUITOS_URL = "https://docs.google.com/spreadsheets/d/1ltqrkfWkaJ7Y9Frik6BrIVBs46x2cOWjc_s9a9ZGegU/export?format=csv&gid=1152960682";

let sectorActivo = "";
let circuitosDataGlobal = []; // Aquí se guardarán todos los circuitos descargados de Sheets

let datosFotos = {
    dniFrontal: null,
    dniRevers: null,
    fachada: null,
    medidor: null,
    extras: []
};

// Control de Acceso e Inicialización
async function validarAcceso() {
    const sector = document.getElementById("login-sector").value;
    const pass = document.getElementById("login-pass").value;

    if (!sector) {
        alert("Por favor seleccione un sector.");
        return;
    }
    
    if (pass === "enee2026") {
        sectorActivo = sector;
        document.getElementById("txt-sector-activo").innerText = `SECTOR: ${sectorActivo}`;
        
        // Mostrar indicador de carga mientras se bajan los circuitos
        document.getElementById("campo-circuito").innerHTML = '<option value="">Cargando circuitos desde Sheets...</option>';
        
        document.getElementById("login-container").style.display = "none";
        document.getElementById("app-container").style.display = "block";
        
        // Colocar fecha actual automáticamente
        document.getElementById("campo-fecha").value = new Date().toISOString().substring(0, 10);
        
        // Descargar los circuitos desde Google Sheets e inyectar los del sector activo
        await descargarCircuitosDesdeSheets();
    } else {
        alert("Contraseña incorrecta para el acceso técnico.");
    }
}

// NUEVA FUNCIÓN: Descarga y procesa el CSV de Google Sheets en tiempo real
async function descargarCircuitosDesdeSheets() {
    try {
        const respuesta = await fetch(SHEETS_CIRCUITOS_URL);
        const textoCSV = await respuesta.text();
        
        // Separamos por líneas y limpiamos espacios o comillas
        const lineas = textoCSV.split("\n");
        circuitosDataGlobal = [];

        for (let i = 1; i < lineas.length; i++) {
            const linea = lineas[i].trim();
            if (!linea) continue;

            // Separar por comas respetando posibles textos entre comillas
            const columnas = linea.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (columnas.length < 2) continue;

            // Estructura esperada del CSV: Columna 0 = CIRCUITO, Columna 1 = SECTOR
            const circuitoNombre = columnas[0].replace(/"/g, "").trim().toUpperCase();
            const sectorNombre = columnas[1].replace(/"/g, "").trim().toUpperCase();

            if (circuitoNombre && sectorNombre) {
                circuitosDataGlobal.push({
                    circuito: circuitoNombre,
                    sector: sectorNombre
                });
            }
        }

        console.log(`Se cargaron ${circuitosDataGlobal.length} circuitos desde Google Sheets.`);
        
        // Una vez descargados, filtramos para mostrar solo los del sector logueado
        poblarMenuCircuitos(sectorActivo);

    } catch (error) {
        console.error("Error al descargar circuitos de Google Sheets:", error);
        alert("⚠️ No se pudieron cargar los circuitos en tiempo real. Se usará una lista de respaldo.");
        poblarCircuitosRespaldo(sectorActivo);
    }
}

// Filtra la lista global de Sheets e inyecta las opciones en el SELECT
function poblarMenuCircuitos(sector) {
    const combo = document.getElementById("campo-circuito");
    combo.innerHTML = '<option value="">-- Seleccione un Circuito --</option>';

    // Filtrar los circuitos que pertenecen al sector activo
    const filtrados = circuitosDataGlobal.filter(item => item.sector === sector.toUpperCase());

    if (filtrados.length === 0) {
        // Si por algún motivo no hay coincidencias exactas en Sheets para ese sector, usamos respaldo
        poblarCircuitosRespaldo(sector);
        return;
    }

    // Insertar las opciones ordenadas alfabéticamente
    filtrados.sort((a, b) => a.circuito.localeCompare(b.circuito)).forEach(item => {
        let opt = document.createElement("option");
        opt.value = item.circuito;
        opt.innerText = item.circuito;
        combo.appendChild(opt);
    });
}

// Lista de contingencia local en caso de que falle la conexión a Internet con Google Drive
function poblarCircuitosRespaldo(sector) {
    const combo = document.getElementById("campo-circuito");
    combo.innerHTML = '<option value="">-- Seleccione un Circuito --</option>';
    
    const respaldos = {
        "TEGUCIGALPA": ["TON-L211", "TON-L212", "SLA-L221", "SLA-L222"],
        "SAN PEDRO SULA": ["LVI-L228", "LVI-L229", "BER-L215"],
        "CHOLUTECA": ["CHO-L411", "CHO-L412"],
        "JUTICALPA": ["JUT-L511", "JUT-L512"]
    };

    const lista = respaldos[sector.toUpperCase()] || ["CIRCUITO-GENERAL"];
    lista.forEach(circuito => {
        let opt = document.createElement("option");
        opt.value = circuito;
        opt.innerText = circuito;
        combo.appendChild(opt);
    });
}

// Geolocalización y conversión matemática a UTM
function capturarUbicacion() {
    if (!navigator.geolocation) {
        alert("Tu dispositivo no soporta geolocalización.");
        return;
    }

    document.getElementById("campo-lat").value = "";
    document.getElementById("campo-lng").value = "";
    document.getElementById("campo-utm").value = "Obteniendo posición GPS...";

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            document.getElementById("campo-lat").value = lat.toFixed(6);
            document.getElementById("campo-lng").value = lng.toFixed(6);
            
            const utm = convertirLatLngToUTM(lat, lng);
            document.getElementById("campo-utm").value = utm;
        },
        (error) => {
            alert("Error al obtener ubicación. Asegúrate de activar el GPS de tu dispositivo.");
            document.getElementById("campo-utm").value = "Error de GPS.";
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

function convertirLatLngToUTM(lat, lng) {
    const a = 6378137.0; 
    const eccSquared = 0.00669438; 
    const k0 = 0.9996;

    let zone = Math.floor((lng + 180) / 6) + 1;
    const latRad = lat * Math.PI / 180.0;
    const lngRad = lng * Math.PI / 180.0;
    const lngOriginRad = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180.0;

    const N = a / Math.sqrt(1 - eccSquared * Math.sin(latRad) * Math.sin(latRad));
    const T = Math.tan(latRad) * Math.tan(latRad);
    const C = eccSquared * Math.cos(latRad) * Math.cos(latRad) / (1 - eccSquared);
    const A = Math.cos(latRad) * (lngRad - lngOriginRad);

    const M = a * ((1 - eccSquared / 4 - 3 * eccSquared * eccSquared / 64 - 5 * eccSquared * eccSquared * eccSquared / 256) * latRad
        - (3 * eccSquared / 8 + 3 * eccSquared * eccSquared / 32 + 45 * eccSquared * eccSquared * eccSquared / 1024) * Math.sin(2 * latRad)
        + (15 * eccSquared * eccSquared / 256 + 45 * eccSquared * eccSquared * eccSquared / 1024) * Math.sin(4 * latRad)
        - (35 * eccSquared * eccSquared * eccSquared / 3072) * Math.sin(6 * latRad));

    let falseEasting = 500000.0;
    let UTMEasting = (k0 * N * (A + (1 - T + C) * A * A * A / 6.0 + (5 - 18 * T + T * T + 72 * C - 58 * eccSquared) * A * A * A * A * A / 120.0) + falseEasting);
    let UTMNorthing = (k0 * (M + N * Math.tan(latRad) * (A * A / 2.0 + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24.0 + (61 - 58 * T + T * T + 600 * C - 330 * eccSquared) * A * A * A * A * A * A / 720.0)));
    
    return `${zone}P E: ${UTMEasting.toFixed(1)} N: ${UTMNorthing.toFixed(1)}`;
}

// Procesamiento de Imágenes Simples (DNI)
function procesarImagenSimple(input, idPreview) {
    if (input.files && input.files[0]) {
        const lector = new FileReader();
        lector.onload = function(e) {
            const contenedor = document.getElementById(idPreview);
            contenedor.innerHTML = `<img src="${e.target.result}">`;
            
            if(idPreview === 'prev-dni-frontal') datosFotos.dniFrontal = e.target.result;
            if(idPreview === 'prev-dni-revers') datosFotos.dniRevers = e.target.result;
        };
        lector.readAsDataURL(input.files[0]);
    }
}

// Procesamiento con Estampado de Marca de Agua Dinámica mediante HTML5 Canvas
function procesarImagenConMarcaAgua(input, idPreview, orientacion) {
    if (input.files && input.files[0]) {
        const lector = new FileReader();
        lector.onload = function(e) {
            const imgElement = new Image();
            imgElement.src = e.target.result;
            imgElement.onload = function() {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");

                if (orientacion === "HORIZONTAL") {
                    canvas.width = 1280; canvas.height = 720;
                } else {
                    canvas.width = 720; canvas.height = 1280;
                }

                ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

                const fecha = new Date().toLocaleDateString('es-HN');
                const hora = new Date().toLocaleTimeString('es-HN');
                const lat = document.getElementById("campo-lat").value || "N/A";
                const lng = document.getElementById("campo-lng").value || "N/A";
                const textoMarca = `${fecha} ${hora} | GPS: ${lat}, ${lng} | SECTOR: ${sectorActivo.toUpperCase()}`;

                ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
                ctx.fillRect(0, canvas.height - 45, canvas.width, 45);

                ctx.fillStyle = "#f4c430"; // Amarillo ENEE institucional
                ctx.font = "bold 20px 'Segoe UI', Arial";
                ctx.fillText(textoMarca, 20, canvas.height - 15);

                const dataURLConMarca = canvas.toDataURL("image/jpeg", 0.85);
                document.getElementById(idPreview).innerHTML = `<img src="${dataURLConMarca}">`;

                if(idPreview === 'prev-fachada') datosFotos.fachada = dataURLConMarca;
                if(idPreview === 'prev-medidor') datosFotos.medidor = dataURLConMarca;
            };
        };
        lector.readAsDataURL(input.files[0]);
    }
}

// Procesamiento de múltiples imágenes extras
function procesarMultiplesExtras(input) {
    const contenedor = document.getElementById("contenedor-prev-extras");
    contenedor.innerHTML = "";
    datosFotos.extras = [];

    if (input.files) {
        Array.from(input.files).forEach((archivo, indice) => {
            const lector = new FileReader();
            lector.onload = function(e) {
                const imgElement = new Image();
                imgElement.src = e.target.result;
                imgElement.onload = function() {
                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d");
                    canvas.width = 960; canvas.height = 720;

                    ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

                    const fecha = new Date().toLocaleDateString('es-HN');
                    const hora = new Date().toLocaleTimeString('es-HN');
                    const lat = document.getElementById("campo-lat").value || "N/A";
                    const lng = document.getElementById("campo-lng").value || "N/A";
                    const textoMarca = `${fecha} ${hora} | GPS: ${lat},${lng} | SECTOR: ${sectorActivo}`;

                    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
                    ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
                    ctx.fillStyle = "#ffffff";
                    ctx.font = "18px Arial";
                    ctx.fillText(textoMarca, 15, canvas.height - 14);

                    const finalData = canvas.toDataURL("image/jpeg", 0.8);
                    datosFotos.extras.push(finalData);

                    const div = document.createElement("div");
                    div.className = "preview-box";
                    div.style.height = "60px";
                    div.innerHTML = `<img src="${finalData}">`;
                    contenedor.appendChild(div);
                };
            };
            lector.readAsDataURL(archivo);
        });
    }
}

// CONSTRUCCIÓN Y GENERACIÓN IMPRESA DEL INFORME TÉCNICO PDF
function generarReportePDF() {
    const campoFecha = document.getElementById("campo-fecha").value;
    const campoEncargado = document.getElementById("campo-encargado").value;
    const campoUsuario = document.getElementById("campo-usuario").value;
    const campoCircuito = document.getElementById("campo-circuito").value;
    
    if(!campoFecha || !campoEncargado || !campoUsuario || !campoCircuito) {
        alert("Por favor, complete todos los campos mandatorios antes de imprimir.");
        return;
    }
    if(!datosFotos.dniFrontal || !datosFotos.dniRevers || !datosFotos.fachada || !datosFotos.medidor) {
        alert("Faltan fotografías obligatorias del levantamiento.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    
    const maxAncho = 210;
    const maxAlto = 297;
    const margen = 10;

    function aplicarMarcoYCabecera(numeroPagina) {
        doc.setDrawColor(22, 35, 47);
        doc.setLineWidth(0.8);
        doc.rect(margen, margen, maxAncho - (margen * 2), maxAlto - (margen * 2));

        doc.setDrawColor(244, 196, 48);
        doc.setLineWidth(0.2);
        doc.rect(margen + 1, margen + 1, maxAncho - (margen * 2) - 2, maxAlto - (margen * 2) - 2);

        doc.setFillColor(255, 255, 255);
        doc.rect(margen + 5, margen + 5, 45, 18, 'F');
        doc.addImage("https://raw.githubusercontent.com/proyectosjdop-alfa/app_poda/refs/heads/main/imagenes/UTCD%20Vertical.png", "PNG", margen + 7, margen + 6, 41, 15);

        doc.setFont("Helvetica", "Bold");
        doc.setFontSize(14);
        doc.setTextColor(22, 35, 47);
        doc.text("EMPRESA NACIONAL DE ENERGÍA ELÉCTRICA", 130, margen + 10, { align: "center" });
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        doc.text("UTCD - CONTROL DE USUARIOS ILEGALES", 130, margen + 16, { align: "center" });

        doc.setFont("Helvetica", "Normal");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(`Página ${numeroPagina}`, maxAncho - margen - 15, maxAlto - margen - 5);
        doc.text("Reporte Técnico Confidencial - ENEE Honduras 2026", margen + 5, maxAlto - margen - 5);
    }

    // PÁGINA 1
    aplicarMarcoYCabecera(1);

    doc.setFillColor(22, 35, 47);
    doc.rect(margen + 5, margen + 28, maxAncho - (margen * 2) - 10, 8, 'F');
    doc.setFont("Helvetica", "Bold");
    doc.setFontSize(10);
    doc.setTextColor(244, 196, 48);
    doc.text("INFORMACIÓN GENERAL DEL LEVANTAMIENTO DE CAMPO", margen + 8, margen + 33.5);

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    let y = margen + 43;
    const campoYEspacio = 7;

    const datosFormulario = [
        ["1. Nombre de la APP:", "LEVANTAMIENTO DE USUARIOS ILEGALES"],
        ["Sector Técnico ENEE:", sectorActivo.toUpperCase()],
        ["a) Fecha de Registro:", campoFecha],
        ["b) Encargado del Operativo:", campoEncargado.toUpperCase()],
        ["c) Nombre Completo del Usuario:", campoUsuario.toUpperCase()],
        ["g) Circuito Asignado:", campoCircuito.toUpperCase()],
        ["d) Coordenadas Geográficas (L/L):", `Lat: ${document.getElementById("campo-lat").value || "N/A"} | Lng: ${document.getElementById("campo-lng").value || "N/A"}`],
        ["e) Coordenada Comercial UTM:", document.getElementById("campo-utm").value || "N/A"],
        ["f) Municipio Local:", document.getElementById("lugar-municipio").value.toUpperCase()],
        ["f) Barrio / Colonia / Aldea:", document.getElementById("lugar-colonia").value.toUpperCase()],
        ["f) Referencia Domiciliaria:", document.getElementById("lugar-referencia").value.toUpperCase()]
    ];

    datosFormulario.forEach(([titulo, valor]) => {
        doc.setFont("Helvetica", "Bold");
        doc.text(titulo, margen + 8, y);
        doc.setFont("Helvetica", "Normal");
        
        if(titulo.includes("Referencia")) {
            const lineasTexto = doc.splitTextToSize(valor, 110);
            doc.text(lineasTexto, margen + 65, y);
            y += (lineasTexto.length * 4) + 2;
        } else {
            doc.text(valor, margen + 65, y);
            y += campoYEspacio;
        }
    });

    y += 2;
    doc.setDrawColor(244, 196, 48);
    doc.setLineWidth(0.5);
    doc.line(margen + 5, y, maxAncho - margen - 5, y);

    y += 6;
    doc.setFillColor(22, 35, 47);
    doc.rect(margen + 5, y, maxAncho - (margen * 2) - 10, 7, 'F');
    doc.setFont("Helvetica", "Bold");
    doc.setTextColor(244, 196, 48);
    doc.text("DOCUMENTACIÓN DE IDENTIFICACIÓN PERSONAL (DNI)", margen + 8, y + 4.8);

    const anchoDNI = 85;
    const altoDNI = 54;
    y += 12;

    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    
    doc.text("FOTO DNI FRONTAL (Tamaño Real Tarjeta)", margen + 10, y - 2);
    doc.addImage(datosFotos.dniFrontal, "JPEG", margen + 10, y, anchoDNI, altoDNI);

    doc.text("FOTO DNI REVERSO (Tamaño Real Tarjeta)", margen + 105, y - 2);
    doc.addImage(datosFotos.dniRevers, "JPEG", margen + 105, y, anchoDNI, altoDNI);

    // PÁGINA 2
    doc.addPage();
    aplicarMarcoYCabecera(2);

    let y2 = margen + 28;

    doc.setFillColor(22, 35, 47);
    doc.rect(margen + 5, y2, maxAncho - (margen * 2) - 10, 7, 'F');
    doc.setFont("Helvetica", "Bold");
    doc.setTextColor(244, 196, 48);
    doc.text("c) REGISTRO FOTOGRÁFICO DE LA FACHADA DE LA VIVIENDA", margen + 8, y2 + 4.8);
    
    y2 += 10;
    doc.addImage(datosFotos.fachada, "JPEG", margen + 10, y2, 170, 95);

    y2 += 105;
    doc.setFillColor(22, 35, 47);
    doc.rect(margen + 5, y2, maxAncho - (margen * 2) - 10, 7, 'F');
    doc.setFont("Helvetica", "Bold");
    doc.setTextColor(244, 196, 48);
    doc.text("d) EVIDENCIA DE LA BASE DEL MEDIDOR E INFRAESTRUCTURA", margen + 8, y2 + 4.8);

    y2 += 10;
    doc.addImage(datosFotos.medidor, "JPEG", (maxAncho / 2) - 50, y2, 100, 95);

    // PÁGINA 3 EN ADELANTE (EXTRAS)
    if (datosFotos.extras.length > 0) {
        let itemsPorPagina = 0;
        let numPaginaActual = 3;
        
        datosFotos.extras.forEach((fotoBase64, index) => {
            if (itemsPorPagina === 0) {
                doc.addPage();
                aplicarMarcoYCabecera(numPaginaActual);
                
                doc.setFillColor(22, 35, 47);
                doc.rect(margen + 5, margen + 28, maxAncho - (margen * 2) - 10, 7, 'F');
                doc.setFont("Helvetica", "Bold");
                doc.setTextColor(244, 196, 48);
                doc.text("ANEXO: EVIDENCIAS ADICIONALES DEL FRAUDE O HALLAZGO", margen + 8, margen + 32.8);
                
                y = margen + 42;
            }

            doc.setFont("Helvetica", "Normal");
            doc.setFontSize(8);
            doc.setTextColor(80, 80, 80);
            doc.text(`Evidencia Adicional N° ${index + 1}`, (maxAncho / 2), y - 2, { align: "center" });
            
            doc.addImage(fotoBase64, "JPEG", (maxAncho / 2) - 70, y, 140, 90);
            
            y += 105;
            itemsPorPagina++;

            if (itemsPorPagina === 2 && index < datosFotos.extras.length - 1) {
                itemsPorPagina = 0;
                numPaginaActual++;
            }
        });
    }

    const nombreArchivoFinal = `Levantamiento_Ilegal_${sectorActivo.toUpperCase()}_${campoUsuario.replace(/\s+/g, '_')}.pdf`;
    
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
}
