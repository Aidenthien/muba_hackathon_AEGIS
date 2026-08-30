import SmoothScroll from "@/components/SmoothScroll";
import Preloader from "@/components/Preloader";
import SiteMenu from "@/components/SiteMenu";
import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import Premortem from "@/components/Premortem";
import Pivot from "@/components/Pivot";
import Pipeline from "@/components/Pipeline";
import Moat from "@/components/Moat";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <SmoothScroll>
      <Preloader />
      <SiteMenu />
      <main>
        <Hero />
        <Marquee />
        <Premortem />
        <Pivot />
        <Pipeline />
        <Moat />
      </main>
      <Footer />
    </SmoothScroll>
  );
}
