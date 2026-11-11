declare module "mammoth" {
  interface MammothImage {
    contentType: string;
    read(encoding: "base64"): Promise<string>;
  }
  const mammoth: {
    images: {
      imgElement(convert: (image: MammothImage) => Promise<{ src: string }>): unknown;
    };
    convertToHtml(input: { arrayBuffer: ArrayBuffer; convertImage?: unknown }): Promise<{ value: string }>;
  };
  export default mammoth;
}
