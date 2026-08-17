"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";

const ITEMS = [
  "Electrical room", "Trolly", "Iron stand", "Linen room", "Ground passage",
  "Chemical warehouse", "Staff Kitchen", "Guest Kitchen", "Generator room",
  "Staff Room Top", "Staff Washroom", "Staff Room bottom", "Electrical DB labels",
  "Fire extinguishers", "Lift", "Fire Blanket", "Fire balls", "Dustbins",
  "Terrace", "Plants and trays", "AC grills", "Over all Second Floor",
  "Amenities warehouse", "Food items warehouse", "Telephones", "Corridor glasses",
  "Cameras", "Main warehouse", "Offices", "Cafe outside", "Cafe inside",
  "Parking area", "Entrance", "Reception",
];

export default function SeedFslPage() {
  const { loading: authLoading } = useAuth();
  const [msg, setMsg] = useState("Seeding...");

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      try {
        const { data: branch } = await supabase
          .from("branches")
          .select("id")
          .eq("name", "FSL")
          .single();
        if (!branch) { setMsg("FSL branch not found."); return; }
        const { error } = await supabase.from("quality_areas").insert({
          branch_id: branch.id,
          name: "FSL Quality Check",
          items: ITEMS,
          sort_order: 0,
        });
        if (error) { setMsg("Error: " + error.message); return; }
        setMsg("Done! " + ITEMS.length + " items added to FSL. You can close this page.");
      } catch (e) {
        setMsg("Error: " + String(e));
      }
    })();
  }, [authLoading]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050507] text-zinc-50">
      <p className="text-lg">{msg}</p>
    </div>
  );
}
