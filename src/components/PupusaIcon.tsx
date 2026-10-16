import { PupusaTypeId } from '@/data/pupusa';

interface Props {
  type: PupusaTypeId;
  className?: string;
}

const COLORS: Record<PupusaTypeId, string> = {
  fq: '#C96A3D',
  queso: '#E9B196',
  ql: '#A9BC73',
  frijol: '#6B3018',
  revuelta: '#8E4020',
  chicharron: '#DC8A60',
  qa: '#D49540',
  qj: '#8AA24F',
  qchip: '#A9BC73',
  qajo: '#C9D49E',
  fchip: '#6E8239',
  rchip: '#8E4020',
  qespinaca: '#6E8239',
  fqloroco: '#C96A3D',
  chicharronloroco: '#B0542B',
  fqchip: '#8AA24F',
  camaron: '#DC8A60',
  frijolchorizo: '#8E4020',
  quesobacon: '#C96A3D',
};

export function PupusaIcon({ type, className = 'w-10 h-10' }: Props) {
  const color = COLORS[type];
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <ellipse cx="24" cy="25" rx="19" ry="15" fill={color} opacity="0.18" />
      <ellipse cx="24" cy="24" rx="17" ry="13" fill={color} />
      <ellipse cx="24" cy="23" rx="14" ry="10.5" fill="#FAF4EA" opacity="0.25" />
      <ellipse cx="24" cy="24" rx="12" ry="8.5" fill="none" stroke={color} strokeWidth="1.2" opacity="0.4" />
      <circle cx="19" cy="22" r="1.6" fill="#FAF4EA" opacity="0.7" />
      <circle cx="27" cy="25" r="1.3" fill="#FAF4EA" opacity="0.7" />
      <circle cx="22" cy="27" r="1.1" fill="#FAF4EA" opacity="0.6" />
      <circle cx="29" cy="21" r="1" fill="#FAF4EA" opacity="0.6" />
    </svg>
  );
}
