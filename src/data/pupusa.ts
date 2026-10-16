export type MasaType = 'maiz' | 'arroz';

export type PupusaTypeId =
  | 'fq'
  | 'queso'
  | 'ql'
  | 'frijol'
  | 'revuelta'
  | 'chicharron'
  | 'qa'
  | 'qj'
  | 'qchip'
  | 'qajo'
  | 'fchip'
  | 'rchip'
  | 'qespinaca'
  | 'fqloroco'
  | 'chicharronloroco'
  | 'fqchip'
  | 'camaron'
  | 'frijolchorizo'
  | 'quesobacon';

export interface PupusaType {
  id: PupusaTypeId;
  code: string;
  name: string;
  description: string;
}

export type BillingMethod = 'single' | 'split' | 'groups';

export interface AccountGroup {
  id: string;
  name: string;
  personIds: string[];
}

export interface PupusaItem {
  id: string;
  pupusaTypeId: PupusaTypeId;
  masa: MasaType;
  quantity: number;
}

/** Bebida o extra con precio propio (horchata, café, curtido extra…). */
export interface ExtraItem {
  id: string;
  label: string;
  priceCents: number;
  quantity: number;
}

/** Una persona de la pupuseada y lo que pidió. `id` es un UUID estable. */
export interface PersonOrder {
  id: string;
  name: string;
  items: PupusaItem[];
  extras?: ExtraItem[];
}

export interface PlaceLocation {
  lat: number;
  lng: number;
}

export interface PlaceRestaurant {
  id: string;
  name: string;
  address: string;
  locality?: string;
  rating?: number;
  reviewCount?: number;
  distanceKm?: number;
  openNow?: boolean;
  hours?: string;
  location?: PlaceLocation;
  placeId: string;
}

export const PUPUSA_TYPES: PupusaType[] = [
  { id: 'fq', code: 'F/Q', name: 'Frijol con Queso', description: 'Frijol y queso' },
  { id: 'queso', code: 'Q', name: 'Queso', description: 'Solo queso' },
  { id: 'ql', code: 'Q/L', name: 'Queso con Loroco', description: 'Queso y loroco' },
  { id: 'frijol', code: 'F', name: 'Frijol', description: 'Solo frijol' },
  { id: 'revuelta', code: 'Revuelta', name: 'Revuelta', description: 'Frijol, queso y chicharrón' },
  { id: 'chicharron', code: 'Chicharrón', name: 'Chicharrón', description: 'Chicharrón y queso' },
  { id: 'qa', code: 'Q/A', name: 'Queso con Ayote', description: 'Queso y ayote' },
  { id: 'qj', code: 'Q/J', name: 'Queso con Jalapeño', description: 'Queso y jalapeño' },
  { id: 'qchip', code: 'Q/Chip', name: 'Queso con Chipilín', description: 'Queso y chipilín' },
  { id: 'qajo', code: 'Q/Ajo', name: 'Queso con Ajo', description: 'Queso y ajo' },
  { id: 'fchip', code: 'F/Chip', name: 'Frijol con Chipilín', description: 'Frijol y chipilín' },
  { id: 'rchip', code: 'R/Chip', name: 'Revuelta con Chipilín', description: 'Revuelta y chipilín' },
  { id: 'qespinaca', code: 'Q/Esp', name: 'Queso con Espinaca', description: 'Queso y espinaca' },
  { id: 'fqloroco', code: 'F/Q/L', name: 'Frijol con Queso y Loroco', description: 'Frijol, queso y loroco' },
  { id: 'chicharronloroco', code: 'Ch/L', name: 'Chicharrón con Loroco', description: 'Chicharrón, queso y loroco' },
  { id: 'fqchip', code: 'F/Q/Chip', name: 'Frijol con Queso y Chipilín', description: 'Frijol, queso y chipilín' },
  { id: 'camaron', code: 'Camarón', name: 'Camarón', description: 'Camarón y queso' },
  { id: 'frijolchorizo', code: 'F/Chor', name: 'Frijol con Chorizo', description: 'Frijol y chorizo' },
  { id: 'quesobacon', code: 'Q/Bacon', name: 'Queso con Bacon', description: 'Queso y bacon' },
];

export const PUPUSA_BY_ID: Record<PupusaTypeId, PupusaType> = PUPUSA_TYPES.reduce(
  (acc, p) => {
    acc[p.id] = p;
    return acc;
  },
  {} as Record<PupusaTypeId, PupusaType>
);

export const MASA_LABEL: Record<MasaType, string> = {
  maiz: 'Maíz',
  arroz: 'Arroz',
};

export const MASA_EMOJI: Record<MasaType, string> = {
  maiz: '🌽',
  arroz: '🍚',
};
