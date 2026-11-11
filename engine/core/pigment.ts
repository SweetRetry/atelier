// Pigment mixing, Kubelka-Munk with one K/S value per linear RGB channel.
// Linear interpolation of K/S is how absorbing paint mixes, so blue and yellow make green instead of grey.
// Three bands is coarse. Mixtures come out darker and less saturated than real paint. A spectral model can replace enc/dec later.

export const toLin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

const LUT = new Uint8Array(4097);
for (let i = 0; i <= 4096; i++) {
  const v = i / 4096;
  LUT[i] = Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
}
/** Linear 0..1 to sRGB byte. */
export const linToByte = (v: number) => LUT[v <= 0 ? 0 : v >= 1 ? 4096 : (v * 4096) | 0]!;

/** Reflectance 0..1 to K/S. */
export const ksEnc = (r: number) => {
  r = r < 0.004 ? 0.004 : r > 0.996 ? 0.996 : r;
  return ((1 - r) * (1 - r)) / (2 * r);
};
/** K/S to reflectance. */
export const ksDec = (k: number) => 1 + k - Math.sqrt(k * k + 2 * k);
