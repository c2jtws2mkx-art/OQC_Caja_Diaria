// src/anual.js
import { getAsientosAnioCorriente, deleteAsientoSoft, restoreAsientoSoft } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    const dashView = document.querySelector('main.container:not(#annualView)');
    const annualView = document.getElementById('annualView');

    const btnViewAnnual = document.getElementById('btnViewAnnual');
    const btnBackToDash = document.getElementById('btnBackToDash');
    const listBody = document.getElementById('listaAnualBody');
    const filterTrimestre = document.getElementById('filterTrimestre');
    const filterCategoria = document.getElementById('filterCategoria');
    const summaryBox = document.getElementById('annualSummaryBox');

    let allYearData = [];

    // Lógica para alternar vistas
    if (btnViewAnnual) {
        btnViewAnnual.addEventListener('click', async () => {
            dashView.style.display = 'none';
            annualView.style.display = 'flex';
            await loadAnnualData();
        });
    }

    btnBackToDash.addEventListener('click', () => {
        annualView.style.display = 'none';
        dashView.style.display = 'flex';
        // Podríamos recargar el dash si hiciera falta
    });

    filterTrimestre.addEventListener('change', renderFilteredList);
    filterCategoria.addEventListener('change', renderFilteredList);

    // Helpers Trimestres
    function getTrimestre(dateString) {
        const month = new Date(dateString).getMonth() + 1; // 1-12
        if (month <= 3) return 'T1';
        if (month <= 6) return 'T2';
        if (month <= 9) return 'T3';
        return 'T4';
    }

    async function loadAnnualData() {
        listBody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando datos del año...</td></tr>';
        allYearData = await getAsientosAnioCorriente();
        renderFilteredList();
    }

    function renderFilteredList() {
        const valTrimestre = filterTrimestre.value;
        const valCategoria = filterCategoria.value;

        // Filtrado
        const filtered = allYearData.filter(asiento => {
            const trimMatch = valTrimestre === 'ALL' || getTrimestre(asiento.fecha_factura) === valTrimestre;
            const catMatch = valCategoria === 'ALL' || asiento.categoria === valCategoria;
            return trimMatch && catMatch;
        });

        // Render tabla
        listBody.innerHTML = '';

        let totalIngresos = 0;
        let totalGastos = 0;

        if (filtered.length === 0) {
            listBody.innerHTML = '<tr><td colspan="6" class="text-center">No hay registros para estos filtros</td></tr>';
            renderSummary(totalIngresos, totalGastos);
            return;
        }

        filtered.forEach(asiento => {
            const isDeleted = asiento.borrado_logico === true;

            if (!isDeleted) {
                if (asiento.tipo === 'ingreso') totalIngresos += asiento.total;
                if (asiento.tipo === 'gasto') totalGastos += asiento.total;
            }

            const tr = document.createElement('tr');

            if (isDeleted) {
                tr.style.opacity = '0.5';
                tr.style.textDecoration = 'line-through';
            }

            const fechaStr = new Date(asiento.fecha_factura).toLocaleDateString('es-ES');
            const totalClass = asiento.tipo === 'gasto' ? 'amount-gasto' : 'amount-ingreso';
            const totalStr = asiento.total.toFixed(2) + ' €';

            const actionBtn = isDeleted
                ? `<button class="btn-restore" title="Restaurar" data-id="${asiento.id}"><i class="fa-solid fa-rotate-left"></i></button>`
                : `<button class="btn-delete" title="Eliminar" data-id="${asiento.id}"><i class="fa-solid fa-trash"></i></button>`;

            tr.innerHTML = `
                <td>${fechaStr}</td>
                <td><strong>${asiento.proveedor}</strong></td>
                <td><span style="font-size:0.8rem; background:#e2e8f0; padding:0.2rem 0.5rem; border-radius:4px;">${asiento.categoria}</span></td>
                <td style="color:var(--text-muted); font-size:0.85rem;">${asiento.detalle || ''}</td>
                <td class="text-right ${totalClass}">${totalStr}</td>
                <td class="text-center">
                    ${actionBtn}
                </td>
            `;

            if (isDeleted) {
                const btnRestore = tr.querySelector('.btn-restore');
                btnRestore.addEventListener('click', async () => {
                    if (confirm("¿Seguro que deseas restaurar este registro?")) {
                        try {
                            if (asiento.id !== '1' && asiento.id !== '2') {
                                await restoreAsientoSoft(asiento.id);
                            }
                            loadAnnualData(); // Recarga y re-aplica filtros
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
                            loadAnnualData(); // Recarga y re-aplica filtros
                        } catch (e) {
                            alert("Error al borrar.");
                        }
                    }
                });
            }

            listBody.appendChild(tr);
        });

        renderSummary(totalIngresos, totalGastos);
    }

    function renderSummary(ingresos, gastos) {
        summaryBox.innerHTML = `
            <div style="flex:1; background:var(--ingreso-light); padding:1rem; border-radius:var(--border-radius-sm); text-align:center;">
                <div style="font-size:0.8rem; font-weight:bold; color:var(--success-green);">TOTAL INGRESOS</div>
                <div style="font-size:1.5rem; color:var(--success-green);">${ingresos.toFixed(2)} €</div>
            </div>
            <div style="flex:1; background:var(--gasto-light); padding:1rem; border-radius:var(--border-radius-sm); text-align:center;">
                <div style="font-size:0.8rem; font-weight:bold; color:var(--gasto-red);">TOTAL GASTOS</div>
                <div style="font-size:1.5rem; color:var(--gasto-red);">${Math.abs(gastos).toFixed(2)} €</div>
            </div>
            <div style="flex:1; background:#e2e8f0; padding:1rem; border-radius:var(--border-radius-sm); text-align:center;">
                <div style="font-size:0.8rem; font-weight:bold; color:var(--text-main);">BALANCE</div>
                <div style="font-size:1.5rem; color:var(--text-main); font-weight:bold;">${(ingresos + gastos).toFixed(2)} €</div>
            </div>
        `;
    }
});
