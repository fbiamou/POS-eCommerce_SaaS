import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Bricolage_Grotesque } from "next/font/google";

import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { getCurrentProfile } from "@/features/auth/actions";
import { redirect } from "next/navigation";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

export default async function LandingPage() {
  const profile = await getCurrentProfile();
  
  if (profile) {
    redirect("/dashboard");
  }

  const tAuth = await getTranslations("Auth");
  const tLanding = await getTranslations("Landing");

  return (
    <div className={`min-h-screen bg-[#FDFCFB] dark:bg-zinc-950 font-sans ${bricolage.variable}`}>
      {/* Navigation */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8">
        <div className="flex items-center">
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-violet-600">
            {tAuth("title")}
          </span>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-6">
          <LocaleSwitcher variant="dropdown" />
          <Link
            href="/login"
            className="text-sm font-medium hover:text-violet-600 transition-colors"
          >
            {tAuth("sign_in")}
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 lg:px-8 pt-12 pb-24">
        {/* Hero Section */}
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-8 items-center mt-8 lg:mt-12">
          
          {/* Left Column: Copy */}
          <div className="max-w-xl">
            <h1 className="font-bricolage text-4xl sm:text-5xl lg:text-[5.5rem] font-extrabold tracking-tight text-zinc-900 dark:text-white leading-[1.1] lg:leading-[1.05]">
              {tLanding("hero_title_1")} <br className="hidden sm:block" /> {tLanding("hero_title_2")}
            </h1>
            <p className="mt-8 text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {tLanding("hero_subtitle")}
            </p>
            
            <div className="mt-10 flex flex-wrap items-center gap-6">
              <Link
                href="/login"
                className="flex items-center justify-center rounded-xl bg-[#7B46F6] px-6 py-3.5 text-sm font-bold text-white hover:bg-violet-700 transition-colors shadow-sm"
              >
                {tLanding("cta_create")} &rarr;
              </Link>
              <Link
                href="#demo"
                className="text-sm font-bold text-zinc-900 dark:text-white underline underline-offset-4 decoration-2 decoration-zinc-300 hover:decoration-zinc-900 transition-colors"
              >
                {tLanding("cta_demo")}
              </Link>
            </div>
          </div>

          {/* Right Column: Graphic Mockup */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-sm lg:ml-auto mt-12 lg:mt-0">
             {/* The dark mock card */}
             <div className="relative rounded-3xl bg-[#1C1C21] shadow-2xl p-6 sm:p-8 border border-zinc-800 rotate-2 hover:rotate-0 transition-transform duration-500">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                   <span className="text-white font-bold text-sm">{tLanding("mock_header")}</span>
                   <div className="h-5 w-5 rounded-full bg-[#8B5CF6] shadow-[0_0_15px_rgba(139,92,246,0.6)]"></div>
                </div>
                {/* Rows */}
                <div className="space-y-4">
                   <div className="bg-[#27272A] rounded-2xl p-5">
                      <div className="text-xs text-zinc-400 mb-1">{tLanding("mock_ca")}</div>
                      <div className="text-xl font-bold text-white font-mono">84 500 FCFA</div>
                   </div>
                   <div className="bg-[#27272A] rounded-2xl p-5">
                      <div className="text-xs text-zinc-400 mb-1">{tLanding("mock_dettes")}</div>
                      <div className="text-xl font-bold text-[#F87171] font-mono">23 000 FCFA</div>
                   </div>
                   <div className="bg-[#27272A] rounded-2xl p-5">
                      <div className="text-xs text-zinc-400 mb-1">{tLanding("mock_stock")}</div>
                      <div className="text-xl font-bold text-[#FBBF24] font-mono">{tLanding("mock_articles")}</div>
                   </div>
                </div>

                {/* Floating Pills */}
                <div className="animate-float absolute -left-2 sm:-left-12 lg:-left-20 top-6 bg-white dark:bg-zinc-800 rounded-full py-2.5 px-4 shadow-xl border border-zinc-100 dark:border-zinc-700 flex items-center gap-2">
                   <div className="h-2.5 w-2.5 rounded-full bg-[#8B5CF6]"></div>
                   <span className="text-xs font-bold font-mono text-zinc-900 dark:text-white">FAC-2026-0005</span>
                </div>
                
                <div className="animate-float animation-delay-1000 absolute -right-2 sm:-right-8 lg:-right-16 top-[45%] bg-white dark:bg-zinc-800 rounded-full py-2.5 px-4 shadow-xl border border-zinc-100 dark:border-zinc-700 flex items-center gap-2">
                   <div className="h-2.5 w-2.5 rounded-full bg-[#FBBF24]"></div>
                   <span className="text-xs font-bold font-mono text-zinc-900 dark:text-white">84 500 FCFA</span>
                </div>
                
                <div className="animate-float animation-delay-2000 absolute right-2 sm:-right-4 -bottom-5 bg-white dark:bg-zinc-800 rounded-full py-2.5 px-4 shadow-xl border border-zinc-100 dark:border-zinc-700 flex items-center gap-2">
                   <div className="h-2.5 w-2.5 rounded-full bg-[#10B981]"></div>
                   <span className="text-xs font-bold text-zinc-900 dark:text-white">{tLanding("mock_relance")}</span>
                </div>
             </div>
          </div>
        </div>

        {/* Features Cards */}
        <div className="mt-32 grid sm:grid-cols-3 gap-6">
           <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 sm:p-10 shadow-sm border border-zinc-100 dark:border-zinc-800">
             <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">{tLanding("feature_sales_title")}</h3>
             <p className="text-sm text-zinc-500 leading-relaxed">{tLanding("feature_sales_desc")}</p>
           </div>
           <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 sm:p-10 shadow-sm border border-zinc-100 dark:border-zinc-800">
             <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">{tLanding("feature_shop_title")}</h3>
             <p className="text-sm text-zinc-500 leading-relaxed">{tLanding("feature_shop_desc")}</p>
           </div>
           <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 sm:p-10 shadow-sm border border-zinc-100 dark:border-zinc-800">
             <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">{tLanding("feature_whatsapp_title")}</h3>
             <p className="text-sm text-zinc-500 leading-relaxed">{tLanding("feature_whatsapp_desc")}</p>
           </div>
        </div>

        {/* Footer Metrics */}
        <div className="mt-20 grid sm:grid-cols-3 gap-8 lg:gap-12 pt-16">
           <div>
             <div className="text-2xl font-bold text-[#7B46F6] font-mono mb-2">{tLanding("footer_100_title")}</div>
             <div className="text-sm text-zinc-600 dark:text-zinc-400">{tLanding("footer_100_desc")}</div>
           </div>
           <div>
             <div className="text-2xl font-bold text-[#7B46F6] font-mono mb-2">{tLanding("footer_lang_title")}</div>
             <div className="text-sm text-zinc-600 dark:text-zinc-400">{tLanding("footer_lang_desc")}</div>
           </div>
           <div>
             <div className="text-2xl font-bold text-[#7B46F6] font-mono mb-2">{tLanding("footer_mobile_title")}</div>
             <div className="text-sm text-zinc-600 dark:text-zinc-400">{tLanding("footer_mobile_desc")}</div>
           </div>
        </div>
      </main>
    </div>
  );
}
