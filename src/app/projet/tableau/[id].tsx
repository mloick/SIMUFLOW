import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSession } from '@/backend/auth';
import { ProjectDashboard, type DashboardItem } from '@/components/project-dashboard';
import { StateMessage } from '@/components/state-message';
import { getCloudId, useImportedProcesses } from '@/data/process-store';
import { useAllProjects } from '@/data/project-view';
import { useSharedProcesses } from '@/data/shared-store';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * Tableau de bord d'un projet, ouvert depuis l'écran du projet : toute
 * l'équipe voit où en est la relecture de chaque process du projet (les miens
 * et ceux de l'équipe).
 */
export default function DashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const t = useT();
  const session = useSession();
  const view = useAllProjects().find((item) => item.project.id === id);
  const imported = useImportedProcesses();
  const shared = useSharedProcesses();
  const items = useMemo(
    (): DashboardItem[] => [
      ...imported
        .filter((process) => process.projectId === id)
        .map((process) => ({ process, cloudId: getCloudId(process.id) })),
      ...shared
        .filter((item) => item.process.projectId === id)
        .map((item) => ({
          process: item.process,
          cloudId: item.cloudId,
          sharedBy: item.ownerName,
        })),
    ],
    [imported, shared, id],
  );

  let body;
  if (!view) {
    body = (
      <StateMessage
        icon={{ ios: 'folder.badge.questionmark', android: 'folder_off' }}
        tone="danger"
        title={t.projects.notFound}
        message={t.projects.notFoundText}
        action={{ label: t.projects.back, onPress: () => router.back() }}
      />
    );
  } else if (session === null) {
    body = (
      <StateMessage
        icon={{ ios: 'person.2', android: 'group' }}
        tone="primary"
        title={t.share.signInRequired}
        message={t.dashboard.signInText}
        action={{
          label: t.share.signIn,
          onPress: () => router.push('/connexion'),
        }}
      />
    );
  } else {
    body = <ProjectDashboard projectName={view.project.name} items={items} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: '',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
        }}
      />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
