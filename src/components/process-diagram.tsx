import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, G, Marker, Path, Polygon, Rect, Text as SvgText, TSpan } from 'react-native-svg';

import { SymbolView, type SymbolViewProps } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { StepKind } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import type { FamilyPaint } from '@/simulation/families';
import { isDiamond, midpoint, offsetPolyline, wrap, type DiagramLayout, type DiagramNode, type Point } from '@/simulation/layout';
import { useT } from '@/i18n';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedG = Animated.createAnimatedComponent(G);

const MIN_SCALE = 0.3;
const MAX_SCALE = 2;
/** Le cadrage automatique ne grossit pas au-delà de la taille réelle… */
const FRAME_MAX_SCALE = 1;
/** … ni ne rapetisse en dessous de ce seuil (le texte resterait illisible). */
const FRAME_MIN_SCALE = 0.55;
/** Seuil pour montrer tout un chemin parcouru (fin du pas à pas, cas simple et complexe). */
const PATH_MIN_SCALE = 0.4;
/** Marge autour de ce que le cadrage montre. */
const FRAME_PADDING = 20;
const MOVE = { duration: 450, easing: Easing.out(Easing.cubic) };
/** Écart entre les traits de deux familles sur une même flèche. */
const FAMILY_GAP = 4.5;
/** Largeur de la mini-carte. */
const MINIMAP_WIDTH = 110;
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
  /** Tâches en parallèle : les autres étapes en cours, entourées elles aussi. */
  otherCurrentIds?: string[];
  /** Sorties possibles depuis l'étape en cours : en pointillés, avec leur étape d'arrivée en fantôme. */
  candidateLinks: string[];
};

/**
 * Vue « Tous les cas » : tout le schéma est dessiné. Une flèche empruntée par
 * plusieurs familles a un trait de chaque couleur, côte à côte, comme un plan
 * de métro. Les flèches qu'aucun chemin n'emprunte sont en pointillés.
 */
export type DiagramOverview = FamilyPaint;

/**
 * Schéma du process qui se construit pendant la simulation : seules les étapes
 * parcourues sont dessinées, et les sorties possibles apparaissent en
 * pointillés, en fondu. À chaque étape, la vue se recadre toute seule sur
 * l'étape en cours et ses sorties. On zoome en pinçant ou avec − et +, on se
 * déplace au doigt. Avec `overview`, tout le schéma est dessiné en couleurs
 * (vue « Tous les cas »).
 */
export function ProcessDiagram({
  layout,
  progress,
  overview,
  height = 260,
  accessibilityLabel,
  fullscreen = false,
  onToggleFullscreen,
  bottomInset = 0,
  topInset = 0,
}: {
  layout: DiagramLayout;
  progress?: DiagramProgress;
  overview?: DiagramOverview;
  height?: number;
  accessibilityLabel: string;
  /** Plein écran : cadre sans bord ni coins arrondis. */
  fullscreen?: boolean;
  /** Bouton plein écran de la barre d'outils (absent sans cette fonction). */
  onToggleFullscreen?: () => void;
  /** Place prise en bas par la carte d'étape flottante : la mini-carte et le cadrage restent au-dessus. */
  bottomInset?: number;
  /** Place prise en haut (barre d'état) en plein écran. */
  topInset?: number;
}) {
  const theme = useTheme();
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [frameWidth, setFrameWidth] = useState(0);

  // Position de la vue : le schéma est agrandi de `scale`, et son coin haut
  // gauche est en (x, y) dans le cadre. Tout bouge sur le fil d'interface
  // (Reanimated), sans repasser par React.
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  // Taille à laquelle le SVG est vraiment dessiné. Pendant un geste, on étire
  // l'image ; à la fin, on redessine à la bonne taille pour que le texte reste net.
  const [renderScale, setRenderScale] = useState(1);
  // Suivi auto : la vue suit l'étape en cours. Glisser, pincer ou zoomer le coupe ; la cible le remet.
  const [follow, setFollow] = useState(true);
  // Hauteur vraiment visible (sans la carte d'étape flottante ni la barre d'état).
  const viewTop = topInset;
  const viewHeight = Math.max(120, height - bottomInset - topInset);
  const width = layout.width;
  const layoutHeight = layout.height;

  /** Fait glisser la vue jusqu'au coin (nx, ny) et à l'échelle k, puis redessine net. */
  const moveTo = useCallback(
    (nx: number, ny: number, k: number) => {
      const timing = reduceMotion ? { duration: 0 } : MOVE;
      x.set(withTiming(bound(nx, width * k, frameWidth), timing));
      y.set(withTiming(bound(ny, layoutHeight * k, height), timing));
      scale.set(
        withTiming(k, timing, (finished) => {
          if (finished) runOnJS(setRenderScale)(k);
        }),
      );
    },
    [reduceMotion, x, y, scale, width, layoutHeight, frameWidth, height],
  );

  /**
   * Amène la vue sur la zone `box` (coordonnées du schéma). Si elle ne tient
   * pas sans passer sous `minScale`, la vue garde au moins `anchor` (l'étape
   * en cours) dans le cadre.
   */
  const showBox = useCallback(
    (box: Box, minScale: number, anchor?: Box) => {
      if (frameWidth === 0) return;
      const fit = Math.min((frameWidth - FRAME_PADDING * 2) / box.width, (viewHeight - FRAME_PADDING * 2) / box.height);
      const k = clamp(Math.min(FRAME_MAX_SCALE, Math.max(minScale, fit)));
      let nx = frameWidth / 2 - (box.x + box.width / 2) * k;
      let ny = viewTop + viewHeight / 2 - (box.y + box.height / 2) * k;
      if (anchor) {
        nx = keepInside(nx, anchor.x * k, (anchor.x + anchor.width) * k, frameWidth);
        ny = viewTop + keepInside(ny - viewTop, anchor.y * k, (anchor.y + anchor.height) * k, viewHeight);
      }
      moveTo(nx, ny, k);
    },
    [frameWidth, viewHeight, viewTop, moveTo],
  );

  /** Zoom des boutons − et +, autour du centre du cadre. */
  const zoomBy = (factor: number) => {
    setFollow(false);
    const k = clamp(scale.get() * factor);
    const ratio = k / scale.get();
    moveTo(frameWidth / 2 - (frameWidth / 2 - x.get()) * ratio, height / 2 - (height / 2 - y.get()) * ratio, k);
  };

  const whole: Box = { x: 0, y: 0, width, height: layoutHeight };
  const showAll = () => {
    setFollow(false);
    showBox(whole, MIN_SCALE);
  };
  /** Remet le suivi auto et recadre tout de suite sur l'étape en cours. */
  const followCurrent = () => {
    setFollow(true);
    frameFocus();
  };
  /** Mini-carte : centre la vue sur le point touché, à l'échelle actuelle. */
  const jumpTo = (mx: number, my: number) => {
    setFollow(false);
    const k = scale.get();
    moveTo(frameWidth / 2 - (mx / miniK) * k, viewTop + viewHeight / 2 - (my / miniK) * k, k);
  };
  const miniK = MINIMAP_WIDTH / Math.max(width, 1);

  // Cadrage automatique : à chaque étape, l'étape en cours et ses sorties
  // possibles ; à la fin du parcours, tout le chemin ; en vue « Tous », tout le schéma.
  const candidates = new Set(progress?.candidateLinks);
  const ghosts = new Set(
    layout.edges
      .filter((edge) => candidates.has(edge.id) && !progress?.visitedSteps.has(edge.to))
      .map((edge) => edge.to),
  );
  const choosing = candidates.size > 0;
  const isCurrent = (nodeId: string) =>
    nodeId === progress?.currentId || (progress?.otherCurrentIds?.includes(nodeId) ?? false);
  const focusIds = !progress
    ? []
    : choosing && progress.currentId
      ? [progress.currentId, ...(progress.otherCurrentIds ?? []), ...layout.edges.filter((edge) => candidates.has(edge.id)).map((edge) => edge.to)]
      : [...progress.visitedSteps];
  const focusKey = overview ? 'tous' : `${progress?.currentId}|${focusIds.join('|')}`;
  const frameFocus = () => {
    if (overview) {
      showBox(whole, MIN_SCALE);
      return;
    }
    const box = boxOf(focusIds.map((id) => layout.nodes.get(id)).filter((node) => node !== undefined));
    const current = progress?.currentId ? layout.nodes.get(progress.currentId) : undefined;
    // Pendant le choix, on reste lisible ; à la fin, on montre le chemin entier, plus petit.
    if (box) showBox(box, choosing ? FRAME_MIN_SCALE : PATH_MIN_SCALE, current);
  };
  useEffect(() => {
    if (follow || overview) frameFocus();
    // focusKey résume focusIds ; frameFocus dépend de ce qui est affiché.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, showBox, overview]);

  // Gestes : glisser d'un doigt pour se déplacer, pincer pour zoomer autour des doigts.
  const commit = () => {
    'worklet';
    runOnJS(setRenderScale)(scale.get());
  };
  const pan = usePanGesture({
    onActivate: () => {
      'worklet';
      runOnJS(setFollow)(false);
    },
    onUpdate: (event) => {
      'worklet';
      x.set(bound(x.get() + event.changeX, width * scale.get(), frameWidth));
      y.set(bound(y.get() + event.changeY, layoutHeight * scale.get(), height));
    },
  });
  const pinch = usePinchGesture({
    onActivate: () => {
      'worklet';
      runOnJS(setFollow)(false);
    },
    onUpdate: (event) => {
      'worklet';
      const k = clamp(scale.get() * event.scaleChange);
      const ratio = k / scale.get();
      scale.set(k);
      x.set(bound(event.focalX - (event.focalX - x.get()) * ratio, width * k, frameWidth));
      y.set(bound(event.focalY - (event.focalY - y.get()) * ratio, layoutHeight * k, height));
    },
    onDeactivate: commit,
  });
  const gesture = useSimultaneousGestures(pan, pinch);

  const contentStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() / renderScale }],
    }),
    [renderScale],
  );

  // Cadre de la mini-carte : la partie du schéma visible à l'écran.
  const miniFrame = useAnimatedStyle(() => ({
    left: (-x.get() / scale.get()) * miniK,
    top: ((viewTop - y.get()) / scale.get()) * miniK,
    width: (frameWidth / scale.get()) * miniK,
    height: (viewHeight / scale.get()) * miniK,
  }));
  const showMinimap = !overview && frameWidth > 0 && layout.width * FRAME_MIN_SCALE > frameWidth * 0.9;

  // Une pointe de flèche par couleur utilisée.
  const arrowColors = new Set([
    theme.primary,
    theme.textSecondary,
    ...[...(overview?.strokes.values() ?? [])].flat().map((item) => item.color),
  ]);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.frame,
          fullscreen && styles.frameFull,
          { height, backgroundColor: fullscreen ? theme.background : theme.surface },
        ]}
        onLayout={(event) => setFrameWidth(event.nativeEvent.layout.width)}>
        <GestureDetector gesture={gesture}>
          <View style={StyleSheet.absoluteFill} collapsable={false}>
            <Animated.View
              style={[styles.content, contentStyle]}
              accessible
              accessibilityRole="image"
              accessibilityLabel={accessibilityLabel}>
              <Svg
                width={layout.width * renderScale}
                height={layout.height * renderScale}
                viewBox={`0 0 ${layout.width} ${layout.height}`}>
                <Defs>
                  {[...arrowColors].map((color) => (
                    <Marker
                      key={color}
                      id={arrowId(color)}
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="10"
                      markerHeight="10"
                      markerUnits="userSpaceOnUse"
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
                      {lane.label || t.diagram.noActor}
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

                {/* Les flèches à venir, en transparence : on voit où le process peut mener. */}
                {progress &&
                  layout.edges.map((edge) =>
                    progress.visitedLinks.has(edge.id) || candidates.has(edge.id) ? null : (
                      <Path
                        key={`a-venir-${edge.id}`}
                        d={pathOf(edge.points)}
                        fill="none"
                        stroke={theme.textSecondary}
                        strokeWidth={1.5}
                        strokeDasharray="6 7"
                        opacity={0.3}
                      />
                    ),
                  )}

                {progress &&
                  layout.edges.map((edge) => {
                    const visited = progress.visitedLinks.has(edge.id);
                    const candidate = candidates.has(edge.id);
                    if (!visited && !candidate) return null;
                    const mid = midpoint(edge.points);
                    return (
                      <FadeIn key={edge.id}>
                        <Path
                          d={pathOf(edge.points)}
                          fill="none"
                          stroke={visited ? theme.primary : theme.textSecondary}
                          strokeWidth={visited ? 2.5 : 1.5}
                          strokeDasharray={visited ? undefined : '6 5'}
                          markerEnd={`url(#${arrowId(visited ? theme.primary : theme.textSecondary)})`}
                        />
                        {edge.label ? <EdgeLabel point={mid} label={edge.label} /> : null}
                      </FadeIn>
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
                  // Même clé pour une étape fantôme puis parcourue : le fondu ne joue qu'à son apparition.
                  const visited = progress?.visitedSteps.has(node.id);
                  // Étape à venir : en transparence, sans fondu.
                  if (!visited && !ghosts.has(node.id))
                    return (
                      <G key={`a-venir-${node.id}`} opacity={0.35}>
                        <NodeShape node={node} ghost />
                      </G>
                    );
                  return (
                    <FadeIn key={node.id}>
                      <NodeShape node={node} current={isCurrent(node.id)} ghost={!visited} />
                    </FadeIn>
                  );
                })}
              </Svg>
            </Animated.View>
          </View>
        </GestureDetector>

        {progress && follow && (
          <View
            pointerEvents="none"
            style={[styles.followPill, { backgroundColor: theme.primary, top: viewTop + Spacing.three - Spacing.one }]}>
            <SymbolView name={{ ios: 'scope', android: 'my_location' }} size={14} tintColor={theme.onPrimary} />
            <ThemedText type="smallBold" style={[styles.followText, { color: theme.onPrimary }]}>
              {t.diagram.follow}
            </ThemedText>
          </View>
        )}

        <View style={[styles.tools, { top: viewTop + Spacing.three - Spacing.one }]}>
          {onToggleFullscreen && (
            <ToolButton
              icon={
                fullscreen
                  ? { ios: 'arrow.down.right.and.arrow.up.left', android: 'close_fullscreen' }
                  : { ios: 'arrow.up.left.and.arrow.down.right', android: 'open_in_full' }
              }
              hint={fullscreen ? t.diagram.exitFullscreen : t.diagram.fullscreen}
              active={fullscreen}
              onPress={onToggleFullscreen}
            />
          )}
          {progress && (
            <ToolButton
              icon={{ ios: 'scope', android: 'my_location' }}
              hint={t.diagram.followHint}
              active={follow}
              onPress={followCurrent}
            />
          )}
          <ToolButton
            icon={{ ios: 'rectangle.dashed', android: 'fit_screen' }}
            hint={t.diagram.allHint}
            onPress={showAll}
          />
          <ToolButton icon={{ ios: 'plus', android: 'add' }} hint={t.diagram.zoomIn} onPress={() => zoomBy(1.25)} />
          <ToolButton
            icon={{ ios: 'minus', android: 'remove' }}
            hint={t.diagram.zoomOut}
            onPress={() => zoomBy(1 / 1.25)}
          />
        </View>

        {showMinimap && (
          <Pressable
            onPress={(event) => jumpTo(event.nativeEvent.locationX, event.nativeEvent.locationY)}
            accessibilityRole="button"
            accessibilityLabel={t.diagram.minimap}
            style={[
              styles.minimap,
              {
                width: MINIMAP_WIDTH,
                height: layout.height * miniK,
                bottom: bottomInset + Spacing.three - Spacing.one,
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}>
            {[...layout.nodes.values()].map((node) => {
              const visited = progress?.visitedSteps.has(node.id);
              const current = isCurrent(node.id);
              return (
                <View
                  key={node.id}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: node.x * miniK,
                    top: node.y * miniK,
                    width: Math.max(4, node.width * miniK),
                    height: Math.max(3, node.height * miniK),
                    borderRadius: 2,
                    backgroundColor: current ? theme.primary : visited ? theme.text : theme.border,
                  }}
                />
              );
            })}
            <Animated.View pointerEvents="none" style={[styles.miniFrame, { borderColor: theme.link }, miniFrame]} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

type Box = { x: number; y: number; width: number; height: number };

/** Décale `offset` pour que le segment [start, end] (déjà à l'échelle) reste dans le cadre, avec une marge. */
function keepInside(offset: number, start: number, end: number, frame: number) {
  if (offset + start < FRAME_PADDING) return FRAME_PADDING - start;
  if (offset + end > frame - FRAME_PADDING) return frame - FRAME_PADDING - end;
  return offset;
}

/** Coin haut gauche permis : le schéma ne sort pas du cadre ; plus petit que le cadre, il y est centré. */
function bound(value: number, size: number, frame: number) {
  'worklet';
  if (size <= frame) return (frame - size) / 2;
  return Math.min(0, Math.max(frame - size, value));
}

/** Plus petite zone qui contient toutes ces étapes. */
function boxOf(nodes: DiagramNode[]): Box | undefined {
  if (nodes.length === 0) return undefined;
  const left = Math.min(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y));
  const right = Math.max(...nodes.map((node) => node.x + node.width));
  const bottom = Math.max(...nodes.map((node) => node.y + node.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Fait apparaître son contenu en fondu, sauf avec « Réduire les animations ». */
function FadeIn({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) opacity.set(withTiming(1, { duration: 350 }));
  }, [opacity, reduceMotion]);
  const animatedProps = useAnimatedProps(() => ({ opacity: opacity.get() }));
  return <AnimatedG animatedProps={animatedProps}>{children}</AnimatedG>;
}

function clamp(scale: number) {
  'worklet';
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
  if (kind === 'parallel') return { fill: theme.successBackground, stroke: theme.success, text: theme.success };
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
    isDiamond(node.kind) ? (
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
  const t = useT();
  const fontSize = 13;
  const usable = isDiamond(node.kind) ? node.width * 0.62 : node.width - 14;
  const lines = wrap(node.title || t.untitled, Math.max(6, Math.floor(usable / (fontSize * 0.56))), 3);
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

/** Bouton rond de la barre d'outils flottante du schéma ; `active` : en couleur de la palette. */
function ToolButton({
  icon,
  hint,
  active = false,
  onPress,
}: {
  icon: SymbolViewProps['name'];
  hint: string;
  active?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint}
      accessibilityState={{ selected: active }}
      hitSlop={2}
      style={({ pressed }) => [
        styles.tool,
        { backgroundColor: active ? theme.primary : theme.surface, opacity: pressed ? 0.75 : 1 },
      ]}>
      <SymbolView name={icon} size={19} tintColor={active ? theme.onPrimary : theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: Radius.large + 2,
    overflow: 'hidden',
  },
  frameFull: { borderRadius: 0 },
  container: { gap: Spacing.one },
  content: { position: 'absolute', left: 0, top: 0, transformOrigin: 'left top' },
  tools: { position: 'absolute', right: Spacing.three - Spacing.half * 3, gap: Spacing.two },
  tool: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(14, 27, 44, 0.16)',
  },
  followPill: {
    position: 'absolute',
    left: Spacing.three - Spacing.one,
    height: 30,
    paddingHorizontal: Spacing.three - Spacing.one,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
  },
  followText: { fontSize: 12, lineHeight: 16, fontWeight: 800 },
  minimap: {
    position: 'absolute',
    right: Spacing.three - Spacing.half * 3,
    borderRadius: Radius.small - 2,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(14, 27, 44, 0.16)',
  },
  miniFrame: { position: 'absolute', borderWidth: 2, borderRadius: 3 },
});
