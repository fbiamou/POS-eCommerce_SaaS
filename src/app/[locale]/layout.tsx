import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree, Spline_Sans_Mono } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { NativeValidationMessages } from '@/components/NativeValidationMessages';

// Fixed app-wide typography from the WISHOP identity (Indigo royal): Figtree
// for body text, Bricolage Grotesque for headings, Spline Sans Mono for
// figures and labels. Only the public storefront (boutique/[slug]) still
// lets a shop customize its own accent color and font; see ThemeStyle,
// which is rendered from that route instead of here.
const appSans = Figtree({
  variable: "--font-app-sans",
  subsets: ["latin"],
});

const appDisplay = Bricolage_Grotesque({
  variable: "--font-app-display",
  subsets: ["latin"],
});

const appMono = Spline_Sans_Mono({
  variable: "--font-app-mono",
  subsets: ["latin"],
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth' });
  // Each page sets its own title ("Stock & Produits · WISHOP"); every
  // page used to be titled "Tableau de Bord", including the public ones.
  return {
    title: { default: t('title'), template: `%s · ${t('title')}` },
    description: t('subtitle'),
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
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // Providing all messages to the client side
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${appSans.variable} ${appDisplay.variable} ${appMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          id="theme-script"
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('theme')==='dark'){document.documentElement.setAttribute('data-theme','dark')}}catch(e){}",
          }}
        />
        <script
          id="unregister-sw"
          dangerouslySetInnerHTML={{
            __html:
              "try{if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(r){for(var i=0;i<r.length;i++){r[i].unregister()}})}}catch(e){}",
          }}
        />
      </head>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          <NativeValidationMessages />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
