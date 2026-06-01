/**
 * Validates if a string is a valid EVM bytes32 hex string (0x followed by 64 hex chars)
 */
export const isBytes32Hex = (id: string): boolean => {
  return /^0x[a-fA-F0-9]{64}$/.test(id);
};

/**
 * Shortens an address or ID for display
 */
export const shortenId = (id: string, chars = 6): string => {
  if (id.length <= chars * 2 + 2) return id;
  return `${id.slice(0, chars + 2)}...${id.slice(-chars)}`;
};


