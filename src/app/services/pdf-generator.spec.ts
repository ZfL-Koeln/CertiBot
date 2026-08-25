import { hexToRgb } from './pdf-generator';

describe('hexToRgb', () => {
  it('parses #005179 to 0..1 components', () => {
    const { r, g, b } = hexToRgb('#005179');
    expect(r).toBeCloseTo(0, 5);
    expect(g).toBeCloseTo(0x51 / 255, 5);
    expect(b).toBeCloseTo(0x79 / 255, 5);
  });

  it('accepts hex without leading #', () => {
    expect(hexToRgb('ffffff')).toEqual({ r: 1, g: 1, b: 1 });
  });

  it('throws on invalid input', () => {
    expect(() => hexToRgb('nope')).toThrowError(/Invalid hex/);
  });
});
