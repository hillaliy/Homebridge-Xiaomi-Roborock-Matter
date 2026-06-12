declare module 'miio' {
  interface MiioDevice {
    miioModel?: string;
    call(method: string, params?: unknown[]): Promise<unknown>;
    destroy?(): void;
  }

  interface DeviceOptions {
    address: string;
    token: string;
  }

  interface Miio {
    device(options: DeviceOptions): Promise<MiioDevice>;
  }

  const miio: Miio;
  export default miio;
}
