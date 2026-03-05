// src/contactos.js
import { buscarContactos, saveContacto } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('contactsModal');
    const searchInput = document.getElementById('searchContact');
    const contactsList = document.getElementById('contactsList');

    // Auto-fill target elements in app.js
    const proveedorInput = document.getElementById('proveedor');
    const cifNifInput = document.getElementById('cifNif');
    // Mantenemos el ID de contacto internamente (opcional)
    let selectedContactId = null;

    // Render list helper
    function renderContactList(contactos) {
        contactsList.innerHTML = '';
        if (contactos.length === 0) {
            contactsList.innerHTML = '<p style="text-align:center;color:var(--text-muted);">No se encontraron contactos</p>';
            return;
        }

        contactos.forEach(c => {
            const div = document.createElement('div');
            div.style.padding = '0.75rem';
            div.style.borderBottom = '1px solid var(--border-color)';
            div.style.cursor = 'pointer';

            div.innerHTML = `
                <div style="font-weight:bold; color:var(--primary-blue);">${c.nombre}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">CIF: ${c.cif_nif || 'N/A'} | Tel: ${c.telefono || 'N/A'}</div>
            `;

            div.addEventListener('click', () => {
                proveedorInput.value = c.nombre;
                cifNifInput.value = c.cif_nif || "";
                selectedContactId = c.id;
                modal.style.display = 'none';
            });
            div.addEventListener('mouseover', () => div.style.backgroundColor = 'var(--bg-light)');
            div.addEventListener('mouseout', () => div.style.backgroundColor = 'transparent');

            contactsList.appendChild(div);
        });
    }

    // Buscador en tiempo real con debounce
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const term = e.target.value.trim();

        debounceTimer = setTimeout(async () => {
            contactsList.innerHTML = '<p style="text-align:center;">Buscando...</p>';
            const results = await buscarContactos(term);
            renderContactList(results);
        }, 400); // 400ms debounce
    });

    // Nuevo contacto form
    const contactForm = document.getElementById('contactForm');

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnGuardar = contactForm.querySelector('.btn-guardar');
        btnGuardar.disabled = true;
        btnGuardar.textContent = "Guardando...";

        const newContact = {
            nombre: document.getElementById('newContactName').value,
            cif_nif: document.getElementById('newContactCif').value,
            telefono: document.getElementById('newContactTel').value,
        };

        try {
            const newId = await saveContacto(newContact);
            alert("Contacto guardado y seleccionado");

            // Auto seleccionar el creado
            proveedorInput.value = newContact.nombre;
            cifNifInput.value = newContact.cif_nif;
            selectedContactId = newId;

            contactForm.reset();
            modal.style.display = 'none';
        } catch (error) {
            alert("Error al guardar contacto (¿Configuraste Firebase?)");
        } finally {
            btnGuardar.disabled = false;
            btnGuardar.textContent = "Guardar Contacto";
        }
    });

    // Auto load on open
    const btnOpenContacts = document.getElementById('btnOpenContacts');
    btnOpenContacts.addEventListener('click', async () => {
        searchInput.value = '';
        contactsList.innerHTML = '<p style="text-align:center;">Cargando...</p>';
        const results = await buscarContactos("");
        renderContactList(results);
    });
});
