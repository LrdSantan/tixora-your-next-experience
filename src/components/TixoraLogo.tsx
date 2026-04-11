import { Ticket } from "lucide-react";
import { Link } from "react-router-dom";

const TixoraLogo = () => (
  <Link to="/" className="flex items-center gap-2">
    <Ticket className="w-7 h-7 text-primary rotate-[-30deg]" />
    <span className="text-xl font-extrabold tracking-tight text-primary">TIXORA</span>
  </Link>
);

export default TixoraLogo;
