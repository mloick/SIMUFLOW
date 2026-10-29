import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, G, Marker, Path, Polygon, Rect, Text as SvgText, TSpan } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { StepKind } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { midpoint, offsetPolyline, type DiagramLayout, type DiagramNode, type Point } from '@/simulation/layout';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const MIN_SCALE = 0.3;
const MAX_SCALE = 2;
const READABLE_SCALE = 0.8;
/** Écart entre les traits de deux familles sur une même flèche. */
const FAMILY_GAP = 4.5;
/** Sur le web, le texte SVG serait sinon dans une police à empattements. */
const FONT = Platform.select({
  web: 'Inter, system-ui, sans-serif',
  default: undefined,
});

export type DiagramProgress = {
  /** Étapes déjà parcourues : elles sont dessinées. */
  visitedSteps: Set<string>;
  /** Flèches déjà empruntées : en bleu. */
  visitedLinks: Set<string>;
  /** Étape en cours : entourée, avec un halo qui pulse. */
  currentId?: string;
  /** Sorties possibles depuis l'étape en cours : en pointillés, avec leur étape d'arrivée en fantôme. */
  candidateLinks: string[];
};

/** Trait d'une famille sur une flèche. */
export type FamilyStroke = { color: string; bold: boolean };

/**
 * Vue « Tous les cas » : tout le schéma est dessiné. Une flèche empruntée par
 * plusieurs familles a un trait de chaque couleur, côte à côte, comme un plan
 * de métro. Les flèches qu'aucun chemin n'emprunte sont en pointillés.
 */
export type DiagramOverview = {
  /** Traits de chaque flèche ; « bold » pour le chemin critique. */
  strokes: Map<string, FamilyStroke[]>;
  /** Famille isolée : ce qui n'en fait pas partie est estompé. */
  dimmedSteps?: Set<string>;
  dimmedLinks?: Set<string>;
};

/**
 * Schéma du process qui se construit pendant la simulation : seules les étapes
 * parcourues sont dessinées, et les sorties possibles apparaissent en
 * pointillés. La vue suit l'étape en cours ; les boutons − et + zooment.
 * Avec `overview`, tout le schéma est dessiné en couleurs (vue « Tous les cas »).
 */
export function ProcessDiagram({
  layout,
  progress,
  overview,
  height = 260,
  accessibilityLabel,
}: {
  layout: DiagramLayout;
  progress?: DiagramProgress;
  overview?: DiagramOverview;
  height?: number;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const vertical = useRef<ScrollViewInstance>(null);
  const horizontal = useRef<ScrollViewInstance>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);

  const fitScale = frameWidth > 0 ? clamp(Math.min(1, (frameWidth - Spacing.two) / layout.width)) : 1;
  // Par défaut, le schéma reste lisible (au moins 80 %) et la vue suit l'étape
  // en cours ; « Tout » le fait tenir en largeur.
  // La vue d'ensemble commence en largeur entière.
  const [fitAll, setFitAll] = useState(overview !== undefined);
  const scale = zoom ?? (fitAll ? fitScale : Math.max(fitScale, READABLE_SCALE));

  // La vue se centre sur l'étape en cours.
  const current = progress?.currentId ? layout.nodes.get(progress.currentId) : undefined;
  useEffect(() => {
    if (!current || frameWidth === 0) return;
    const animated = !reduceMotion;
    horizontal.current?.scrollTo({
      x: Math.max(0, (current.x + current.width / 2) * scale - frameWidth / 2),
      animated,
    });
    vertical.current?.scrollTo({
      y: Math.max(0, (current.y + current.height / 2) * scale - height / 2),
      animated,
    });
  }, [current, scale, frameWidth, height, reduceMotion]);

  const candidates = new Set(progress?.candidateLinks);
  const ghosts = new Set(
    layout.edges
      .filter((edge) => candidates.has(edge.id) && !progress?.visitedSteps.has(edge.to))
      .map((edge) => edge.to),
  );
  // Une pointe de flèche par couleur utilisée.
  const arrowColors = new Set([
    theme.primary,
    theme.textSecondary,
    ...[...(overview?.strokes.values() ?? [])].flat().map((item) => item.color),
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.title}>
          Schéma
        </ThemedText>
        <ToolButton label="−" hint="Dézoomer" onPress={() => setZoom(clamp(scale / 1.25))} />
        <ToolButton label="+" hint="Zoomer" onPress={() => setZoom(clamp(scale * 1.25))} />
        <ToolButton
          label="Tout"
          hint="Afficher tout le schéma en largeur"
          onPress={() => {
            setZoom(null);
            setFitAll(true);
          }}
        />
      </View>
      <View
        style={[styles.frame, { height, backgroundColor: theme.surface, borderColor: theme.border }]}
        onLayout={(event) => setFrameWidth(event.nativeEvent.layout.width)}>
        <ScrollView ref={vertical} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          <ScrollView ref={horizontal} horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
            <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
              <Svg
                width={layout.width * scale}
                height={layout.height * scale}
                viewBox={`0 0 ${layout.width} ${layout.height}`}>
                <Defs>
                  {[...arrowColors].map((color) => (
                    <Marker
                      key={color}
                      id={arrowId(color)}
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto">
                      <Path d="M0 0L10 5L0 10z" fill={color} />
                    </Marker>
                  ))}
                </Defs>

                {layout.lanes.map((lane, index) => (
                  <G key={lane.label || index}>
                    <Rect
                      x={lane.x}
                      y={8}
                      width={lane.width}
                      height={layout.height - 16}
                      rx={10}
                      fill={index % 2 ? theme.surface : theme.surfaceMuted}
                    />
                    <SvgText
                      x={lane.x + 10}
                      y={30}
                      fontSize={13}
                      fontFamily={FONT}
                      fontWeight="600"
                      fill={theme.textSecondary}>
                      {lane.label || 'Sans acteur'}
                    </SvgText>
                  </G>
                ))}

                {overview &&
                  layout.edges.map((edge) => {
                    const strokes = overview.strokes.get(edge.id) ?? [];
                    const color = strokes.length === 1 ? strokes[0].color : undefined;
                    return (
                      <G key={edge.id} opacity={overview.dimmedLinks?.has(edge.id) ? 0.15 : strokes.length ? 1 : 0.6}>
                        {strokes.length === 0 && (
                          <Path
                            d={pathOf(edge.points)}
                            fill="none"
                            stroke={theme.textSecondary}
                            strokeWidth={1.5}
                            strokeDasharray="6 5"
                            markerEnd={`url(#${arrowId(theme.textSecondary)})`}
                          />
                        )}
                        {strokes.map((item, index) => (
                          <Path
                            key={item.color}
                            d={pathOf(offsetPolyline(edge.points, (index - (strokes.length - 1) / 2) * FAMILY_GAP))}
                            fill="none"
                            stroke={item.color}
                            strokeWidth={item.bold ? 4 : 2.5}
                            markerEnd={`url(#${arrowId(item.color)})`}
                          />
                        ))}
                        {edge.label ? (
                          <EdgeLabel point={midpoint(edge.points)} label={edge.label} color={color} />
                        ) : null}
                      </G>
                    );
                  })}

                {progress &&
                  layout.edges.map((edge) => {
                    const visited = progress.visitedLinks.has(edge.id);
                    const candidate = candidates.has(edge.id);
                    if (!visited && !candidate) return null;
                    const mid = midpoint(edge.points);
                    return (
                      <G key={edge.id}>
                        <Path
                          d={pathOf(edge.points)}
                          fill="none"
                          stroke={visited ? theme.primary : theme.textSecondary}
                          strokeWidth={visited ? 2.5 : 1.5}
                          strokeDasharray={visited ? undefined : '6 5'}
                          markerEnd={`url(#${arrowId(visited ? theme.primary : theme.textSecondary)})`}
                        />
                        {edge.label ? <EdgeLabel point={mid} label={edge.label} /> : null}
                      </G>
                    );
                  })}

                {[...layout.nodes.values()].map((node) => {
                  if (overview) {
                    return (
                      <G key={node.id} opacity={overview.dimmedSteps?.has(node.id) ? 0.25 : 1}>
                        <NodeShape node={node} neutral />
                      </G>
                    );
                  }
                  if (progress?.visitedSteps.has(node.id)) {
                    return <NodeShape key={node.id} node={node} current={node.id === progress.currentId} />;
                  }
                  if (ghosts.has(node.id)) return <NodeShape key={node.id} node={node} ghost />;
                  return null;
                })}
              </Svg>
            </View>
          </ScrollView>
        </ScrollView>
      </View>
    </View>
  );
}

function clamp(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** Identifiant de la pointe de flèche d'une couleur, par exemple « arrow-0078bd ». */
function arrowId(color: string) {
  return `arrow-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
}

function pathOf(points: Point[]) {
  return points.map((p, i) => `${i ? 'L' : 'M'}${Math.round(p.x * 10) / 10} ${Math.round(p.y * 10) / 10}`).join(' ');
}

/** Couleurs d'une étape selon son rôle. */
function useNodeColors(kind: StepKind) {
  const theme = useTheme();
  if (kind === 'decision')
    return {
      fill: theme.warningBackground,
      stroke: theme.warning,
      text: theme.warning,
    };
  if (kind === 'start' || kind === 'end') return { fill: theme.text, stroke: theme.text, text: theme.background };
  return { fill: theme.primary, stroke: theme.primary, text: theme.onPrimary };
}

function NodeShape({
  node,
  current = false,
  ghost = false,
  neutral = false,
}: {
  node: DiagramNode;
  current?: boolean;
  ghost?: boolean;
  /** Vue « Tous » : les tâches restent claires pour laisser la couleur aux chemins. */
  neutral?: boolean;
}) {
  const theme = useTheme();
  const kindColors = useNodeColors(node.kind);
  const colors =
    neutral && node.kind === 'task' ? { fill: theme.surface, stroke: theme.fieldBorder, text: theme.text } : kindColors;
  const { x, y, width: w, height: h } = node;
  const fill = ghost ? theme.surface : colors.fill;
  const stroke = ghost ? theme.textSecondary : colors.stroke;
  const shape =
    node.kind === 'decision' ? (
      <Polygon
        points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`}
        fill={fill}
        stroke={stroke}
        strokeWidth={ghost ? 1.5 : 2}
        strokeDasharray={ghost ? '5 4' : undefined}
      />
    ) : (
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={node.kind === 'task' ? 10 : h / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={ghost ? 1.5 : 2}
        strokeDasharray={ghost ? '5 4' : undefined}
      />
    );

  return (
    <G opacity={ghost ? 0.75 : 1}>
      {current && <Halo node={node} />}
      {shape}
      <NodeText node={node} color={ghost ? theme.textSecondary : colors.text} />
    </G>
  );
}

/** Halo de l'étape en cours, qui pulse sauf avec « Réduire les animations ». */
function Halo({ node }: { node: DiagramNode }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(0.15, { duration: 900 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({ opacity: opacity.value }));
  const pad = 7;
  return (
    <AnimatedRect
      animatedProps={animatedProps}
      x={node.x - pad}
      y={node.y - pad}
      width={node.width + pad * 2}
      height={node.height + pad * 2}
      rx={14}
      fill="none"
      stroke={theme.link}
      strokeWidth={5}
    />
  );
}

/** Titre coupé en lignes de la largeur de la forme (3 lignes au plus). */
function NodeText({ node, color }: { node: DiagramNode; color: string }) {
  const fontSize = 13;
  const usable = node.kind === 'decision' ? node.width * 0.62 : node.width - 14;
  const lines = wrap(node.title || 'Sans titre', Math.max(6, Math.floor(usable / (fontSize * 0.56))), 3);
  const lineHeight = fontSize * 1.2;
  const firstY = node.y + node.height / 2 - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.35;
  return (
    <SvgText
      x={node.x + node.width / 2}
      y={firstY}
      fontSize={fontSize}
      fontFamily={FONT}
      fontWeight="600"
      fill={color}
      textAnchor="middle">
      {lines.map((line, index) => (
        <TSpan key={index} x={node.x + node.width / 2} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </TSpan>
      ))}
    </SvgText>
  );
}

export function wrap(text: string, perLine: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (!line) line = word;
    else if ((line + ' ' + word).length <= perLine) line += ' ' + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].slice(0, Math.max(1, perLine - 1)) + '…';
    return kept;
  }
  return lines;
}

function EdgeLabel({ point, label, color }: { point: Point; label: string; color?: string }) {
  const theme = useTheme();
  const width = Math.max(22, label.length * 6.6 + 12);
  return (
    <G>
      <Rect
        x={point.x - width / 2}
        y={point.y - 9}
        width={width}
        height={18}
        rx={9}
        fill={theme.surface}
        stroke={color ?? theme.border}
      />
      <SvgText
        x={point.x}
        y={point.y + 4}
        fontSize={12}
        fontFamily={FONT}
        fontWeight={color ? '600' : undefined}
        fill={color ?? theme.textSecondary}
        textAnchor="middle">
        {label}
      </SvgText>
    </G>
  );
}

function ToolButton({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint}
      hitSlop={4}
      style={({ pressed }) => [
        styles.tool,
        {
          backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
          borderColor: theme.border,
        },
      ]}>
      <ThemedText type="smallBold" style={{ color: theme.link }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  container: { gap: Spacing.one },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  title: { flex: 1 },
  tool: {
    minWidth: 44,
    minHeight: 36,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
