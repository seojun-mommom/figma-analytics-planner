function createPaint(r: number, g: number, b: number, opacity = 1): readonly SolidPaint[] {
  return [{
    blendMode: 'NORMAL',
    color: { r, g, b },
    opacity,
    type: 'SOLID',
    visible: true
  }];
}

export const COLORS = {
  BRAND: createPaint(255 / 255, 110 / 255, 18 / 255),       // #FE6E12
  TEXT: createPaint(26 / 255, 26 / 255, 26 / 255),          // #1a1a1a
  GRAY: createPaint(107 / 255, 114 / 255, 128 / 255),       // #6b7280
  LIGHT_GRAY: createPaint(229 / 255, 231 / 255, 235 / 255), // #e5e7eb
  WHITE: createPaint(1, 1, 1),
};
