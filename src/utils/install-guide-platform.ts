import type { InstallPlatform } from './install-guide';

/** Sur téléphone, SimuFlow est déjà une app installée : pas de guide (voir install-guide-platform.web.ts). */
export function installPlatform(): InstallPlatform | null {
  return null;
}
