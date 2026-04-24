declare module 'html5-qrcode' {
  export class Html5Qrcode {
    constructor(elementId: string, verbose?: boolean);
    start(
      cameraIdOrConfig: any,
      configuration: any,
      qrCodeSuccessCallback: (decodedText: string, result: any) => void,
      qrCodeErrorCallback: (errorMessage: string, error: any) => void
    ): Promise<void>;
    stop(): Promise<void>;
    pause(): void;
    resume(): void;
    isScanning: boolean;
  }
  export class Html5QrcodeScanner {
    constructor(elementId: string, config: any, verbose: boolean);
    render(onSuccess: any, onError: any): void;
    clear(): Promise<void>;
  }
}
