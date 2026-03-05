// src/app.js
import { getAsientosMesCorriente, saveAsiento, updateAsiento, deleteAsientoSoft, restoreAsientoSoft } from './firebase.js';

let currentEditId = null; // Track record being edited

document.addEventListener('DOMContentLoaded', () => {
    console.log("App initialized");

    // Toggle Ingreso/Gasto logic
    const btnTypeGasto = document.getElementById('btnTypeGasto');
    const btnTypeIngreso = document.getElementById('btnTypeIngreso');
    let currentType = 'gasto'; // default

    btnTypeGasto.addEventListener('click', () => {
        currentType = 'gasto';
        btnTypeGasto.classList.add('active-gasto');
        btnTypeIngreso.classList.remove('active-ingreso');
    });

    btnTypeIngreso.addEventListener('click', () => {
        currentType = 'ingreso';
        btnTypeIngreso.classList.add('active-ingreso');
        btnTypeGasto.classList.remove('active-gasto');
    });

    // Tax Logic (Bidirectional)
    const baseInput = document.getElementById('baseImponible');
    const ivaSelect = document.getElementById('porcentajeIva');
    const montoIvaInput = document.getElementById('montoIva');
    const totalInput = document.getElementById('total');
    const otrosCargosInput = document.getElementById('otrosCargos');

    let isUpdating = false;

    function parseNum(val) {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    }

    // Calcula de Base -> Total
    function updateTotalesForward() {
        if (isUpdating) return;
        isUpdating = true;

        let base = parseNum(baseInput.value);
        let pctIva = parseNum(ivaSelect.value);
        let otros = parseNum(otrosCargosInput.value);

        let montoIva = (base * pctIva) / 100;
        let total = base + montoIva + otros;

        montoIvaInput.value = montoIva.toFixed(2);
        totalInput.value = total.toFixed(2);

        isUpdating = false;
    }

    // Calcula de Total -> Base e IVA
    function updateTotalesBackward() {
        if (isUpdating) return;
        isUpdating = true;

        let total = parseNum(totalInput.value);
        let pctIva = parseNum(ivaSelect.value);
        let otros = parseNum(otrosCargosInput.value);

        // total = base + (base * pctIva/100) + otros
        // total - otros = base * (1 + pctIva/100)
        // base = (total - otros) / (1 + pctIva/100)

        let base = (total - otros) / (1 + (pctIva / 100));
        let montoIva = total - otros - base;

        baseInput.value = base.toFixed(2);
        montoIvaInput.value = montoIva.toFixed(2);

        isUpdating = false;
    }

    baseInput.addEventListener('input', updateTotalesForward);
    ivaSelect.addEventListener('change', updateTotalesForward);
    otrosCargosInput.addEventListener('input', updateTotalesForward);

    totalInput.addEventListener('input', updateTotalesBackward);


    // Contacts Modal Logic
    const modal = document.getElementById('contactsModal');
    const btnOpenContacts = document.getElementById('btnOpenContacts');
    const btnCloseModal = document.getElementById('closeContactsModal');

    btnOpenContacts.addEventListener('click', () => {
        modal.style.display = 'block';
    });

    btnCloseModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target == modal) {
            modal.style.display = 'none';
        }
    });

    // Auto-set today date
    document.getElementById('fechaFactura').valueAsDate = new Date();

    // Attach submit handle
    const form = document.getElementById('entryForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnGuardar = document.getElementById('btnGuardar');
        btnGuardar.disabled = true;
        btnGuardar.textContent = "Guardando...";

        const totalValue = parseNum(document.getElementById('total').value);

        // Map values to Firestore model
        const asientoData = {
            fecha_factura: document.getElementById('fechaFactura').value,
            tipo: currentType, // 'gasto' o 'ingreso'
            contacto_id: null, // TODO: Link to real contact
            proveedor: document.getElementById('proveedor').value,
            cif_dni: document.getElementById('cifNif').value,
            categoria: document.getElementById('categoria').value,
            detalle: document.getElementById('detalle').value,
            base_imponible: parseNum(document.getElementById('baseImponible').value),
            iva_porcentaje: parseNum(document.getElementById('porcentajeIva').value),
            monto_iva: parseNum(document.getElementById('montoIva').value),
            otros_cargos: parseNum(document.getElementById('otrosCargos').value),
            // Asegurarse de que un gasto se guarde como numero negativo
            total: currentType === 'gasto' ? -Math.abs(totalValue) : Math.abs(totalValue),
            foto_url: null, // Later with Storage
        };

        try {
            if (currentEditId) {
                await updateAsiento(currentEditId, asientoData);
                alert("Asiento actualizado correctamente.");
                currentEditId = null;
            } else {
                await saveAsiento(asientoData);
                alert("Asiento guardado correctamente.");
            }
            form.reset();
            // Reset totals UI manually
            document.getElementById('baseImponible').value = "0";
            document.getElementById('montoIva').value = "0";
            document.getElementById('otrosCargos').value = "0";
            document.getElementById('total').value = "0";
            // Refresh list
            renderList();
        } catch (error) {
            console.error(error);
            alert("Error al guardar, revisa la consola.");
        } finally {
            btnGuardar.disabled = false;
            btnGuardar.textContent = "Guardar";
        }
    });

    // Handle form reset btn
    const btnLimpiar = document.getElementById('btnLimpiar');
    btnLimpiar.addEventListener('click', () => {
        form.reset();
        currentEditId = null;
        document.getElementById('btnGuardar').textContent = "Guardar";
        document.getElementById('baseImponible').value = "0";
        document.getElementById('montoIva').value = "0";
        document.getElementById('otrosCargos').value = "0";
        document.getElementById('total').value = "0";
    });

    // Render Initial List
    renderList();

    // --- OCR Logic ---
    const btnScan = document.getElementById('btnScan');
    const fileInput = document.getElementById('receiptFileInput');

    if (btnScan && fileInput) {
        btnScan.addEventListener('click', () => {
            fileInput.click(); // Abre dialogo de camara/archivo
        });

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            btnScan.disabled = true;
            btnScan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

            // 1. Convert to Base64
            const reader = new FileReader();

            reader.onload = async () => {
                try {
                    const base64Image = reader.result;

                    // 2. Send to Netlify Function (or local Flask server on port 5000)
                    const endpoint = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000'
                        ? 'http://localhost:5000/.netlify/functions/process_receipt'
                        : '/.netlify/functions/process_receipt';

                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: base64Image })
                    });

                    if (!response.ok) {
                        let errMsg = "Error en el servidor OCR";
                        try {
                            const err = await response.json();
                            errMsg = err.error || errMsg;
                        } catch (e) {
                            errMsg = `Error HTTP ${response.status}. ¿Está encendido el servidor Python (Flask) en el puerto 5000? La app no funciona usando solo la API web sin el backend.`;
                        }
                        throw new Error(errMsg);
                    }

                    const data = await response.json();

                    // 3. Fill the form
                    if (data.fecha) document.getElementById('fechaFactura').value = data.fecha;
                    if (data.proveedor) document.getElementById('proveedor').value = data.proveedor;
                    if (data.cif_nif) document.getElementById('cifNif').value = data.cif_nif;

                    if (data.base_imponible) document.getElementById('baseImponible').value = data.base_imponible;
                    if (data.porcentaje_iva) document.getElementById('porcentajeIva').value = data.porcentaje_iva;
                    if (data.total) {
                        document.getElementById('total').value = data.total;
                        // Trigger recalculate backwards just in case base wasn't provided but total was
                        updateTotalesBackward();
                    }

                    alert("¡Recibo procesado con éxito!");
                } catch (error) {
                    console.error("OCR Error:", error);
                    let msg = error.message;
                    if (msg === "Failed to fetch" || msg.includes("NetworkError")) {
                        msg = "❌ No se pudo conectar con el servidor OCR analítico.\n\nPara poder escanear recibos en esta fase de pruebas local, necesitas abrir OTRA pestaña en tu terminal y ejecutar:\n\npython local_backend_server.py\n\n(Asegúrate de configurar también tu GEMINI_API_KEY ahí).";
                    }
                    alert("Falla del OCR:\n\n" + msg);
                } finally {
                    btnScan.disabled = false;
                    btnScan.innerHTML = '<i class="fa-solid fa-camera"></i> Escanear o Subir Factura';
                    fileInput.value = ''; // reset
                }
            };

            reader.onerror = (error) => {
                alert("Error crítico leyendo la imagen desde el navegador.");
                btnScan.disabled = false;
                btnScan.innerHTML = '<i class="fa-solid fa-camera"></i> Escanear o Subir Factura';
                fileInput.value = ''; // reset
            };

            reader.readAsDataURL(file);
        });
    }
});

// Global state for seats
let asientosList = [];

// Elementos de Filtro
const filterMes = document.getElementById('filterMes');
const filterAnio = document.getElementById('filterAnio');
const filterCategoriaList = document.getElementById('filterCategoriaList');

// Auto-seleccionar el mes actual al iniciar
if (filterMes) {
    const mm = String(new Date().getMonth() + 1).padStart(2, '0');
    filterMes.value = mm;
}
if (filterAnio) {
    const yyyy = new Date().getFullYear().toString();
    filterAnio.innerHTML = `<option value="ALL">Todos</option><option value="${yyyy}" selected>${yyyy}</option><option value="${yyyy - 1}">${yyyy - 1}</option>`;
}

if (filterMes) filterMes.addEventListener('change', renderList);
if (filterAnio) filterAnio.addEventListener('change', renderList);
if (filterCategoriaList) filterCategoriaList.addEventListener('change', renderList);

async function renderList() {
    const listBody = document.getElementById('listaMesBody');
    const summaryTotal = document.getElementById('summaryTotal');
    const summaryIngresos = document.getElementById('summaryIngresos');
    const summaryGastos = document.getElementById('summaryGastos');

    listBody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando...</td></tr>';

    // Fetch data (Real Firebase or fallback mocks)
    asientosList = await getAsientosMesCorriente();

    listBody.innerHTML = '';
    let totalMes = 0;
    let totalIngresos = 0;
    let totalGastos = 0;

    // Aplicar Filtros Globales
    const valMes = filterMes ? filterMes.value : 'ALL';
    const valAnio = filterAnio ? filterAnio.value : 'ALL';
    const valCat = filterCategoriaList ? filterCategoriaList.value : 'ALL';

    const asientosFiltrados = asientosList.filter(asiento => {
        if (!asiento.fecha_factura) return true;

        let [y, m, d] = asiento.fecha_factura.split('-');

        if (valMes !== 'ALL') {
            if (valMes.startsWith('T')) {
                // Lógica de Trimestre
                const mesNum = parseInt(m, 10);
                if (valMes === 'T1' && (mesNum < 1 || mesNum > 3)) return false;
                if (valMes === 'T2' && (mesNum < 4 || mesNum > 6)) return false;
                if (valMes === 'T3' && (mesNum < 7 || mesNum > 9)) return false;
                if (valMes === 'T4' && (mesNum < 10 || mesNum > 12)) return false;
            } else {
                // Mes exacto
                if (m !== valMes) return false;
            }
        }

        if (valAnio !== 'ALL' && y !== valAnio) return false;
        if (valCat !== 'ALL' && asiento.categoria !== valCat) return false;

        return true;
    });

    if (asientosFiltrados.length === 0) {
        listBody.innerHTML = '<tr><td colspan="4" class="text-center">No hay asientos con esos filtros</td></tr>';
        summaryTotal.textContent = '0,00 €';
        summaryTotal.className = 'summary-amount';
        if (summaryIngresos) summaryIngresos.textContent = '0,00 €';
        if (summaryGastos) summaryGastos.textContent = '0,00 €';
        return;
    }

    asientosFiltrados.forEach(asiento => {
        const isDeleted = asiento.borrado_logico === true;

        if (!isDeleted) {
            totalMes += asiento.total;
            if (asiento.tipo === 'ingreso') {
                totalIngresos += asiento.total;
            } else {
                totalGastos += Math.abs(asiento.total);
            }
        }

        const tr = document.createElement('tr');

        if (isDeleted) {
            tr.style.opacity = '0.5';
            tr.style.textDecoration = 'line-through';
        }

        // Formatear fecha
        const fechaObj = new Date(asiento.fecha_factura);
        const fechaStr = fechaObj.toLocaleDateString('es-ES');

        // Estilo según tipo
        const totalClass = asiento.tipo === 'gasto' ? 'amount-gasto' : 'amount-ingreso';
        const totalStr = asiento.total.toFixed(2) + ' €';

        const actionBtn = isDeleted
            ? `<button class="btn-restore" title="Restaurar" data-id="${asiento.id}"><i class="fa-solid fa-rotate-left"></i></button>`
            : `<button class="btn-delete" title="Eliminar" data-id="${asiento.id}"><i class="fa-solid fa-trash"></i></button>`;

        tr.innerHTML = `
            <td>${fechaStr}</td>
            <td>
                <strong>${asiento.proveedor}</strong><br>
                <small style="color: var(--text-muted);">${asiento.categoria}</small>
            </td>
            <td class="text-right ${totalClass}">${totalStr}</td>
            <td class="text-center">
                <button class="btn-edit" title="Editar" data-id="${asiento.id}"><i class="fa-solid fa-pen"></i></button>
                ${actionBtn}
            </td>
        `;

        // Añadir listeners para botones dinamos (Borrar/Restaurar)
        if (isDeleted) {
            const btnRestore = tr.querySelector('.btn-restore');
            btnRestore.addEventListener('click', async () => {
                if (confirm("¿Restaurar y pasar al formulario para poder editarlo?")) {
                    try {
                        // 1. Restore the seat
                        if (asiento.id !== '1' && asiento.id !== '2') {
                            await restoreAsientoSoft(asiento.id);
                        }

                        // 2. Load into the form & set edit mode
                        currentEditId = asiento.id;

                        if (asiento.tipo === 'gasto') {
                            document.getElementById('btnTypeGasto').click();
                        } else {
                            document.getElementById('btnTypeIngreso').click();
                        }

                        document.getElementById('fechaFactura').value = asiento.fecha_factura || "";
                        document.getElementById('proveedor').value = asiento.proveedor || "";
                        document.getElementById('cifNif').value = asiento.cif_nif || "";
                        document.getElementById('categoria').value = asiento.categoria || "Otros";
                        document.getElementById('detalle').value = asiento.detalle || "";

                        document.getElementById('baseImponible').value = (asiento.base_imponible || 0).toFixed(2);
                        document.getElementById('porcentajeIva').value = asiento.porcentaje_iva || "21";
                        document.getElementById('montoIva').value = (asiento.monto_iva || 0).toFixed(2);
                        document.getElementById('otrosCargos').value = (asiento.otros_cargos || 0).toFixed(2);
                        document.getElementById('total').value = (Math.abs(asiento.total) || 0).toFixed(2);

                        document.getElementById('btnGuardar').textContent = "Actualizar";

                        // Scroll back up to the form so the user sees it
                        window.scrollTo({ top: 0, behavior: 'smooth' });

                        renderList();
                    } catch (e) {
                        alert("Error al restaurar.");
                    }
                }
            });
        } else {
            const btnDelete = tr.querySelector('.btn-delete');
            btnDelete.addEventListener('click', async () => {
                if (confirm("¿Seguro que deseas eliminar lógicamente este registro?")) {
                    try {
                        if (asiento.id !== '1' && asiento.id !== '2') {
                            await deleteAsientoSoft(asiento.id);
                        }
                        renderList();
                    } catch (e) {
                        alert("Error al borrar.");
                    }
                }
            });

            // Lógica del botón Editar
            const btnEdit = tr.querySelector('.btn-edit');
            btnEdit.addEventListener('click', () => {
                currentEditId = asiento.id;

                if (asiento.tipo === 'gasto') {
                    document.getElementById('btnTypeGasto').click();
                } else {
                    document.getElementById('btnTypeIngreso').click();
                }

                document.getElementById('fechaFactura').value = asiento.fecha_factura || "";
                document.getElementById('proveedor').value = asiento.proveedor || "";
                document.getElementById('cifNif').value = asiento.cif_nif || "";
                document.getElementById('categoria').value = asiento.categoria || "Otros";
                document.getElementById('detalle').value = asiento.detalle || "";

                document.getElementById('baseImponible').value = (asiento.base_imponible || 0).toFixed(2);
                document.getElementById('porcentajeIva').value = asiento.porcentaje_iva || "21";
                document.getElementById('montoIva').value = (asiento.monto_iva || 0).toFixed(2);
                document.getElementById('otrosCargos').value = (asiento.otros_cargos || 0).toFixed(2);
                document.getElementById('total').value = (Math.abs(asiento.total) || 0).toFixed(2);

                document.getElementById('btnGuardar').textContent = "Actualizar";

                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        listBody.appendChild(tr);
    });

    // Actualizar Resumen (Tarjetas)
    if (summaryTotal) {
        summaryTotal.textContent = totalMes.toFixed(2) + ' €';
        if (totalMes >= 0) {
            summaryTotal.className = 'summary-amount positive';
        } else {
            summaryTotal.className = 'summary-amount negative';
        }
    }

    if (summaryIngresos) {
        summaryIngresos.textContent = totalIngresos.toFixed(2) + ' €';
    }

    if (summaryGastos) {
        summaryGastos.textContent = totalGastos.toFixed(2) + ' €';
    }
}
