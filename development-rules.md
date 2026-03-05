# Reglas de Desarrollo: "Ojú qué Calor - Caja Diaria"

## 1. Principios de Código Limpio y Buenas Prácticas
- **Naming:** Variables y funciones en español técnico claro. Nombres descriptivos: `obtenerGastoPorId()`.
- **DRY (Don't Repeat Yourself):** Abstraer lógica repetida en utilidades o componentes.
- **KISS (Keep It Simple, Stupid):** Funciones atómicas que realicen una sola tarea.
- **Comentarios:** Código autodocumentado. Comentar el "por qué", no el "cómo".

## 2. Arquitectura en Capas (Separación de Responsabilidades)

### A. Diseño Web Responsivo (Mobile-First)
- **Adaptabilidad Total:** El diseño debe ser fluido y adaptarse automáticamente a diferentes tamaños de pantalla y orientaciones (Portrait/Landscape).
- **Breakpoint de Referencia:** Optimización crítica para iPhone SE 2022 (375px de ancho), pero escalable a tablets y desktop.
- **Unidades Relativas:** Priorizar el uso de `rem`, `em`, `vh/vw` y porcentajes sobre píxeles fijos.
- **Flexbox y Grid:** Utilizar Layouts modernos para evitar desbordamientos y asegurar que los elementos se reordenen según el espacio.
- **Touch-Friendly:** Elementos interactivos (botones, inputs) con un tamaño mínimo de 44x44px para facilitar el uso táctil.
- **Imágenes y Media:** Uso de `max-width: 100%` y formatos modernos (WebP) para asegurar carga rápida y ajuste visual.

### B. Capa de Frontend (UI/UX)
- Solo gestiona presentación y captura. Los componentes deben ser "tontos" (presentacionales).
- Prohibido incluir lógica de cálculo de impuestos en el cliente.

### C. Capa de Backend / API
- Punto de unión entre Front y Data (Netlify Functions en Python/JS).
- Orquestación de la API de Gemini para el OCR.

### D. Capa de Datos (Persistencia)
- Modelos bien definidos en Firebase Firestore.
- No se permiten estados locales que no estén sincronizados con la persistencia.

## 3. Lógica en el Lado Servidor (Políticas y Reglas)
- **Triggers:** Usar Cloud Functions para auditorías y limpieza de datos.
- **Views / Store Procedures:** Definir las consultas de cierre trimestral en el servidor. El Front solo consume el resultado.
- **Security Rules:** Políticas de "mínimo privilegio" en el acceso a colecciones.

## 4. Gestión de Datos y Modelado
- **Integridad:** Siempre usar IDs de la tabla `contactos` en `caja_diaria`.
- **Borrado Lógico:** Uso estricto de flag `borrado_logico`. No realizar `DELETE` físicos.
- **Modelos en Capas:** Abstracción total entre el dato crudo de la DB y el objeto que consume la interfaz.

## 5. Protocolo de OCR y Automatización
- Proceso atómico: Captura -> Procesamiento Servidor -> JSON -> Validación Usuario -> Persistencia.

## 6. Reglas para el Agente IA (Antigravity/Cursor)
1. **Analizar antes de codificar:** Revisar siempre el modelo de datos en `ers.md`.
2. **Priorizar el Servidor:** Validaciones y cálculos complejos siempre en el lado servidor.
3. **Consistencia Visual:** Mantener la adaptabilidad responsiva en cada nuevo componente generado.