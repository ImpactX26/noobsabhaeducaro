import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Check, X, ArrowRight, ArrowDown, Menu } from "lucide-react";
import { SiegLogo } from "@/components/SiegLogo";
import { Marquee } from "@/components/Marquee";
import { useReveal } from "@/hooks/useReveal";

const universities = ["RWTH Aachen University", "Technical University of Munich", "TU Berlin", "TU Dresden", "TU Darmstadt", "TU Braunschweig", "Heidelberg University", "University of Bonn", "KIT", "University of Stuttgart", "University of Hamburg", "University of Cologne", "University of Freiburg", "University of Mannheim", "University of Göttingen"];
const companies = ["SAP", "Siemens", "Bosch", "BMW", "Mercedes-Benz", "Volkswagen", "Deutsche Telekom", "Allianz", "BASF", "Infineon", "Continental", "Adidas", "Zalando", "Lufthansa"];

const Label = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`font-mono-label text-[10px] md:text-xs ${className}`}>{children}</span>
);

const CTA = ({ to = "/dashboard", children, dark }: { to?: string; children: React.ReactNode; dark?: boolean }) => (
  <Link to={to} className={`font-mono-label group inline-flex items-center gap-3 px-6 py-4 text-xs font-bold transition-transform hover:-translate-y-1 ${dark ? "bg-sieg-black text-sieg-yellow" : "bg-sieg-yellow text-sieg-black"}`}>
    {children} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
  </Link>
);

function Row({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between border-b border-current/10 py-2.5">
      <span className="flex items-center gap-3">
        <span className={`flex h-6 w-6 items-center justify-center ${ok ? "bg-sieg-success text-sieg-white" : "bg-sieg-red text-sieg-white"}`}>
          {ok ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <X className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
        <span className="font-semibold">{label}</span>
      </span>
      <Label className={ok ? "opacity-60" : "text-sieg-red"}>{ok ? "OK" : "Missing"}</Label>
    </div>
  );
}

function ProgressPanel({ complete = false, className = "" }: { complete?: boolean; className?: string }) {
  return (
    <div className={`border-2 border-sieg-black bg-sieg-white text-sieg-black shadow-[12px_12px_0_0_hsl(var(--sieg-red))] ${className}`}>
      <div className="flex items-center justify-between bg-sieg-black px-5 py-3 text-sieg-white">
        <SiegLogo className="text-lg" />
        <Label className="text-sieg-yellow">✦ Just now</Label>
      </div>
      <div className="p-5">
        <Label className="opacity-60">Application progress</Label>
        <div className="flex items-end justify-between">
          <p className="font-display mt-2 whitespace-nowrap text-6xl">{complete ? "5" : "4"}<span className="text-sieg-red"> / 5</span></p>
          <Label className={complete ? "bg-sieg-success px-2 py-1 text-sieg-white" : "bg-sieg-yellow px-2 py-1"}>{complete ? "Complete" : "Almost complete"}</Label>
        </div>
        <div className="mt-3 h-2 bg-sieg-black/10"><div className="h-full bg-sieg-red transition-all duration-1000" style={{ width: complete ? "100%" : "80%" }} /></div>
        <div className="mt-4 text-sm">
          <Row ok label="Degree" /><Row ok label="Academic Marks" /><Row ok label="Documents" /><Row ok={complete} label="Language Certificate" />
        </div>
        <div className={`mt-5 p-4 ${complete ? "bg-sieg-black text-sieg-white" : "bg-sieg-yellow"}`}>
          <Label className="opacity-70">Your next step</Label>
          <p className="font-display mt-2 text-xl uppercase">{complete ? "Explore German universities" : "Upload your language certificate"}</p>
          <span className={`font-mono-label mt-3 inline-block px-3 py-2 text-[10px] font-bold ${complete ? "bg-sieg-yellow text-sieg-black" : "bg-sieg-black text-sieg-yellow"}`}>{complete ? "Explore →" : "Upload certificate"}</span>
        </div>
      </div>
    </div>
  );
}

function DocSheet({ name, tag, tone, style, className = "" }: { name: string; tag: string; tone: "ok" | "unknown" | "missing"; style?: React.CSSProperties; className?: string }) {
  const tagCls = tone === "ok" ? "bg-sieg-success text-sieg-white" : tone === "unknown" ? "bg-sieg-yellow text-sieg-black" : "bg-sieg-black text-sieg-yellow";
  return (
    <div style={style} className={`floaty absolute w-40 border-2 border-sieg-black bg-sieg-white p-4 text-sieg-black shadow-[6px_6px_0_0_hsl(var(--sieg-black))] md:w-52 ${className}`}>
      <div className="space-y-1.5">{[90, 70, 80, 50].map((w, i) => <div key={i} className="h-1.5 bg-sieg-black/15" style={{ width: `${w}%` }} />)}</div>
      <p className="mt-4 truncate text-sm font-bold">{name}</p>
      <span className={`font-mono-label mt-2 inline-block px-2 py-1 text-[9px] font-bold ${tagCls}`}>{tag}</span>
    </div>
  );
}

function DynamicJourney() {
  const [after, setAfter] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setAfter((a) => !a), 3500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="grid items-center gap-8 md:grid-cols-[1fr_auto_1fr]">
      <div className={`transition-opacity duration-700 ${after ? "opacity-40" : "opacity-100"}`}><Label className="mb-3 block text-sieg-red">Before</Label><ProgressPanel /></div>
      <div className="flex flex-row items-center justify-center gap-3 md:flex-col">
        {["User uploads", "AI analyzes"].map((s) => (
          <div key={s} className="flex flex-col items-center gap-2"><ArrowDown className="h-6 w-6 text-sieg-red md:rotate-0" /><Label className="bg-sieg-black px-3 py-2 text-sieg-yellow">{s}</Label></div>
        ))}
      </div>
      <div className={`transition-opacity duration-700 ${after ? "opacity-100" : "opacity-40"}`}><Label className="mb-3 block text-sieg-success">After</Label><ProgressPanel complete /></div>
    </div>
  );
}

export default function Home() {
  useReveal();
  const [menu, setMenu] = useState(false);

  return (
    <div className="overflow-x-hidden bg-sieg-black text-sieg-white">
      {/* NAV */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-sieg-white/10 bg-sieg-black/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-5 md:px-10">
          <Link to="/"><SiegLogo className="text-2xl" /></Link>
          <nav className="hidden gap-10 md:flex">
            {[["How It Works", "#how"], ["Journey", "#journey"], ["Opportunities", "#opportunities"]].map(([l, h]) => (
              <a key={h} href={h} className="font-mono-label text-[11px] text-sieg-white/70 hover:text-sieg-yellow">{l}</a>
            ))}
          </nav>
          <div className="hidden items-center gap-6 md:flex">
            <Link to="/auth" className="font-mono-label text-[11px] hover:text-sieg-yellow">Login</Link>
            <Link to="/dashboard" className="font-mono-label bg-sieg-yellow px-4 py-2.5 text-[11px] font-bold text-sieg-black hover:bg-sieg-white">Start your journey →</Link>
          </div>
          <button className="md:hidden" onClick={() => setMenu(!menu)} aria-label="Menu"><Menu /></button>
        </div>
        {menu && (
          <div className="flex flex-col gap-4 border-t border-sieg-white/10 bg-sieg-black p-5 md:hidden">
            <a href="#how" onClick={() => setMenu(false)} className="font-mono-label text-xs">How it works</a>
            <a href="#journey" onClick={() => setMenu(false)} className="font-mono-label text-xs">Journey</a>
            <a href="#opportunities" onClick={() => setMenu(false)} className="font-mono-label text-xs">Opportunities</a>
            <Link to="/dashboard" className="font-mono-label bg-sieg-yellow px-4 py-3 text-xs font-bold text-sieg-black">Start your journey →</Link>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="relative min-h-screen overflow-hidden pt-24">
        <div className="absolute -right-32 top-16 h-[78vh] w-[40vw] bg-sieg-red" />
        <div className="absolute bottom-0 right-[28vw] h-40 w-40 bg-sieg-yellow md:h-64 md:w-64" />
        <div className="absolute left-0 top-[58%] h-3 w-1/3 bg-sieg-yellow" />
        <div className="relative mx-auto grid max-w-[1600px] gap-10 px-5 pb-16 md:px-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sieg-white/60">
              <Label>AI-powered applicant journey</Label><Label className="text-sieg-yellow">Germany / 2026</Label>
            </div>
            <h1 className="font-display mt-8 text-[15vw] uppercase lg:text-[7vw]">
              <span className="block">Your path</span>
              <span className="block">to <span className="text-sieg-yellow">Germany.</span></span>
              <span className="mt-4 block text-sieg-white">Made</span>
              <span className="block text-sieg-red">intelligent.</span>
            </h1>
            <p className="mt-10 max-w-md text-lg text-sieg-white/80">AI-powered document intelligence for your journey to Germany.</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <CTA>Start your journey</CTA>
              <a href="#how" className="font-mono-label inline-flex items-center gap-3 border border-sieg-white px-6 py-4 text-xs font-bold hover:bg-sieg-white hover:text-sieg-black">Explore how it works →</a>
            </div>
            <div className="mt-14 flex gap-6 text-sieg-white/50"><Label>Document intelligence</Label><Label>Qualification check</Label></div>
          </div>
          <div className="relative flex items-center lg:pt-20">
            <ProgressPanel className="w-full max-w-md rotate-[-2deg] lg:ml-auto" />
          </div>
        </div>
        <a href="#problem" className="relative mx-auto flex max-w-[1600px] items-center gap-2 px-5 pb-8 text-sieg-white/60 md:px-10"><Label>Scroll to explore</Label><ArrowDown className="h-4 w-4 animate-bounce" /></a>
      </section>

      {/* PROBLEM */}
      <section id="problem" className="relative overflow-hidden bg-sieg-red px-5 py-28 text-sieg-black md:px-10">
        <Label className="relative z-10">01 — The problem</Label>
        <h2 className="font-display reveal relative z-10 mt-6 text-[18vw] uppercase md:text-[12vw]">
          Turn<br /><span className="text-sieg-yellow">documents</span><br />into<br /><span className="text-sieg-yellow">direction.</span>
        </h2>
        <DocSheet name="CV.pdf" tag="✓ Verified" tone="ok" className="right-[6%] top-[10%]" style={{ ["--r" as string]: "6deg" }} />
        <DocSheet name="BTech_Degree.pdf" tag="✓ Verified" tone="ok" className="right-[30%] top-[28%] hidden md:block" style={{ ["--r" as string]: "-8deg", animationDelay: "1s" }} />
        <DocSheet name="12th_Marksheet.pdf" tag="? Unknown" tone="unknown" className="right-[4%] top-[46%]" style={{ ["--r" as string]: "-4deg", animationDelay: "2s" }} />
        <DocSheet name="Experience_Letter.pdf" tag="? Unknown" tone="unknown" className="right-[24%] top-[62%] hidden md:block" style={{ ["--r" as string]: "10deg", animationDelay: ".5s" }} />
        <DocSheet name="Language_Certificate.pdf" tag="! Missing" tone="missing" className="right-[8%] top-[74%]" style={{ ["--r" as string]: "3deg", animationDelay: "1.5s" }} />
        <div className="reveal relative z-10 mt-14 max-w-xl space-y-4 text-lg font-medium md:text-xl">
          <p>Your CV. Your degree. Your marksheets. Your experience. Your language certificate.</p>
          <p className="text-sieg-white">Individually, they're just documents. Together, they tell the story of your journey.</p>
        </div>
        <p className="font-display reveal relative z-10 mt-16 inline-block bg-sieg-black px-6 py-4 text-3xl text-sieg-white md:text-5xl">
          <SiegLogo /> brings them together.
        </p>
      </section>

      {/* INTRODUCE */}
      <section className="relative overflow-hidden px-5 py-28 md:px-10">
        <div className="mx-auto grid max-w-[1600px] items-center gap-14 lg:grid-cols-2">
          <div className="reveal">
            <Label className="text-sieg-yellow">02 — Introducing</Label>
            <h2 className="font-display mt-6 text-6xl uppercase md:text-8xl">One journey.<br /><span className="text-sieg-red">Everything</span><br />in one place.</h2>
            <SiegLogo className="mt-8 block text-7xl md:text-9xl" />
            <p className="mt-8 max-w-md text-lg text-sieg-white/70">sieg.ai brings your documents, profile, qualification status and next action into one intelligent journey.</p>
          </div>
          <div className="reveal relative">
            <div className="absolute -left-6 -top-6 h-full w-full bg-sieg-yellow" />
            <div className="relative grid grid-cols-2 gap-px border-2 border-sieg-white bg-sieg-white/20">
              {[["Profile", "80%", "AI extracted"], ["Documents", "4 / 5", "Processed"], ["Qualification", "Almost", "There"], ["Next step", "1", "Action"]].map(([a, b, c], i) => (
                <div key={a} className={`p-6 ${i === 3 ? "bg-sieg-red" : "bg-sieg-ink"}`}>
                  <Label className="opacity-60">{a}</Label>
                  <p className="font-display mt-4 text-5xl">{b}</p>
                  <Label className={i === 3 ? "text-sieg-black" : "text-sieg-yellow"}>✦ {c}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW */}
      <section id="how">
        <div className="bg-sieg-white px-5 py-20 text-sieg-black md:px-10">
          <h2 className="font-display reveal text-[18vw] uppercase md:text-[11vw]">How<br /><SiegLogo onDark={false} /><br />works.</h2>
        </div>
        {[
          ["01", "Upload", "Bring your documents together.", "bg-sieg-black text-sieg-white", "text-sieg-red"],
          ["02", "Understand", "AI extracts and organizes the information inside them.", "bg-sieg-red text-sieg-black", "text-sieg-white"],
          ["03", "Check", "Identify missing requirements, conflicts and qualification gaps.", "bg-sieg-yellow text-sieg-black", "text-sieg-red"],
          ["04", "Act", "Know exactly what to do next.", "bg-sieg-ink text-sieg-white", "text-sieg-yellow"],
        ].map(([n, t, d, bg, accent], i) => (
          <div key={n} className={`${bg} border-t border-sieg-black/20 px-5 py-14 md:px-10`}>
            <div className={`reveal mx-auto flex max-w-[1600px] flex-col gap-4 md:flex-row md:items-end md:justify-between ${i % 2 ? "md:flex-row-reverse md:text-right" : ""}`}>
              <div className="flex items-end gap-6">
                <span className={`font-display text-6xl md:text-8xl ${accent}`}>{n}</span>
                <span className="font-display text-6xl uppercase md:text-[9vw]">{t}</span>
              </div>
              <p className="max-w-sm text-lg font-medium md:text-xl">{d}</p>
            </div>
          </div>
        ))}
      </section>

      {/* AI INTELLIGENCE */}
      <section className="px-5 py-28 md:px-10">
        <div className="mx-auto grid max-w-[1600px] gap-16 lg:grid-cols-2">
          <h2 className="font-display reveal text-6xl uppercase md:text-8xl">It doesn't<br />just read<br />your documents.<br /><span className="text-sieg-red">It understands<br />the journey.</span></h2>
          <div className="reveal relative">
            <div className="flex flex-wrap gap-2">
              {["CV", "Degree", "Marks", "Language", "Experience"].map((d) => (
                <span key={d} className="font-mono-label border border-sieg-white/40 px-3 py-2 text-xs">{d}</span>
              ))}
            </div>
            <svg className="my-2 h-16 w-full" viewBox="0 0 400 60" preserveAspectRatio="none">
              {[40, 120, 200, 280, 360].map((x) => <path key={x} className="flow-line" d={`M${x} 0 C ${x} 30, 200 30, 200 60`} stroke="hsl(var(--sieg-yellow))" strokeWidth="2" fill="none" />)}
            </svg>
            {[["AI analysis", "bg-sieg-red text-sieg-white"], ["Profile", "bg-sieg-ink border border-sieg-white/30"], ["Qualification", "bg-sieg-ink border border-sieg-white/30"], ["Next action", "bg-sieg-yellow text-sieg-black"]].map(([s, c], i, arr) => (
              <div key={s}>
                <div className={`font-display px-6 py-5 text-3xl uppercase ${c}`}>{i === 0 && "✦ "}{s}</div>
                {i < arr.length - 1 && <svg className="mx-auto h-8 w-4" viewBox="0 0 4 30"><line className="flow-line" x1="2" y1="0" x2="2" y2="30" stroke="hsl(var(--sieg-yellow))" strokeWidth="2" /></svg>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QUALIFICATION */}
      <section className="bg-sieg-yellow px-5 py-28 text-sieg-black md:px-10">
        <div className="mx-auto grid max-w-[1600px] items-center gap-14 lg:grid-cols-2">
          <h2 className="font-display reveal text-[18vw] uppercase lg:text-[10vw]">Are you<br /><span className="text-sieg-red">ready?</span></h2>
          <div className="reveal border-2 border-sieg-black bg-sieg-black text-sieg-white shadow-[14px_14px_0_0_hsl(var(--sieg-red))]">
            <div className="flex justify-between border-b border-sieg-white/20 p-5"><Label className="text-sieg-yellow">Qualification check</Label><Label className="opacity-50">✦ AI verified</Label></div>
            {[["Degree", true], ["Academic marks", true], ["Language certificate", false]].map(([l, ok]) => (
              <div key={l as string} className="flex items-center justify-between border-b border-sieg-white/10 px-5 py-5">
                <span className="font-display flex items-center gap-4 text-2xl uppercase md:text-3xl">
                  <span className={`flex h-9 w-9 items-center justify-center ${ok ? "bg-sieg-success" : "bg-sieg-red"}`}>{ok ? <Check strokeWidth={3} /> : <X strokeWidth={3} />}</span>{l}
                </span>
                <Label className={ok ? "" : "bg-sieg-red px-2 py-1"}>{ok ? "OK" : "Missing"}</Label>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <Label className="opacity-60">Your next step:</Label>
              <CTA>Upload certificate</CTA>
            </div>
          </div>
        </div>
      </section>

      {/* DYNAMIC JOURNEY */}
      <section id="journey" className="bg-sieg-paper px-5 py-28 text-sieg-black md:px-10">
        <div className="mx-auto max-w-[1600px]">
          <h2 className="font-display reveal text-6xl uppercase md:text-[8vw]">Your profile<br /><span className="text-sieg-red">changes.</span> So does<br />your journey.</h2>
          <p className="reveal mt-6 max-w-lg text-lg">sieg.ai adapts the next step as new information becomes available.</p>
          <div className="reveal mt-16"><DynamicJourney /></div>
        </div>
      </section>

      {/* WHAT NEXT */}
      <section className="px-5 py-28 md:px-10">
        <div className="mx-auto grid max-w-[1600px] items-center gap-12 lg:grid-cols-2">
          <h2 className="font-display reveal text-[20vw] uppercase lg:text-[11vw]">So...<br />what's<br />next?</h2>
          <div className="reveal">
            <div className="bg-sieg-red p-8 md:p-12">
              <Label>⚠ Action required</Label>
              <p className="font-display mt-4 text-5xl uppercase md:text-6xl">Your language certificate is missing.</p>
              <p className="mt-6 max-w-md text-lg">Upload a valid certificate so sieg.ai can verify your qualification.</p>
              <div className="mt-8"><CTA>Upload certificate</CTA></div>
            </div>
            <p className="font-display mt-6 text-2xl text-sieg-white/70">Not another checklist. <span className="text-sieg-yellow">A clear next step.</span></p>
          </div>
        </div>
      </section>

      {/* OPPORTUNITIES */}
      <section id="opportunities" className="border-y border-sieg-white/10 py-24">
        <div className="px-5 md:px-10">
          <h2 className="font-display reveal text-6xl uppercase md:text-8xl">Where<br />could you <span className="text-sieg-yellow">go?</span></h2>
          <Label className="mt-8 block text-sieg-red">Universities to explore</Label>
        </div>
        <Marquee items={universities} speed={60} className="mt-6 border-y border-sieg-white/10 bg-sieg-ink py-6" />
        <div className="mt-16 px-5 md:px-10">
          <Label className="block text-sieg-yellow">Companies to explore</Label>
          <p className="mt-3 max-w-xl text-sieg-white/70">Discover opportunities across Germany's technology, engineering and business ecosystem.</p>
        </div>
        <Marquee items={companies} reverse speed={45} className="mt-6 bg-sieg-yellow py-6 text-sieg-black" />
        <p className="mt-6 px-5 text-xs text-sieg-white/40 md:px-10">Names shown for exploration only. Not affiliated with or endorsed by sieg.ai.</p>
      </section>

      {/* PHILOSOPHY */}
      <section className="bg-sieg-white px-5 py-28 text-sieg-black md:px-10">
        <h2 className="font-display reveal text-[14vw] uppercase md:text-[9vw]">No guessing.<br />No endless<br />checklists.<br />Just the <span className="bg-sieg-yellow px-2">next</span> <span className="text-sieg-red">step.</span></h2>
        <div className="mt-14 flex flex-wrap gap-x-12 gap-y-3">
          {["Clarity", "Transparency", "Progress"].map((w) => <Label key={w} className="text-sm">— {w}</Label>)}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden bg-sieg-red px-5 py-28 text-sieg-black md:px-10">
        <h2 className="font-display reveal text-[18vw] uppercase md:text-[10vw]">Your<br />Germany<br />journey<br />starts <span className="text-sieg-white">here.</span></h2>
        <div className="mt-12 flex flex-wrap items-end justify-between gap-8">
          <div><CTA>Start your journey</CTA><p className="mt-4 font-semibold">From documents to your next step.</p></div>
          <SiegLogo onDark={false} egClassName="text-sieg-white" className="text-[22vw] md:text-[16vw]" />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-5 py-14 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div><SiegLogo className="text-4xl" /><p className="mt-3 text-sieg-white/60">Your path to victory in Germany.</p></div>
          <div className="flex gap-8">
            {["About", "Privacy", "Terms", "Contact"].map((l) => <a key={l} href="#" className="font-mono-label text-[11px] text-sieg-white/60 hover:text-sieg-yellow">{l}</a>)}
          </div>
        </div>
        <p className="font-mono-label mt-12 text-[10px] text-sieg-white/40">© 2026 sieg.ai · No guaranteed admission, visa or employment.</p>
      </footer>
    </div>
  );
}
