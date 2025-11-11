  // NUNCA la escribas directamente en el código.
  const API_KEY = process.env.GEMINI_API_KEY;

  // **MEJORA**: Verificar si la clave de API existe. Si no, devolver un error claro.
  if (!API_KEY) {
    return response.status(500).json({ error: 'La variable de entorno GEMINI_API_KEY no está configurada en Vercel.' });
  }

  // Determinar a qué API de Google llamar basándose en el cuerpo de la petición.
  const isTextRequest = request.body.contents && request.body.systemInstruction;
  const isTtsRequest = request.body.input && request.body.voice;

