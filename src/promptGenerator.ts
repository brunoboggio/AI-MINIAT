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
    // 4. Composition & Layout
    const COMPOSITION_BY_COUNT: Record<LayoutType, Record<number, string>> = {
        'centered': {
            1: "Central Composition (Single): The sole subject is dead center, commanding the frame with direct eye contact. Symmetrical balance.",
            2: "Central Composition (Duo): Two subjects standing back-to-back or side-by-side in the center. Perfectly balanced symmetry.",
            3: "Central Composition (Trio): One main subject in front-center, flanked by two others slightly behind. Pyramid composition.",
            4: "Central Composition (Quartet): Four subjects arranged in a diamond or square formation in the center. Tight grouping.",
            5: "Central Composition (Quintet): One central leader figure surrounded by four others in a semi-circle. Strong focal point.",
            6: "Central Composition (Ensemble): A dense central group of 6+ people, layered depth, looking like a powerful team poster."
        },
        'thirds-left': {
            1: "Rule of Thirds (Single): Subject stands on the left verical third line. Empty space on the right for text.",
            2: "Rule of Thirds (Duo): Two subjects clustered on the left side. One slightly in front of the other.",
            3: "Rule of Thirds (Trio): Three subjects standing in a row or wedge on the left side of the frame.",
            4: "Rule of Thirds (Group): A cluster of 4 people on the left. dynamic interaction within the group.",
            5: "Rule of Thirds (Crowd): A defined group of 5 filling the left half of the frame, leaving the right side clear.",
            6: "Rule of Thirds (Mass): A large group of 6+ people packed into the left side, creating a wall of faces."
        },
        'thirds-right': {
            1: "Rule of Thirds (Single): Subject stands on the right vertical third line. Empty space on the left for text.",
            2: "Rule of Thirds (Duo): Two subjects clustered on the right side. Interactive pose.",
            3: "Rule of Thirds (Trio): Three subjects arranged continuously on the right side.",
            4: "Rule of Thirds (Group): Four people grouped tightly on the right side. Depth arrangement.",
            5: "Rule of Thirds (Crowd): Five people filling the right side of the screen. Dynamic layering.",
            6: "Rule of Thirds (Mass): 6+ people crowding the right side, leaving the left open for massive text."
        },
        'vs': {
            1: "Versus (Split Self): A visual split effect. The same person shown twice in contrasting moods (e.g., Happy vs Sad) on left and right.",
            2: "Versus (Duel): One person on the far left, one on the far right. Facing each other aggressively or competitively. Space in middle.",
            3: "Versus (Uneven): One main rival on left vs two challengers on right. Asymmetrical confrontation.",
            4: "Versus (Team Battle): Two people on the left vs Two people on the right. Balanced standoff.",
            5: "Versus (Boss Fight): One powerful figure on left vs a team of four on the right.",
            6: "Versus (War): Three people on left vs Three people on right. Epic team clash composition."
        },
        'reaction': {
            1: "Reaction (Selfie): Extreme close-up of face in the foreground corner (left or right). Blurred background event.",
            2: "Reaction (Duo): Two people in the foreground corner reacting together to something behind them.",
            3: "Reaction (Trio): Three heads popping up from the bottom or corner, shocked expressions.",
            4: "Reaction (Group): A row of 4 distinct reaction faces along the bottom or side edge.",
            5: "Reaction (Audience): 5 people reacting wildly, positioned to frame the main content in the background.",
            6: "Reaction (Crowd): A sea of 6+ shocked faces filling the foreground, looking at a distant event."
        },
        'group': {
            1: "Group (Solo Leader): One person stepping forward as if leading an invisible army. Command presence.",
            2: "Group (Partners): Two partners standing shoulder-to-shoulder. Buddy cop movie poster vibe.",
            3: "Group (Trio): Classic Charlie's Angels or band formation. V-shape arrangement.",
            4: "Group (Squad): Four people walking towards the camera in a line. Slow-motion stride energy.",
            5: "Group (Team): Five people in a wedge formation. The leader in front, others fanning out.",
            6: "Group (Army): 6+ people filling the width of the frame. An overwhelming number of subjects."
        },
        'perspective': {
            1: "Forced Perspective (Hand): Subject in background, their hand reaching close to lens holding an object (or empty).",
            2: "Forced Perspective (Duo): One person huge in foreground (looking down), other person tiny in background.",
            3: "Forced Perspective (Depth): One very close, one mid-ground, one far background. Extreme depth of field.",
            4: "Forced Perspective (Line): A line of 4 people stretching from extreme foreground to infinity.",
            5: "Forced Perspective (Circle): 5 people standing in a circle looking down at the camera (fisheye lens).",
            6: "Forced Perspective (Tunnel): 6+ people forming a tunnel or aisle that recedes into the distance."
        },
        'brainstorm': {
            1: "Mind Map (Solo): Subject in center, looking confused or inspired. Icons/Elements floating around their head.",
            2: "Brainstorm (Discussion): Two people arguing or discussing. Ideas/graphics appearing between them.",
            3: "Brainstorm (Roundtable): Three people looking at a central glowing object or plan.",
            4: "Brainstorm (Team): Four people pointing at different floating diagrams in the air. Collaborative chaos.",
            5: "Brainstorm (Huddle): Five people heads together in a circle looking at a map/plan.",
            6: "Brainstorm (Classroom): One person teaching, 5+ people listening or taking notes with visible thought bubbles."
        },
        'split': {
            1: "Split Screen (Before/After): The same person on both sides. Left side 'Before', Right side 'After'.",
            2: "Split Screen (Duo): Vertical divider. Person A in their world (Left) vs Person B in their world (Right).",
            3: "Split Screen (Trio): Three vertical panels. One person in each panel. Triptych style.",
            4: "Split Screen (Quad): 2x2 Grid. One person in each quadrant. Different emotions.",
            5: "Split Screen (Mixed): Left half has 1 person, Right half has 4 people in a grid.",
            6: "Split Screen (Grid): 2x3 Grid. Six separate panels reacting differently."
        },
        'silhouette': {
            1: "Silhouette (Hero): Single dark hero outline against a blazing sunset/explosion background.",
            2: "Silhouette (Couple): Two silhouettes holding hands or fighting against a bright backdrop.",
            3: "Silhouette (Trio): Three mysterious figures in shadow. Dramatic backlighting.",
            4: "Silhouette (Squad): Four tactical silhouettes moving through smoke/mist.",
            5: "Silhouette (Gang): Five distinct character outlines posed on a ridge.",
            6: "Silhouette (Army): A massive array of dark shapes/soldiers against a light source."
        }
    };

    // Fallback for counts > 6 to use the "6" key
    const safeCount = Math.min(Math.max(config.characterCount, 1), 6);
    const selectedLayoutDesc = COMPOSITION_BY_COUNT[config.layout][safeCount] || COMPOSITION_BY_COUNT['centered'][safeCount];
    const compositionSection = `
    **4. COMPOSITION & CAMERA**
    - Layout Style: ${selectedLayoutDesc}
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
