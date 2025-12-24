import type { LayoutType, PaletteType, ThumbnailConfig } from './types';


const COLOR_MAP: Record<string, string> = {
    'text-white': 'White',
    'text-black': 'Black',
    'text-red-500': 'Vibrant Red',
    'text-blue-500': 'Electric Blue',
    'text-green-500': 'Bright Green',
    'text-yellow-400': 'Canary Yellow',
    'text-purple-500': 'Royal Purple',
    'text-pink-500': 'Hot Pink',
};

function getColorName(tailwindClass: string): string {
    return COLOR_MAP[tailwindClass] || 'White';
}

export function generateImagePrompt(config: ThumbnailConfig): string {
    // 1. Text Analysis & Colors
    const rawTitle = config.title.replace(/\*/g, ''); // Remove asterisks for the raw text
    const baseColor = getColorName(config.textColorBase);
    const accentColor = getColorName(config.textColorAccent);

    // Construct text instructions regarding emphasis
    // Assuming *word* means accent color
    const textInstructions = config.title.includes('*')
        ? `The text contains emphasized words. The words enclosed in asterisks in "${config.title}" should be colored ${accentColor}, while the rest is ${baseColor}.`
        : `The text color is primarily ${baseColor}.`;

    const textSection = `
    **1. MAIN TEXT & TYPOGRAPHY**
    - Content: "${rawTitle}"
    - Style: Bold, impactful, high-readability font suitable for YouTube thumbnails.
    - Colors: Primary color is ${baseColor}. Accent/Highlight color is ${accentColor}.
    - Instructions: ${textInstructions} Text must be massive, legible, and integrated into the scene but distinct from the background.
    `;

    // 2. Background & Atmosphere
    const backgroundInput = config.description.trim() || "A captivating abstract background suitable for high click-through rate.";
    const backgroundSection = `
    **2. BACKGROUND & SETTING**
    - Description: ${backgroundInput}
    - Detail Level: High definition, 8k resolution textures.
    - Depth: Ensure a sense of depth to separate the subject from the background.
    `;

    // 3. Characters & Subject
    const subjectQty = config.characterCount === 1 ? "1 person" : `${config.characterCount} people`;
    const charactersSection = `
    **3. CHARACTERS**
    - Quantity: ${subjectQty}.
    - Appearance: Expressive, emotional, and engaging. High-quality facial features.
    - Role: Main focus of the thumbnail, interacting with the viewer or the scene elements.
    `;

    // 4. Composition & Layout
    const layoutInstructions: Record<LayoutType, string> = {
        'centered': "Central Composition: Subject is dead center. Symmetrical, balanced, and powerful.",
        'thirds-left': "Rule of Thirds: Subject positioned on the left third. Open space on the right for text.",
        'thirds-right': "Rule of Thirds: Subject positioned on the right third. Open space on the left for text.",
        'vs': "Versus / Showdown: Split screen diagonal composition. Different elements on each side comparing contrast.",
        'reaction': "Reaction Shot: Extreme close-up or selfie angle of the subject in a corner/foreground, reacting to a background event.",
        'group': "Group Shot: Subjects arranged in a cohesive formation (V-shape or line). Unified team presence.",
        'perspective': "Forced Perspective: Exaggerated scale. Hand or object in foreground looking huge, subject in background.",
        'brainstorm': "Mind Map: Subject in center with elements/icons floating around them. Dynamic energy connections.",
        'split': "Split Screen: Hard vertical division. Left side distinct from right side (e.g., Before/After).",
        'silhouette': "Silhouette: Strong backlighting creating a dark subject shape against a bright, vivid background."
    };
    const compositionSection = `
    **4. COMPOSITION & CAMERA**
    - Layout Style: ${layoutInstructions[config.layout]}
    - Aspect Ratio: 16:9 (YouTube Standard).
    - Framing: Ensure space is reserved for the text overlay. Avoid cluttering the text areas.
    `;

    // 5. Color Palette & Lighting
    const paletteInstructions: Record<PaletteType, string> = {
        'vibrant': "Vibrant: High saturation, bright yellows and vivid colors. High energy.",
        'dark': "Dark/Tech: sleek blacks, deep blues, cybernetic neon accents. Moody and professional.",
        'pastel': "Pastel: Soft, creamy colors (pinks, baby blues). Gentle lighting, approachable feel.",
        'neon': "Neon/Cyberpunk: Glowing greens, purples, and electric blues. High contrast night vibes.",
        'warm': "Warm: Golden hour tones, oranges, reds, and cozy yellows. Welcoming.",
        'cold': "Cold: Icy blues, cyans, and clean whites. Crisp, professional, wintery.",
        'monochrome': "Monochrome: Black and white with high contrast / Noir style.",
        'retro': "Retro 80s: Synthwave purples and oranges, sunset gradients, vintage filter.",
        'nature': "Nature: Organic greens, earth tones, sunlight, fresh atmosphere.",
        'luxury': "Luxury: Gold, black, and marble textures. Sophisticated and expensive."
    };
    const paletteSection = `
    **5. COLOR PALETTE & LIGHTING**
    - Theme: ${paletteInstructions[config.palette]}
    - Lighting: Cinematic lighting, rim lights to separate subject from background.
    `;

    // 6. Additional Information
    const extraDetails = config.extraInfo.trim() || "No additional specific instructions.";
    const extraInfoSection = `
    **6. ADDITIONAL DETAILS**
    - Notes: ${extraDetails}
    - Quality: Trending on ArtStation, Unreal Engine 5 render style, sharp focus.
    `;

    // Assemble full prompt
    return `
    Create a high-quality YouTube thumbnail image based on the following detailed specifications:

    ${textSection}
    ${backgroundSection}
    ${charactersSection}
    ${compositionSection}
    ${paletteSection}
    ${extraInfoSection}

    **GOAL**: Maximize Click-Through Rate (CTR). The image must be eye-catching, high contrast, and emotionally resonant.
    `.trim();
}

export function generateAdaptationPrompt(config: ThumbnailConfig, characterImages: Record<number, string[]>): string {
    // ============================================================
    // STAGE 2: FACE REPLACEMENT PROMPT (Multi-Modal Approach)
    // ============================================================
    // This prompt is COMPLETELY DIFFERENT from Stage 1.
    // Stage 1 = Create from scratch (text → image)
    // Stage 2 = Modify existing image (image + photos → modified image)
    // ============================================================

    // Build position descriptions based on layout
    const positionMapping: Record<LayoutType, string[]> = {
        'centered': ['in the CENTER of the image'],
        'thirds-left': ['on the LEFT THIRD of the image'],
        'thirds-right': ['on the RIGHT THIRD of the image'],
        'vs': ['on the LEFT side (facing right)', 'on the RIGHT side (facing left)'],
        'reaction': ['in the CORNER/FOREGROUND (reaction position)'],
        'group': ['in the CENTER (front)', 'on the LEFT SIDE', 'on the RIGHT SIDE', 'in the BACK LEFT', 'in the BACK RIGHT'],
        'perspective': ['in the main subject position'],
        'brainstorm': ['in the CENTER of the composition'],
        'split': ['on the LEFT HALF of the split', 'on the RIGHT HALF of the split'],
        'silhouette': ['as the main SILHOUETTE figure']
    };

    const positions = positionMapping[config.layout] || ['in the image'];

    // Build character-to-image mapping with position info
    let imageIndexCounter = 2; // Image 1 is always the base thumbnail
    let characterMappingText = '';

    for (let i = 0; i < config.characterCount; i++) {
        const charImgs = characterImages[i] || [];
        const count = charImgs.length;
        const position = positions[i] || positions[0] || 'in the image';

        if (count > 0) {
            const imageRange = count === 1
                ? `IMAGE ${imageIndexCounter}`
                : `IMAGES ${imageIndexCounter}-${imageIndexCounter + count - 1}`;

            characterMappingText += `
    **PERSON ${i + 1}** (Position: ${position})
    - Reference photos: ${imageRange}
    - ${count > 1 ? `Multiple angles provided for maximum likeness accuracy` : `Single reference provided`}
    - ACTION: Replace the character at this position with this person's face and features
`;
            imageIndexCounter += count;
        } else {
            characterMappingText += `
    **PERSON ${i + 1}** (Position: ${position})
    - Reference photos: NONE PROVIDED
    - ACTION: Keep the existing character or generate a fitting placeholder
`;
        }
    }

    // Palette-specific lighting instructions for face blending
    const lightingInstructions: Record<PaletteType, string> = {
        'vibrant': 'bright, saturated lighting with warm highlights on skin',
        'dark': 'dramatic shadows with cool blue rim lighting on face edges',
        'pastel': 'soft, diffused lighting with gentle shadows',
        'neon': 'strong neon color reflections on skin (greens, purples, pinks)',
        'warm': 'golden hour warm tones on skin with orange/yellow highlights',
        'cold': 'cool blue-white lighting with crisp shadows',
        'monochrome': 'high contrast black and white lighting',
        'retro': 'synthwave purple and orange color cast on skin',
        'nature': 'natural daylight with soft green ambient reflections',
        'luxury': 'elegant rim lighting with subtle gold reflections'
    };

    const lightingNote = lightingInstructions[config.palette] || 'cinematic lighting matching the scene';

    return `
[FACE REPLACEMENT TASK - NANO BANANA PRO OPTIMIZED]

You are receiving multiple images for a FACE REPLACEMENT task. This is NOT a generation task - you are MODIFYING an existing thumbnail.

═══════════════════════════════════════════════════════════════
                        IMAGE INPUT MAPPING
═══════════════════════════════════════════════════════════════

**IMAGE 1: BASE THUMBNAIL (THE REFERENCE)**
- This is the thumbnail layout you MUST preserve
- Keep: ALL text, background, effects, composition, lighting mood
- Modify: ONLY the face regions of the characters

${characterMappingText}

═══════════════════════════════════════════════════════════════
                      CRITICAL INSTRUCTIONS
═══════════════════════════════════════════════════════════════

1. **PRESERVE EVERYTHING FROM IMAGE 1 EXCEPT FACES**
   ✓ Text overlay → KEEP EXACTLY as-is (no modifications, no repositioning)
   ✓ Background → KEEP EXACTLY as-is
   ✓ Composition/Layout → KEEP EXACTLY as-is
   ✓ Overall lighting mood → KEEP as-is
   ✗ Character faces → REPLACE with reference photos

2. **IDENTITY MATCHING (99% ACCURACY REQUIRED)**
   - The replaced faces MUST look EXACTLY like the people in the reference photos
   - Match: facial structure, nose shape, eye shape, skin tone, facial hair
   - If multiple reference angles are provided, use them ALL to understand the face from different perspectives
   - The result should be indistinguishable from a real photo of that person

3. **EXPRESSION & POSE ADAPTATION**
   - Keep the IDENTITY from the reference photos
   - Apply the EXPRESSION and HEAD ANGLE from IMAGE 1
   - Example: If IMAGE 1 shows a screaming pose, make the person from the reference scream

4. **LIGHTING & SEAMLESS BLENDING**
   - Face lighting: ${lightingNote}
   - Match the lighting direction from IMAGE 1
   - Ensure skin tones blend naturally with the scene
   - Add appropriate rim lights/reflections to match the environment
   - NO visible seams, mismatched shadows, or color temperature issues

5. **TEXT PROTECTION (CRITICAL)**
   - The text "${config.title.replace(/\*/g, '')}" must remain UNTOUCHED
   - Do NOT generate new text, move existing text, or allow faces to overlap text
   - Text is SACRED - pixel-perfect preservation required

═══════════════════════════════════════════════════════════════
                        OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════

- Resolution: 1920x1080 (16:9 YouTube Standard)
- Quality: Photorealistic, professional YouTube thumbnail quality
- The result should look like the ORIGINAL thumbnail but with DIFFERENT PEOPLE
- No AI artifacts, no blurry regions, no uncanny valley effects
`.trim();
}
