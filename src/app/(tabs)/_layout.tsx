import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

export default function TabsLayout() {
  const colors = useTheme();
  const t = useT();

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      tintColor={colors.link}
      iconColor={{ default: colors.textSecondary, selected: colors.link }}
      indicatorColor={colors.surfaceMuted}
      labelStyle={{ default: { color: colors.textSecondary }, selected: { color: colors.link } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t.tabs.process}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" md="account_tree" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="scanner">
        <NativeTabs.Trigger.Label>{t.tabs.scanner}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="doc.viewfinder" md="document_scanner" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="projets">
        <NativeTabs.Trigger.Label>{t.tabs.projects}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="folder" md="folder" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="reglages">
        <NativeTabs.Trigger.Label>{t.tabs.settings}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="slider.horizontal.3" md="tune" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
