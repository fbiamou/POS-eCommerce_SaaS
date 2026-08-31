import Sidebar from "@/components/layout/Sidebar";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import { getCurrentProfile } from '@/features/auth/actions';
import { getShopSettings } from '@/features/settings/actions';
import { ThemeStyle } from '@/components/ThemeStyle';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Sidebar' });
  return {
    title: t('dashboard') + " - Boutique POS",
    description: "Application de gestion pour boutique",
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Providing all messages to the client side
  const messages = await getMessages();

  // Fetch current user profile and shop settings (null if not logged in)
  const [profile, shopSettings] = await Promise.all([
    getCurrentProfile(),
    getShopSettings(),
  ]);

  return (
    <html lang={locale}>
      <head>
        <ThemeStyle
          accentColor={shopSettings?.theme_accent_color}
          fontFamily={shopSettings?.theme_font}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen w-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden flex flex-col md:flex-row`}
      >
        <NextIntlClientProvider messages={messages}>
          <Sidebar profile={profile} shopName={shopSettings?.shop_name} shopLogoUrl={shopSettings?.shop_logo_url} />
          <main className="flex-1 overflow-y-auto bg-white dark:bg-black p-4 md:p-8 pt-16 md:pt-8 w-full">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
