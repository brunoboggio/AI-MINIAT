export type LayoutType =
    | 'centered' | 'thirds-left' | 'thirds-right' | 'vs' | 'reaction'
    | 'group' | 'perspective' | 'brainstorm' | 'split' | 'silhouette';

export type PaletteType =
    | 'vibrant' | 'dark' | 'pastel' | 'neon' | 'warm'
    | 'cold' | 'monochrome' | 'retro' | 'nature' | 'luxury';

export interface ThumbnailConfig {
    title: string;
    description: string;
    characterCount: number;
    layout: LayoutType;
    palette: PaletteType;
    extraInfo: string;
    textColorBase: string;
    textColorAccent: string;
}
