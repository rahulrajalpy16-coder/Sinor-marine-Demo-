/** Intro reveal progress shared between the camera timeline and the materials (0 → holographic, 1 → steady). */
export const reveal = {
  value: 1,
  set(v: number) {
    this.value = Math.max(0, Math.min(1, v));
  },
};
