// Preferências por aparelho no localStorage. Pode falhar (aba anônima, armazenamento bloqueado),
// então toda leitura e escrita é protegida e o app funciona sem elas.

const PREFIX = 'onlemu:';

export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // Sem armazenamento: a preferência só vale nesta sessão.
  }
}
