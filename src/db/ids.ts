import { getRandomBytes } from 'expo-crypto';
import { v7 } from 'uuid';

export function newId(): string {
  return v7({ random: getRandomBytes(16) });
}
