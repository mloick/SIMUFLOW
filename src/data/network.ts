/**
 * Le téléphone a-t-il accès à Internet ? Lu par expo-network, qui suit les
 * changements (Wi-Fi coupé, mode avion…). `undefined` tant que ce n'est pas connu.
 */

import { useNetworkState } from 'expo-network';

export function useOnline(): boolean | undefined {
  const network = useNetworkState();
  if (network.isConnected === false || network.isInternetReachable === false) return false;
  if (network.isConnected === undefined) return undefined;
  return true;
}
