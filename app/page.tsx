import { GeneratePageComponent } from "@/components/generate-page";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <GeneratePageComponent />
    </div>
  );
}
