import QRCode from "qrcode";

export interface QrAssets {
  svg: string;
  pngDataUrl: string;
}

/** Generate SVG markup and PNG data URL QR codes for a target URL. */
export async function generateQrAssets(targetUrl: string): Promise<QrAssets> {
  const [svg, pngDataUrl] = await Promise.all([
    QRCode.toString(targetUrl, {
      type: "svg",
      margin: 2,
      width: 220,
      color: { dark: "#0f172a", light: "#ffffff" },
    }),
    QRCode.toDataURL(targetUrl, {
      margin: 2,
      width: 400,
      color: { dark: "#0f172a", light: "#ffffff" },
    }),
  ]);
  return { svg, pngDataUrl };
}
