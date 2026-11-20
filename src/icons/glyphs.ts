/**
 * Hand-drawn 24×24 line glyphs used inside the two-layer icon plates.
 * Every glyph only uses stroke (no fills) so it stays crisp from 16px to 128px
 * and looks identical to the reference icon sheet.
 */
export const GLYPHS: Record<string, string> = {
  house:
    '<path d="M3.5 10.8 12 3.8l8.5 7"/><path d="M5.6 9.6V20h12.8V9.6"/><path d="M9.8 20v-5.2h4.4V20"/>',
  shop:
    '<path d="M3.6 4.2h2.1l2.2 10.9h9.5l2-7.4H7.1"/><circle cx="9.4" cy="18.8" r="1.5"/><circle cx="16.9" cy="18.8" r="1.5"/>',
  road:
    '<path d="M7.2 3.4 5.1 20.6"/><path d="M16.8 3.4l2.1 17.2"/><path d="M12 5.6v2.6M12 11v2.6M12 16.4v2.8"/>',
  trail:
    '<circle cx="13.6" cy="4.6" r="1.9"/><path d="M9.2 21l2.2-5.4 2.7 2 .9 3.4"/><path d="M11.4 15.6 9.7 10.9l3.1-1.7 2.4 3 2.9 1"/>',
  nature:
    '<path d="M12 2.9 6.4 10.4h3.2L4.9 17.4h14.2l-4.7-7h3.2z"/><path d="M12 17.4V21.2"/>',
  fence:
    '<path d="M3.8 8.8h16.4M3.8 15.2h16.4"/><path d="M7 5.2V20M12 3.6V20M17 5.2V20"/>',
  poi:
    '<path d="M12 21.2s6.6-6.2 6.6-10.7A6.6 6.6 0 0 0 5.4 10.5c0 4.5 6.6 10.7 6.6 10.7z"/><circle cx="12" cy="10.2" r="2.3"/>',
  hazard:
    '<path d="M12 3.8 21.2 19.9H2.8z"/><path d="M12 9.1v4.6"/><path d="M12 16.7v.02"/>',
  public:
    '<path d="M3.4 20.6h17.2"/><path d="M5.8 20.6v-9.4M9.9 20.6v-9.4M14.1 20.6v-9.4M18.2 20.6v-9.4"/><path d="M3.6 10.9 12 4.6l8.4 6.3z"/>',
  cross:
    '<path d="M10.2 3.7h3.6v6.4h6.4v3.6h-6.4v6.4h-3.6v-6.4H3.8v-3.6h6.4z"/>',
  cafe:
    '<path d="M4.8 8.2h11.1v5.6a5.5 5.5 0 0 1-11.1 0z"/><path d="M15.9 9.6h1.7a2.8 2.8 0 0 1 0 5.6h-1.7"/><path d="M4 20.4h12.7"/>',
  water:
    '<path d="M12 3.3c3.7 4.5 5.7 7.5 5.7 10a5.7 5.7 0 0 1-11.4 0c0-2.5 2-5.5 5.7-10z"/>',
  school:
    '<path d="M2.7 8.9 12 4.6l9.3 4.3-9.3 4.3z"/><path d="M6.3 11.1v6.1c0 1.4 2.5 2.5 5.7 2.5s5.7-1.1 5.7-2.5v-6.1"/>',
  church:
    '<path d="M12 2.6v4.2M10 4.7h4"/><path d="M6.4 20.6V12l5.6-4.1 5.6 4.1v8.6z"/><path d="M10.2 20.6v-3.9h3.6v3.9"/>',
  bench:
    '<path d="M4 9.2h16M4 13.4h16"/><path d="M6.6 13.4V20.4M17.4 13.4V20.4"/><path d="M6.6 9.2V5.2M17.4 9.2V5.2"/>',
  lamp:
    '<path d="M8.2 21h7.6"/><path d="M12 21V7.6"/><path d="M9.1 7.6h5.8"/><circle cx="12" cy="5" r="1.9"/>',
  camera:
    '<rect x="3" y="7.1" width="12.9" height="10" rx="2.6"/><path d="M15.9 11.6 21 8.5v7.2l-5.1-3.1z"/>',
  trash:
    '<path d="M4.4 6.4h15.2"/><path d="M9.5 6.4V4.4h5v2"/><path d="M6.4 6.4 7.5 20.1h9l1.1-13.7"/><path d="M10.4 10v6.2M13.6 10v6.2"/>',
  atm:
    '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="3.2"/><path d="M8 16.6 12 7.8l4 8.8"/><path d="M9.7 13.6h4.6"/>',
  parking:
    '<rect x="4" y="3.4" width="16" height="17.2" rx="3.4"/><path d="M9.7 17V7.3h3.5a3 3 0 0 1 0 6H9.7"/>',
  star:
    '<path d="M12 3 14.7 9.4 21.2 10.2 16.4 14.6 17.8 21.1 12 17.7 6.2 21.1 7.6 14.6 2.8 10.2 9.3 9.4z"/>',
  note:
    '<path d="M5.6 4.4h9.2l4 4v11.2H5.6z"/><path d="M14.8 4.4v4.2h4.2"/><path d="M8.7 12.4h6.6M8.7 15.9h4.3"/>',
  crane:
    '<path d="M3.4 17.6h17.2"/><path d="M5.2 17.6V9.4h9.4v8.2"/><path d="M14.6 9.4 20.4 4.4"/><path d="M8.2 17.6v-4h3.4v4"/>',
  antenna:
    '<path d="M7 21.2 12 2.9l5 18.3"/><path d="M9 14.2h6"/><path d="M10.2 8.6h3.6"/>',
  photo:
    '<rect x="3" y="5.6" width="18" height="12.9" rx="2.6"/><circle cx="8.4" cy="10.4" r="1.6"/><path d="M4.6 16.4 9.4 12l3.5 3.2 2.4-2 4.1 4"/>',
  shield:
    '<path d="M12 3.3 19.6 6v6c0 4.2-3.1 7.6-7.6 8.9C7.5 19.6 4.4 16.2 4.4 12V6z"/><path d="M8.8 12.2l2.3 2.4 4.2-4.6"/>',
  gate:
    '<path d="M4 20.6V8.2M20 20.6V8.2"/><path d="M4 8.2h16"/><path d="M7 11.4v9.2M11 11.4v9.2M15 11.4v9.2M19 11.4v9.2"/>',
  tree:
    '<path d="M12 20.6v-4.2"/><circle cx="12" cy="9.6" r="5.4"/><path d="M9.4 12.4 12 15l2.6-2.6"/>',
  glass: '<path d="M5.6 4.4h12.8l-1.2 8.8a5.2 5.2 0 0 1-10.4 0z"/><path d="M12 13.6V20.2M9 20.6h6"/>',
  cube:
    '<path d="M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6z"/><path d="M4 7.6 12 12l8-4.4M12 12v8.8"/>',
  dot: '<circle cx="12" cy="12" r="4.6"/>',
}

export type GlyphId = keyof typeof GLYPHS
