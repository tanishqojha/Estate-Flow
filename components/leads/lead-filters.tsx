"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  TEMPERATURE_LABELS,
} from "@/lib/types";

const ALL = "all";

export interface AgentOption {
  id: string;
  full_name: string;
}

/** URL-driven filters: search (debounced), status, source, temp, agent. */
export function LeadFilters({ agents }: { agents: AgentOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== ALL) params.set(key, value);
      else params.delete(key);
      params.delete("page"); // any filter change resets pagination
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function onSearchChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setParam("q", value.trim() || null), 350);
  }

  const hasFilters =
    !!searchParams.get("q") ||
    !!searchParams.get("status") ||
    !!searchParams.get("source") ||
    !!searchParams.get("temperature") ||
    !!searchParams.get("agent");

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search name, phone, email…"
          className="pl-9"
          inputMode="search"
          aria-label="Search leads"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        <Select
          value={searchParams.get("status") ?? ALL}
          onValueChange={(v) => setParam("status", v)}
        >
          <SelectTrigger className="w-auto min-w-28 shrink-0" size="sm" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("source") ?? ALL}
          onValueChange={(v) => setParam("source", v)}
        >
          <SelectTrigger className="w-auto min-w-28 shrink-0" size="sm" aria-label="Filter by source">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sources</SelectItem>
            {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("temperature") ?? ALL}
          onValueChange={(v) => setParam("temperature", v)}
        >
          <SelectTrigger className="w-auto min-w-24 shrink-0" size="sm" aria-label="Filter by temperature">
            <SelectValue placeholder="Temp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any temp</SelectItem>
            {Object.entries(TEMPERATURE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {agents.length > 0 ? (
          <Select
            value={searchParams.get("agent") ?? ALL}
            onValueChange={(v) => setParam("agent", v)}
          >
            <SelectTrigger className="w-auto min-w-28 shrink-0" size="sm" aria-label="Filter by agent">
              <SelectValue placeholder="Agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All agents</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setQ("");
              router.replace(pathname, { scroll: false });
            }}
          >
            <X aria-hidden /> Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
