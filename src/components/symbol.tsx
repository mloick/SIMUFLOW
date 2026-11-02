import { SymbolView as ExpoSymbolView, type SymbolViewProps } from 'expo-symbols';

export type { SymbolViewProps };

/**
 * Icône système : SF Symbols sur iOS, Material Symbols sur Android et sur le
 * web. `expo-symbols` cherche une clé `web` dans le nom ; sans elle, rien ne
 * s'affiche dans le navigateur. On reprend donc le nom Android, la même police
 * Material Symbols, quand `web` n'est pas donné.
 */
export function SymbolView({ name, ...props }: SymbolViewProps) {
  const withWeb = typeof name === 'object' && name.web === undefined ? { ...name, web: name.android } : name;
  return <ExpoSymbolView name={withWeb} {...props} />;
}
