export const state = {
  machine:       'creality-falcon5w',
  material:      'wood',
  color:         'medium',
  mode:          'engrave',   // 'engrave' | 'cut' | 'vector'
  thickness:     '3mm',       // '3mm' | '6mm'
  contrast:      1.2,
  brightness:    0,
  threshold:     128,
  edgeThreshold: 20,
  dither:        true,
  invert:        false,
  originalSrc:   null,
  processedSrc:  null,
  svgSrc:        null,
  activeTab:     'original',
  outputWidth:   0,
  outputHeight:  0,
  pathCount:     0,
}
