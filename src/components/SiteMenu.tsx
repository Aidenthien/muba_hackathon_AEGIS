"use client";

import StaggeredMenu from "@/components/StaggeredMenu";
import AegisMark from "@/components/AegisMark";

const ITEMS = [
  { label: "Home", ariaLabel: "Go to the home section", link: "#" },
  {
    label: "Dev",
    ariaLabel: "Developer docs — install the extension and integrate AEGIS",
    link: "/developer",
  },
];

export default function SiteMenu() {
  return (
    <StaggeredMenu
      isFixed
      position="right"
      logo={<AegisMark className="h-9 w-9" />}
      items={ITEMS}
      displaySocials={false}
      displayItemNumbering
      colors={["#041020", "#4da2ff"]}
      accentColor="#6ff7ff"
      menuButtonColor="#e8f1fb"
      openMenuButtonColor="#6ff7ff"
    />
  );
}
