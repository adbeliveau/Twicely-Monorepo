export const LOCAL_HANDLING_FLAGS = [
  'NEEDS_VEHICLE',
  'NEEDS_HELP',
  'NEEDS_DISASSEMBLY',
  'NEEDS_EQUIPMENT',
] as const;

export type LocalHandlingFlag = (typeof LOCAL_HANDLING_FLAGS)[number];

export const HANDLING_FLAG_LABELS: Record<LocalHandlingFlag, string> = {
  NEEDS_VEHICLE: "Buyer must bring own transport (won't fit in standard car)",
  NEEDS_HELP: 'Loading help required (heavy/bulky — bring someone)',
  NEEDS_DISASSEMBLY: 'Disassembly required before transport',
  NEEDS_EQUIPMENT: 'Special equipment needed (dolly, straps, etc.)',
};

export const HANDLING_FLAG_SHORT_LABELS: Record<LocalHandlingFlag, string> = {
  NEEDS_VEHICLE: 'Needs vehicle',
  NEEDS_HELP: 'Help needed',
  NEEDS_DISASSEMBLY: 'Disassembly required',
  NEEDS_EQUIPMENT: 'Equipment needed',
};
