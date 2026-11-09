export const USE_VERSION_MANAGEMENT_MOCK = false;

export const CLASS_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  PASS: 'Pass',
  F01: 'Buoyancy',
  F02: 'Poor fit',
  F03: 'Clamping abnormality',
  F04: 'Angled lock',
  F05: 'Slipped teeth',
  F06: 'Slipping bit',
  F07: 'Missing screw',
  F08: 'Idling',
  F09: 'Cross threading',
  F10: 'Thread damage',
  F11: 'Head damage',
  F12: 'Bit slip',
  F13: 'Material defect',
  F14: 'Other',
};

export function classCategory(code: string): string {
  const name = CLASS_DISPLAY_NAMES[code];
  return name === undefined ? code : `${code} ${name}`;
}
