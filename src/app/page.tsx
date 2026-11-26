import { HomeHighlights } from "@/components/home-highlights";
import { ShortenerWorkbench } from "@/components/shortener-workbench";

export default function HomePage(): React.ReactElement {
  return (
    <div className="space-y-8">
      <ShortenerWorkbench />
      <HomeHighlights />
    </div>
  );
}
