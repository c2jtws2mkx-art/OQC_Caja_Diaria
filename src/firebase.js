// src/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

// TODO: Replace with your app's Firebase project configuration
// IMPORTANTE: El usuario debe rellenar esto para que funcione la integración real
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID"
};

// Variables para exportar seguras
export let db = null;
export let storage = null;
export let cajasRef = null;
export let contactosRef = null;

let isFirebaseConfigured = false;

if (firebaseConfig.apiKey !== "TU_API_KEY") {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        storage = getStorage(app);
        cajasRef = collection(db, "caja_diaria");
        contactosRef = collection(db, "contactos");
        isFirebaseConfigured = true;
    } catch (e) {
        console.warn("Fallo al inicializar Firebase. Usando fallback local.");
    }
} else {
    console.warn("Firebase no configurado (Credenciales por defecto). Usaremos LocalStorage para la persistencia en esta sesión de prueba.");
}


/**
 * 
 * DATOS MOCK (Mientras no haya config real)
 * 
 */

export const mockContactos = [
    { id: 'c1', nombre: 'Suministros Paco', cif_nif: 'B12345678', telefono: '600123456' },
    { id: 'c2', nombre: 'Cliente Av. Libertad', cif_nif: '75000111A', telefono: '688999000' }
];

export const mockAsientos = [
    {
        id: '1',
        fecha_factura: new Date().toISOString().split('T')[0],
        proveedor: 'Suministros Paco',
        categoria: 'Fontanería',
        detalle: 'Material tuberías de cobre',
        total: -150.50,
        tipo: 'gasto'
    },
    {
        id: '2',
        fecha_factura: new Date().toISOString().split('T')[0],
        proveedor: 'Cliente Av. Libertad',
        categoria: 'Climatización',
        detalle: 'Instalación split 3000fg',
        total: 450.00,
        tipo: 'ingreso'
    }
];

/**
 * 
 * Funciones Auxiliares para CRUD
 * 
 */

// Traer todos los asientos desde 2025 (Año Fiscal Anterior) hasta fin del año actual
export async function getAsientosMesCorriente() {
    const today = new Date();
    // Forzamos a traer desde Enero 1 de 2025
    const firstDay = '2025-01-01';
    const lastDay = new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0];

    return fetchAsientos(firstDay, lastDay);
}

// Traer asientos del año en curso
export async function getAsientosAnioCorriente() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0];

    return fetchAsientos(firstDay, lastDay);
}

// Helper local fallback
function getLocalAsientos() {
    const stored = localStorage.getItem('oqc_asientos_fallback');
    return stored ? JSON.parse(stored) : [];
}

function handleFallbackAsientos(firstDay, lastDay) {
    const localData = getLocalAsientos();
    // Filtramos local data
    const filteredLocal = localData.filter(a => a.fecha_factura >= firstDay && a.fecha_factura <= lastDay);
    // Filtramos mocks
    const filteredMock = mockAsientos.filter(a => a.fecha_factura >= firstDay && a.fecha_factura <= lastDay);

    return [...filteredLocal, ...filteredMock].sort((a, b) => new Date(b.fecha_factura) - new Date(a.fecha_factura));
}

async function fetchAsientos(firstDay, lastDay) {
    if (!isFirebaseConfigured) {
        return handleFallbackAsientos(firstDay, lastDay);
    }

    try {
        const q = query(
            cajasRef,
            where("fecha_factura", ">=", firstDay),
            where("fecha_factura", "<=", lastDay),
            orderBy("fecha_factura", "desc")
        );

        const querySnapshot = await getDocs(q);
        const asientos = [];
        querySnapshot.forEach((doc) => {
            asientos.push({ id: doc.id, ...doc.data() });
        });
        return asientos;
    } catch (e) {
        console.warn("Firebase no configurado o falló, mostrando LocalStorage + mocks...", e);
        return handleFallbackAsientos(firstDay, lastDay);
    }
}


// Guardar un nuevo asiento
export async function saveAsiento(asientoData) {
    if (!isFirebaseConfigured) {
        return saveAsientoFallback(asientoData);
    }

    try {
        const docRef = await addDoc(cajasRef, {
            ...asientoData,
            fecha_creacion: serverTimestamp(),
            borrado_logico: false
        });
        return docRef.id;
    } catch (e) {
        console.warn("Fallback Guardando Asiento en LocalStorage", e);
        return saveAsientoFallback(asientoData);
    }
}

function saveAsientoFallback(asientoData) {
    const localData = getLocalAsientos();
    const newAsiento = {
        id: 'local_' + Date.now(),
        ...asientoData,
        fecha_creacion: new Date().toISOString(),
        borrado_logico: false
    };
    localData.push(newAsiento);
    localStorage.setItem('oqc_asientos_fallback', JSON.stringify(localData));
    return newAsiento.id;
}

// Actualizar un asiento existente
export async function updateAsiento(id, asientoData) {
    if (!isFirebaseConfigured) {
        return updateAsientoFallback(id, asientoData);
    }
    try {
        const asientoRef = doc(db, "caja_diaria", id);
        await updateDoc(asientoRef, {
            ...asientoData
        });
        return id;
    } catch (e) {
        console.warn("Fallback Actualizando Asiento", e);
        return updateAsientoFallback(id, asientoData);
    }
}

function updateAsientoFallback(id, asientoData) {
    if (id.startsWith('local_') || id === '1' || id === '2') {
        const localData = getLocalAsientos();
        const index = localData.findIndex(a => a.id === id);
        if (index !== -1) {
            localData[index] = { ...localData[index], ...asientoData };
            localStorage.setItem('oqc_asientos_fallback', JSON.stringify(localData));
        } else {
            // Mocks fallback
            const mockIndex = mockAsientos.findIndex(a => a.id === id);
            if (mockIndex !== -1) {
                mockAsientos[mockIndex] = { ...mockAsientos[mockIndex], ...asientoData };
            }
        }
    }
    return id;
}

// Marcar como borrado lógico
export async function deleteAsientoSoft(id) {
    if (!isFirebaseConfigured) {
        return deleteAsientoFallback(id);
    }
    try {
        const asientoRef = doc(db, "caja_diaria", id);
        await updateDoc(asientoRef, {
            borrado_logico: true
        });
        return true;
    } catch (e) {
        console.warn("Borrado en Fallback...", e);
        return deleteAsientoFallback(id);
    }
}

function deleteAsientoFallback(id) {
    if (id.startsWith('local_')) {
        const localData = getLocalAsientos();
        const index = localData.findIndex(a => a.id === id);
        if (index !== -1) {
            localData[index].borrado_logico = true;
            localStorage.setItem('oqc_asientos_fallback', JSON.stringify(localData));
        }
    }
    return true;
}

// Restaurar un borrado lógico
export async function restoreAsientoSoft(id) {
    if (!isFirebaseConfigured) {
        return restoreAsientoFallback(id);
    }
    try {
        const asientoRef = doc(db, "caja_diaria", id);
        await updateDoc(asientoRef, {
            borrado_logico: false
        });
        return true;
    } catch (e) {
        console.warn("Restaurando en Fallback...", e);
        return restoreAsientoFallback(id);
    }
}

function restoreAsientoFallback(id) {
    if (id.startsWith('local_')) {
        const localData = getLocalAsientos();
        const index = localData.findIndex(a => a.id === id);
        if (index !== -1) {
            localData[index].borrado_logico = false;
            localStorage.setItem('oqc_asientos_fallback', JSON.stringify(localData));
        }
    }
    return true;
}


// Buscar contactos (por nombre simple para la demo, Firestore no tiene LIKE nativo sin index o Algolia. Haremos una busqueda parcial en memoria si son pocos, o en el peor caso los traemos todos en local)
export async function buscarContactos(terminoBusqueda) {
    if (!isFirebaseConfigured) {
        return searchContactosFallback(terminoBusqueda);
    }
    try {
        const querySnapshot = await getDocs(contactosRef);
        const resultados = [];
        const term = terminoBusqueda.toLowerCase();

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const nombre = (data.nombre || "").toLowerCase();
            const cif = (data.cif_nif || "").toLowerCase();

            if (nombre.includes(term) || cif.includes(term)) {
                resultados.push({ id: doc.id, ...data });
            }
        });
        return resultados;
    } catch (e) {
        console.warn("Retornando contactos Local + mock");
        return searchContactosFallback(terminoBusqueda);
    }
}

function searchContactosFallback(terminoBusqueda) {
    const stored = localStorage.getItem('oqc_contactos_fallback');
    const localContactos = stored ? JSON.parse(stored) : [];
    const combined = [...localContactos, ...mockContactos];

    return combined.filter(c => c.nombre.toLowerCase().includes(terminoBusqueda.toLowerCase()) || (c.cif_nif && c.cif_nif.toLowerCase().includes(terminoBusqueda.toLowerCase())));
}

export async function saveContacto(contactoData) {
    if (!isFirebaseConfigured) {
        return saveContactoFallback(contactoData);
    }
    try {
        const docRef = await addDoc(contactosRef, {
            ...contactoData,
            fecha_creacion: serverTimestamp()
        });
        return docRef.id;
    } catch (e) {
        console.warn("Guardando contacto local", e);
        return saveContactoFallback(contactoData);
    }
}

function saveContactoFallback(contactoData) {
    const stored = localStorage.getItem('oqc_contactos_fallback');
    const localContactos = stored ? JSON.parse(stored) : [];
    const newContact = {
        id: 'c_local_' + Date.now(),
        ...contactoData
    };
    localContactos.push(newContact);
    localStorage.setItem('oqc_contactos_fallback', JSON.stringify(localContactos));
    return newContact.id;
}



