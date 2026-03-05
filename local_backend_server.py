import sys
import os

# Add local python backend to path
sys.path.append(os.path.abspath("local_python_backend"))

from process_receipt import app as process_receipt_app
from flask_cors import CORS

# Activar CORS para todas las rutas por defecto durante dev
CORS(process_receipt_app)

if __name__ == '__main__':
    print("="*60)
    print("Iniciando Servidor Flask Backend (Puerto 5000)")
    print("Por favor, asegúrate de mantener corriendo tu servidor HTTP de frontend")
    print("en el puerto 3000. El frontend enviará el OCR a este puerto.")
    print("Asegúrate de que la variable de entorno GEMINI_API_KEY esté configurada!")
    print("="*60)
    
    # Run the flask app that handles /.netlify/functions/process_receipt
    process_receipt_app.run(port=5000, debug=True)
