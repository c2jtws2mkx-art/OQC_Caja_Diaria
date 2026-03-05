import base64
import json
import os
import google.generativeai as genai
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configurar API Key. En Netlify, esto viene de las Environment Variables
api_key = os.environ.get("GEMINI_API_KEY")

if api_key:
    genai.configure(api_key=api_key)

# Inicializar modelo
try:
    model = genai.GenerativeModel('gemini-2.5-flash')
except Exception as e:
    model = None
    print(f"Error al inicializar el modelo Gemini: {e}")

@app.route("/.netlify/functions/process_receipt", methods=["POST", "OPTIONS"])
def process_receipt():
    # CORS Headers
    if request.method == "OPTIONS":
        return "", 204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        }

    cors_headers = {"Access-Control-Allow-Origin": "*"}

    if not api_key:
        return jsonify({"error": "La API Key de Gemini no está configurada en el servidor (GEMINI_API_KEY)."}), 500, cors_headers

    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({"error": "No se recibió ninguna imagen en formato base64."}), 400, cors_headers

        base64_image = data['image']
        
        # Opcional: limpiar prefix de base64 si el de frontend lo envía (data:image/jpeg;base64,...)
        if "," in base64_image:
            base64_image = base64_image.split(",")[1]

        image_data = {
            "mime_type": "image/jpeg",
            "data": base64_image
        }

        prompt = """
        Eres un asistente experto en contabilidad. Analiza esta imagen que es un recibo o ticket de compra.
        Extrae la siguiente información y devuélvela ÚNICAMENTE como un objeto JSON válido (sin formato Markdown adicional, ni ```json, solo las llaves {}):

        {
            "fecha": "YYYY-MM-DD", (si no existe, null)
            "proveedor": "Nombre del negocio o empresa", (si no existe, null)
            "cif_nif": "CIF o NIF", (si no existe, null)
            "base_imponible": 0.00, (si no existe, calcularla o poner null)
            "porcentaje_iva": 0, (asumir 21 si no está claro pero hay impuestos, si no null)
            "total": 0.00 (el total final a pagar)
        }
        
        Si alguno no se encuentra, pon `null`. Si el total existe pero no hay base/iva desglosados, intenta deducir la base imponible asumiendo el 21% de IVA (Total / 1.21).
        """

        response = model.generate_content([prompt, image_data])
        response_text = response.text.strip()

        # Limpiar posibles bloques Markdown que devuelva Gemini a pesar de pedirle que no
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        parsed_json = json.loads(response_text)

        return jsonify(parsed_json), 200, cors_headers

    except Exception as e:
        print(f"Error procesando OCR: {e}")
        return jsonify({"error": str(e)}), 500, cors_headers
