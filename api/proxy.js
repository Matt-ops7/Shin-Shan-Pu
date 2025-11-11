 * 4. Esta función devuelve la respuesta de Google a tu aplicación.
 */

export default async function handler(req, res) {
  // Obtener la clave de API de una variable de entorno segura.
  // NUNCA la escribas directamente en el código.
  const API_KEY = process.env.GEMINI_API_KEY;

  // **MEJORA**: Verificar si la clave de API existe. Si no, devolver un error claro.
  if (!API_KEY) {
    return res.status(500).json({ error: 'La variable de entorno GEMINI_API_KEY no está configurada en Vercel.' });
  }

  // Determinar a qué API de Google llamar basándose en el cuerpo de la petición.
  const isTextRequest = req.body.contents && req.body.systemInstruction;
  const isTtsRequest = req.body.input && req.body.voice;

  let targetUrl;
  if (isTextRequest) {
  } else if (isTtsRequest) {
    targetUrl = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${API_KEY}`;
  } else {
    return res.status(400).json({ error: 'Cuerpo de la petición inválido.' });
  }

  try {
    const apiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      // Devolver el mismo error que dio la API de Google.
      return res.status(apiResponse.status).send(errorText);
    }

    const data = await apiResponse.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Error interno en el servidor proxy.' });
  }
}
