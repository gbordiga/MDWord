export {};

declare global {
  interface Window {
    __MDWORD_APP__?: import("zustand").StoreApi<import("@/lib/store").AppState>;
    mdword?: import("@mdword/shared").HostApi;
    showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle>;
    showDirectoryPicker?: (options?: unknown) => Promise<FileSystemDirectoryHandle>;
  }
}
