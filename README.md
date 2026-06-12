# 🦅 Agenda Cultural CDMX · Edición Politécnica

Una aplicación web interactiva y premium para planificar tus días en la Ciudad de México con eventos culturales, exposiciones, conciertos, meetups y más. La aplicación busca actividades en tiempo real en internet mediante Inteligencia Artificial y mantiene una experiencia fluida a través de un sistema de sincronización y caché inteligente.

---

## 🚀 Características Principales

*   **Búsqueda en Vivo con IA (Gemini + Google Search):** Olvídate de agendas estáticas obsoletas. La aplicación busca en tiempo real en internet (Google, blogs culturales, carteleras populares como *Dónde Ir*, *Ticketmaster*, *Superboletos*) conciertos, obras de teatro y exposiciones para la fecha seleccionada.
*   **Sistema de Caché de Dos Niveles:**
    *   **Caché Local (localStorage):** Guarda las búsquedas de cada fecha en tu navegador. Si vuelves a consultar la misma fecha, cargará instantáneamente.
    *   **Caché en la Nube (Firestore):** Si activas la sincronización con Firebase, las búsquedas realizadas por cualquier usuario se almacenan globalmente por fecha, optimizando la velocidad de carga global y reduciendo el consumo de la API de Gemini.
*   **Planificador de Día Personalizable:** Agrega eventos a tu itinerario diario, calcula costos automáticamente, consulta accesibilidad de mascotas (*Pet-Friendly*) y exporta tu plan a un archivo universal `.ics` (para Google Calendar, Apple Calendar o Outlook).
*   **Sugerencias con IA:** Genera itinerarios y recomendaciones personalizadas según las cercanías de tus eventos mediante Gemini.
*   **Sincronización en la Nube Compartida:** Sincroniza tus favoritos y tus planes de día entre múltiples dispositivos (móvil, tablet, computadora) usando un ID único de usuario y Firebase.

---

## 🛠️ Para el Desarrollador: Cómo funciona la App

La aplicación está diseñada como una single-page application (SPA) ligera con un backend opcional Serverless.

### Arquitectura de Búsqueda Dinámica
1.  Al cargar una fecha, la app verifica si hay eventos guardados en la caché local (`localStorage`) o en la nube (`Firestore`).
2.  Si no hay registros en caché, inicia una petición:
    *   **En Producción (Vercel):** Llama a `/api/get-events?date=YYYY-MM-DD`. Esta función Serverless (Node.js) realiza la petición a Gemini utilizando la clave del servidor (`process.env.GEMINI_API_KEY`) y devuelve un JSON estructurado. Esto **evita errores de CORS** y **no expone tu API key** al usuario final.
    *   **En Local (Fallback):** Si la función de servidor no responde o estás abriendo el HTML directamente, la app intenta realizar una llamada directa desde el navegador a la API de Google, utilizando la API key ingresada por el usuario en el header.
3.  La API de Gemini utiliza **Google Search Grounding** para buscar en la web, procesa las carteleras de la CDMX de ese día exacto, estructura los datos geográficos (coordenadas aproximadas para Google Maps y Waze) y devuelve un arreglo JSON estandarizado.

---

## 🔑 Configuración y Despliegue

### 1. Clave de API de Gemini (AI Studio)
La app necesita una clave de API de Gemini para la búsqueda en vivo y sugerencias. Puedes obtener una **completamente gratis** en [Google AI Studio](https://aistudio.google.com/).

#### Configuración en Producción (Vercel)
Para desplegar la aplicación y que funcione automáticamente para todos los usuarios sin pedirles una API key:
1.  Despliega el proyecto en Vercel (la estructura incluye el archivo `vercel.json` y la carpeta `api/` para configurar la función Node.js).
2.  En el panel de tu proyecto en Vercel, ve a **Settings ⚙️ -> Environment Variables**.
3.  Añade una nueva variable con el nombre **`GEMINI_API_KEY`** y coloca tu clave de API de Gemini (ej. `AIzaSy...`).
4.  ¡Listo! La cartelera en vivo buscará eventos reales automáticamente al entrar al sitio.

#### Configuración en Desarrollo Local
Si estás probando la app de forma local (abriendo el archivo `index.html` en tu navegador o mediante un servidor estático simple):
1.  Obtén tu API key en Google AI Studio.
2.  Pega tu clave en el campo **🔑 Gemini API Key** ubicado en la esquina superior derecha del encabezado de la app.
3.  La clave se guardará de forma segura en el almacenamiento local de tu navegador (`localStorage`) para que no tengas que escribirla cada vez.

---

### 2. Sincronización en la Nube con Firebase (Opcional)
Para habilitar el guardado de itinerarios y favoritos en la nube y sincronizar dispositivos, puedes configurar un proyecto gratuito de Firestore:
1.  Ve a [Firebase Console](https://console.firebase.google.com/) y crea un nuevo proyecto.
2.  En el menú lateral, ve a **Build -> Firestore Database** y haz clic en **Create Database** (selecciona *Start in test mode* para comenzar).
3.  En la configuración de tu proyecto (icono de engranaje ⚙️ -> Project Settings), en la pestaña *General*, baja hasta "Your apps" y añade una aplicación web (`</>`).
4.  Copia el objeto `firebaseConfig` que te entrega Firebase:
    ```javascript
    const firebaseConfig = {
      apiKey: "TU_API_KEY_AQUI",
      authDomain: "TU_PROYECTO.firebaseapp.com",
      projectId: "TU_PROYECTO_ID",
      ...
    };
    ```
5.  Abre `index.html` y reemplaza el objeto `FIREBASE_CONFIG` ubicado cerca de la línea 21 en la etiqueta `<script type="module">`.
6.  Sube los cambios a Vercel o recarga tu archivo local. Ahora aparecerá una nube verde (`☁️ Nube activa`) indicando que tus datos se respaldan en tiempo real.

---

## 📱 Guía para el Usuario Final

1.  **Selecciona una fecha:** Usa el selector del encabezado. La app buscará en segundos todos los eventos ocurriendo ese día.
2.  **Filtra tu búsqueda:** Puedes usar los *chips* de categorías en el encabezado para ver solo eventos gratis, eventos del IPN, del sector premium (Fever), aptos para mascotas o en zonas específicas como el Sur de la ciudad.
3.  **Arma tu día:**
    *   Presiona **➕ Al Plan** en las tarjetas de eventos para añadirlos a tu itinerario.
    *   Verás un resumen con el total de eventos, la inversión total aproximada y la cantidad de actividades amigables con mascotas en tu panel de plan de día.
4.  **Descarga tu itinerario:** Presiona **Descargar plan (.ics)** para guardar el archivo y agregarlo a tus calendarios de Google, Apple o Outlook con direcciones y horarios correctos.
5.  **Obtén recomendaciones de la IA:** Si tienes eventos en tu plan, presiona **Sugerir con IA** para recibir recomendaciones personalizadas de restaurantes, cafés y logística para complementar tu día.
