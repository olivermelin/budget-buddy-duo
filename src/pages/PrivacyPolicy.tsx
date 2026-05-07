import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2 rounded-xl">
            <Link to="/login">
              <ArrowLeft className="h-4 w-4" /> Tillbaka
            </Link>
          </Button>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl font-display font-bold">Integritetspolicy</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Senast uppdaterad: {new Date().toLocaleDateString("sv-SE", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-foreground">

          <section className="space-y-3">
            <h2 className="text-xl font-display font-semibold">1. Vem ansvarar för dina uppgifter?</h2>
            <p className="text-muted-foreground leading-relaxed">
              BudgetBuddy är en personlig budgetapplikation. Tjänsten drivs utan kommersiellt syfte.
              Vi behandlar dina personuppgifter i enlighet med EU:s dataskyddsförordning (GDPR,
              förordning 2016/679).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-display font-semibold">2. Vilka uppgifter samlar vi in?</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex gap-2"><span className="text-foreground font-medium">Kontouppgifter:</span> E-postadress och namn via Google OAuth.</li>
              <li className="flex gap-2"><span className="text-foreground font-medium">Ekonomidata:</span> Transaktioner, kategorier, budget, sparmål och lån som du och ditt hushåll lägger in.</li>
              <li className="flex gap-2"><span className="text-foreground font-medium">Hushållsdata:</span> Information om hushållets medlemmar (visningsnamn, inkomst, färg).</li>
              <li className="flex gap-2"><span className="text-foreground font-medium">Teknisk data:</span> Felrapporter via Sentry (anonymiserade stacktraces) om ett fel uppstår.</li>
            </ul>
            <p className="text-muted-foreground">
              Vi samlar <strong className="text-foreground">inte</strong> in reklamsyftad data, säljer inga uppgifter till tredje part och
              använder inga spårningscookies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-display font-semibold">3. Varför behandlar vi uppgifterna?</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li><strong className="text-foreground">Avtalets fullgörande (Art. 6.1.b):</strong> För att tillhandahålla tjänsten — visa din ekonomi, synkronisera med hushållets medlemmar.</li>
              <li><strong className="text-foreground">Berättigat intresse (Art. 6.1.f):</strong> Felrapportering för att förbättra stabiliteten.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-display font-semibold">4. Var lagras uppgifterna?</h2>
            <p className="text-muted-foreground leading-relaxed">
              All data lagras hos <strong className="text-foreground">Supabase</strong> i EU-regionen (Frankfurt, eu-central-1).
              Data lämnar aldrig EU/EES. Supabase är ISO 27001-certifierat och SOC 2 Type II-granskat.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-display font-semibold">5. Hur länge sparas uppgifterna?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Dina uppgifter sparas så länge ditt konto är aktivt. När du raderar ditt konto
              (via Inställningar → Radera mitt konto) tas alla personuppgifter bort omedelbart.
              Anonymiserade transaktionsposter kan kvarstå utan koppling till din identitet.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-display font-semibold">6. Dina rättigheter</h2>
            <p className="text-muted-foreground">Du har rätt att:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li><strong className="text-foreground">Tillgång (Art. 15):</strong> Begära ut en kopia av dina uppgifter via Inställningar → Exportera data.</li>
              <li><strong className="text-foreground">Rättelse (Art. 16):</strong> Korrigera felaktiga uppgifter direkt i appen.</li>
              <li><strong className="text-foreground">Radering (Art. 17):</strong> Radera ditt konto och alla dina uppgifter via Inställningar → Radera mitt konto.</li>
              <li><strong className="text-foreground">Dataportabilitet (Art. 20):</strong> Exportera dina transaktioner som XLSX eller PDF via Inställningar → Exportera data.</li>
              <li><strong className="text-foreground">Invändning (Art. 21):</strong> Invända mot behandling baserad på berättigat intresse.</li>
            </ul>
            <p className="text-muted-foreground">
              Du har också rätt att lämna in klagomål till{" "}
              <strong className="text-foreground">Integritetsskyddsmyndigheten (IMY)</strong> på{" "}
              <a href="https://www.imy.se" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">imy.se</a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-display font-semibold">7. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Vi använder enbart tekniskt nödvändiga cookies för inloggningssessionen (Supabase auth-token).
              Inga spårningscookies eller reklamcookies används.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-display font-semibold">8. Kontakt</h2>
            <p className="text-muted-foreground leading-relaxed">
              Har du frågor om hur vi hanterar dina personuppgifter? Kontakta oss via{" "}
              <a href="mailto:olivermelin62@gmail.com" className="underline hover:text-foreground">
                olivermelin62@gmail.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
