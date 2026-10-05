/** Sub-page banner in the style of ilgotalk.com: wide photo with a title on top. */
export function SubHero({ title, subtitle, image = "/site/banner-a.jpg" }: { title: string; subtitle?: string; image?: string }) {
  return (
    <section className="relative overflow-hidden bg-site-teal">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover object-right opacity-90" />
      <div className="absolute inset-0 bg-gradient-to-r from-site-teal via-site-teal/70 to-transparent" />
      <div className="relative mx-auto max-w-7xl px-4 py-14 text-white sm:px-6 sm:py-20">
        <h1 className="text-3xl font-black sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-xl text-lg font-medium sm:text-xl">{subtitle}</p>}
      </div>
    </section>
  );
}

export function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 ${className}`}>{children}</section>;
}
