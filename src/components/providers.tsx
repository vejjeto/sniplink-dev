"use client";

import { CommandPalette } from "@/components/command-palette";
import { UiToastProvider } from "@/components/toast-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <UiToastProvider>
        {children}
        <CommandPalette />
      </UiToastProvider>
    </QueryClientProvider>
  );
}
