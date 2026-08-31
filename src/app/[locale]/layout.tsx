import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
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

// Bare document shell shared by every page — authenticated dashboard pages
// (Sidebar + content layout) live in the (app) route group, while public
// pages (login, storefront, procurement intake) render directly here with
// no forced app chrome.
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

  // Theme reflects the visitor's own shop when authenticated; public pages
  // (login, storefront) fall back to the default theme.
  const shopSettings = await getShopSettings();

  return (
    <html lang={locale}>
      <head>
        <ThemeStyle
          accentColor={shopSettings?.theme_accent_color}
          fontFamily={shopSettings?.theme_font}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-50 dark:bg-zinc-950`}
      >
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
