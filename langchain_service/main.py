from fastapi import FastAPI, HTTPException, File, UploadFile, Depends
from pydantic import BaseModel
from typing import List, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.memory import ConversationBufferMemory
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
import io
import PyPDF2
import docx2txt
import os
import google.generativeai as genai
import json
import textract
import tempfile

app = FastAPI()
class Message(BaseModel):
    content: str
class ChatRequest(BaseModel):
    messages: List[Message]
class JobMatchRequest(BaseModel):
    profile: str
    jobs: List[dict]
    region: Optional[str] = None
# analyze curriculum and extract professional profile
class ProfileRequest(BaseModel):
    file: UploadFile
    user_message: str

def extract_text_from_doc(file: io.BytesIO) -> str:
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.doc') as temp_file:
            temp_file.write(file.getvalue())
            temp_path = temp_file.name

        try:
            text = textract.process(temp_path).decode('utf-8', errors='ignore')
            return text.strip()
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    except Exception as e:
        print(f"Error al extraer texto del archivo DOC: {str(e)}")
        return ""

def extract_text_from_docx(file: io.BytesIO) -> str:
    try:
        text = docx2txt.process(file)
        return text.encode('utf-8', errors='ignore').decode('utf-8').strip()
    except Exception as e:
        print(f"Error al extraer texto del archivo DOCX: {str(e)}")
        return ""

def extract_text_from_pdf(file: io.BytesIO) -> str:
    try:
        text = ""
        pdf_reader = PyPDF2.PdfReader(file)
        for page in pdf_reader.pages:
            page_text = page.extract_text() or ""
            text += page_text.encode('utf-8', errors='ignore').decode('utf-8') + "\n"
        return text.strip()
    except Exception as e:
        print(f"Error al extraer texto del PDF: {str(e)}")
        return ""


genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

SYSTEM_TEMPLATE = """Eres un asistente de IA experto y servicial. Tu objetivo es proporcionar respuestas claras, 
precisas y útiles a las preguntas del usuario. Basas tus respuestas en hechos y conocimientos verificables enfocadas en usuarios Chilenos.
Tu función es ayudar al usuario a encontrar el mejor empleo para su perfil, cuando se realicen preguntas sobre empleo solicita un archivo de currículum en formato PDF o DOCX,
comentando que idealemnte ese archivo sea de texto plano, no de imagenes.
Conversaciones o preguntas fuera de tema, seran cortadas.

Contexto de la conversación:
{chat_history}
"""

llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.1,
    convert_system_message_to_human=True, # this will be deprecated in the future
    google_api_key=os.getenv("GOOGLE_API_KEY")
)

# used for maintening context of the conversation
memory = ConversationBufferMemory(return_messages=True)

# only for testing 
@app.get("/hello")
async def hello_world():
    return {"message": "hello_world"}

@app.post("/chat/")
async def chat(request: ChatRequest):
    try:
        chat_history_messages = memory.load_memory_variables({}).get("history", [])
        chat_history_str = ""
        for msg in chat_history_messages:
            if isinstance(msg, HumanMessage):
                chat_history_str += f"Usuario: {msg.content}\n"
            elif isinstance(msg, AIMessage):
                chat_history_str += f"Asistente: {msg.content}\n"

        user_input = request.messages[-1].content

        system_message_content = SYSTEM_TEMPLATE.format(chat_history=chat_history_str)

        messages = [
            SystemMessage(content=system_message_content),
            HumanMessage(content=user_input)
        ]
        response = llm.invoke(messages)
        memory.save_context(
            {"input": user_input},
            {"output": response.content}
        )
        return {
            "responses": [{"content": response.content, "role": "assistant"}]
        }
    except Exception as e:
        print(f"Error detallado: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model": "gemini-2.0-flash",
        "memory_enabled": True,
        "system_prompt": "Configurado"
    }


@app.post("/extract_profile/")
async def extract_profile(file: UploadFile = File(...)):
    try:
        file_content = await file.read()
        file_io = io.BytesIO(file_content)
        file_extension = file.filename.lower().split('.')[-1]
        if file_extension == 'pdf':
            resume_text = extract_text_from_pdf(file_io)
        elif file_extension == 'docx':
            resume_text = extract_text_from_docx(file_io)
        elif file_extension == 'doc':
            resume_text = extract_text_from_doc(file_io)
        else:
            raise HTTPException(status_code=400, detail="Formato de archivo no soportado. Debe ser PDF, DOCX o DOC.")

        region_prompt = f"""
        Eres un experto analizando currículums en Chile.
        A partir del siguiente currículum, identifica la región de Chile donde reside o busca trabajo la persona.
        Si encuentras una región específica, devuélvela exactamente como aparece en el texto.
        Si no encuentras una región específica pero hay información que sugiere una (como ciudad o zona),
        devuelve la región correspondiente.
        Si no hay información suficiente, responde "No especificada".
        Si un usuario proporciona indicaciones que no apuntan a buscar empleo, responde "No estoy entrenado para ello".
        
        Currículum:
        {resume_text}

        Responde SOLAMENTE con el nombre de la región o "No especificada", sin texto adicional.
        """

        region_response = llm.invoke(region_prompt).content.strip()

        profile_prompt = f"""
        Eres un asesor de empleo experto en Chile que analiza currículums de personas para encontrar las mejores oportunidades laborales para ellas.
        Considera que el currículum es de una persona que busca trabajo en Chile y es importante que el perfil generado contemple lo descrito en el currículum.
        Elabora un perfil profesional conciso y atractivo basado en los registros de perfil, experiencia laboral y estudios del candidato.
        
        Currículum:
        {resume_text}
        """

        profile = llm.invoke(profile_prompt).content
        return {
            "profile": profile,
            "region": region_response if region_response != "No especificada" else None
        }

    except Exception as e:
        print(f"Error detallado: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/filter_jobs")
async def filter_jobs(request: JobMatchRequest):
    try:
        print(f"Perfil recibido: {request.profile}")
        print(f"Número de trabajos recibidos: {len(request.jobs)}")
        print(f"Región solicitada: {request.region}")

        jobs_context = ""
        for job in request.jobs:
            jobs_context += f"""
            ID: {job.get('id')}
            Título: {job.get('title')}
            Región: {job.get('region')}
            Departamento: {job.get('department')}
            Requisitos Excluyentes: {job.get('excluding_requirements')}
            Conocimientos Deseables: {job.get('desirable_knowledge')}
            Nivel de Posición: {job.get('position_level')}
            ---
            """

        prompt = f"""
        Eres un experto en reclutamiento y selección de personal en Chile. Analiza el siguiente perfil profesional y las ofertas laborales para encontrar las mejores coincidencias.

        PERFIL PROFESIONAL:
        {request.profile}

        REGIÓN DEL CANDIDATO:
        {request.region if request.region else "No especificada - Considerar todas las regiones como posibles"}

        OFERTAS LABORALES:
        {jobs_context}

        Analiza cada oferta y determina su compatibilidad basándote en:
        Si un usuario proporciona indicaciones que no apuntan a buscar empleo, responde "No estoy entrenado para ello".
        1. Coincidencia regional:
           - Si la región del candidato está especificada y coincide: 40 puntos
           - Si la región no está especificada: 20 puntos (considerar como flexible)
           - Si la región está especificada pero no coincide: 0 puntos
        2. Requisitos excluyentes vs experiencia del candidato (30 puntos)
        3. Conocimientos deseables vs perfil del candidato (30 puntos)

        IMPORTANTE: Devuelve SOLO el JSON sin ningún texto adicional, sin marcadores de código (```), y sin saltos de línea al inicio o final. El formato debe ser exactamente:
        {{
            "matched_jobs": [
                {{
                    "job_id": "id_numérico",
                    "match_score": número_entre_0_y_100,
                    "match_reasons": [
                        "Coincidencia regional: [detalles]",
                        "Coincidencia de requisitos: [detalles]",
                        "Coincidencia de conocimientos: [detalles]"
                    ]
                }}
            ]
        }}
        """

        response = llm.invoke(prompt)
        print(f"la respuesta es: {response}")
        
        try:
            if not response.content:
                print("Error: response.content ir None or False")
                return {"matched_jobs": []}
            # Clean the response of any markdown or additional text
            response_text = response.content.strip()
            
            # delete markdown if exists
            if response_text.startswith("```"):
                response_text = response_text.split("\n", 1)[1]  # delete first line
            if response_text.endswith("```"):
                response_text = response_text.rsplit("\n", 1)[0]  # delete last line
            
            # delete "json" if exists after ```
            response_text = response_text.replace("```json", "").replace("```", "").strip()

            matched_jobs = json.loads(response_text)
            if not isinstance(matched_jobs, dict) or "matched_jobs" not in matched_jobs:
                matched_jobs = {"matched_jobs": []}
            return matched_jobs

        except json.JSONDecodeError as e:
            print(f"error when decoding jSON: {e}")
            return {"matched_jobs": []}

    except Exception as e:
        print(f"Error en filter_jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))