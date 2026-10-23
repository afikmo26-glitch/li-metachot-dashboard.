// react-three-fiber for the web build; the native build uses r3f.native.ts. Everything 3D imports from here
// so the Canvas and the hooks always come from the same copy of the library.
export { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
