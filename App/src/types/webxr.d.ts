// Minimal WebXR type declarations untuk TypeScript
// Lengkap: npm i --save-dev @types/webxr

interface XRSystem {
  isSessionSupported(mode: XRSessionMode): Promise<boolean>;
  requestSession(mode: XRSessionMode, options?: XRSessionInit): Promise<XRSession>;
}

interface XRSession {
  end(): Promise<void>;
}

interface XRSessionInit {
  requiredFeatures?: string[];
  optionalFeatures?: string[];
  domOverlay?: { root: Element };
}

type XRSessionMode = "inline" | "immersive-vr" | "immersive-ar";

interface Navigator {
  xr?: XRSystem;
}
