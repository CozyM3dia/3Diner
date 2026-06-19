// Type shim untuk @mkkellogg/gaussian-splats-3d (tidak ada @types resmi)
declare module "@mkkellogg/gaussian-splats-3d" {
  // WebXR mode constants
  const WebXRMode: {
    None: 0;
    VR: 1;
    AR: 2;
  };

  interface WebXRSessionInit {
    requiredFeatures?: string[];
    optionalFeatures?: string[];
    domOverlay?: { root: Element };
  }

  interface ViewerOptions {
    rootElement?: HTMLElement | null;
    selfDrivenMode?: boolean;
    useBuiltInControls?: boolean;
    initialCameraPosition?: [number, number, number];
    initialCameraLookAt?: [number, number, number];
    cameraUp?: [number, number, number];
    gpuAcceleratedSort?: boolean;
    sharedMemoryForWorkers?: boolean;
    dynamicScene?: boolean;
    renderer?: unknown;
    threeScene?: unknown;
    camera?: unknown;
    // WebXR
    webXRMode?: 0 | 1 | 2;
    webXRSessionInit?: WebXRSessionInit;
  }

  // Runtime constant exported by the library
  const SceneFormat: {
    Splat: 0;
    KSplat: 1;
    Ply: 2;
  };

  interface AddSplatSceneOptions {
    splatAlphaRemovalThreshold?: number;
    showLoadingUI?: boolean;
    progressiveLoad?: boolean;
    format?: 0 | 1 | 2;
    onProgress?: (progress: number) => void;
  }

  class Viewer {
    constructor(options?: ViewerOptions);
    addSplatScene(url: string, options?: AddSplatSceneOptions): Promise<void>;
    start(): void;
    stop(): void;
    dispose(): void;
    // Internal refs exposed at runtime (not typed officially)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly splatMesh: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly camera: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly controls: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly renderer: any;
  }
}
