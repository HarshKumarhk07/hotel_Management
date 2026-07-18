import { customAlphabet } from 'nanoid';

// Unambiguous uppercase alphanumerics (no 0/O/1/I) for human-readable codes.
const nano = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 8);

/** Generate a human-friendly, collision-resistant order number, e.g. ORD-7K2P9QXM. */
export function generateOrderNumber(): string {
  return `ORD-${nano()}`;
}
