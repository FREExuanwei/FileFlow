import { safeOutputName } from '../files/names';
export function renameOutput(base: string, extension: string) {
  const stem = base.trim();
  const controls = [...stem].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
  if (!stem || stem.length > 120 || controls || /[<>:"/\\|?*\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(stem) || /[. ]$/.test(stem) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) throw new Error('Choose a valid file name without paths, reserved names or special characters (maximum 120 characters).');
  return safeOutputName(`${stem}.${extension}`, extension);
}
