import { PublicSearch } from "@/components/public/PublicSearch";

/**
 * Institutional attribution line -- kept as a named constant, not
 * inline text, specifically so it stays easy to find and edit and
 * never silently implies ElectIQ itself is IEBC. This is a real
 * disclosure requirement from the approved design, not decoration.
 */
const INSTITUTIONAL_ATTRIBUTION =
  "Official election results, verified and published by the Independent Electoral and Boundaries Commission (IEBC).";

export function PublicHero({ electionId, countryName }: { electionId: string; countryName: string }) {
  return (
    <section className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-20 text-center text-white">
      {/*
        Temporary gradient background standing in for a real photograph.
        A real image was not fabricated or claimed to be licensed here.
        To swap in the real hero photo later: replace this div's
        className with a background-image style pointing at
        /public/images/kenya-election-hero.jpg (plus a dark overlay div
        exactly like the one below) -- no other structural change
        needed anywhere else in this component.
      */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-pub-blue via-[#1E3A6E] to-[#0F1F3D]" />
      <div className="absolute inset-0 -z-10 bg-black/20" />

      <h1 className="text-4xl font-bold sm:text-5xl">{countryName}</h1>
      <p className="mt-3 text-lg text-white/90">Transparent elections. A stronger tomorrow.</p>
      <p className="mt-2 max-w-2xl text-sm text-white/70">{INSTITUTIONAL_ATTRIBUTION}</p>

      <div className="mt-8 w-full max-w-2xl">
        <PublicSearch electionId={electionId} />
      </div>
    </section>
  );
}
