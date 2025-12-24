export type InputImage = {
    mimeType: string;
    data: string;
};

export async function generateImageWithGemini(
    apiKey: string,
    prompt: string,
    model: string = 'imagen-3.0-generate-001',
    projectId?: string,
    inputImages: InputImage[] = [],
    location: string = 'us-central1'
): Promise<string | null> {

    let url: string;
    let headers: Record<string, string>;

    console.log(`[GeminiService] Called with Model: ${model}, ProjectID: ${projectId || 'N/A'}, Images: ${inputImages.length}`);

    const isGemini = model.toLowerCase().includes('gemini');
    let payload: any;

    // Improved API Key vs OAuth Token detection
    const cleanKey = apiKey.trim();

    // OAuth tokens from Google have specific patterns:
    // - Start with "ya29." (Google OAuth access tokens)
    // - Start with "eyJ" (JWT tokens, base64 encoded JSON)
    // - Are typically 200+ characters long
    // API Keys typically start with "AIza" and are ~39 characters
    const looksLikeOAuthToken =
        cleanKey.startsWith('ya29.') ||  // Google OAuth access token prefix
        cleanKey.startsWith('eyJ') ||     // JWT token prefix
        (cleanKey.length > 100 && !cleanKey.startsWith('AIza')); // Long non-API key

    const isApiKey = !looksLikeOAuthToken;

    // Debug log to confirm detection
    console.log(`[GeminiService] Key Detection: Length=${cleanKey.length}, StartsWithAIza=${cleanKey.startsWith('AIza')}, StartsWithYa29=${cleanKey.startsWith('ya29.')}, Verdict=${isApiKey ? 'API Key' : 'OAuth Token'}`);

    if (projectId && !isApiKey) {
        // Vertex AI Endpoint (Only if we have a Project ID AND it's NOT a standard API key)
        // WARNING: Vertex AI OAuth tokens from `gcloud auth print-access-token` have issues
        // when called directly from a browser due to CORS and token type restrictions.
        // This works best from a backend/server environment.

        // For Gemini models, prefer Google AI Studio endpoint (works better from browser)
        if (isGemini) {
            console.warn("[GeminiService] WARNING: Using Vertex AI with Gemini from browser may fail.");
            console.warn("[GeminiService] Consider using a Google AI Studio API Key instead.");
            console.warn("[GeminiService] Get one at: https://aistudio.google.com/apikey");
        }

        console.log("[GeminiService] Using Vertex AI Endpoint (OAuth)");
        const method = isGemini ? 'generateContent' : 'predict';
        url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:${method}`;
        headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cleanKey}` // In Vertex mode, apiKey is treated as Access Token
        };
    } else {
        // Google AI Studio (Generative Language) Endpoint
        // We use this if no Project ID is provided OR if we detect a standard API Key (AIza...)
        console.log(`[GeminiService] Using AI Studio Endpoint. Key Type: ${isApiKey ? 'Standard API Key' : 'OAuth Token (Fallback)'}`);

        const method = isGemini ? 'generateContent' : 'predict';

        if (isApiKey) {
            // Standard API Key Mode
            url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}?key=${cleanKey}`;
            headers = {
                'Content-Type': 'application/json'
            };
        } else {
            // OAuth Token Mode (for AI Studio)
            // Useful if user has an OAuth token but wants to use the standard endpoint (or doesn't have a Project ID set)
            url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`;
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cleanKey}`
            };
        }
    }

    if (isGemini) {
        // Gemini Payload structure
        const parts: any[] = [{ text: prompt }];

        if (inputImages && inputImages.length > 0) {
            inputImages.forEach(img => {
                parts.push({
                    inlineData: {
                        mimeType: img.mimeType,
                        data: img.data
                    }
                });
            });
        }

        // Check if this is an image generation model
        const isImageGenModel = model.toLowerCase().includes('image') ||
            model.toLowerCase().includes('imagen');

        payload = {
            contents: [{
                role: 'user',
                parts: parts
            }],
            // CRITICAL: generationConfig with responseModalities is REQUIRED for image generation
            generationConfig: isImageGenModel ? {
                responseModalities: ["TEXT", "IMAGE"],
                // Image config for aspect ratio (official Gemini API field)
                imageConfig: {
                    aspectRatio: "16:9"
                }
            } : undefined,
        };

        console.log(`[GeminiService] Gemini Payload: isImageGenModel=${isImageGenModel}, responseModalities=${isImageGenModel ? '["TEXT", "IMAGE"]' : 'default'}`);
    } else {
        // Legacy Imagen Payload structure
        // Note: Standard Imagen 3 generate API typically doesn't support image inputs in this simple 'predict' structure
        // unless it's an editing task, which has a different payload. 
        // For now, we only send text prompt to Imagen.
        payload = {
            instances: [
                {
                    prompt: prompt,
                    aspectRatio: "16:9",
                }
            ],
            parameters: {
                sampleCount: 1,
            }
        };
    }

    // ... (rest of the function remains similar but we need to ensure the end matches)
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini/Vertex API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log("[GeminiService] Raw Response:", JSON.stringify(data, null, 2));

        // 1. Handle Imagen Response (Predictions)
        const prediction = data.predictions?.[0];
        if (prediction) {
            if (prediction.bytesBase64Encoded) return `data:image/png;base64,${prediction.bytesBase64Encoded}`;
            if (prediction.bytesBase64) return `data:image/png;base64,${prediction.bytesBase64}`;
            if (prediction.mimeType && prediction.bytesBase64) return `data:${prediction.mimeType};base64,${prediction.bytesBase64}`;
        }

        // 2. Handle Gemini Response (Candidates)
        const candidate = data.candidates?.[0];
        if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
                const inlineData = part.inline_data || part.inlineData;
                if (inlineData && inlineData.mimeType && inlineData.mimeType.startsWith('image/')) {
                    return `data:${inlineData.mimeType};base64,${inlineData.data}`;
                }
            }
        }

        if (candidate?.finishReason) {
            throw new Error(`Gemini finished with reason: ${candidate.finishReason} (No image generated)`);
        }

        throw new Error("No image data found in response (check logs for details)");

    } catch (error) {
        console.error("Failed to generate image:", error);
        throw error;
    }
}
