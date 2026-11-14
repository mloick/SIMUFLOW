// Remplace `expo-sqlite/localStorage/install` dans les tests : la base SQLite
// du téléphone n'existe pas ici, un dictionnaire en mémoire joue `localStorage`.
const values = new Map();
if (!globalThis.localStorage) {
  globalThis.localStorage = {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}
