import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="chat-agent"
export default class extends Controller {
  static targets = ["interface", "messages", "input"]
  connect() {
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
  
  sendMessage() {

  }
}
