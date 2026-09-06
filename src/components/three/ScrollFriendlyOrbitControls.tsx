import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

export function ScrollFriendlyOrbitControls() {
  const canvas = useThree(state => state.gl.domElement);

  useEffect(() => {
    // Keep native page scrolling unless the user explicitly requests graph zoom.
    const routeWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) event.stopImmediatePropagation();
    };
    canvas.addEventListener('wheel', routeWheel, { capture: true, passive: true });
    return () => canvas.removeEventListener('wheel', routeWheel, true);
  }, [canvas]);

  return <OrbitControls makeDefault enableDamping dampingFactor={0.07} minDistance={6} maxDistance={24} enablePan={false} />;
}
