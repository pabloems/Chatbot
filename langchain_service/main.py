from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain.memory import ConversationBufferMemory
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
import os
import google.generativeai as genai
app = FastAPI()
class Message(BaseModel):
    content: str
class ChatRequest(BaseModel):
    messages: List[Message]

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

SYSTEM_TEMPLATE = """Eres un asistente de IA experto y servicial. Tu objetivo es proporcionar respuestas claras, 
precisas y útiles a las preguntas del usuario. Basas tus respuestas en hechos y conocimientos verificables enfocadas en usuarios Chilenos.

Contexto de la conversación:
{chat_history}
"""

llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.2,
    convert_system_message_to_human=True,
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