import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cyphera | Ruang Kendali Lahan",
  applicationName: "Cyphera",
  description: "Kelola banyak lahan, pantau simulasi cuaca per lokasi, dan rencanakan kegiatan budidaya.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
