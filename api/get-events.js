// api/get-events.js

export default async function handler(req, res) {
  // Configurar cabeceras CORS básicas
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-gemini-key'
  );

  // Manejar preflight de CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { date } = req.query;
  if (!date) {
    res.status(400).json({ error: 'Falta el parámetro de fecha (date).' });
    return;
  }

  // Buscar la API Key: 1. Variable de entorno en el servidor; 2. Cabecera enviada por el cliente.
  const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-key'];
  if (!apiKey) {
    res.status(401).json({
      error: 'No se configuró ninguna API Key de Gemini.',
      details: 'Por favor, configura GEMINI_API_KEY en las variables de entorno de tu proyecto en Vercel, o ingrésala en el panel del frontend.'
    });
    return;
  }

  const prompt = `Busca en internet eventos reales, exposiciones de museos, conciertos, obras de teatro, festivales, mercaditos, bazares, meetups o actividades culturales o sociales que ocurran el día ${date} (año, mes, día específico) en la Ciudad de México (CDMX).
Consulta fuentes populares como "Donde Ir CDMX", "Cartelera de la Ciudad de México", "Ticketmaster México", "Superboletos", "Boletia", "Eventbrite CDMX", etc.
Debes devolver al menos 30 eventos reales y activos que se lleven a cabo exactamente ese día. Si no hay suficientes eventos específicos para ese día exacto, busca eventos y exposiciones permanentes o de temporada que estén abiertos ese día de la semana.
Devuelve los resultados obligatoriamente como un arreglo JSON válido de objetos, y absolutamente NADA más (sin explicaciones, sin texto adicional, sin formato markdown de triple comilla invertida, solo el JSON puro que comience con [ y termine con ]). Cada objeto debe representar un evento con los siguientes campos exactos y estructurados:
- id: un string único corto (ej. 'live_' + número aleatorio o correlativo)
- time: string formato de 24 horas 'HH:MM' (ej. '19:00') o la palabra 'Flexible' si no tiene horario específico
- endTime: string formato de 24 horas 'HH:MM' (ej. '21:30') o 'Flexible'
- title: nombre completo y atractivo del evento
- location: nombre del lugar o recinto real (ej. 'Foro Sol', 'Palacio de Bellas Artes', 'Parque España')
- neighborhood: zona o colonia (ej. 'Roma Norte', 'Centro Histórico', 'Polanco', 'Coyoacán')
- address: dirección física completa en CDMX
- lat: latitud aproximada (número decimal, ej. 19.4326) o null si no se conoce
- lng: longitud aproximada (número decimal, ej. -99.1332) o null si no se conoce
- dateInfo: texto legible del horario y fecha (ej. 'Lunes 8 de Jun · 19:00 hrs')
- dateType: 'permanent' | 'seasonal' | 'oneoff' | 'weekly' (elige el que mejor aplique)
- inst: tipo de institución organizadora (elige entre: 'IPN' | 'UNAM' | 'Premium' | 'Gobierno' | 'Independiente')
- cost: texto descriptivo del costo (ej. 'Gratis' o 'Inversión: $350' o 'Desde $600')
- costVal: valor numérico del costo mínimo (ej. 0 para gratis, o un entero como 350)
- booking: información breve de venta de boletos o reservación (ej. 'Ticketmaster' o 'Entrada libre' o 'Taquilla del recinto')
- attire: tipo de vestimenta sugerida con emoji (ej. '👟 Cómoda' o '🧥 Casual' o '👔 Smart Casual')
- net: nivel estimado de networking y conexiones (elige entre: 'Bajo' | 'Medio' | 'Alto')
- cat: categoría principal (elige entre: 'Arte' | 'Música' | 'Cine' | 'Bazar' | 'Ciencia' | 'Social' | 'Gastronomía' | 'Naturaleza')
- petFriendly: boolean (true o false)
- isWildcard: boolean (true si es una actividad flexible que se puede hacer cualquier día, false si es de horario/fecha fija)
- priority: boolean (true si es un concierto, show o evento de un solo día o de alta relevancia, false en caso contrario)
- link: URL oficial del evento o de la boletera (o null si no hay)
- desc: descripción amena y detallada del evento de 2 a 3 oraciones en español.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      res.status(response.status).json({
        error: errorData?.error?.message || `Error de la API de Gemini: HTTP ${response.status}`,
        details: errorData
      });
      return;
    }

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      res.status(500).json({ error: 'La respuesta devuelta por Gemini está vacía.' });
      return;
    }

    text = text.trim();
    // Eliminar bloques de código markdown si la IA no los omitió a pesar de la instrucción
    if (text.startsWith('```json')) {
      text = text.substring(7, text.length - 3).trim();
    } else if (text.startsWith('```')) {
      text = text.substring(3, text.length - 3).trim();
    }

    let parsedEvents;
    try {
      parsedEvents = JSON.parse(text);
    } catch (parseError) {
      console.error('Error al parsear el JSON de la IA:', text);
      res.status(500).json({
        error: 'No se pudo parsear la respuesta como un JSON válido.',
        raw: text
      });
      return;
    }

    if (!Array.isArray(parsedEvents)) {
      res.status(500).json({ error: 'La respuesta de la IA no es un arreglo de eventos.' });
      return;
    }

    res.status(200).json(parsedEvents);
  } catch (err) {
    console.error('Error procesando la solicitud:', err);
    res.status(500).json({ error: 'Error interno en el servidor.', details: err.message });
  }
}
