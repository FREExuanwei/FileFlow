import { validateDimensions } from './dimensions';
export function resizeDimensions(originalWidth: number, originalHeight: number, width?: number, height?: number, keepAspect = true) {
  validateDimensions(originalWidth, originalHeight);
  if (width !== undefined && (!Number.isInteger(width) || width < 1)) validateDimensions(width, 1);
  if (height !== undefined && (!Number.isInteger(height) || height < 1)) validateDimensions(1, height);
  let w = width ?? originalWidth, h = height ?? originalHeight;
  if (keepAspect) {
    if (width !== undefined) h = Math.max(1, Math.round(w * originalHeight / originalWidth));
    else if (height !== undefined) w = Math.max(1, Math.round(h * originalWidth / originalHeight));
  }
  validateDimensions(w, h);
  return { width: w, height: h };
}
