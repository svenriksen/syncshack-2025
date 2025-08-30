import React from "react";

export function Button({ children }: { children: React.ReactNode }) {
    return (
        <button className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
            {children}
        </button>
    );
}