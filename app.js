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
    
    if (pass === "Ilegal2026*") {
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

// Procesa Fachada y Medidor aplicando el recuadro blanco al logo y letras blancas limpias
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
                
                const logoMarca = new Image();
                logoMarca.crossOrigin = "anonymous";
                logoMarca.src = "https://raw.githubusercontent.com/proyectosjdop-alfa/levantamiento_ilegales/refs/heads/main/imagenes/UTCD%20Vertical%20.png";
                
                logoMarca.onload = function() {
                    const ahora = new Date();
                    const fechaTxt = `Fecha: ${ahora.toLocaleDateString('es-HN')}`;
                    const horaTxt = `Hora: ${ahora.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
                    const lat = document.getElementById("campo-lat").value || "N/A";
                    const lng = document.getElementById("campo-lng").value || "N/A";
                    const coordTxt = `Coordenadas: ${lat}, ${lng}`;
                    const sectorTxt = `Sector: ${sectorActivo.toUpperCase()}`;

                    // Dimensiones del logo (Escala aproximada para 25mm x 35mm)
                    const logoAncho = 95;
                    const logoAlto = 133;
                    
                    const posX = 25;
                    const posY = canvas.height - logoAlto - 25;

                    // 1. DIBUJAR FONDO BLANCO SÓLIDO ÚNICAMENTE DETRÁS DEL LOGO
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(posX - 8, posY - 8, logoAncho + 16, logoAlto + 16);

                    // Estampar el logotipo sobre su fondo blanco
                    ctx.drawImage(logoMarca, posX, posY, logoAncho, logoAlto);

                    // 2. CONFIGURAR TEXTO BLANCO SIN FONDO (CON SOMBRA DE CONTRASTE)
                    ctx.fillStyle = "#ffffff"; 
                    ctx.font = "bold 16px Arial";
                    ctx.shadowColor = "black";
                    ctx.shadowBlur = 6;
                    ctx.shadowOffsetX = 2;
                    ctx.shadowOffsetY = 2;
                    
                    const textoX = posX + logoAncho + 25;
                    let textoY = posY + 22;

                    // Imprimir datos verticalmente a la par
                    ctx.fillText(fechaTxt, textoX, textoY);
                    ctx.fillText(horaTxt, textoX, textoY + 28);
                    ctx.fillText(coordTxt, textoX, textoY + 56);
                    ctx.fillText(sectorTxt, textoX, textoY + 84);

                    // Resetear sombras para no afectar otros renders futuros del canvas
                    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

                    const finalData = canvas.toDataURL("image/jpeg", 0.85);
                    document.getElementById(idPreview).innerHTML = `<img src="${finalData}">`;
                    
                    if(idPreview === 'prev-fachada') datosFotos.fachada = finalData;
                    if(idPreview === 'prev-medidor') datosFotos.medidor = finalData;
                };
                
                logoMarca.onerror = function() {
                    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
                    ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px Arial";
                    ctx.fillText(`ERROR LOGO | ${new Date().toLocaleString('es-HN')} | SECTOR: ${sectorActivo}`, 20, canvas.height - 14);
                    const finalData = canvas.toDataURL("image/jpeg", 0.85);
                    document.getElementById(idPreview).innerHTML = `<img src="${finalData}">`;
                    if(idPreview === 'prev-fachada') datosFotos.fachada = finalData;
                    if(idPreview === 'prev-medidor') datosFotos.medidor = finalData;
                };
            };
        };
        lector.readAsDataURL(input.files[0]);
    }
}

// NUEVO ENFOQUE: Acumulador de fotos extras sin límite con marca de agua institucional
function procesarFotoExtraSiguiente(input) {
    if (input.files && input.files[0]) {
        const archivo = input.files[0];
        const lector = new FileReader();
        
        lector.onload = (e) => {
            const imgElement = new Image(); 
            imgElement.src = e.target.result;
            imgElement.onload = function() {
                const canvas = document.createElement("canvas"); 
                const ctx = canvas.getContext("2d");
                
                // Forzar resolución estándar horizontal para evidencias
                canvas.width = 1280; 
                canvas.height = 720;
                ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
                
                const logoMarca = new Image();
                logoMarca.crossOrigin = "anonymous";
                logoMarca.src = "https://raw.githubusercontent.com/proyectosjdop-alfa/levantamiento_ilegales/refs/heads/main/imagenes/UTCD%20Vertical%20.png";
                
                logoMarca.onload = function() {
                    const ahora = new Date();
                    const fechaTxt = `Fecha: ${ahora.toLocaleDateString('es-HN')}`;
                    const horaTxt = `Hora: ${ahora.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
                    const lat = document.getElementById("campo-lat").value || "N/A";
                    const lng = document.getElementById("campo-lng").value || "N/A";
                    const coordTxt = `Coordenadas: ${lat}, ${lng}`;
                    const sectorTxt = `Sector: ${sectorActivo.toUpperCase()}`;

                    const logoAncho = 95; 
                    const logoAlto = 133;
                    const posX = 25; 
                    const posY = canvas.height - logoAlto - 25;

                    // 1. Escudo de fondo blanco para el Logotipo
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(posX - 8, posY - 8, logoAncho + 16, logoAlto + 16);
                    ctx.drawImage(logoMarca, posX, posY, logoAncho, logoAlto);

                    // 2. Textos técnicos en blanco puro con sombra inalterable
                    ctx.fillStyle = "#ffffff"; 
                    ctx.font = "bold 15px Arial";
                    ctx.shadowColor = "black";
                    ctx.shadowBlur = 6;
                    ctx.shadowOffsetX = 2;
                    ctx.shadowOffsetY = 2;
                    
                    const textoX = posX + logoAncho + 25;
                    let textoY = posY + 22;

                    ctx.fillText(fechaTxt, textoX, textoY);
                    ctx.fillText(horaTxt, textoX, textoY + 28);
                    ctx.fillText(coordTxt, textoX, textoY + 56);
                    ctx.fillText(sectorTxt, textoX, textoY + 84);

                    // Limpiar sombras del lienzo
                    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

                    const finalData = canvas.toDataURL("image/jpeg", 0.85);
                    
                    // Guardar en el arreglo global existente de fotos extras
                    datosFotos.extras.push(finalData);
                    
                    // Renderizar la miniatura en la interfaz del usuario inmediatamente
                    const contenedor = document.getElementById("contenedor-prev-extras");
                    const div = document.createElement("div"); 
                    div.className = "preview-box";
                    div.style.position = "relative";
                    div.innerHTML = `
                        <img src="${finalData}" style="width:100%; height:100%; object-fit:cover;">
                        <span style="position:absolute; top:2px; left:5px; background:rgba(0,0,0,0.7); color:#fff; font-size:10px; padding:2px 5px; border-radius:3px;">
                            Foto ${datosFotos.extras.length}
                        </span>
                    `; 
                    contenedor.appendChild(div);
                    
                    // Resetear el input file para que permita capturar la siguiente inmediatamente
                    input.value = "";
                };
                
                logoMarca.onerror = function() {
                    const finalData = canvas.toDataURL("image/jpeg", 0.8);
                    datosFotos.extras.push(finalData);
                    
                    const contenedor = document.getElementById("contenedor-prev-extras");
                    const div = document.createElement("div"); 
                    div.className = "preview-box";
                    div.innerHTML = `<img src="${finalData}" style="width:100%; height:100%; object-fit:cover;">`; 
                    contenedor.appendChild(div);
                    input.value = "";
                };
            };
        };
        lector.readAsDataURL(archivo);
    }
}
// GENERACIÓN DE PDF CORREGIDA, CENTRADA Y SIN ERRORES DE SINTAXIS
function generarReportePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    
    const maxAncho = 210; 
    const maxAlto = 297; 
    const margen = 10;

    // Función interna para dibujar la estructura base con marcos de celda tipo Excel
    function aplicarMarcoYEncabezadoExcel(numPagina) {
        // 1. Marco perimetral de la hoja externa
        doc.setDrawColor(22, 35, 47); 
        doc.setLineWidth(0.4);
        doc.rect(margen, margen, maxAncho - (margen * 2), maxAlto - (margen * 2));
        
        // 2. MARCO DEL ENCABEZADO SUPERIOR
        doc.setLineWidth(0.3);
        doc.setDrawColor(22, 35, 47);
        doc.rect(margen + 2, margen + 2, maxAncho - (margen * 2) - 4, 18); // Caja contenedora del header

        // Líneas divisorias internas del encabezado
        doc.line(margen + 47, margen + 2, margen + 47, margen + 20);
        doc.line(165, margen + 2, 165, margen + 20);

        // Imagen del Logo
        doc.setFillColor(255, 255, 255);
        doc.addImage("https://raw.githubusercontent.com/proyectosjdop-alfa/levantamiento_ilegales/refs/heads/main/imagenes/UTCD%20Vertical.png", "PNG", margen + 4, margen + 4, 39, 14);

        // Título Central
        doc.setFont("helvetica", "bold"); 
        doc.setFontSize(11); 
        doc.setTextColor(22, 35, 47);
        doc.text("LEVANTAMIENTO DE ILEGALES", 106, margen + 8, { align: "center" });
        doc.setFontSize(10); 
        doc.text(`SECTOR ${sectorActivo.toUpperCase()}`, 106, margen + 14, { align: "center" });

        // Cuadrícula Informativa de Control Derecha (Fijos y Vacíos)
        doc.line(165, margen + 8, maxAncho - margen - 2, margen + 8);
        doc.line(165, margen + 14, maxAncho - margen - 2, margen + 14);

        doc.setFontSize(8); 
        doc.setFont("helvetica", "normal");
        doc.text("Código:", 167, margen + 6);   
        doc.text("Versión: 1", 167, margen + 12);
        doc.text("Fecha:", 167, margen + 18);    

        // Footer de la página
        doc.setFontSize(8); 
        doc.setTextColor(140, 140, 140);
        doc.text(`Página ${numPagina}`, maxAncho - margen - 15, maxAlto - margen - 4);
    }

    // ================= PÁGINA 1: DATOS (RECUADRO LIMPIO) Y DNIs =================
    aplicarMarcoYEncabezadoExcel(1);
    
    doc.setFont("helvetica", "bold"); 
    doc.setFontSize(10); 
    doc.setTextColor(0, 0, 0);
    // Texto centrado perfectamente usando el ancho dinámico de la página
    doc.text("INFORMACIÓN DEL LEVANTAMIENTO:", maxAncho / 2, margen + 30, { align: "center" });

    // Arreglo de campos a imprimir
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

    let inicioYTabla = margen + 38;
    let anchoTabla = maxAncho - (margen * 2) - 8; 
    let altoFilaFija = 6.5;
    
    // 1. Calcular la altura total que requiere el cuadro contenedor único
    let altoTotalCuadro = 0;
    datosMapeados.forEach(([campo, valor]) => {
        if (campo.includes("REFERENCIA")) {
            let lineasDeTexto = doc.splitTextToSize(valor, 115);
            altoTotalCuadro += (lineasDeTexto.length * 4.5) + 3;
        } else {
            altoTotalCuadro += altoFilaFija;
        }
    });

    // 2. Dibujar el RECUADRO ÚNICO EXTERIOR sin líneas internas
    doc.setDrawColor(22, 35, 47);
    doc.setLineWidth(0.4);
    doc.rect(margen + 4, inicioYTabla, anchoTabla, altoTotalCuadro);

    // 3. Imprimir el texto limpio en su interior
    let yActual = inicioYTabla;
    datosMapeados.forEach(([campo, valor]) => {
        let esReferencia = campo.includes("REFERENCIA");
        let lineasDeTexto = doc.splitTextToSize(valor, 115);
        let altoFilaActual = esReferencia ? (lineasDeTexto.length * 4.5) + 3 : altoFilaFija;

        // Imprimir Etiqueta
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text(campo, margen + 7, yActual + 4.5);

        // Imprimir Valor alineado
        doc.setFont("helvetica", "normal");
        if (esReferencia) {
            doc.text(lineasDeTexto, margen + 65, yActual + 4.5);
        } else {
            doc.text(valor, margen + 65, yActual + 4.5);
        }

        yActual += altoFilaActual;
    });

    // Posición para las fotos de los DNI de forma VERTICAL abajo
    yActual += 15; 
    doc.setFont("helvetica", "bold"); 
    doc.setFontSize(9);
    
    const anchoDNI = 85.6;
    const altoDNI = 54;
    const xCentradoDNI = (maxAncho / 2) - (anchoDNI / 2);

    if(datosFotos.dniFrontal) {
        doc.text("FOTO FRONTAL DNI DEL USUARIO:", xCentradoDNI, yActual);
        yActual += 2;
        doc.addImage(datosFotos.dniFrontal, "JPEG", xCentradoDNI, yActual, anchoDNI, altoDNI);
        doc.setDrawColor(22, 35, 47); doc.setLineWidth(0.3);
        doc.rect(xCentradoDNI, yActual, anchoDNI, altoDNI); 
        yActual += altoDNI + 15;
    }
    
    if(datosFotos.dniRevers) {
        doc.text("FOTO REVERSO DNI DEL USUARIO:", xCentradoDNI, yActual);
        yActual += 2;
        doc.addImage(datosFotos.dniRevers, "JPEG", xCentradoDNI, yActual, anchoDNI, altoDNI);
        doc.setDrawColor(22, 35, 47); doc.setLineWidth(0.3);
        doc.rect(xCentradoDNI, yActual, anchoDNI, altoDNI); 
    }

    // ================= PÁGINA 2: FACHADA Y MEDIDOR CON MARCOS =================
    doc.addPage();
    aplicarMarcoYEncabezadoExcel(2);

    let yPag2 = margen + 30;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    
    // Foto Fachada: 160 mm × 100 mm con su marco
    doc.text("FOTO FACHADA:", maxAncho / 2, yPag2 + 5, { align: "center" });
    if(datosFotos.fachada) {
        let xFachada = (maxAncho / 2) - 80;
        doc.addImage(datosFotos.fachada, "JPEG", xFachada, yPag2 + 3, 160, 100);
        doc.setDrawColor(22, 35, 47); doc.setLineWidth(0.4);
        doc.rect(xFachada, yPag2 + 3, 160, 100);
    }

    // Foto Medidor: 70 mm × 100 mm con su marco
    yPag2 += 130;
    doc.text("FOTO BASE DEL MEDIDOR:", maxAncho / 2, yPag2 + 5, { align: "center" });
    if(datosFotos.medidor) {
        let xMedidor = (maxAncho / 2) - 35;
        doc.addImage(datosFotos.medidor, "JPEG", xMedidor, yPag2 + 3, 70, 100);
        doc.setDrawColor(22, 35, 47); doc.setLineWidth(0.4);
        doc.rect(xMedidor, yPag2 + 3, 70, 100);
    }

    // ================= PÁGINAS 3+: OTRAS FOTOS EXTRAS CON MARCOS =================
    if (datosFotos.extras.length > 0) {
        let paginaExtraActiva = 3;
        let conteoFotosPorPagina = 0;
        let yFotosExtras = margen + 30;
        
        datosFotos.extras.forEach((imgExtra, indice) => {
            if (conteoFotosPorPagina === 0) {
                doc.addPage();
                aplicarMarcoYEncabezadoExcel(paginaExtraActiva);
                yFotosExtras = margen + 30;
            }

            doc.setFont("helvetica", "bold"); doc.setFontSize(9);
            doc.text(`OTRAS FOTOS ${indice + 1}:`, maxAncho / 2, yFotosExtras, { align: "center" });
            
            let xExtra = (maxAncho / 2) - 80;
            doc.addImage(imgExtra, "JPEG", xExtra, yFotosExtras + 3, 160, 100);
            doc.setDrawColor(22, 35, 47); doc.setLineWidth(0.4);
            doc.rect(xExtra, yFotosExtras + 3, 160, 100);
            
            yFotosExtras += 120;
            conteoFotosPorPagina++;

            if (conteoFotosPorPagina === 2 && indice < datosFotos.extras.length - 1) {
                conteoFotosPorPagina = 0; 
                paginaExtraActiva++;
            }
        });
    }

    // Lanzar el visor de impresión integrado
    window.open(doc.output('bloburl'), '_blank');
}
