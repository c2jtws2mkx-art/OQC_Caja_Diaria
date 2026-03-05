# ERS: WebApp "Ojú qué Calor - Caja Diaria"

## 1. Descripción del Proyecto
Desarrollo de una Aplicación Web Progresiva (PWA) de uso personal para la gestión contable (Ingresos/Gastos) del negocio de fontanería, climatización y servicios técnicos de Quique en Jerez de la Frontera. El sistema permite la digitalización de facturas mediante OCR y el almacenamiento centralizado en la nube.

## 2. Arquitectura y Stack Tecnológico
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla o Framework ligero) alojado en **Netlify (Antigravity)**.
- **Backend (Serverless):** Netlify Functions (Python) para procesamiento de API Gemini.
- **Base de Datos:** **Firebase Firestore** (NoSQL) para registros y contactos.
- **Almacenamiento:** **Firebase Storage** para copias digitales de facturas/tickets.
- **Inteligencia Artificial:** **Gemini 3 Pro (Vision)** para extracción de datos (OCR).

## 3. Modelo de Datos (Firestore)

### Colección: `caja_diaria`
- `id`: Autogenerado (String).
- `fecha_creacion`: Timestamp (automático).
- `fecha_factura`: Date (extraído/manual).
- `tipo`: String ("Ingreso" | "Gasto").
- `contacto_id`: DocumentReference (hacia colección `contactos`).
- `cif_dni`: String (del contacto seleccionado).
- `categoria`: String (Desplegable: Fontanería, Clima, ACS, Electricidad, Redes, etc.).
- `detalle`: String (Largo).
- `base_imponible`: Number.
- `iva_porcentaje`: Number (0, 4, 10, 21).
- `monto_iva`: Number.
- `otros_cargos`: Number (Retenciones o conceptos sin IVA).
- `total`: Number.
- `foto_url`: String (enlace a Firebase Storage).
- `borrado_logico`: Boolean (Default: false).

### Colección: `contactos`
- `nombre`: String.
- `cif_nif`: String.
- `telefono`: String.
- `domicilio`: String.
- `notas`: String.

## 4. Requisitos Funcionales (RF)

### RF01 - Captura Híbrida y OCR
El sistema debe permitir usar la cámara del iPhone SE 2022 o subir archivos de la fototeca.
- La imagen se envía a Gemini Pro.
- La IA debe devolver un JSON con: Fecha, Proveedor, CIF, Base, IVA y Total.
- Los campos del formulario se pre-rellenan automáticamente.

### RF02 - Lógica de Impuestos Bidireccional
El formulario debe permitir:
- Cálculo **Hacia adelante**: Base + % IVA -> Total.
- Cálculo **Hacia atrás**: Total / % IVA -> Base e IVA.
- Soporte para IVA: 0%, 4%, 10%, 21% y campo "Otros" para retenciones.

### RF03 - Gestión de Contactos (Popup)
- Selector de contactos con búsqueda en tiempo real.
- Botón para abrir modal (ventana emergente) con ABM completo (Alta, Baja, Modificación) de contactos.
- Optimizado para pantalla pequeña (iPhone SE).

### RF04 - Pantalla de Inicio (Dash)
- Formulario de alta rápida en la parte superior.
- Listado inferior de registros del **mes en curso**.
- Exclusión de registros con `borrado_logico: true`.

### RF05 - Consulta Fiscal Trimestral
- Segunda pantalla con agrupación por trimestres fiscales.
- Filtros avanzados por todos los campos del modelo.
- Sumatorios automáticos por categorías y tipo.

## 5. Requisitos No Funcionales (RNF)
- **RNF01 - Mobile First:** Optimización obligatoria para iPhone SE 2022 (375px ancho).
- **RNF02 - Persistencia:** Las imágenes deben subirse a Firebase Storage antes de guardar el registro en Firestore.
- **RNF03 - Seguridad:** Acceso restringido a usuario administrador único (sin login multiusuario).
- **RNF04 - Rendimiento:** El procesamiento OCR no debe bloquear la interfaz (uso de loaders).

## 6. Flujo de Trabajo (Workflow)
1. Usuario abre la App -> Pantalla Inicio.
2. Captura de foto -> API Gemini -> Relleno automático.
3. Selección de contacto (o alta en popup) -> Guardar.
4. Imagen se aloja en Firebase Storage -> Registro se guarda en Firestore.
5. Lista del mes se actualiza automáticamente.