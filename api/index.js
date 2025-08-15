// api/index.js
// O código do backend, agora sem a dependência do Google Cloud Storage.
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
    throw new Error("A variável de ambiente GOOGLE_API_KEY não está definida.");
}

const ai = new GoogleGenAI({ apiKey: apiKey });

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: "Método não permitido." });
    }

    try {
        const { prompt, type } = req.body;

        if (!prompt || !type) {
            return res.status(400).json({ error: "Prompt e tipo são obrigatórios." });
        }

        console.log(`Recebendo requisição para "${type}" com o prompt: "${prompt}"`);

        if (type === 'image') {
            const payload = {
                instances: { prompt: prompt },
                parameters: { "sampleCount": 1 }
            };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) { throw new Error('Erro na chamada da API de imagem: ' + response.statusText); }
            const result = await response.json();
            
            if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
                const imageData = result.predictions[0].bytesBase64Encoded;
                res.json({ imageData: imageData });
            } else {
                console.error("Dados de imagem não encontrados na resposta da API.");
                res.status(500).json({ error: "Não foi possível gerar a imagem." });
            }
        } else if (type === 'video') {
            console.log("Iniciando a geração de vídeo...");
            
            // 1. Inicia a operação de geração de vídeo.
            let operation = await ai.models.generateVideos({
                model: "veo-3.0-generate-preview",
                prompt: prompt,
            });

            // 2. Loop de polling para verificar o status.
            while (!operation.done) {
                console.log("Aguardando a conclusão da geração do vídeo...");
                await new Promise((resolve) => setTimeout(resolve, 10000)); // Espera 10 segundos
                operation = await ai.operations.getVideosOperation({
                    operation: operation,
                });
            }

            console.log("Geração de vídeo concluída! Preparando para enviar ao frontend...");

            // 3. Obtém o vídeo gerado como um Buffer.
            const generatedVideo = operation.response.generatedVideos[0];
            const videoBuffer = await ai.files.download({ file: generatedVideo.video });
            
            // 4. Converte o Buffer para uma string base64.
            const base64VideoData = videoBuffer.toString('base64');
            
            // 5. Envia os dados base64 diretamente para o frontend.
            res.json({ base64VideoData: base64VideoData });

        } else {
            res.status(400).json({ error: "Tipo de requisição inválido." });
        }
    } catch (error) {
        console.error("Erro na função serverless:", error);
        res.status(500).json({ error: "Erro interno do servidor." });
    }
}
