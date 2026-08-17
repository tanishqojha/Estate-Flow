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
import { AVAILABILITY_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/types";

const ALL = "all";

export function PropertyFilters() {
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
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const hasFilters =
    !!searchParams.get("q") || !!searchParams.get("type") || !!searchParams.get("availability");

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(
              () => setParam("q", e.target.value.trim() || null),
              350,
            );
          }}
          placeholder="Search title, location…"
          className="pl-9"
          inputMode="search"
          aria-label="Search properties"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Select value={searchParams.get("type") ?? ALL} onValueChange={(v) => setParam("type", v)}>
          <SelectTrigger className="w-auto min-w-28 shrink-0" size="sm" aria-label="Filter by type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("availability") ?? ALL}
          onValueChange={(v) => setParam("availability", v)}
        >
          <SelectTrigger
            className="w-auto min-w-28 shrink-0"
            size="sm"
            aria-label="Filter by availability"
          >
            <SelectValue placeholder="Availability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any status</SelectItem>
            {Object.entries(AVAILABILITY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
