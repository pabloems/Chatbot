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
    this.addMessage("¡Hola! Soy tu asistente de empleabilidad 4T. Podemos ayudarte a encontrar un trabajo que se ajuste a tu perfil, para ello necesitamos que nos adjuntes tu currículum e indiques en que región te encuentras.", "bot");
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
      if (type == 'user') {
        bubble.style.justifyContent = 'end';
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
        this.addMessage("Lo siento, ocurrió un error al subir el archivo.", 'bot');
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
      } catch (error) {
        console.error('Error detallado:', error);
        this.addMessage("Lo siento, ocurrió un error al procesar tu mensaje.", 'bot');
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
      console.error('Error al buscar empleos:', error);
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
      const matchScoreClass = job.match_score >= 80 ? 'bg-green-100 text-green-800' : 
                            job.match_score >= 70 ? 'bg-blue-100 text-blue-800' : 
                            'bg-yellow-100 text-yellow-800';
  
      content += `
        <div class="bg-white rounded-lg p-3 border border-gray-200 hover:border-blue-300 transition-colors">
          <div class="flex justify-between items-start">
            <div class="font-semibold text-blue-600">${job.title}</div>
            <div class="text-xs ${matchScoreClass} px-2 py-1 rounded">
              ${job.match_score}% Match
            </div>
          </div>
          
          <div class="text-sm text-gray-600">${job.company}</div>
          <div class="mt-1 text-sm">${job.description}</div>
          
          ${job.match_reasons ? `
            <div class="mt-2">
              <div class="text-xs font-semibold text-gray-700">Razones de coincidencia:</div>
              <ul class="list-disc list-inside text-xs text-gray-600">
                ${job.match_reasons.map(reason => `<li>${reason}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${job.recommendations ? `
            <div class="mt-2">
              <div class="text-xs font-semibold text-gray-700">Recomendaciones:</div>
              <ul class="list-disc list-inside text-xs text-gray-600">
                ${job.recommendations.map(rec => `<li>${rec}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          <div class="mt-2 flex justify-between items-center">
            <div>
              <span class="text-xs text-gray-500">
                <i class="fas fa-map-marker-alt"></i> ${job.region}
              </span>
              <span class="text-xs text-gray-500 ml-2">
                <i class="fas fa-calendar"></i> Cierra: ${job.close_date}
              </span>
            </div>
            <button class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm transition-colors" 
                    onclick="window.open('${job.public_url}', '_blank')">
              Ver oferta
            </button>
          </div>
        </div>
      `;
    });

    if (totalJobs > jobs.length) {
      content += `
        <div class="text-center mt-4">
          <button class="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md text-sm transition-colors">
            Ver ${totalJobs - jobs.length} ofertas más
          </button>
        </div>
      `;
    }
    
    content += '</div>';
    
    bubble.innerHTML = content;
    messageDiv.appendChild(bubble);
    this.messagesTarget.appendChild(messageDiv);
    this.scrollToBottom();
  }
}