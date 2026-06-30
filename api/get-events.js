// api/get-events.js
// Función Serverless para Vercel que actúa como proxy seguro para consultar la API de Gemini 2.0.
// Esto evita la filtración de claves de API en el cliente y sortea los problemas de CORS.

export default async function handler(req, res) {
  // Configurar cabeceras CORS básicas para permitir el acceso cruzado desde el frontend
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-gemini-key'
  );

  // Manejar preflight de CORS (solicitudes de verificación OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Limitar únicamente a peticiones GET
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // Extraer parámetros de búsqueda: date (fecha obligatoria) y parámetros opcionales para sustituir un evento
  const { date, substituteFor, location } = req.query;
  if (!date) {
    res.status(400).json({ error: 'Falta el parámetro de fecha (date).' });
    return;
  }

  // Buscar la API Key de Gemini: primero en variables de entorno del servidor, y de lo contrario en el header del cliente.
  const apiKey = (process.env.GEMINI_API_KEY || req.headers['x-gemini-key'] || '').trim();
  if (!apiKey || apiKey === 'TU_API_KEY_AQUI') {
    res.status(401).json({
      error: 'No se configuró ninguna API Key de Gemini válida.',
      details: 'Por favor, configura la variable de entorno GEMINI_API_KEY en Vercel (o en tu archivo .env local para desarrollo) con una clave válida de Google AI Studio (aistudio.google.com).'
    });
    return;
  }

  // Construir el prompt de Gemini dinámicamente según se solicite una búsqueda normal o una sustitución individual
  let prompt;
  if (substituteFor) {
    // Prompt específico para encontrar un único evento alternativo que sirva como sustituto
    prompt = `Busca en internet un evento alternativo real y activo que ocurra el día ${date} en la Ciudad de México (CDMX) para sustituir al evento "${substituteFor}" (que originalmente se realiza en "${location || 'CDMX'}"). 
El nuevo evento sugerido debe ser de la misma categoría o estar ubicado en una zona cercana, y tener un perfil de interés similar.
Devuelve los resultados obligatoriamente como un arreglo JSON válido con un único objeto de evento (debiendo comenzar con [ y terminar con ]), y absolutamente NADA más (sin explicaciones, sin texto adicional, sin formato markdown). El objeto debe tener los siguientes campos exactos y estructurados:
- id: un string único corto (ej. 'live_alt_' + número aleatorio o correlativo)
- time: string formato de 24 horas 'HH:MM' o la palabra 'Flexible' si no tiene horario específico
- endTime: string formato de 24 horas 'HH:MM' o 'Flexible'
- title: nombre completo del evento alternativo sugerido
- location: nombre del lugar o recinto real
- neighborhood: zona o colonia
- address: dirección física completa en CDMX
- lat: latitud aproximada (número decimal o null)
- lng: longitud aproximada (número decimal o null)
- dateInfo: texto legible de la fecha y hora
- dateType: 'permanent' | 'seasonal' | 'oneoff' | 'weekly'
- inst: tipo de institución organizadora (elige entre: 'IPN' | 'UNAM' | 'Premium' | 'Gobierno' | 'Independiente')
- cost: texto descriptivo del costo
- costVal: valor numérico del costo mínimo (entero o 0)
- booking: información breve de venta de boletos o reservación
- attire: tipo de vestimenta sugerida con emoji
- net: nivel estimado de networking (elige entre: 'Bajo' | 'Medio' | 'Alto')
- cat: categoría principal (elige entre: 'Arte' | 'Música' | 'Cine' | 'Bazar' | 'Ciencia' | 'Social' | 'Gastronomía' | 'Naturaleza')
- petFriendly: boolean (true o false)
- isWildcard: boolean (true si es flexible en día, false si es fijo)
- priority: boolean (true si es muy relevante o un solo día, false en caso contrario)
- link: URL oficial o de boletera (o null)
- desc: descripción amena y detallada del evento de 2 a 3 oraciones en español.

IMPORTANTE: Todos los valores de texto (strings) dentro del JSON deben usar comillas dobles externas. Si dentro del texto necesitas incluir comillas o citar algo, usa comillas simples (') y NUNCA comillas dobles ("), para evitar romper el formato JSON y que sea directamente parseable con JSON.parse.`;
  } else {
    // Prompt de búsqueda estándar: limitado a 15-20 eventos y enfocado en grandes recintos de la CDMX
    prompt = `Busca en internet eventos reales, exposiciones de museos, conciertos, obras de teatro, festivales, mercaditos, bazares, meetups o actividades culturales o sociales que ocurran el día ${date} (año, mes, día específico) en la Ciudad de México (CDMX).
Consulta fuentes populares como "Donde Ir CDMX", "Cartelera de la Ciudad de México", "Ticketmaster México", "Superboletos", "Boletia", "Eventbrite CDMX", etc.
Intenta prioritariamente incluir eventos en grandes recintos y espacios icónicos de la ciudad como: Campo Marte, Palacio de los Deportes, WTC, Auditorio Nacional, Auditorio BlackBerry, Estadio GNP (antes Foro Sol), Estadio CDMX (Azul), Arena CDMX, explanadas de las alcaldías, ferias del libro, Teatro Telcel, Carpa Santa Fe, Zócalo Capitalino, etc.
Debes devolver entre 15 y 20 eventos reales y activos que se lleven a cabo exactamente ese día. Si no hay suficientes eventos específicos para ese día exacto, busca eventos y exposiciones permanentes o de temporada que estén abiertos ese día de la semana.
Devuelve los resultados obligatoriamente como un arreglo JSON válido de objetos, y absolutamente NADA más (sin explicaciones, sin texto adicional, sin formato markdown de triple comilla invertida, solo el JSON puro que comience con [ y termine con ]). Cada objeto debe representar un evento con los siguientes campos exactos y estructurados:
- id: un string único corto (ej. 'live_' + número aleatorio o correlativo)
- time: string formato de 24 horas 'HH:MM' o la palabra 'Flexible' si no tiene horario específico
- endTime: string formato de 24 horas 'HH:MM' o 'Flexible'
- title: nombre completo y atractivo del evento
- location: nombre del lugar o recinto real
- neighborhood: zona o colonia
- address: dirección física completa en CDMX
- lat: latitud aproximada (número decimal o null)
- lng: longitud aproximada (número decimal o null)
- dateInfo: texto legible de la fecha y hora
- dateType: 'permanent' | 'seasonal' | 'oneoff' | 'weekly'
- inst: tipo de institución organizadora (elige entre: 'IPN' | 'UNAM' | 'Premium' | 'Gobierno' | 'Independiente')
- cost: texto descriptivo del costo
- costVal: valor numérico del costo mínimo (entero o 0)
- booking: información breve de venta de boletos o reservación
- attire: tipo de vestimenta sugerida con emoji
- net: nivel estimado de networking (elige entre: 'Bajo' | 'Medio' | 'Alto')
- cat: categoría principal (elige entre: 'Arte' | 'Música' | 'Cine' | 'Bazar' | 'Ciencia' | 'Social' | 'Gastronomía' | 'Naturaleza')
- petFriendly: boolean (true o false)
- isWildcard: boolean (true si es flexible en día, false si es fijo)
- priority: boolean (true si es muy relevante o un solo día, false en caso contrario)
- link: URL oficial o de boletera (o null)
- desc: descripción amena y detallada del evento de 2 a 3 oraciones en español.

IMPORTANTE: Todos los valores de texto (strings) dentro del JSON deben usar comillas dobles externas. Si dentro del texto necesitas incluir comillas o citar algo, usa comillas simples (') y NUNCA comillas dobles ("), para evitar romper el formato JSON y que sea directamente parseable con JSON.parse.`;
  }

  try {
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-lite', 'gemini-1.5-pro'];
    const apiVersions = ['v1beta', 'v1'];
    let lastError = null;
    let data = null;
    const errorsList = [];

    outerLoop:
    for (const model of models) {
      for (const ver of apiVersions) {
        for (const useTools of [true, false]) {
          try {
            console.log(`Intentando consultar modelo: ${model} (${ver}, tools: ${useTools})`);
            const payload = {
              contents: [{ parts: [{ text: prompt }] }]
            };
            if (useTools) {
              payload.tools = [{ google_search: {} }];
            }

            const response = await fetch(
              `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              }
            );

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              const errMsg = errorData?.error?.message || `Error de la API de Gemini: HTTP ${response.status}`;
              lastError = { status: response.status, message: errMsg, details: errorData };
              errorsList.push({ model, ver, useTools, status: response.status, message: errMsg });
              
              console.warn(`Fallo con modelo ${model} (${ver}, tools: ${useTools}). Status: ${response.status}. Mensaje: ${errMsg}`);
              
              if (response.status === 401 || response.status === 403) {
                break outerLoop;
              }
              continue;
            }

            data = await response.json();
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
              lastError = null;
              break outerLoop;
            }
          } catch (fetchErr) {
            console.error(`Error de red al consultar ${model}:`, fetchErr);
            const errMsg = fetchErr.message || String(fetchErr);
            lastError = { status: 500, message: errMsg };
            errorsList.push({ model, ver, useTools, status: 500, message: errMsg });
          }
        }
      }
    }

    if (lastError) {
      let friendlyMessage = lastError.message;
      let friendlyDetails = lastError.details || null;
      
      const hasQuotaError = errorsList.some(e => e.status === 429);
      if (hasQuotaError) {
        res.status(429).json({
          error: "429_BLOCK",
          key: apiKey,
          message: "Límite de cuota excedido (HTTP 429) en el servidor. Ejecutando fallback cliente-side..."
        });
        return;
      }

      res.status(lastError.status || 500).json({
        error: friendlyMessage,
        details: friendlyDetails,
        attempts: errorsList
      });
      return;
    }
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      res.status(500).json({ error: 'La respuesta devuelta por Gemini está vacía.' });
      return;
    }

    text = text.trim();
    
    // Extraer el bloque de JSON (arreglo o un objeto) de forma segura buscando los corchetes
    let cleanedText = text;
    const startIdx = text.indexOf('[');
    const endIdx = text.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleanedText = text.substring(startIdx, endIdx + 1);
    } else {
      // Limpiar bloques de formato de código markdown clásico
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.substring(7, cleanedText.length - 3).trim();
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.substring(3, cleanedText.length - 3).trim();
      }
    }

    // Sanitizar comas sobrantes al final de listas u objetos (trailing commas)
    cleanedText = cleanedText.replace(/,(\s*[\]}])/g, '$1');

    let parsedEvents;
    try {
      parsedEvents = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Error al parsear el JSON de la IA:', cleanedText);
      res.status(500).json({
        error: `No se pudo parsear la respuesta como un JSON válido: ${parseError.message}`,
        raw: cleanedText
      });
      return;
    }

    // Validar que hayamos recibido un arreglo estructurado
    if (!Array.isArray(parsedEvents)) {
      res.status(500).json({ error: 'La respuesta de la IA no es un arreglo de eventos.' });
      return;
    }

    // Retornar los eventos dinámicos al frontend con status 200
    res.status(200).json(parsedEvents);
  } catch (err) {
    console.error('Error procesando la solicitud:', err);
    res.status(500).json({ error: 'Error interno en el servidor.', details: err.message });
  }
}
