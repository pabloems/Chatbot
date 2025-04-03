import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["interface", "messages", "input", "fileInput"]
  connect() {
    if (!this.hasMessagesTarget) {
      const messagesContainer = document.createElement('div')
      messagesContainer.setAttribute('data-chat-agent-target', 'messages')
      messagesContainer.className = 'flex-1 overflow-y-auto p-4 flex flex-col space-y-2'
      this.interfaceTarget.insertBefore(messagesContainer, this.interfaceTarget.lastElementChild)
    }
    this.addMessage("¡Hola! Soy tu asistente de empleabilidad 4T. Podemos ayudarte a encontrar un trabajo que se ajuste a tu perfil, para ello necesitamos que nos adjuntes tu currículum e indiques en que región de Chile te encuentras.", "bot");
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
  
  addLoadingMessage() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'flex justify-start w-full';
    loadingDiv.innerHTML = `
        <div class="bg-gray-100 rounded-lg py-2 px-4 max-w-[75%] break-words">
            <div class="flex items-center space-x-2">
                <div class="animate-pulse">⏳</div>
                <span>Revisando tu perfil...</span>
            </div>
        </div>
    `;
    this.messagesTarget.appendChild(loadingDiv);
    this.scrollToBottom();
    return loadingDiv;
  }

  handleFileSelect(event) {
    const file = event.target.files[0]
    const fileNameDisplay = document.getElementById("file-name")
    const fileIcon = document.getElementById("file-icon")

    if (file) {
      fileNameDisplay.textContent = file.name
      fileIcon.textContent = "📄"
    } else {
      fileNameDisplay.textContent = ""
      fileIcon.textContent = "📎"
    }
  }

  addMessage(content, type) {
    const messageDiv = document.createElement('div')
    messageDiv.className = 'flex w-full';
    if (type === 'user') {
      messageDiv.style.justifyContent = 'flex-end';
    } else {
      messageDiv.style.justifyContent = 'flex-start';
    }
    const bubble = document.createElement('div')
    bubble.className = type === 'user'
      ? 'bg-blue-500 text-white rounded-lg py-2 px-4 max-w-[75%] break-words'
      : 'rounded-lg py-2 px-4 max-w-[75%] break-words justify-end'
      if (type !== 'user') {
        bubble.style.backgroundColor = 'rgb(243, 244, 246)';
      }
      bubble.style.marginTop = '0.30rem';
      bubble.style.marginBottom = '0.30rem';
      bubble.style.marginLeft = '0.30rem';
      bubble.style.marginRight = '0.30rem';

    bubble.textContent = content
    messageDiv.appendChild(bubble)
    this.messagesTarget.appendChild(messageDiv)
    this.scrollToBottom()
  }

  async sendMessage() {
    const message = this.inputTarget.value.trim();
    const file = this.fileInputTarget.files[0];
    this.disableInput();

    if (message) {
      this.addMessage(message, 'user');
    }

    if (file) {
      const formData = new FormData();
      const loadingMessage = this.addLoadingMessage();
      formData.append("file", file);
      formData.append("user_message", message || "");

      try {
        this.addMessage(`Procesando archivo: ${file.name}...`, 'bot');

        const response = await fetch('/chatbot/ask', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const profile = data.profile;
        console.log(data, "datitos");
        loadingMessage.remove();
        this.addMessage("📋 Resumen del Perfil Profesional:", "bot");
        this.addMessage(profile, "bot");
        
        setTimeout(() => {
          this.addMessage("Buscaremos las mejores opciones de empleo para ti", "bot");
          this.disableInput();
          this.searchJobs(data);
        }, 1000);

      } catch (error) {
        console.error('Error detallado:', error);
        this.addMessage("Lo siento, ocurrió un error al subir el archivo. Es posible que el archivo no sea un PDF o DOCX.", 'bot');
        this.enableInput();
      }
    } else if (message) {
      try {
        const response = await fetch('/chatbot/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ query: message }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const botResponse = data.responses[0]?.content || "Lo siento, hubo un error en la respuesta.";

        this.addMessage(botResponse, 'bot');

        if (data.file_url) {
          this.addFileMessage(data.file_url, 'bot');
        }
        this.enableInput();
      } catch (error) {
        console.error('Error detallado:', error);
        this.addMessage("Lo siento, ocurrió un error al procesar tu mensaje.", 'bot');
        this.enableInput();
      }
    }

    this.inputTarget.value = '';
    this.fileInputTarget.value = '';
    document.getElementById("file-name").textContent = "";
    document.getElementById("file-icon").textContent = "📎";
    this.scrollToBottom();
  }

  scrollToBottom() {
    this.messagesTarget.scrollTop = this.messagesTarget.scrollHeight
  }

  disableInput() {
    this.inputTarget.disabled = true;
    this.inputTarget.placeholder = "Buscando opciones de empleo...";
    this.fileInputTarget.disabled = true;
    this.inputTarget.classList.add('bg-gray-100');
  }
  
  enableInput() {
    this.inputTarget.disabled = false;
    this.inputTarget.placeholder = "Escribe un mensaje...";    
    this.fileInputTarget.disabled = false;
    this.inputTarget.classList.remove('bg-gray-100');
  }
  
  async searchJobs(profileData) {
    try {
      const loadingMessage = this.addLoadingMessage();
      
      this.simulateTyping([
        "Analizando tu perfil profesional...",
        "Buscando ofertas que coincidan con tus habilidades...",
        "Filtrando las mejores oportunidades..."
      ], () => {
        this.callExternalJobService(profileData, loadingMessage);
      });
      
    } catch (error) {
      console.error('error in search jobss:', error);
      this.addMessage("Lo siento, ocurrió un error al buscar empleos.", 'bot');
      this.enableInput();
    }
  }
  
  simulateTyping(messages, callback, index = 0) {
    if (index >= messages.length) {
      callback();
      return;
    }
    
    setTimeout(() => {
      this.addMessage(messages[index], 'bot');
      this.simulateTyping(messages, callback, index + 1);
    }, 1500);
  }
  
  async callExternalJobService(profileData, loadingMessage) {
    try {
      const response = await fetch('/chatbot/search_jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ profile_data: profileData })
      });
      if (!response.ok) {
        throw new Error(`Error al conectar con el servicio de búsqueda: ${response.status}`);
      }
      const data = await response.json();
      loadingMessage.remove();
      this.addMessage("🎉 ¡Hemos encontrado algunas oportunidades en que podrían interesarte!", 'bot');
      this.displayJobs(data.jobs, data.total_jobs);
      
      setTimeout(() => {
        this.enableInput();
      }, 1000);
      
    } catch (error) {
      console.error('Error al conectar con el servicio de empleos:', error);
      this.addMessage("No pudimos conectar con el servicio de búsqueda de empleos. Por favor, intenta más tarde.", 'bot');
      this.enableInput();
    }
  }
  
  displayJobs(jobs, totalJobs = 0) {
    if (!jobs || jobs.length === 0) {
      this.addMessage("No encontramos ofertas que coincidan exactamente con tu perfil. Te recomendamos ampliar tus habilidades o revisar más tarde.", 'bot');
      return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex justify-start w-full';
    
    const bubble = document.createElement('div');
    bubble.className = 'rounded-lg py-2 px-4 max-w-[90%] w-[90%] break-words bg-gray-100';
    
    let content = `
      <div class="space-y-4">
        <div class="text-lg font-semibold text-gray-800">
          Encontramos ${totalJobs || jobs.length} oportunidades que coinciden con tu perfil
        </div>
    `;  
    jobs.forEach((job) => {
      content += `   
        <div style="margin-top: 0.5rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <div style="display: flex; flex-direction: column;">
            ${job && job.title ? `<span style="font-size: 1rem; color: #6B7280; margin-bottom: 0.25rem;">
              💼 ${job.title}
            </span>` : ''}
            ${job && job.archetype_text ? `<span style="font-size: 0.75rem; color: #6B7280; margin-bottom: 0.25rem;">
              🏢 Modalidad: ${job.archetype_text}
            </span>` : ''}
            ${job && job.address ? `<span style="font-size: 0.75rem; color: #6B7280; margin-bottom: 0.25rem;">
              📍 ${job.address}
            </span>` : ''}
            ${job && job.published_at_date_text ? `<span style="font-size: 0.75rem; color: #6B7280; margin-bottom: 0.25rem;">
              📅 Publicada el: ${job.published_at_date_text}
            </span>` : ''}
          </div>
          <button 
            style="background-color: #3B82F6; color: white; padding: 0.25rem 0.75rem; border-radius: 0.375rem; font-size: 0.875rem; transition: background-color 0.2s; cursor: pointer;"
            onmouseover="this.style.backgroundColor='#2563EB'"
            onmouseout="this.style.backgroundColor='#3B82F6'"
            onclick="window.open('${job.public_url}', '_blank')">
            Ver oferta
          </button>
        </div>
      `;
    });
    content += '</div>';
    
    bubble.innerHTML = content;
    messageDiv.appendChild(bubble);
    this.messagesTarget.appendChild(messageDiv);
    this.scrollToBottom();
    this.enableInput();
  }
}