/**
 * Generates a deterministic, accessible color for a given speaker name using OKLCH.
 * OKLCH (Oklab LCh) is a perceptually uniform color space that allows for
 * consistent lightness and chroma while rotating hue.
 * 
 * @param name - The name of the speaker
 * @returns An object containing the CSS color string and a complementary/contrast color if needed.
 */
export function getSpeakerColor(name: string): string {
    if (!name) return "oklch(70% 0.14 0)"; // Default fallback

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    // OKLCH params
    // L (Lightness): 65% - 75% for readable, vibrant pastel-ish tones
    // C (Chroma): 0.12 - 0.18 for enough saturation but not neon
    // H (Hue): 0 - 360 derived from hash

    const hue = Math.abs(hash % 360);
    const lightness = 70; // Fixed for consistency
    const chroma = 0.14;  // Fixed for consistency

    return `oklch(${lightness}% ${chroma} ${hue})`;
}

/**
 * Returns a semi-transparent background version of the speaker color.
 */
export function getSpeakerBackground(name: string): string {
    const color = getSpeakerColor(name);
    // HACK: OKLCH transparency isn't universally supported in all Tailwind utility contexts easily 
    // without defining vars, but we can wrap it if using modern CSS. 
    // However, for simplicity and broad compatibility if OKLCH is valid CSS color:
    // We can just rely on opacity in the component, OR return a slightly modified lightness/alpha.

    // Actually, let's just use the raw color and let the UI apply opacity via className="bg-[color]/20" 
    // IF we were using Tailwind variables. Since we are returning a raw string, we might need a 
    // different strategy for backgrounds if we want exact matching.

    // For now, let's stick to returning the solid color and handling opacity in styles 
    // or using `color-mix` if supported.
    return `color-mix(in oklab, ${color}, transparent 80%)`;
}
