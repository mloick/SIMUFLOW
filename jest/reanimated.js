// Reanimated (animations) : son module natif n'existe pas dans Jest. On le remplace par une version
// immobile : les valeurs prennent tout de suite leur état final, les composants animés sont les composants
// ordinaires. Les tests vérifient ce qui s'affiche et ce qui se passe au toucher, pas le mouvement.
jest.mock('react-native-reanimated', () => {
  const { View, Text, Image, ScrollView } = require('react-native');
  const immediate = (value) => value;
  const animation = { duration: () => animation, delay: () => animation, springify: () => animation };
  const Animated = { View, Text, Image, ScrollView, createAnimatedComponent: (component) => component };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: (value) => ({ value }),
    useAnimatedStyle: (factory) => factory(),
    useAnimatedProps: (factory) => factory(),
    useDerivedValue: (factory) => ({ value: factory() }),
    useReducedMotion: () => false,
    withTiming: immediate,
    withSpring: immediate,
    withDelay: (_delay, value) => value,
    withRepeat: immediate,
    withSequence: (...values) => values[values.length - 1],
    cancelAnimation: () => {},
    runOnJS: (fn) => fn,
    interpolate: (value, input, output) => output[input.indexOf(value)] ?? output[0],
    interpolateColor: (value, input, output) => output[input.indexOf(value)] ?? output[0],
    Easing: { linear: immediate, ease: immediate, out: immediate, in: immediate, inOut: immediate, bezier: () => immediate },
    FadeIn: animation,
    FadeOut: animation,
    FadeInDown: animation,
    FadeInUp: animation,
  };
});
