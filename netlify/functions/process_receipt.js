const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event, context) => {
    // Definimos headers CORS para Netlify Functions
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };

    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 204, headers, body: "" };
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "La API Key de Gemini no está configurada (GEMINI_API_KEY en el entorno de Netlify)." })
            };
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const body = JSON.parse(event.body || "{}");
        if (!body || !body.image) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "No se recibió ninguna imagen en formato base64." })
            };
        }

        let base64Image = body.image;
        if (base64Image.includes(",")) {
            base64Image = base64Image.split(",")[1];
        }

        const prompt = `Eres un asistente experto en contabilidad. Analiza esta imagen que es un recibo o ticket de compra.
Extrae la siguiente información y devuélvela ÚNICAMENTE como un objeto JSON válido (sin formato Markdown adicional, ni \`\`\`json, solo las llaves {}):

{
    "fecha": "YYYY-MM-DD", (si no existe, null)
    "proveedor": "Nombre del negocio o empresa", (si no existe, null)
    "cif_nif": "CIF o NIF", (si no existe, null)
    "base_imponible": 0.00, (si no existe, calcularla o poner null)
    "porcentaje_iva": 0, (asumir 21 si no está claro pero hay impuestos, si no null)
    "total": 0.00 (el total final a pagar)
}

Si alguno no se encuentra, pon \`null\`. Si el total existe pero no hay base/iva desglosados, intenta deducir la base imponible asumiendo el 21% de IVA (Total / 1.21).`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Image,
                    mimeType: "image/jpeg"
                }
            }
        ]);

        let responseText = result.response.text().trim();

        // Limpiar cualquier envoltura markdown
        if (responseText.startsWith("```json")) {
            responseText = responseText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (responseText.startsWith("```")) {
            responseText = responseText.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }

        const parsedJson = JSON.parse(responseText);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(parsedJson)
        };
    } catch (error) {
        console.error("Error procesando OCR en Serveless Function:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || "Error interno del servidor en Netlify." })
        };
    }
};
