import { useState } from "react";
import "./_group.css";
import "./NeonCapsules.css";
import { FeedPreview } from "./_shared/FeedPreview";
import GolSlider from "./_shared/GolSlider";

export function NeonCapsuleStartMenu() {
  const [activeFeature, setActiveFeature] = useState("Fame");

  return (
    <>
      <FeedPreview />
      <GolSlider
        activeFeature={activeFeature}
        onFeatureChange={setActiveFeature}
        onRefresh={() => undefined}
        initiallyOpen
        disableAutoClose
        previewVariant="neon"
      />
    </>
  );
}
