/**
 * Esta es una Cloud Function que actúa como un proxy seguro.
 * Resuelve el problema de CORS al hacer que las llamadas a la API de Google
 * se realicen desde un servidor, en lugar de directamente desde el navegador.
 *
 * Cómo funciona:
 * 1. Tu aplicación (app.js) envía la petición a esta función.
 * 2. Esta función recibe la petición y la reenvía a la API de Google.
 * 3. La API de Google responde a esta función.
 * 4. Esta función devuelve la respuesta de Google a tu aplicación.
 */

export default async function handler(request, response) {
  // Obtener la clave de API de una variable de entorno segura.
  // NUNCA la escribas directamente en el código.
  const API_KEY = process.env.GEMINI_API_KEY;

  // Determinar a qué API de Google llamar basándose en el cuerpo de la petición.
  const isTextRequest = request.body.contents && request.body.systemInstruction;
  const isTtsRequest = request.body.input && request.body.voice;

  let targetUrl;
  if (isTextRequest) {
    targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;
  } else if (isTtsRequest) {
    targetUrl = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${API_KEY}`;
  } else {
    return response.status(400).json({ error: 'Cuerpo de la petición inválido.' });
  }

  try {
    const apiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      // Devolver el mismo error que dio la API de Google.
      return response.status(apiResponse.status).send(errorText);
    }

    const data = await apiResponse.json();
    return response.status(200).json(data);
  } catch (error) {
    return response.status(500).json({ error: 'Error interno en el servidor proxy.' });
  }
}