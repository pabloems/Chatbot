
class ChatbotController < ApplicationController
  def index
  end
  
  def ask
    response = HTTParty.post("http://localhost:8000/chat/", 
                             body: { messages: [{ content: params[:query] }] }.to_json, 
                             headers: { "Content-Type" => "application/json" })
    render json: response.parsed_response
  end
end
