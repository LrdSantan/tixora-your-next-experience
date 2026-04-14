import { Users, Shield, Zap, Heart } from "lucide-react";

export default function About() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-5xl">
      {/* Hero Section */}
      <section className="text-center mb-20 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-6 leading-tight">
          Bringing Nigeria's Best <span className="text-gradient">Events to You</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Tixora is Nigeria's modern event ticketing platform — built to make discovering, booking, and managing event tickets effortless for everyone.
        </p>
      </section>

      {/* Our Story */}
      <section className="grid md:grid-cols-2 gap-12 mb-20 items-center">
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-foreground">Our Story</h2>
          <p className="text-muted-foreground leading-relaxed">
            Tixora was born out of frustration. Buying tickets to events in Nigeria was still largely informal — bank transfers to strangers, WhatsApp confirmations, and no proof of purchase. We knew there had to be a better way.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Built by a team that loves Nigerian culture, music, sports, and art, Tixora is our answer to the problem — a platform where organizers can list events with confidence and attendees can buy tickets securely, receive digital tickets instantly, and show up ready to enjoy.
          </p>
        </div>
        <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-3xl p-8 aspect-square flex items-center justify-center">
          <Users className="w-32 h-32 text-primary opacity-80" />
        </div>
      </section>

      {/* Mission */}
      <section className="bg-hero-bg text-white rounded-3xl p-12 text-center mb-20 shadow-xl overflow-hidden relative">
        <div className="relative z-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-secondary mb-4">Our Mission</h2>
          <p className="text-2xl md:text-3xl font-bold max-w-2xl mx-auto leading-tight">
            Our mission is simple: make every Nigerian event experience seamless — from discovery to the door.
          </p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/10 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/20 rounded-full -ml-32 -mb-32 blur-3xl opacity-50" />
      </section>

      {/* Values */}
      <section className="mb-20">
        <h2 className="text-3xl font-bold text-center mb-12">Our Core Values</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Trust",
              desc: "Every transaction on Tixora is secured and every ticket is verifiable. No fakes, no fraud.",
              icon: Shield,
              color: "text-blue-500",
              bg: "bg-blue-50"
            },
            {
              title: "Simplicity",
              desc: "We obsess over making ticketing as simple as possible for both organizers and attendees.",
              icon: Zap,
              color: "text-amber-500",
              bg: "bg-amber-50"
            },
            {
              title: "Community",
              desc: "We believe in Nigerian culture, creativity, and community. Every event on Tixora is a celebration of that.",
              icon: Heart,
              color: "text-primary",
              bg: "bg-primary/5"
            }
          ].map((val, idx) => (
            <div key={idx} className="bg-card border border-border p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className={`${val.bg} w-12 h-12 rounded-xl flex items-center justify-center mb-6`}>
                <val.icon className={`w-6 h-6 ${val.color}`} />
              </div>
              <h3 className="text-xl font-bold mb-3">{val.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{val.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team Section */}
      <section className="bg-surface border border-border rounded-3xl p-12 overflow-hidden relative">
        <div className="flex flex-col md:flex-row gap-12 items-center relative z-10">
          <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-5xl font-black text-white shrink-0 shadow-lg">
            YA
          </div>
          <div className="space-y-4 text-center md:text-left">
            <h2 className="text-3xl font-bold text-foreground">Meet the Founder</h2>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-primary">Yusuf Ayodeji (Deji)</h3>
              <p className="text-muted-foreground font-medium italic">Founder & Developer, Abuja, Nigeria</p>
            </div>
            <p className="text-muted-foreground leading-relaxed max-w-2xl">
              Deji built Tixora to solve a real problem he experienced firsthand. A frontend developer and entrepreneur, he is passionate about building products that work for Nigeria.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
