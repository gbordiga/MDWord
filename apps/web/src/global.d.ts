export {};

declare global {
  interface Window {
    mdword?: import("@mdword/shared").HostApi;
    showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle>;
    showDirectoryPicker?: (options?: unknown) => Promise<FileSystemDirectoryHandle>;
  }
}
