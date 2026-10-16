/** Recuerda el nombre de quien usa este teléfono, para no pedirlo cada vez. */
const NAME_KEY = 'pupusastime:my-name';

export function rememberedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function rememberName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name.trim());
  } catch {
    // Sin almacenamiento: no pasa nada.
  }
}
