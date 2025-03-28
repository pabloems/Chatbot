import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["interface", "messages", "input"]
  connect() {
    if (!this.hasMessagesTarget) {
      const messagesContainer = document.createElement('div')
      messagesContainer.setAttribute('data-chat-agent-target', 'messages')
      messagesContainer.className = 'flex-1 overflow-y-auto p-4 flex flex-col space-y-2'
      this.interfaceTarget.insertBefore(messagesContainer, this.interfaceTarget.lastElementChild)
    }
    this.addMessage("¡Hola! Soy tu asistente virtual 4T. ¿En qué puedo ayudarte?", "bot");
  }

  toggleChat() {
    this.interfaceTarget.classList.toggle("hidden")
    this.interfaceTarget.classList.toggle("flex")
  }

  handleKeydown(event) {
    if (event.key === "Enter") {
      this.sendMessage()
    }
  }
  
  async sendMessage() {
    const message = this.inputTarget.value.trim()
    if (!message) return

    this.addMessage(message, 'user')
    this.inputTarget.value = ''

    try {
      const response = await fetch('/chatbot/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ query: message })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const botResponse = data && data.responses[0] ? data.responses[0].content : "Lo siento, hubo un error en la respuesta."
      
      this.addMessage(botResponse, 'bot')
    } catch (error) {
      console.error('Error detallado:', error)
      this.addMessage("Lo siento, ocurrió un error al procesar tu mensaje.", 'bot')
    }
  }

  addMessage(content, type) {
    const messageDiv = document.createElement('div')
    messageDiv.className = type === 'user' 
      ? 'flex justify-end w-full'
      : 'flex justify-start w-full'

    const bubble = document.createElement('div')
    bubble.className = type === 'user'
      ? 'bg-blue-500 text-white rounded-lg py-2 px-4 max-w-[75%] break-words'
      : 'rounded-lg py-2 px-4 max-w-[75%] break-words '
      if (type !== 'user') {
        bubble.style.backgroundColor = 'rgb(243, 244, 246)';
      }
      // 
      bubble.style.marginTop = '0.30rem';
      bubble.style.marginBottom = '0.30rem';
      bubble.style.marginLeft = '0.30rem';
      bubble.style.marginRight = '0.30rem';

    bubble.textContent = content
    messageDiv.appendChild(bubble)
    this.messagesTarget.appendChild(messageDiv)
    this.scrollToBottom()
  }

  scrollToBottom() {
    this.messagesTarget.scrollTop = this.messagesTarget.scrollHeight
  }
}