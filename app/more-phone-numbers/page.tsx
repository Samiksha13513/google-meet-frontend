import { Phone } from "lucide-react";

export default function MorePhoneNumbers() {
  const phoneNumbers = [
    ["Albania (AL)", "+355 4 530 1809"],
    ["Angola (AO)", "+244 226 425 540"],
    ["Argentina (AR)", "+54 11 3986-3700"],
    ["Australia (AU)", "+61 2 8320 4510"],
    ["Austria (AT)", "+43 1 22781000"],
    ["Barbados (BB)", "+1 246-623-9887"],
    ["Belgium (BE)", "+32 2 896 35 00"],
    ["Benin (BJ)", "+229 01 61 50 99 90"],
    ["Brazil (BR)", "+55 21 3500-1798"],
    ["Bulgaria (BG)", "+359 2 907 4000"],
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-6 sm:p-12">
      <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm border border-[#dfe1e5]">
        <div className="mb-8 flex items-center gap-4 border-b border-[#dfe1e5] pb-8">
          <div className="rounded-full bg-[#e8f0fe] p-4 text-[#1a73e8]">
            <Phone size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-normal text-[#202124]">Dial-in numbers</h1>
            <p className="mt-2 text-[15px] text-[#5f6368]">Use these numbers to join your meeting by phone</p>
          </div>
        </div>

        <div className="mb-8 rounded-2xl bg-[#f1f3f4] p-6">
          <p className="text-[16px] font-medium text-[#202124]">
            To join your meeting, dial one of these numbers and then enter this PIN:
          </p>
          <p className="mt-2 text-2xl font-medium tracking-wide text-[#1a73e8]">617 403 022#</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {phoneNumbers.map(([country, number]) => (
            <div key={country} className="flex items-center justify-between rounded-2xl border border-[#dfe1e5] p-5 hover:bg-[#f8f9fa] transition-colors">
              <span className="text-[15px] font-medium text-[#202124]">{country}</span>
              <span className="text-[15px] font-mono text-[#5f6368]">{number}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
