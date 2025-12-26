import React, { useState } from 'react';
import {
    Palette, Users, Layout, Type, Image as ImageIcon, Sparkles,
    ArrowRight, Upload, Loader2, Play, Download, Copy, Check
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { generateImagePrompt, generateAdaptationPrompt } from './promptGenerator';
import { generateImageWithGemini } from './services/geminiService';
import type { InputImage } from './services/geminiService';

// --- Types ---

import type { LayoutType, PaletteType, ThumbnailConfig } from './types';

// --- Types ---
/*
export type LayoutType =
    | 'centered' | 'thirds-left' | 'thirds-right' | 'vs' | 'reaction'
    | 'group' | 'perspective' | 'brainstorm' | 'split' | 'silhouette';

export type PaletteType =
    | 'vibrant' | 'dark' | 'pastel' | 'neon' | 'warm'
    | 'cold' | 'monochrome' | 'retro' | 'nature' | 'luxury';
*/

interface AppState {
    step: 'draft' | 'adaptation';
    config: ThumbnailConfig;
    generatedDraft: boolean; // Has the "AI" generated the draft?
    generatedPrompt: string; // The text prompt generated for the AI
    adaptationPrompt?: string; // The prompt for Stage 2

    generatedImage?: string; // Real AI Image URL (base64)
    characterImages: Record<number, string[]>; // Slot ID -> Image URLs (Max 5)
    adaptationImage?: string; // Final Result
}

// --- Utils ---

const blobUrlToBase64 = async (url: string): Promise<{ data: string, mimeType: string }> => {
    if (url.startsWith('data:')) {
        const match = url.match(/^data:(.*);base64,(.*)$/);
        if (match) return { mimeType: match[1], data: match[2] };
    }
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const res = reader.result as string;
            const match = res.match(/^data:(.*);base64,(.*)$/);
            if (match) resolve({ mimeType: match[1], data: match[2] });
            else reject(new Error("Invalid base64 conversion"));
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

// --- Constants ---

const LAYOUTS: { id: LayoutType; label: string }[] = [
    { id: 'centered', label: 'Centrado (Primer Plano)' },
    { id: 'thirds-left', label: 'Regla de Tercios (Izquierda)' },
    { id: 'thirds-right', label: 'Regla de Tercios (Derecha)' },
    { id: 'vs', label: 'VS / Enfrentamiento' },
    { id: 'reaction', label: 'Reacción (Esquina)' },
    { id: 'group', label: 'Grupo Simétrico' },
    { id: 'perspective', label: 'Perspectiva Forzada' },
    { id: 'brainstorm', label: 'Lluvia de Ideas' },
    { id: 'split', label: 'Pantalla Dividida' },
    { id: 'silhouette', label: 'Silueta a Contraluz' },
];

const PALETTES: { id: PaletteType; label: string; bg: string; text: string; accent: string }[] = [
    { id: 'vibrant', label: 'Vibrante', bg: 'bg-yellow-400', text: 'text-black', accent: 'border-black' },
    { id: 'dark', label: 'Oscuro (Tech)', bg: 'bg-slate-900', text: 'text-white', accent: 'border-blue-500' },
    { id: 'pastel', label: 'Pastel (Soft)', bg: 'bg-pink-100', text: 'text-gray-800', accent: 'border-pink-400' },
    { id: 'neon', label: 'Neón (Cyberpunk)', bg: 'bg-black', text: 'text-green-400', accent: 'border-purple-500' },
    { id: 'warm', label: 'Cálido', bg: 'bg-orange-600', text: 'text-white', accent: 'border-yellow-300' },
    { id: 'cold', label: 'Frío', bg: 'bg-blue-800', text: 'text-blue-100', accent: 'border-cyan-400' },
    { id: 'monochrome', label: 'Monocromático', bg: 'bg-gray-200', text: 'text-gray-900', accent: 'border-black' },
    { id: 'retro', label: 'Retro (80s)', bg: 'bg-purple-900', text: 'text-yellow-300', accent: 'border-pink-500' },
    { id: 'nature', label: 'Naturaleza', bg: 'bg-green-800', text: 'text-green-100', accent: 'border-emerald-400' },
    { id: 'luxury', label: 'Lujoso', bg: 'bg-black', text: 'text-amber-400', accent: 'border-amber-600' },
];

const TEXT_COLORS = [
    { id: 'white', value: 'text-white', bg: 'bg-white' },
    { id: 'black', value: 'text-black', bg: 'bg-black' },
    { id: 'red', value: 'text-red-500', bg: 'bg-red-500' },
    { id: 'blue', value: 'text-blue-500', bg: 'bg-blue-500' },
    { id: 'green', value: 'text-green-500', bg: 'bg-green-500' },
    { id: 'yellow', value: 'text-yellow-400', bg: 'bg-yellow-400' },
    { id: 'purple', value: 'text-purple-500', bg: 'bg-purple-500' },
    { id: 'pink', value: 'text-pink-500', bg: 'bg-pink-500' },
];

// --- Sub-components (Inline for Single File requirement) ---

const SidebarControl = ({ label, icon: Icon, children, className }: { label: string, icon: any, children: React.ReactNode, className?: string }) => (
    <div className={cn("mb-8 group", className)}>
        <div className="flex items-center gap-2 mb-3 text-gray-400 group-hover:text-blue-400 transition-colors font-semibold text-xs uppercase tracking-widest">
            <Icon className="w-4 h-4" />
            {label}
        </div>
        <div className="bg-[#0f1115]/50 rounded-xl p-1 border border-white/5 backdrop-blur-sm transition-all group-hover:border-white/10">
            {children}
        </div>
    </div>
);

// --- Layout Preview Component ---
const LayoutPreviewIcon = ({ layout, active, count = 1 }: { layout: LayoutType, active: boolean, count?: number }) => {
    const color = active ? "#60a5fa" : "#4b5563"; // blue-400 vs gray-600

    // Helper: Generate multiple person shapes based on count and layout strategy
    const renderShapes = (
        startX: number,
        startY: number,
        w: number,
        h: number,
        spacingX: number = 5,
        spacingY: number = 0,
        limit: number = 6
    ) => {
        const visualCount = Math.min(count, limit);
        return Array.from({ length: visualCount }).map((_, i) => {
            // Center the group
            const totalWidth = (visualCount - 1) * spacingX + w;
            const offsetX = startX - (totalWidth / 2) + (i * spacingX);
            const offsetY = startY + (i * spacingY);

            return (
                <rect
                    key={i}
                    x={offsetX}
                    y={offsetY}
                    width={w}
                    height={h}
                    rx={2}
                    fill={color}
                    opacity={0.8 + (i % 2) * 0.1}
                />
            );
        });
    };

    return (
        <svg viewBox="0 0 100 60" className="w-full h-full rounded-sm overflow-hidden" style={{ backgroundColor: '#000' }}>
            {/* Base Frame */}
            <rect x="0" y="0" width="100" height="60" fill="#1f2937" />

            {layout === 'centered' && (
                <>
                    {renderShapes(50, 15, 12, 30, 8, 2)}
                    {/* Spotlight effect */}
                    <ellipse cx="50" cy="50" rx={20 + (count * 2)} ry="5" fill={color} opacity="0.2" />
                </>
            )}
            {layout === 'thirds-left' && (
                <>
                    <line x1="33" y1="0" x2="33" y2="60" stroke="#374151" strokeWidth="1" />
                    <line x1="66" y1="0" x2="66" y2="60" stroke="#374151" strokeWidth="1" />
                    {renderShapes(22, 15, 10, 30, 6, 2)}
                </>
            )}
            {layout === 'thirds-right' && (
                <>
                    <line x1="33" y1="0" x2="33" y2="60" stroke="#374151" strokeWidth="1" />
                    <line x1="66" y1="0" x2="66" y2="60" stroke="#374151" strokeWidth="1" />
                    {renderShapes(78, 15, 10, 30, 6, 2)}
                </>
            )}
            {layout === 'vs' && (
                <>
                    <path d="M45 0 L55 60" stroke="#374151" strokeWidth="2" />
                    {/* Left Side Group */}
                    {Array.from({ length: Math.ceil(count / 2) }).map((_, i) => (
                        <rect key={`l-${i}`} x={10 - (i * 3)} y={15 + (i * 5)} width={15} height={30} rx={2} fill={color} opacity="0.5" transform="rotate(-5 25 30)" />
                    ))}
                    <text x="50" y="32" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle">VS</text>
                    {/* Right Side Group */}
                    {Array.from({ length: Math.floor(count / 2) || 1 }).map((_, i) => (
                        <rect key={`r-${i}`} x={75 + (i * 3)} y={15 + (i * 5)} width={15} height={30} rx={2} fill="#ef4444" opacity="0.5" transform="rotate(5 75 30)" />
                    ))}
                </>
            )}
            {layout === 'reaction' && (
                <>
                    <rect x="0" y="0" width="100" height="60" fill={color} opacity="0.2" />
                    {/* Background Interest */}
                    <circle cx="20" cy="20" r="5" fill="#ef4444" opacity="0.5" />
                    {/* Reaction Faces in Corner */}
                    {renderShapes(80, 25, 15, 30, 10, -3)}
                </>
            )}
            {layout === 'group' && (
                <>
                    {/* V-Formationish */}
                    {renderShapes(50, 20, 12, 25, 14, 0)}
                    {count >= 3 && <rect x="50" y="25" width="12" height="25" rx={2} fill={color} opacity="1" transform="translate(-6, 0)" />}
                </>
            )}
            {layout === 'perspective' && (
                <>
                    <path d="M20 50 L35 20 L65 20 L80 50 Z" fill={color} opacity="0.1" />
                    <rect x="0" y="0" width="100" height="60" fill="url(#grid)" opacity="0.2" />
                    {/* Foreground Big, Background Small */}
                    <rect x="10" y="10" width="20" height="40" rx={2} fill={color} opacity="0.9" /> {/* Big */}
                    {count > 1 && <rect x="40" y="20" width="10" height="20" rx={2} fill={color} opacity="0.7" />}
                    {count > 2 && <rect x="60" y="25" width="5" height="10" rx={1} fill={color} opacity="0.5" />}
                    {count > 3 && <rect x="80" y="28" width="3" height="6" rx={0.5} fill={color} opacity="0.3" />}
                </>
            )}
            {layout === 'brainstorm' && (
                <>
                    <circle cx="50" cy="30" r="15" stroke={color} fill="none" strokeWidth="2" />
                    {/* Orbiting dots based on count */}
                    {Array.from({ length: count }).map((_, i) => {
                        const angle = (i / count) * 2 * Math.PI;
                        const r = 20;
                        const cx = 50 + r * Math.cos(angle);
                        const cy = 30 + r * Math.sin(angle);
                        return <circle key={i} cx={cx} cy={cy} r={4} fill={color} opacity="0.7" />;
                    })}
                </>
            )}
            {layout === 'split' && (
                <>
                    <rect x="0" y="0" width="50" height="60" fill={color} opacity="0.6" />
                    <rect x="50" y="0" width="50" height="60" fill="#000" opacity="0.9" />
                    <line x1="50" y1="0" x2="50" y2="60" stroke="#fff" strokeWidth="1" />
                    {/* Distributed People */}
                    {Array.from({ length: count }).map((_, i) => (
                        <rect
                            key={i}
                            x={i % 2 === 0 ? 15 : 65}
                            y={15 + Math.floor(i / 2) * 10}
                            width={15}
                            height={25}
                            rx={2}
                            fill={i % 2 === 0 ? color : "#ef4444"}
                            opacity="0.8"
                        />
                    ))}
                </>
            )}
            {layout === 'silhouette' && (
                <>
                    <rect x="0" y="0" width="100" height="60" fill={color} opacity="0.3" style={{ mixBlendMode: 'overlay' }} />
                    {renderShapes(50, 20, 15, 40, 12, 2)}
                </>
            )}
        </svg>
    );
};

// --- Main Component ---

// --- Character Silhouette Component ---
const CharacterSilhouette = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor">
        <path d="M50 20 C58 20 65 27 65 35 C65 43 58 50 50 50 C42 50 35 43 35 35 C35 27 42 20 50 20 Z M20 100 L20 85 C20 70 30 60 50 60 C70 60 80 70 80 85 L80 100 L20 100 Z" opacity="0.8" />
    </svg>
);

// --- Main Component ---

export default function ThumbnailStudio() {
    const [state, setState] = useState<AppState>({
        step: 'draft',
        config: {
            title: 'INCREÍBLE *VIDEO*',
            description: '',
            characterCount: 1,
            layout: 'centered',
            palette: 'dark',
            extraInfo: '',
            textColorBase: 'text-white',
            textColorAccent: 'text-yellow-400',
        },

        generatedDraft: false,
        generatedPrompt: '',
        adaptationPrompt: '',
        characterImages: {},
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [adaptationLoading, setAdaptationLoading] = useState(false);
    const [adaptationDone, setAdaptationDone] = useState(false);
    const [adaptationError, setAdaptationError] = useState<string | null>(null);

    // API Integration State
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
    const [apiError, setApiError] = useState<string | null>(null);

    // Save API key
    const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const key = e.target.value;
        setApiKey(key);
        localStorage.setItem('gemini_api_key', key);
    };

    const [projectId, setProjectId] = useState(() => localStorage.getItem('google_cloud_project_id') || '');
    const handleProjectIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const id = e.target.value;
        setProjectId(id);
        localStorage.setItem('google_cloud_project_id', id);
    };

    const [selectedModel, setSelectedModel] = useState('imagen-3.0-generate-001');
    const modelOptions = [
        { value: 'imagen-3.0-generate-001', label: 'Imagen 3 (Standard)', price: '~ $0.03 / img' },
        { value: 'imagen-3.0-fast-generate-001', label: 'Imagen 3 (Fast)', price: '~ $0.03 / img' },
        { value: 'imagen-3.0-generate-002', label: 'Imagen 3.0 v2', price: '~ $0.03 / img' },
        // Gemini Image Models (Nano Banana series):
        { value: 'gemini-2.5-flash-image', label: 'Nano Banana (Gemini 2.5 Flash)', price: 'Low Latency' },
        { value: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro (Gemini 3 Pro)', price: '~ $0.13-0.24 / img' },
    ];



    // --- Actions ---

    const handleGenerateDraft = async () => {
        setIsGenerating(true);
        setApiError(null);

        // Generate the prompt based on current config
        const prompt = generateImagePrompt(state.config);
        console.log("Generación de Prompt IA:", prompt);

        let realImageUrl = undefined;

        if (apiKey) {
            try {
                // FORCE API KEY MODE if the key looks like a standard API Key (short or starts with AIza).
                // This prevents sending ProjectID which triggers Vertex AI (requiring OAuth).
                const isLikelyApiKey = apiKey.trim().startsWith('AIza') || apiKey.trim().length < 60;
                const effectiveProjectId = isLikelyApiKey ? undefined : (projectId || undefined);

                console.log(`[DEBUG] handleGenerateDraft. KeyIsAPI=${isLikelyApiKey}. EffectiveProjectID=${effectiveProjectId}`);

                const imageBase64 = await generateImageWithGemini(apiKey, prompt, selectedModel, effectiveProjectId);
                if (imageBase64) {
                    realImageUrl = imageBase64;
                }
            } catch (error: any) {
                console.error("Error generando imagen:", error);
                setApiError(error.message || "Error desconocido al generar imagen");
            }
        } else {
            // Simulate delay if no API key
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        setIsGenerating(false);
        setState(prev => ({
            ...prev,
            generatedDraft: true,
            generatedPrompt: prompt,
            generatedImage: realImageUrl
        }));
    };

    const handlePreviewPrompt = () => {
        const prompt = generateImagePrompt(state.config);
        setState(prev => ({
            ...prev,
            generatedPrompt: prompt
        }));
    };

    const handleSkipToStage2 = () => {
        const prompt = generateImagePrompt(state.config);
        setState(prev => ({
            ...prev,
            generatedPrompt: prompt,
            generatedDraft: true,
            step: 'adaptation'
        }));
    };

    const handlePreviewAdaptationPrompt = () => {
        try {
            console.log("Generating Adaptation Prompt... Config:", state.config);
            const prompt = generateAdaptationPrompt(state.config, state.characterImages);
            console.log("Adaptation Prompt Generated:", prompt);
            setState(prev => ({
                ...prev,
                adaptationPrompt: prompt
            }));
        } catch (e) {
            console.error("Error generating adaptation prompt:", e);
        }
    };

    const handleDownloadImage = () => {
        const imageToDownload = state.step === 'adaptation' && state.adaptationImage
            ? state.adaptationImage
            : state.generatedImage;

        if (!imageToDownload) return;

        const link = document.createElement('a');
        link.href = imageToDownload;
        link.download = `miniat-studio-${state.step}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleResetToStage1 = () => {
        setState(prev => ({ ...prev, step: 'draft' }));
    };

    const handleStage2Completion = () => {
        // Option A: Just go back to Stage 1 to start over or refine
        handleResetToStage1();
    };

    const handleReferenceUpload = (file: File) => {
        const url = URL.createObjectURL(file);
        setState(prev => ({ ...prev, generatedImage: url }));
    };

    const handleApproveDraft = () => {
        setState(prev => ({ ...prev, step: 'adaptation' }));
    };

    const handleImageUpload = (slotId: number, file: File) => {
        const url = URL.createObjectURL(file);
        setState(prev => {
            const currentImages = prev.characterImages[slotId] || [];
            if (currentImages.length >= 5) return prev; // Max 5 limit
            return {
                ...prev,
                characterImages: { ...prev.characterImages, [slotId]: [...currentImages, url] }
            };
        });
    };

    const removeImage = (slotId: number, imgIndex: number) => {
        setState(prev => {
            const currentImages = prev.characterImages[slotId] || [];
            const newImages = currentImages.filter((_, i) => i !== imgIndex);
            return {
                ...prev,
                characterImages: { ...prev.characterImages, [slotId]: newImages }
            };
        });
    }

    const handleAdaptation = async () => {
        setAdaptationLoading(true);
        setAdaptationError(null);
        setAdaptationDone(false);

        // 1. Generate Prompt
        const adaptPrompt = generateAdaptationPrompt(state.config, state.characterImages);
        console.log("Generación de Prompt Adaptación:", adaptPrompt);

        // Update state with the prompt so we can see it during/after generation
        setState(prev => ({
            ...prev,
            adaptationPrompt: adaptPrompt
        }));

        // 2. Prepare Images (Reference + Characters)
        const inputImages: InputImage[] = [];

        try {
            // A. Reference Image (Stage 1 Result)
            if (state.generatedImage) {
                const refImg = await blobUrlToBase64(state.generatedImage);
                inputImages.push(refImg);
            }

            // B. Character Images
            for (let i = 0; i < state.config.characterCount; i++) {
                const images = state.characterImages[i] || [];
                for (const imgUrl of images) {
                    const base64Img = await blobUrlToBase64(imgUrl);
                    inputImages.push(base64Img);
                }
            }

            // 3. Call API
            if (apiKey) {
                const isLikelyApiKey = apiKey.trim().startsWith('AIza') || apiKey.trim().length < 60;
                const effectiveProjectId = isLikelyApiKey ? undefined : (projectId || undefined);

                console.log(`[DEBUG] handleAdaptation. KeyIsAPI=${isLikelyApiKey} EffectiveProjectID=${effectiveProjectId}`);

                const resultImage = await generateImageWithGemini(
                    apiKey,
                    adaptPrompt,
                    selectedModel,
                    effectiveProjectId,
                    inputImages
                );

                if (resultImage) {
                    setState(prev => ({
                        ...prev,
                        adaptationImage: resultImage
                    }));
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            setAdaptationLoading(false);
            setAdaptationDone(true);

        } catch (error: any) {
            console.error("Error en adaptación:", error);
            setAdaptationError(error.message || "Error al adaptar personajes");
            setAdaptationLoading(false);
        }
    };

    const currentPalette = PALETTES.find(p => p.id === state.config.palette) || PALETTES[1];

    // --- Sub-components (Inline for Single File requirement) ---



    const parseTitle = (text: string) => {
        const parts = text.split('*');
        return parts.map((part, i) => {
            if (i % 2 === 1) {
                // Emphasis
                return <span key={i} className={state.config.textColorAccent}>{part}</span>;
            }
            // Base
            return <span key={i} className={state.config.textColorBase}>{part}</span>;
        });
    };

    const [copied, setCopied] = useState(false);

    const handleCopyPromptToClipboard = () => {
        navigator.clipboard.writeText(state.generatedPrompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-[#0f1115] text-white font-sans flex overflow-hidden selection:bg-blue-500 selection:text-white" >
            {/* Sidebar */}
            <aside className="w-[400px] bg-[#161b22] border-r border-gray-800 flex flex-col h-screen z-10 shadow-2xl">
                <div className="p-6 border-b border-gray-800 bg-[#161b22]">
                    <h1 className="text-2xl font-black italic tracking-tighter flex items-center gap-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                        <Sparkles className="w-6 h-6 text-blue-400" fill="currentColor" />
                        AI MINIAT <span className="text-white not-italic font-light tracking-widest text-sm opacity-50 ml-1">STUDIO</span>
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <button
                            onClick={() => setState(prev => ({ ...prev, step: 'draft' }))}
                            className={cn("h-1 w-full rounded-full transition-all duration-300 cursor-pointer hover:opacity-80", state.step === 'draft' ? "bg-blue-500" : "bg-green-500")}
                        />
                        <button
                            onClick={() => state.generatedDraft && setState(prev => ({ ...prev, step: 'adaptation' }))}
                            className={cn("h-1 w-full rounded-full transition-all duration-300",
                                state.step === 'adaptation' ? "bg-blue-500" : "bg-gray-700",
                                state.generatedDraft ? "cursor-pointer hover:bg-blue-400/50" : "cursor-not-allowed"
                            )}
                        />
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-gray-500 font-mono uppercase">
                            {state.step === 'draft' ? 'Etapa 1: Estructura & Concepto' : 'Etapa 2: Realismo'}
                        </p>
                        {state.step === 'adaptation' && (
                            <button onClick={handleResetToStage1} className="text-[10px] text-blue-400 hover:text-white transition-colors uppercase font-bold tracking-wider">
                                Volver a Etapa 1
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">

                    {state.step === 'draft' ? (
                        <>
                            <SidebarControl label="Texto Principal" icon={Type}>
                                <div className="space-y-4 p-2">
                                    <div className="relative group/input">
                                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                            <Type className="w-4 h-4 text-gray-500 group-focus-within/input:text-blue-400 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            value={state.config.title}
                                            onChange={(e) => setState(prev => ({ ...prev, config: { ...prev.config, title: e.target.value } }))}
                                            className="w-full bg-[#161b22] border border-gray-700 rounded-lg py-3 pl-10 pr-3 text-white text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-gray-600 shadow-inner"
                                            placeholder="Ej: MI NUEVA *CASA*"
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 block"></span> Usa *asteriscos* para pintar el texto.</p>

                                    <div className="grid grid-cols-2 gap-4 bg-black/20 p-3 rounded-lg border border-white/5">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-gray-500 mb-2 block tracking-wider">Color Base</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {TEXT_COLORS.map(c => (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => setState(prev => ({ ...prev, config: { ...prev.config, textColorBase: c.value } }))}
                                                        className={cn(
                                                            "w-6 h-6 rounded-full border-2 transition-all hover:scale-110 shadow-sm",
                                                            c.bg,
                                                            state.config.textColorBase === c.value
                                                                ? "border-white ring-2 ring-white/20 scale-110 z-10"
                                                                : "border-transparent opacity-60 hover:opacity-100"
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-gray-500 mb-2 block tracking-wider">Color Énfasis</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {TEXT_COLORS.map(c => (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => setState(prev => ({ ...prev, config: { ...prev.config, textColorAccent: c.value } }))}
                                                        className={cn(
                                                            "w-6 h-6 rounded-full border-2 transition-all hover:scale-110 shadow-sm",
                                                            c.bg,
                                                            state.config.textColorAccent === c.value
                                                                ? "border-white ring-2 ring-white/20 scale-110 z-10"
                                                                : "border-transparent opacity-60 hover:opacity-100"
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </SidebarControl>

                            <SidebarControl label="Descripción del Fondo" icon={ImageIcon}>
                                <div className="p-1">
                                    <textarea
                                        value={state.config.description}
                                        onChange={(e) => setState(prev => ({ ...prev, config: { ...prev.config, description: e.target.value } }))}
                                        className="w-full bg-[#161b22] border border-gray-700 rounded-lg p-3 text-white text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none h-24 resize-none transition-all placeholder:text-gray-600 shadow-inner leading-relaxed"
                                        placeholder="Describe el escenario con detalle (ej: una mansión moderna al atardecer, iluminación cinematográfica...)"
                                    />
                                </div>
                            </SidebarControl>

                            <SidebarControl label="Personajes" icon={Users}>
                                <div className="flex items-center justify-between p-3">
                                    <span className="text-xs text-gray-400 font-medium mr-4">Cantidad:</span>
                                    <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                                        {[1, 2, 3, 4, 5].map((num) => (
                                            <button
                                                key={num}
                                                onClick={() => setState(prev => ({ ...prev, config: { ...prev.config, characterCount: num } }))}
                                                className={cn(
                                                    "w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-all",
                                                    state.config.characterCount === num
                                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-105"
                                                        : "text-gray-500 hover:text-white hover:bg-white/5"
                                                )}
                                            >
                                                {num}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </SidebarControl>

                            <SidebarControl label="Composición" icon={Layout}>
                                <div className="grid grid-cols-2 gap-3 p-2">
                                    {LAYOUTS.map(l => (
                                        <button
                                            key={l.id}
                                            onClick={() => setState(prev => ({ ...prev, config: { ...prev.config, layout: l.id } }))}
                                            className={cn(
                                                "relative group flex flex-col items-center gap-2 p-2 rounded-lg border transition-all duration-200",
                                                state.config.layout === l.id
                                                    ? "bg-blue-500/10 border-blue-500 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]"
                                                    : "bg-[#0f1115] border-transparent hover:border-gray-600 hover:bg-gray-800"
                                            )}
                                        >
                                            <div className="w-full aspect-video rounded overflow-hidden bg-black/50 border border-white/5 group-hover:border-white/20 transition-colors">
                                                <LayoutPreviewIcon layout={l.id} active={state.config.layout === l.id} count={state.config.characterCount} />
                                            </div>
                                            <span className={cn(
                                                "text-[10px] uppercase tracking-wider font-semibold",
                                                state.config.layout === l.id ? "text-blue-400" : "text-gray-500 group-hover:text-gray-300"
                                            )}>
                                                {l.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </SidebarControl>

                            <SidebarControl label="Paleta de Color" icon={Palette}>
                                <div className="p-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        {PALETTES.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => setState(prev => ({ ...prev, config: { ...prev.config, palette: p.id } }))}
                                                className={cn(
                                                    "relative w-full h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 group/palette flex items-center justify-center shadow-lg",
                                                    state.config.palette === p.id
                                                        ? "border-white scale-105 shadow-[0_0_15px_rgba(255,255,255,0.2)] z-10"
                                                        : "border-transparent opacity-80 hover:opacity-100 hover:scale-105 hover:border-white/20"
                                                )}
                                            >
                                                {/* Background Layer */}
                                                <div className={cn("absolute inset-0", p.bg)} />

                                                {/* Text Preview */}
                                                <div className={cn("relative z-10 font-bold text-lg tracking-tighter", p.text)}>
                                                    Aa
                                                </div>

                                                {/* Accent Decor */}
                                                <div className={cn("absolute bottom-2 left-2 right-2 h-1 rounded-full", p.accent.replace('border-', 'bg-'))} />

                                                {/* Active Checkmark (optional, creates visual noise? keeping it simple for now) */}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-3 flex items-center justify-center h-5">
                                        <span className="text-[10px] text-gray-300 font-mono uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5 animate-fadeIn">
                                            {PALETTES.find(p => p.id === state.config.palette)?.label}
                                        </span>
                                    </div>
                                </div>
                            </SidebarControl>

                            <SidebarControl label="Información Extra" icon={Sparkles}>
                                <div className="p-2">
                                    <input
                                        type="text"
                                        value={state.config.extraInfo}
                                        onChange={(e) => setState(prev => ({ ...prev, config: { ...prev.config, extraInfo: e.target.value } }))}
                                        className="w-full bg-[#161b22] border border-gray-700 rounded-lg p-3 text-white text-xs focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-gray-600 shadow-inner"
                                        placeholder="Detalles adicionales (iluminación, estilo, cámara...)"
                                    />
                                </div>
                            </SidebarControl>
                        </>
                    ) : (
                        <>
                            {/* STAGE 2 SIDEBAR */}
                            <div className="space-y-6 animate-fadeIn">
                                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                                    <h3 className="text-sm font-medium text-gray-300 mb-2">Referencia (Stage 1)</h3>
                                    {/* Preview of the Stage 1 Result */}
                                    <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative border border-gray-700 group/ref">
                                        {state.generatedImage ? (
                                            <img src={state.generatedImage} className="w-full h-full object-cover" alt="Draft Reference" />
                                        ) : (
                                            <div className={cn("w-full h-full flex items-center justify-center", currentPalette.bg)}>
                                                <span className={cn("font-black text-xs uppercase text-center px-2", currentPalette.text)}>
                                                    {parseTitle(state.config.title)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover/ref:opacity-100 transition-opacity backdrop-blur-sm">
                                            <label className="cursor-pointer bg-white text-black px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider hover:scale-105 transition-transform flex items-center gap-2">
                                                <Upload className="w-3 h-3" /> Subir Ref
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={(e) => e.target.files?.[0] && handleReferenceUpload(e.target.files[0])}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* AI Model Selector for Stage 2 */}
                                <div className="space-y-3 p-3 bg-blue-900/10 rounded-lg border border-blue-500/20">
                                    <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Sparkles className="w-3 h-3" /> Modelo de Adaptación
                                    </h3>
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider">Modelo</label>
                                        <select
                                            value={selectedModel}
                                            onChange={(e) => setSelectedModel(e.target.value)}
                                            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                        >
                                            {modelOptions.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label} ({opt.price})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                        Usando API Key / Project ID de Etapa 1
                                    </div>
                                </div>

                                <h3 className="text-sm font-medium text-blue-400 uppercase tracking-wider">Mapeo de Personajes</h3>
                                <p className="text-[10px] text-gray-500 mb-2">Sube hasta 5 fotos por personaje para mejor referencia.</p>

                                {Array.from({ length: state.config.characterCount }).map((_, idx) => (
                                    <div key={idx} className="bg-[#0d1117] p-3 rounded-lg border border-gray-700">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-bold text-gray-300">Personaje {idx + 1}</span>
                                            <span className="text-[10px] text-gray-500">
                                                {(state.characterImages[idx] || []).length} / 5
                                            </span>
                                        </div>

                                        {/* Image Grid */}
                                        <div className="grid grid-cols-3 gap-2 mb-2">
                                            {(state.characterImages[idx] || []).map((img, i) => (
                                                <div key={i} className="relative aspect-square rounded overflow-hidden group/img">
                                                    <img src={img} className="w-full h-full object-cover" />
                                                    <button
                                                        onClick={() => removeImage(idx, i)}
                                                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                                                    >
                                                        <div className="text-red-500 font-bold text-xs">X</div>
                                                    </button>
                                                </div>
                                            ))}
                                            {/* Add Button if < 5 */}
                                            {(!state.characterImages[idx] || state.characterImages[idx].length < 5) && (
                                                <label className="flex flex-col items-center justify-center aspect-square border-2 border-gray-700 border-dashed rounded-md cursor-pointer hover:bg-gray-800/50 hover:border-blue-500/50 transition-all">
                                                    <Upload className="w-4 h-4 text-gray-500" />
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                                        if (e.target.files?.[0]) handleImageUpload(idx, e.target.files[0]);
                                                    }} />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Reusable AI Config Panel (now outside the conditional, rendered for both steps) */}
                    <div className="mb-4 space-y-3 p-3 bg-black/20 rounded-lg border border-white/5">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Sparkles className="w-3 h-3" /> Configuración IA
                        </h3>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider">
                                {projectId ? "Google Cloud Access Token" : "Gemini API Key"}
                            </label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={handleApiKeyChange}
                                placeholder={projectId ? "Pegar OAuth Access Token..." : "Pegar API Key aquí..."}
                                className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider">
                                Project ID (Opcional - Vertex AI)
                            </label>
                            <input
                                type="text"
                                value={projectId}
                                onChange={handleProjectIdChange}
                                placeholder="Ej: my-google-project-id"
                                className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-blue-500 outline-none placeholder:text-gray-600"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider">Modelo</label>
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-blue-500 outline-none"
                            >
                                {modelOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label} ({opt.price})
                                    </option>
                                ))}
                            </select>
                        </div>
                        {apiKey && (
                            <p className="text-[9px] text-gray-400 mt-1">
                                Precio est: <span className="text-green-400">{modelOptions.find(m => m.value === selectedModel)?.price}</span>
                            </p>
                        )}
                    </div>

                    {state.step === 'draft' ? (
                        <>
                            <button
                                onClick={handleGenerateDraft}
                                disabled={isGenerating}
                                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transition-all flex items-center justify-center gap-2 group border border-white/10 uppercase tracking-wider text-sm mt-4"
                            >
                                {isGenerating ? <Loader2 className="animate-spin w-5 h-5" /> : <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform fill-white/20" />}
                                {isGenerating ? 'Generando Diseño...' : 'Generar Miniatura IA'}
                            </button>

                            <button
                                onClick={handlePreviewPrompt}
                                disabled={isGenerating}
                                className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl border border-white/5 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider mt-2 group"
                            >
                                <Type className="w-4 h-4 group-hover:text-blue-400 transition-colors" />
                                Previsualizar Prompt
                            </button>

                            <button
                                onClick={handleSkipToStage2}
                                disabled={isGenerating}
                                className="w-full bg-transparent hover:bg-gray-800 text-gray-500 hover:text-gray-300 font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider mt-2 group border border-dashed border-gray-800 hover:border-gray-600"
                            >
                                <ArrowRight className="w-3 h-3" />
                                Ir a Stage 2 (Sin Imagen)
                            </button>

                            {apiError && (
                                <div className="mt-2 p-2 bg-red-900/50 border border-red-700 rounded text-red-200 text-xs text-center">
                                    {apiError}
                                </div>
                            )}

                            {state.generatedDraft && (
                                <div className="mt-4 animate-fadeIn">
                                    <div className="bg-[#0d1117] border border-green-900/50 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2 text-green-400">
                                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                                                <Sparkles className="w-3 h-3" />
                                                Prompt Generado (Debug)
                                            </div>
                                            <button
                                                onClick={handleCopyPromptToClipboard}
                                                className="hover:text-white transition-colors"
                                                title="Copiar prompt"
                                            >
                                                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                            </button>
                                        </div>
                                        <textarea
                                            readOnly
                                            value={state.generatedPrompt}
                                            className="w-full bg-black/30 text-green-300 text-[10px] font-mono p-2 rounded h-24 resize-none focus:outline-none scrollbar-thin scrollbar-thumb-green-900"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* PROMPT PREVIEW AREA (Shows up if we have a prompt but NOT a draft image yet, e.g. from Preview) */}
                            {!state.generatedDraft && state.generatedPrompt && (
                                <div className="mt-4 animate-fadeIn">
                                    <div className="bg-[#0d1117] border border-blue-900/50 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2 text-blue-400">
                                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                                                <Type className="w-3 h-3" />
                                                Previsualización del Prompt
                                            </div>
                                            <button
                                                onClick={handleCopyPromptToClipboard}
                                                className="hover:text-white transition-colors"
                                                title="Copiar prompt"
                                            >
                                                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                            </button>
                                        </div>
                                        <textarea
                                            readOnly
                                            value={state.generatedPrompt}
                                            className="w-full bg-black/30 text-blue-300 text-[10px] font-mono p-2 rounded h-24 resize-none focus:outline-none scrollbar-thin scrollbar-thumb-blue-900"
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="flex flex-col gap-2 mt-8">
                                <button
                                    onClick={handleAdaptation}
                                    disabled={adaptationLoading || adaptationDone}
                                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-2"
                                >
                                    {adaptationLoading ? <Loader2 className="animate-spin" /> : <Play className="fill-current w-5 h-5" />}
                                    {adaptationLoading ? 'Adaptando con IA...' : adaptationDone ? '¡Completado!' : 'Adaptar Personajes (IA)'}
                                </button>

                                <button
                                    onClick={handlePreviewAdaptationPrompt}
                                    disabled={adaptationLoading}
                                    className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl border border-white/5 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider mt-2 group"
                                >
                                    <Type className="w-4 h-4 group-hover:text-green-400 transition-colors" />
                                    Previsualizar Prompt
                                </button>

                                {/* STAGE 2 PROMPT PREVIEW */}
                                {state.adaptationPrompt && (
                                    <div className="mt-4 animate-fadeIn">
                                        <div className="bg-[#0d1117] border border-green-900/50 rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-2 text-green-400">
                                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                                                    <Type className="w-3 h-3" />
                                                    Prompt Adaptación
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(state.adaptationPrompt || '');
                                                        setCopied(true);
                                                        setTimeout(() => setCopied(false), 2000);
                                                    }}
                                                    className="hover:text-white transition-colors"
                                                    title="Copiar prompt"
                                                >
                                                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                </button>
                                            </div>
                                            <textarea
                                                readOnly
                                                value={state.adaptationPrompt}
                                                className="w-full bg-black/30 text-green-300 text-[10px] font-mono p-2 rounded h-24 resize-none focus:outline-none scrollbar-thin scrollbar-thumb-green-900"
                                            />
                                        </div>
                                    </div>
                                )}


                                {adaptationDone && (
                                    <button
                                        onClick={handleStage2Completion}
                                        className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl border border-white/5 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                                    >
                                        <ArrowRight className="w-4 h-4" /> Volver a Etapa 1 / Finalizar
                                    </button>
                                )}
                            </div>
                            {adaptationError && (
                                <div className="mt-2 p-2 bg-red-900/50 border border-red-700 rounded text-red-200 text-xs text-center">
                                    {adaptationError}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </aside>

            {/* Main Canvas Area */}
            <main className="flex-1 flex flex-col relative bg-[#0f1115] bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:20px_20px]">
                {/* Toolbar */}
                <header className="h-16 border-b border-gray-800 flex items-center justify-between px-8 bg-[#0f1115]/80 backdrop-blur-md sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        <span className="text-gray-500 text-sm">Proyecto: <span className="text-white font-medium">Sin Título 1</span></span>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={handleDownloadImage}
                            disabled={!state.generatedImage && !(state.step === 'adaptation' && state.adaptationImage)}
                            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Descargar Imagen"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                        <button className="text-gray-400 hover:text-white transition-colors"><Layout className="w-5 h-5" /></button>
                        <button className="text-gray-400 hover:text-white transition-colors"><ImageIcon className="w-5 h-5" /></button>
                    </div>
                </header>

                {/* Canvas Container */}
                <div className="flex-1 flex items-center justify-center p-10 overflow-hidden">

                    <div className="relative w-full max-w-5xl aspect-video shadow-2xl rounded-sm overflow-hidden border-4 border-gray-800 bg-gray-900 group">

                        {/* "AI" Simulation Layer - The rendered thumbnail or Real Generated Image */}
                        {/* "AI" Simulation Layer - Live Preview */}
                        <div className={cn("w-full h-full relative transition-all duration-1000 overflow-hidden", !state.generatedImage && currentPalette.bg)}>

                            {/* Real Generated Image */}
                            {state.generatedImage && (
                                <img
                                    src={state.generatedImage}
                                    className="absolute inset-0 w-full h-full object-cover z-0"
                                    alt="Generated Thumbnail"
                                />
                            )}

                            {/* Simulation Fallback (Blueprint Mode) */}
                            {!state.generatedImage && (
                                <>
                                    {/* Background Pattern/Texture Simulation */}
                                    <div className="absolute inset-0 opacity-30 bg-[linear-gradient(45deg,transparent_25%,rgba(0,0,0,0.2)_50%,transparent_75%,transparent_100%)] bg-[length:10px_10px]" />
                                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[length:20px_20px]" />
                                </>
                            )}

                            {/* Characters Layer */}
                            {!state.generatedImage && (
                                <div className="absolute inset-0 p-8">
                                    {Array.from({ length: state.config.characterCount }).map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={cn(
                                                "absolute border-2 border-dashed border-white/30 rounded-lg flex items-center justify-center backdrop-blur-sm transition-all duration-700",
                                                state.step === 'adaptation' && adaptationDone ? "border-none bg-transparent" : "bg-black/10",
                                                getPositionStyles(state.config.layout, idx, state.config.characterCount)
                                            )}
                                        >
                                            {state.step === 'adaptation' && adaptationDone && state.adaptationImage ? (
                                                // REALISTIC RESULT (If we had individual cutouts, but we have full image usually. 
                                                // State.adaptationImage is the FULL thumbnail refactored.
                                                // So we might hide this layer or show nothing if the background covers it.)
                                                // For now, if we have a full adaptation result, we usually display it as the MAIN background 
                                                // and hide these individual placeholders.
                                                // But if we generated clear cutouts, we'd use them.
                                                // Assuming 'adaptationImage' is the full final image, we render it at the top level (line 680).
                                                // So here we render nothing or the input ref?
                                                <div />
                                            ) : (
                                                // DRAFT / PLACEHOLDER
                                                state.step === 'adaptation' && state.characterImages[idx] && state.characterImages[idx].length > 0 ? (
                                                    <img src={state.characterImages[idx][0]} className="w-full h-full object-cover opacity-50 grayscale" alt="Draft" />
                                                ) : (
                                                    // Silhouette Placeholder
                                                    <div className="flex flex-col items-center justify-center text-white/20">
                                                        <CharacterSilhouette className="w-32 h-32 opacity-20" />
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Final Adapted Image Layer override */}
                            {state.adaptationImage && state.step === 'adaptation' && (
                                <img
                                    src={state.adaptationImage}
                                    className="absolute inset-0 w-full h-full object-cover z-20"
                                    alt="Final Adapted"
                                />
                            )}

                            {/* Text Layer */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-12">
                                <h1
                                    className={cn(
                                        "text-[6rem] leading-none font-black uppercase text-center drop-shadow-xl stroke-2 tracking-tighter break-words max-w-full z-20 transition-all duration-500",
                                        state.config.layout === 'split' && "w-1/2 ml-auto",
                                        state.config.layout === 'thirds-left' && "mr-auto pl-10 text-left",
                                        state.config.layout === 'thirds-right' && "ml-auto pr-10 text-right",
                                    )}
                                    style={{
                                        textShadow: '4px 4px 0px rgba(0,0,0,0.5)',
                                        WebkitTextStroke: '2px rgba(255,255,255,0.1)'
                                    }}
                                >
                                    {parseTitle(state.config.title)}
                                </h1>
                            </div>

                            {/* Adaptation Overlay Effect */}
                            {adaptationLoading && (
                                <div className="absolute inset-0 bg-black/60 z-50 flex flex-col items-center justify-center backdrop-blur-sm animate-pulse">
                                    <Loader2 className="w-16 h-16 text-green-500 animate-spin mb-4" />
                                    <p className="text-green-400 font-mono text-xl uppercase tracking-widest animate-bounce">Procesando IA...</p>
                                    <div className="w-64 h-1 bg-gray-800 rounded-full mt-4 overflow-hidden">
                                        <div className="h-full bg-green-500 animate-loading-bar" />
                                    </div>
                                </div>
                            )}

                        </div>

                    </div>

                    {/* Approve Button (Floating) */}
                    {
                        state.generatedDraft && state.step === 'draft' && (
                            <div className="absolute bottom-10 right-10 animate-slideUp">
                                <button
                                    onClick={handleApproveDraft}
                                    className="bg-white text-black hover:bg-gray-100 font-bold py-4 px-8 rounded-full shadow-2xl flex items-center gap-3 transition-transform hover:scale-105"
                                >
                                    <span>Aprobar Diseño y Personalizar</span>
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        )
                    }

                </div >
            </main >
        </div >
    );
}

// --- Positioning Logic ---

function getPositionStyles(layout: LayoutType, index: number, _total: number): string {
    // Simple layout engine based on index and total count
    // Returns tailwind classes for absolute positioning and dimensions

    const styles: Record<LayoutType, string[]> = {
        'centered': [
            'inset-x-[20%] bottom-0 top-[20%] z-10', // Main
            'inset-x-[5%] bottom-0 top-[30%] -z-10 scale-90 translate-x-[-30%]', // Side 1
            'inset-x-[5%] bottom-0 top-[30%] -z-10 scale-90 translate-x-[30%]', // Side 2
            'inset-x-[10%] bottom-0 top-[40%] -z-20 scale-75 translate-x-[-50%]', // Back 1
            'inset-x-[10%] bottom-0 top-[40%] -z-20 scale-75 translate-x-[50%]', // Back 2
        ],
        'thirds-left': [
            'left-[10%] bottom-0 top-[10%] width-[40%] z-10',
            'left-[5%] bottom-0 top-[20%] width-[30%] -z-10',
            'left-[20%] bottom-0 top-[20%] width-[30%] -z-10',
            'left-[0%] bottom-0 top-[30%] width-[30%] -z-20',
            'left-[35%] bottom-0 top-[30%] width-[30%] -z-20',
        ],
        'thirds-right': [
            'right-[10%] bottom-0 top-[10%] width-[40%] z-10',
            'right-[5%] bottom-0 top-[20%] width-[30%] -z-10',
            'right-[20%] bottom-0 top-[20%] width-[30%] -z-10',
            'right-[0%] bottom-0 top-[30%] width-[30%] -z-20',
            'right-[35%] bottom-0 top-[30%] width-[30%] -z-20',
        ],
        'vs': [
            'left-[5%] bottom-0 top-[10%] w-[45%] -skew-x-6 border-r-4 border-red-500 z-10',
            'right-[5%] bottom-0 top-[10%] w-[45%] skew-x-6 z-10',
            'inset-[30%] opacity-50 z-0',
            'inset-[30%] opacity-50 z-0',
            'inset-[30%] opacity-50 z-0',
        ],
        'reaction': [
            'right-0 bottom-0 w-[40%] h-[50%] z-20 rounded-tl-3xl border-t-4 border-l-4 border-white shadow-2xl',
            'inset-0 z-0 opacity-50 scale-110', // Background content
            'inset-0 z-0 opacity-50',
            'inset-0 z-0 opacity-50',
            'inset-0 z-0 opacity-50',
        ],
        'group': [
            'left-[50%] -translate-x-1/2 bottom-0 top-[15%] w-[30%] z-30',
            'left-[25%] bottom-0 top-[20%] w-[25%] z-20',
            'right-[25%] bottom-0 top-[20%] w-[25%] z-20',
            'left-[10%] bottom-0 top-[30%] w-[20%] z-10',
            'right-[10%] bottom-0 top-[30%] w-[20%] z-10',
        ],
        'perspective': [
            'inset-x-[30%] bottom-0 top-[10%] z-30 scale-125 origin-bottom',
            'inset-x-[10%] bottom-[20%] top-[40%] z-20 opacity-80',
            'inset-x-[60%] bottom-[20%] top-[40%] z-20 opacity-80',
            'inset-x-[40%] bottom-[40%] top-[50%] z-10 opacity-60',
            'inset-x-0 bottom-[40%] top-[50%] z-10 opacity-60',
        ],
        'brainstorm': [
            'inset-[25%] z-10 rounded-full border border-white/20',
            'top-0 left-0 w-[30%] h-[40%]',
            'top-0 right-0 w-[30%] h-[40%]',
            'bottom-0 left-0 w-[30%] h-[40%]',
            'bottom-0 right-0 w-[30%] h-[40%]',
        ],
        'split': [
            'left-0 inset-y-0 w-[50%] border-r-2 border-white',
            'right-0 inset-y-0 w-[50%]',
            'hidden',
            'hidden',
            'hidden',
        ],
        'silhouette': [
            'inset-x-[20%] bottom-0 top-[20%] grayscale brightness-0 contrast-200 z-20',
            'inset-x-[5%] bottom-0 top-[30%] grayscale brightness-0 contrast-200 z-10 opacity-80',
            'inset-x-[60%] bottom-0 top-[30%] grayscale brightness-0 contrast-200 z-10 opacity-80',
            'hidden',
            'hidden',
        ]
    };

    const layoutStyles = styles[layout] || styles['centered'];
    // Fallback if index out of bounds
    return layoutStyles[index] || 'hidden';
}

