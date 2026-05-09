import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { generateCalendarLinks, downloadIcs } from "@/lib/calendar";

const IcsDownloadPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const title = searchParams.get("title") || "Event";
    const description = searchParams.get("description") || "";
    const location = searchParams.get("location") || "";
    const date = searchParams.get("date") || "";
    const time = searchParams.get("time") || "00:00";

    if (!date) {
      navigate("/");
      return;
    }

    const { icsContent } = generateCalendarLinks({
      title,
      description,
      location,
      startDate: date,
      startTime: time
    });

    downloadIcs(title, icsContent);
    
    // Small delay before navigating back
    const timer = setTimeout(() => {
      navigate(-1);
    }, 1500);

    return () => clearTimeout(timer);
  }, [searchParams, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
      <h1 className="text-xl font-bold mb-2">Preparing Calendar File</h1>
      <p className="text-muted-foreground">Your event invitation is being generated and downloaded.</p>
    </div>
  );
};

export default IcsDownloadPage;
