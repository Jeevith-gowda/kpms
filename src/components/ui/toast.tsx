"use client";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      toastOptions={{
        classNames: {
          toast: "bg-white border border-gray-200 shadow-lg rounded-lg p-4 text-gray-900",
          error: "border-red-200 bg-red-50 text-red-800",
          success: "border-green-200 bg-green-50 text-green-800",
        },
      }}
    />
  );
}
