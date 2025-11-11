export default async function handler(req, res) {
 
  const API_KEY = process.env.GEMINI_API_KEY;


  if (!API_KEY) {
    return res.status(500).json({ error: 'La variable de entorno GEMINI_API_KEY no está configurada en Vercel.' });
  }


  const isTextRequest = req.body.contents && req.body.systemInstruction;
  const isTtsRequest = req.body.input && req.body.voice;

  let targetUrl;
  if (isTextRequest) {
    targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;
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
   
      return res.status(apiResponse.status).send(errorText);
    }

    const data = await apiResponse.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Error interno en el servidor proxy.' });
  }
}

