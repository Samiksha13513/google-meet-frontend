'use client'

export default function Page() {
  const countries = [
    { country: 'Albania (AL)', number: '+355 4 530 1809' },
    { country: 'Angola (AO)', number: '+244 226 425 540' },
    { country: 'Argentina (AR)', number: '+54 11 3986-3700' },
    { country: 'Australia (AU)', number: '+61 2 8320 4510' },
    { country: 'Austria (AT)', number: '+43 1 22781000' },
    { country: 'Barbados (BB)', number: '+1 246-623-9887' },
    { country: 'Belgium (BE)', number: '+32 2 896 35 00' },
    { country: 'Benin (BJ)', number: '+229 01 61 50 99 90' },
    { country: 'Brazil (BR)', number: '+55 21 3500-1798' },
    { country: 'Bulgaria (BG)', number: '+359 2 907 4000' },
    { country: 'Cambodia (KH)', number: '+855 23 962 640' },
    { country: 'Canada (CA)', number: '+1 437-781-4585' },
    { country: 'Cayman Islands (KY)', number: '+1 345-769-7456' },
    { country: 'Chile (CL)', number: '+56 43 245 2070' },
    { country: 'Colombia (CO)', number: '+57 601 8956250' },
    { country: 'Costa Rica (CR)', number: '+506 4010 2450' },
    { country: 'Croatia (HR)', number: '+385 1 2772 000' },
    { country: 'Curaçao (CW)', number: '+599 9 788 9961' },
    { country: 'Czechia (CZ)', number: '+420 234 610 000' },
  ]

  const pin = '659 928 490 0190#'

  return (
    <main className="min-h-screen bg-white">
      {/* Header with logo */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-10 py-4">
          <div className="flex items-center gap-2">
            {/* Google Meet Logo */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
              className="flex-shrink-0"
            >
              {/* Yellow background */}
              <rect width="48" height="48" rx="8" fill="#FFC107" />
              {/* Video icon */}
              <path
                d="M14 16h16v16H14v-16zm18-2h6v20h-6v-20z"
                fill="white"
              />
            </svg>
            <span className="text-2xl font-normal text-gray-900">Meet</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-10 py-12">
        {/* Heading */}
        <div className="mb-12 max-w-2xl">
          <h1 className="mb-4 text-base font-normal text-gray-900 leading-relaxed">
            To join your meeting, dial one of these numbers and then enter this PIN:
          </h1>
          <p className="text-base font-semibold text-gray-900">{pin}</p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Table header */}
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 text-left text-sm font-normal text-blue-600">
                  Country
                </th>
                <th className="pb-3 text-left text-sm font-normal text-blue-600">
                  Dial-in number
                </th>
              </tr>
            </thead>
            {/* Table body */}
            <tbody>
              {countries.map((item, index) => (
                <tr
                  key={index}
                  className={`border-b border-gray-200 ${index === countries.length - 1
                      ? 'bg-gray-100'
                      : 'hover:bg-gray-50'
                    }`}
                >
                  <td className="py-3 text-sm text-gray-900">{item.country}</td>
                  <td className="py-3 text-sm text-gray-900">{item.number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PIN note at bottom */}
        <div className="mt-8 flex items-center gap-2">
          <span className="text-sm text-gray-600">PIN:</span>
          <span className="text-sm font-medium text-gray-900">{pin}</span>
        </div>
      </div>
    </main>
  )
}
