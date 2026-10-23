import React, { Suspense } from 'react';
import type { Arena3DProps } from './Arena3D';

// The 3D scene (three.js + expo-gl) is only loaded when a 3D battle starts, so a phone that can't run it
// never fails at app start; the battle just falls back to the 2D arena.
const Arena3D = React.lazy(() => import('./Arena3D'));

class Guard extends React.Component<{ onError?: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function Safe3D(props: Arena3DProps) {
  return (
    <Guard onError={props.onError}>
      <Suspense fallback={null}>
        <Arena3D {...props} />
      </Suspense>
    </Guard>
  );
}
