"use client";

import { MeetingActions } from "./meeting-action";
import { FeatureCarousel } from "./feature-carousel";

export function MainContent() {
  return (
    <main className="flex flex-1 flex-col items-center overflow-auto bg-white px-8 pt-12">
      {/* Hero section */}
      <div className="flex max-w-2xl flex-col items-center text-center">
        {/* Main heading */}
        <h1 className="mb-4 text-3xl font-normal text-[#1f1f1f] md:text-4xl">
          Secure video conferencing
          <br />
          for everyone
        </h1>

        {/* Subheading */}
        <p className="mb-8 text-lg text-gray-600">
          Connect, collaborate, and celebrate from anywhere with
          <br />
          Google Meet
        </p>

        {/* Meeting actions */}
        <MeetingActions />
      </div>

      {/* Divider */}
      <div className="my-12 w-full max-w-2xl">
        <hr className="border-gray-200" />
      </div>

      {/* Feature carousel */}
      <FeatureCarousel />
    </main>
  );
}
