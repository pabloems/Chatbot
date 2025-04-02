class ChatbotController < ApplicationController
  def index
  end
  
  def ask
    if params[:file]
      form_data = {
        file: params[:file],
        user_message: params[:user_message]
      }
      response = HTTParty.post("#{ENV['DEV_PYTHON_MICROSERVICE_URL']}/extract_profile/",
        body: form_data,
        multipart: true
      )
      render json: response.parsed_response
    else
      response = HTTParty.post("#{ENV['DEV_PYTHON_MICROSERVICE_URL']}/chat/",
        body: { messages: [{ content: params[:query] }] }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
      render json: response.parsed_response
    end
  end

  def search_jobs
    begin
      profile_data = params[:profile_data]
      if Rails.env.development?
        base_url = ENV['JOB_API_URL']
      else
        base_url = ENV['JOB_API_URL_PRODUCTION']
      end
      response = HTTParty.post("#{base_url}/api/v3/bci_portals/_search",
        headers: {
          "Content-Type" => "application/json",
          "Accept" => "application/json"
        },
      if Rails.env.development?
        verify: false,
        verify_peer: false
      end
      )
      if response.code == 200
        raw_jobs = response["hits"]["hits"]
        jobs = raw_jobs.map do |job|
          source = job["_source"]
          {
            id: source["id"],
            title: source["title"],
            description: source["long_description"]&.gsub(/<\/?[^>]*>/, ""), #used this regex for clean html code
            region: source["region_name"],
            department: source["bci_department_description"],
            excluding_requirements: source["excluding_requirements"]&.gsub(/<\/?[^>]*>/, ""), # used this regex for clean html code
            desirable_knowledge: source["desirable_knowledge"]&.gsub(/<\/?[^>]*>/, ""), # used this regex for clean html code
            public_url: source["public_url"],
            position_level: source["position_level_description"]
          }
        end
  
        region = if profile_data["region"].present?
          profile_data["region"]
        else
          extract_region_from_profile(profile_data["profile"])
        end

        Rails.logger.info("Profile: #{profile_data['profile']}")
        Rails.logger.info("Región detectada: #{region}")
        Rails.logger.info("number of jobs: #{jobs.length}")
    
        filter_response = HTTParty.post("#{ENV['DEV_PYTHON_MICROSERVICE_URL']}/filter_jobs",
        body: {
          profile: profile_data["profile"],
          jobs: jobs,
          region: region
        }.to_json,
        headers: {
          "Content-Type" => "application/json"
        }
      )
        if filter_response.code == 200
          matched_jobs = filter_response["matched_jobs"] || []
          
          filtered_jobs = matched_jobs.map do |match|
            job = jobs.find { |j| j[:id].to_s == match["job_id"].to_s }
            next unless job
  
            job.merge({
              match_score: match["match_score"],
              match_reasons: match["match_reasons"],
              recommendations: match["recommendations"]
            })
          end.compact
  
          filtered_jobs.sort_by! { |job| -job[:match_score] }
  
          render json: { 
            jobs: filtered_jobs,
            total_jobs: filtered_jobs.length
          }
        else
          Rails.logger.error("Error in filter_jobs response: #{filter_response.body}")
          render json: { error: "Error al filtrar empleos: #{filter_response.body}" }, status: 500
        end
      else
        render json: { error: "Error al conectar con el servicio de empleos: #{response.code}" }, status: 500
      end
      
    rescue => e
      Rails.logger.error("Error in search_jobs: #{e.message}")
      Rails.logger.error(e.backtrace.join("\n"))
      render json: { 
        error: "Error en el procesamiento: #{e.message}"
      }, status: 500
    end
  end

  private

  # TODO In future it's better create model of region and use it in the filter_jobs
  def extract_region_from_profile(profile)
    region_mappings = {
      "santiago" => "Región Metropolitana",
      "metropolitana" => "Región Metropolitana",
      "rm" => "Región Metropolitana",
      "valparaiso" => "Región de Valparaíso",
      "viña del mar" => "Región de Valparaíso",
      "concepcion" => "Región del Biobío",
      "biobio" => "Región del Biobío",
      "arica" => "Región de Arica y Parinacota",
      "parinacota" => "Región de Arica y Parinacota",
      "tarapacá" => "Región de Tarapacá",
      "antofagasta" => "Región de Antofagasta",
      "atacama" => "Región de Atacama",
      "coquimbo" => "Región de Coquimbo",
      "valparaíso" => "Región de Valparaíso",
      "ohiggins" => "Región del Libertador General Bernardo O'Higgins",
      "maule" => "Región del Maule",
      "ñuble" => "Región de Ñuble",
      "araucanía" => "Región de La Araucanía",
      "los ríos" => "Región de Los Ríos",
      "los lagos" => "Región de Los Lagos",
      "aysén" => "Región de Aysén",
      "magallanes" => "Región de Magallanes",
      "nuble" => "Región de Ñuble",
      "biobío" => "Región del Biobío",
      "la araucania" => "Región de La Araucanía",
      "la araucanía" => "Región de La Araucanía",
    }
  
    profile_lower = profile.downcase
  
    region_mappings.each do |term, region|
      return region if profile_lower.include?(term)
    end
  
    regiones_chile = [
      "Región de Arica y Parinacota",
      "Región de Tarapacá",
      "Región de Antofagasta",
      "Región de Atacama",
      "Región de Coquimbo",
      "Región de Valparaíso",
      "Región Metropolitana",
      "Región del Libertador General Bernardo O'Higgins",
      "Región del Maule",
      "Región de Ñuble",
      "Región del Biobío",
      "Región de La Araucanía",
      "Región de Los Ríos",
      "Región de Los Lagos",
      "Región de Aysén",
      "Región de Magallanes"
    ]
  
    regiones_chile.each do |region|
      return region if profile.include?(region)
    end
  
    nil
  end

end
