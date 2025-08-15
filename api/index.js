// api/index.js
// O código do backend, agora usando o modelo veo-2.0-generate-001, conforme solicitado.
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
    console.error("Erro: A variável de ambiente GOOGLE_API_KEY não está definida.");
    throw new Error("Missing GOOGLE_API_KEY environment variable.");
}

const ai = new GoogleGenerativeAI({ apiKey: apiKey });

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
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Erro na chamada da API de imagem:', response.status, errorData);
                return res.status(response.status).json({ error: response.statusText, details: errorData });
            }

            const result = await response.json();
            
            if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
                const imageData = result.predictions[0].bytesBase64Encoded;
                res.json({ imageData: imageData });
            } else {
                console.error("Dados de imagem não encontrados na resposta da API.");
                res.status(500).json({ error: "Não foi possível gerar a imagem." });
            }
        } else if (type === 'video') {
            console.log("Iniciando a geração de vídeo com Veo...");

            const generateVideoPayload = {
                prompt: prompt
            };
            const generateVideoApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:generateVideo?key=${apiKey}`;
            const generateVideoResponse = await fetch(generateVideoApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(generateVideoPayload)
            });

            if (!generateVideoResponse.ok) {
                const errorData = await generateVideoResponse.json().catch(() => ({}));
                console.error('Erro ao iniciar a geração de vídeo:', generateVideoResponse.status, errorData);
                return res.status(generateVideoResponse.status).json({ error: "Failed to start video generation.", details: errorData });
            }
            
            const operation = await generateVideoResponse.json();
            const operationName = operation.name;

            let operationStatus;
            let videoResult = null;
            while (true) {
                const statusApiUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`;
                const statusResponse = await fetch(statusApiUrl);
                operationStatus = await statusResponse.json();

                if (operationStatus.done) {
                    if (operationStatus.error) {
                        console.error('Erro na operação de vídeo:', operationStatus.error);
                        return res.status(500).json({ error: "Erro na geração do vídeo.", details: operationStatus.error });
                    }
                    videoResult = operationStatus.response;
                    break;
                }
                console.log("Aguardando a conclusão da geração do vídeo...");
                await new Promise((resolve) => setTimeout(resolve, 10000));
            }

            console.log("Geração de vídeo concluída! Preparando para enviar ao frontend...");

            const generatedVideoFile = videoResult.generatedVideos[0];
            const fileApiUrl = `https://generativelanguage.googleapis.com/v1beta/${generatedVideoFile.video}?alt=media&key=${apiKey}`;
            const videoBufferResponse = await fetch(fileApiUrl);
            const videoBuffer = await videoBufferResponse.arrayBuffer();
            
            const base64VideoData = Buffer.from(videoBuffer).toString('base64');
            
            res.json({ base64VideoData: base64VideoData });

        } else {
            res.status(400).json({ error: "Tipo de requisição inválido." });
        }
    } catch (error) {
        console.error("Erro na função serverless:", error);
        res.status(500).json({ error: "Erro interno do servidor." });
    }
}
