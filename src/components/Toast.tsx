import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';

export interface ToastOptions {
  message: string;
  action?: { label: string; onPress: () => void };
  durationMs?: number;
}

const ToastContext = createContext<(toast: ToastOptions) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/** Toast global: sobrevive ao fechamento do modal que o disparou. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { key: number }) | null>(null);
  const insets = useSafeAreaInsets();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((options: ToastOptions) => {
    setToast({ ...options, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    timer.current = setTimeout(
      () => setToast(null),
      toast.durationMs ?? (toast.action ? 6000 : 3500),
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={[styles.container, { bottom: insets.bottom + 72 }]}>
          <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Text style={styles.message}>{toast.message}</Text>
            {toast.action ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  toast.action?.onPress();
                  setToast(null);
                }}
              >
                <Text style={styles.action}>{toast.action.label}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center' },
  toast: {
    backgroundColor: colors.toast,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    gap: spacing.sm,
    width: '100%',
    maxWidth: 480,
  },
  message: { color: '#FFFFFF', fontSize: 15 },
  action: { color: '#7EE2B8', fontSize: 14, fontWeight: '700' },
});
