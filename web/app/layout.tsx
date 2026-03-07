import type { Metadata } from "next";
import "./globals.css";
import { TourProvider } from "@/lib/useTour";

export const metadata: Metadata = {
  title: "Zora",
  description: "AI-powered essay development platform",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('zora-theme');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <TourProvider>{children}</TourProvider>
      </body>
    </html>
  );
}
