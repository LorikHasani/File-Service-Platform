import type { Service, ToolType } from '@/types/database';

/**
 * The price a given client pays for a service.
 * Slave clients pay slave_price; when that isn't set we fall back to the
 * master (base) price so nothing ever charges €0 by accident. Master clients
 * (the default) always pay base_price.
 */
export function priceFor(
  service: Pick<Service, 'base_price' | 'slave_price'>,
  toolType: ToolType | null | undefined
): number {
  if (toolType === 'slave') {
    return service.slave_price ?? service.base_price;
  }
  return service.base_price;
}
