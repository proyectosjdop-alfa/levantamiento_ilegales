// URL de la nueva hoja compartida con validación por Sector y Circuito
const SHEETS_CIRCUITOS_URL = "https://docs.google.com/spreadsheets/d/15FfY5O9CXIBA0RUcwqJMqHLbrOFRmu4ssgZ9xhPa44A/export?format=csv&gid=434622515";

let sectorActivo = "";
let circuitosDataGlobal = [];

let datosFotos = {
    dniFrontal: null,
    dniRevers: null,
    fachada: null,
    medidor: null,
    extras: []
};

// Formateador automático en tiempo real para DNI (xxxx-xxxx-xxxxx) o pasaporte libre
function formatearDNI(input) {
    let valor = input.value.replace(/\s+/g, '').toUpperCase();
    
    // Si solo contiene números y avanza hacia un formato DNI
    if (/^\d+$/.test(valor.replace(/-/g, ''))) {
        let numeros = valor.replace(/-/g, '');
        if (numeros.length > 13) numeros = numeros.substr(0, 13);
        
        let resultado = "";
        if (numeros.length > 0) resultado += numeros.substr(0, 4);
        if (numeros.length > 4) resultado += "-" + numeros.substr(4, 4);
        if (numeros.length > 8) resultado += "-" + numeros.substr(8, 5);
        
        input.value = resultado;
    } else {
        // Si tiene letras se asume Pasaporte y se le deja escribir hasta 14 caracteres libres
        if (valor.length > 14) {
            input.value = valor.substr(0, 14);
        }
    }
}

// Inicialización de Acceso Técnico
async function validarAcceso() {
    const sector = document.getElementById("login-sector").value;
    const pass = document.getElementById("login-pass").value;

    if (!sector) {
        alert("Seleccione un sector válido para continuar.");
        return;
    }
    
    if (pass === "enee2026") {
        sectorActivo = sector;
        document.getElementById("txt-sector-activo").innerText = `SECTOR: ${sectorActivo.toUpperCase()}`;
        document.getElementById("campo-circuito").innerHTML = '<option value="">Descargando circuitos oficiales...</option>';
        
        document.getElementById("login-container").style.display = "none";
        document.getElementById("app-container").style.display = "block";
        
        document.getElementById("campo-fecha").value = new Date().toISOString().substring(0, 10);
        
        await descargarCircuitosDesdeSheets();
    } else {
        alert("Contraseña incorrecta.");
    }
}

// Descarga y procesa el nuevo CSV estructurado de Google Sheets
async function descargarCircuitosDesdeSheets() {
    try {
        const respuesta = await fetch(SHEETS_CIRCUITOS_URL);
        const textoCSV = await respuesta.text();
        const lineas = textoCSV.split("\n");
        circuitosDataGlobal = [];

        // Leer encabezado para mapear las columnas dinámicamente
        let indexCircuito = 0;
        let indexSector = 1;

        if(lineas.length > 0) {
            const cabecera = lineas[0].split(",");
            for(let c=0; c<cabecera.length; c++) {
                let colNombre = cabecera[c].replace(/"/g, "").trim().toUpperCase();
                if(colNombre === "CIRCUITO") indexCircuito = c;
                if(colNombre === "SECTOR") indexSector = c;
            }
        }

        for (let i = 1; i < lineas.length; i++) {
            const linea = lineas[i].trim();
            if (!linea) continue;

            const columnas = linea.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (columnas.length <= Math.max(indexCircuito, indexSector)) continue;

            const circuitoNombre = columnas[indexCircuito].replace(/"/g, "").trim().toUpperCase();
            const sectorNombre = columnas[indexSector].replace(/"/g, "").trim().toUpperCase();

            if (circuitoNombre && sectorNombre) {
                circuitosDataGlobal.push({ circuito: circuitoNombre, sector: sectorNombre });
            }
        }

        poblarMenuCircuitos(sectorActivo);
    } catch (error) {
        console.error("Error al conectar con Sheets:", error);
        alert("⚠️ Falló descarga en vivo. Se usará lista local de contingencia.");
        poblarCircuitosRespaldo(sectorActivo);
    }
}

function poblarMenuCircuitos(sector) {
    const combo = document.getElementById("campo-circuito");
    combo.innerHTML = '<option value="">-- Seleccione un Circuito --</option>';

    const filtrados = circuitosDataGlobal.filter(item => item.sector === sector.toUpperCase());

    if (filtrados.length === 0) {
        poblarCircuitosRespaldo(sector);
        return;
    }

    filtrados.sort((a, b) => a.circuito.localeCompare(b.circuito)).forEach(item => {
        let opt = document.createElement("option");
        opt.value = item.circuito;
        opt.innerText = item.circuito;
        combo.appendChild(opt);
    });
}

function poblarCircuitosRespaldo(sector) {
    const combo = document.getElementById("campo-circuito");
    combo.innerHTML = '<option value="">-- Seleccione un Circuito --</option>';
    const respaldos = {
        "TEGUCIGALPA": ["TON-L211", "TON-L212", "SLA-L221"],
        "SAN PEDRO SULA": ["LVI-L228", "LVI-L229"],
        "JUTICALPA": ["JUT-L511", "JUT-L512"],
        "CHOLUTECA": ["CHO-L411"]
    };
    const lista = respaldos[sector.toUpperCase()] || ["CIRCUITO-GENERAL"];
    lista.forEach(c => {
        let opt = document.createElement("option");
        opt.value = c; opt.innerText = c; combo.appendChild(opt);
    });
}

// Captura Automática vía Antena/Gps
function capturarUbicacion() {
    if (!navigator.geolocation) {
        alert("Geolocalización no soportada.");
        return;
    }
    document.getElementById("campo-utm").value = "Buscando satélites...";
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            document.getElementById("campo-lat").value = pos.coords.latitude.toFixed(6);
            document.getElementById("campo-lng").value = pos.coords.longitude.toFixed(6);
            calcularUTMManual();
        },
        () => { alert("Active el GPS de su celular."); document.getElementById("campo-utm").value = "Fallo GPS"; },
        { enableHighAccuracy: true, timeout: 8000 }
    );
}

// Escucha de entradas manuales para recalcular UTM instantáneamente
function calcularUTMManual() {
    const lat = parseFloat(document.getElementById("campo-lat").value);
    const lng = parseFloat(document.getElementById("campo-lng").value);
    
    if (!isNaN(lat) && !isNaN(lng)) {
        document.getElementById("campo-utm").value = convertirLatLngToUTM(lat, lng);
    } else {
        document.getElementById("campo-utm").value = "";
    }
}

function convertirLatLngToUTM(lat, lng) {
    const a = 6378137.0; const eccSquared = 0.00669438; const k0 = 0.9996;
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

    let UTMEasting = (k0 * N * (A + (1 - T + C) * A * A * A / 6.0 + (5 - 18 * T + T * T + 72 * C - 58 * eccSquared) * A * A * A * A * A / 120.0) + 500000.0);
    let UTMNorthing = (k0 * (M + N * Math.tan(latRad) * (A * A / 2.0 + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24.0 + (61 - 58 * T + T * T + 600 * C - 330 * eccSquared) * A * A * A * A * A * A / 720.0)));
    
    return `${zone}P E: ${UTMEasting.toFixed(1)} N: ${UTMNorthing.toFixed(1)}`;
}

function procesarImagenSimple(input, idPreview) {
    if (input.files && input.files[0]) {
        const lector = new FileReader();
        lector.onload = (e) => {
            document.getElementById(idPreview).innerHTML = `<img src="${e.target.result}">`;
            if(idPreview === 'prev-dni-frontal') datosFotos.dniFrontal = e.target.result;
            if(idPreview === 'prev-dni-revers') datosFotos.dniRevers = e.target.result;
        };
        lector.readAsDataURL(input.files[0]);
    }
}

function procesarImagenConMarcaAgua(input, idPreview, orientacion) {
    if (input.files && input.files[0]) {
        const lector = new FileReader();
        lector.onload = (e) => {
            const imgElement = new Image();
            imgElement.src = e.target.result;
            imgElement.onload = function() {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                canvas.width = orientacion === "HORIZONTAL" ? 1280 : 720;
                canvas.height = orientacion === "HORIZONTAL" ? 720 : 1280;

                ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
                
                const txt = `${new Date().toLocaleString('es-HN')} | GPS: ${document.getElementById("campo-lat").value || "N/A"}, ${document.getElementById("campo-lng").value || "N/A"} | SECTOR: ${sectorActivo}`;
                ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
                ctx.fillStyle = "#f4c430"; ctx.font = "bold 18px Arial"; ctx.fillText(txt, 20, canvas.height - 14);

                const finalData = canvas.toDataURL("image/jpeg", 0.85);
                document.getElementById(idPreview).innerHTML = `<img src="${finalData}">`;
                if(idPreview === 'prev-fachada') datosFotos.fachada = finalData;
                if(idPreview === 'prev-medidor') datosFotos.medidor = finalData;
            };
        };
        lector.readAsDataURL(input.files[0]);
    }
}

function procesarMultiplesExtras(input) {
    const contenedor = document.getElementById("contenedor-prev-extras");
    contenedor.innerHTML = ""; datosFotos.extras = [];
    if (input.files) {
        Array.from(input.files).forEach((archivo) => {
            const lector = new FileReader();
            lector.onload = (e) => {
                const imgElement = new Image(); imgElement.src = e.target.result;
                imgElement.onload = function() {
                    const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d");
                    canvas.width = 1280; canvas.height = 720;
                    ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
                    
                    const finalData = canvas.toDataURL("image/jpeg", 0.8);
                    datosFotos.extras.push(finalData);
                    
                    const div = document.createElement("div"); div.className = "preview-box";
                    div.innerHTML = `<img src="${finalData}">`; contenedor.appendChild(div);
                };
            };
            lector.readAsDataURL(archivo);
        });
    }
}

// GENERACIÓN DE PDF SIGUIENDO EL MODELO DE EXCEL EXCLUSIVAMENTE
function generarReportePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    
    const maxAncho = 210; const maxAlto = 297; const margen = 10;

    function aplicarMarcoYEncabezadoExcel(numPagina) {
        // Marco de la celda externa del Excel
        doc.setDrawColor(22, 35, 47); doc.setLineWidth(0.6);
        doc.rect(margen, margen, maxAncho - (margen * 2), maxAlto - (margen * 2));
        
        // Cabecera Combinada de Celdas
        doc.setFillColor(255, 255, 255); doc.rect(margen + 2, margen + 2, 45, 16, 'F');
        doc.addImage("https://raw.githubusercontent.com/proyectosjdop-alfa/levantamiento_ilegales/refs/heads/main/imagenes/UTCD%20Vertical.png", "PNG", margen + 4, margen + 3, 40, 14);

        // Bloque del Título de Celda Excel Central
        doc.setFont("Helvetica", "Bold"); doc.setFontSize(11); doc.setTextColor(22, 35, 47);
        doc.text("LEVANTAMIENTO DE ILEGALES", 125, margen + 7, { align: "center" });
        doc.setFontSize(10); doc.text(`SECTOR ${sectorActivo.toUpperCase()}`, 125, margen + 12, { align: "center" });

        // Cuadrícula Informativa de Control a la Derecha
        doc.setLineWidth(0.2); doc.setDrawColor(180, 180, 180);
        doc.rect(170, margen + 2, 28, 16);
        doc.setFontSize(7); doc.setFont("Helvetica", "Normal");
        doc.text("Código: [Vacío]", 172, margen + 6);
        doc.text("Versión: 1", 172, margen + 11);
        doc.text(`Fecha: ${document.getElementById("campo-fecha").value}`, 172, margen + 15);

        // Footer Informativo
        doc.setFontSize(7); doc.setTextColor(140, 140, 140);
        doc.text(`Pagina ${numPagina}`, maxAncho - margen - 15, maxAlto - margen - 4);
    }

    // ================= PÁGINA 1: DATOS Y DNI CARD =================
    aplicarMarcoYEncabezadoExcel(1);
    
    doc.setFont("Helvetica", "Bold"); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
    doc.text("Aquí va toda la información:", margen + 5, margen + 26);

    let y = margen + 32;
    const datosMapeados = [
        ["FECHA:", document.getElementById("campo-fecha").value],
        ["ENCARGADO DEL LEVANTAMIENTO:", document.getElementById("campo-encargado").value.toUpperCase()],
        ["NOMBRE DEL USUARIO:", document.getElementById("campo-usuario").value.toUpperCase()],
        ["DNI / PASAPORTE DEL USUARIO:", document.getElementById("campo-dni").value],
        ["CIRCUITO:", document.getElementById("campo-circuito").value.toUpperCase()],
        ["COORDENADA LAT/LONG:", `${document.getElementById("campo-lat").value || "N/A"}, ${document.getElementById("campo-lng").value || "N/A"}`],
        ["COORDENADA UTM:", document.getElementById("campo-utm").value || "N/A"],
        ["MUNICIPIO:", document.getElementById("lugar-municipio").value.toUpperCase()],
        ["COLONIA/BARRIO/ALDEA:", document.getElementById("lugar-colonia").value.toUpperCase()],
        ["REFERENCIA DE LA VIVIENDA:", document.getElementById("lugar-referencia").value.toUpperCase()]
    ];

    datosMapeados.forEach(([campo, valor]) => {
        doc.setFont("Helvetica", "Bold"); doc.text(campo, margen + 8, y);
        doc.setFont("Helvetica", "Normal");
        
        if (campo.includes("REFERENCIA")) {
            const splitTxt = doc.splitTextToSize(valor, 115);
            doc.text(splitTxt, margen + 65, y);
            y += (splitTxt.length * 4) + 4;
        } else {
            doc.text(valor, margen + 65, y);
            y += 6.5;
        }
    });

    // Separación e Inyección de Fotos DNI según tamaño de celda exacto de tarjeta (85.6mm x 54mm)
    y = Math.max(y + 5, 115); 
    doc.setFont("Helvetica", "Bold"); doc.setFontSize(8);
    
    if(datosFotos.dniFrontal) {
        doc.text("FOTO FRONTAL DNI DEL USUARIO: 85.60 mm × 53.98 mm", margen + 8, y);
        doc.addImage(datosFotos.dniFrontal, "JPEG", margen + 8, y + 3, 85.6, 54);
    }
    if(datosFotos.dniRevers) {
        doc.text("FOTO REVERSO DNI DEL USUARIO: 85.60 mm × 53.98 mm", margen + 102, y);
        doc.addImage(datosFotos.dniRevers, "JPEG", margen + 102, y + 3, 85.6, 54);
    }

    // ================= PÁGINA 2: FACHADA Y MEDIDOR =================
    doc.addPage();
    aplicarMarcoYEncabezadoExcel(2);

    // Foto Fachada: 160 mm × 100 mm
    let y2 = margen + 26;
    doc.setFont("Helvetica", "Bold"); doc.setFontSize(9);
    doc.text("FOTO FACHADA: 160 mm × 100 mm", margen + 5, y2);
    if(datosFotos.fachada) {
        doc.addImage(datosFotos.fachada, "JPEG", margen + 15, y2 + 4, 160, 100);
    }

    // Foto Medidor: 70 mm × 100 mm (Centrado Estilo Celda Excel)
    y2 += 112;
    doc.text("FOTO BASE DEL MEDIDOR: 70 mm × 100 mm", margen + 5, y2);
    if(datosFotos.medidor) {
        doc.addImage(datosFotos.medidor, "JPEG", (maxAncho / 2) - 35, y2 + 4, 70, 100);
    }

    // ================= PÁGINAS 3+: OTRAS FOTOS EXTRAS =================
    if (datosFotos.extras.length > 0) {
        let pAct = 3;
        let subIndex = 0;
        
        datosFotos.extras.forEach((imgExtra, i) => {
            if (subIndex === 0) {
                doc.addPage();
                aplicarMarcoYEncabezadoExcel(pAct);
                y2 = margen + 26;
            }

            doc.setFont("Helvetica", "Bold"); doc.setFontSize(9);
            doc.text(`OTRAS FOTOS ${i + 1}: 160 mm × 100 mm`, margen + 5, y2);
            doc.addImage(imgExtra, "JPEG", margen + 15, y2 + 4, 160, 100);
            
            y2 += 112;
            subIndex++;

            if (subIndex === 2 && i < datosFotos.extras.length - 1) {
                subIndex = 0; pAct++;
            }
        });
    }

    const nArchivo = `Levantamiento_${sectorActivo.toUpperCase()}_${document.getElementById("campo-usuario").value.replace(/\s+/g, '_')}.pdf`;
    window.open(doc.output('bloburl'), '_blank');
}
