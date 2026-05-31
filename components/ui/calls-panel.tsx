"use client";

import { Phone } from "lucide-react";

export function CallsPanel() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="rounded-xl border p-8 text-center">
        <Phone className="mx-auto h-10 w-10 text-gray-600" />
        <h2 className="mt-4 text-xl font-medium">Calls</h2>
        <p className="mt-2 text-sm text-gray-600">
          Make and receive direct calls. This area will show your call
          history and contacts.
        </p>
        <div className="mt-6">
          <button
            className="rounded-full bg-blue-600 px-4 py-2 text-white"
            onClick={() => alert("Call flow not implemented yet")}
          >
            Start a call
          </button>
        </div>
      </div>
    </div>
  );
}
