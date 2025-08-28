"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { CalendarDays, MapPin, Users, Download, Plus, Search, Printer, Edit3, RefreshCw, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

// --------------------
// Types
// --------------------
export interface EventItem {
  id: string;
  title: string;
  location: string;
  start: string; // ISO string
  end: string;   // ISO string
  notes?: string;
  mapQuery?: string;
  url?: string;
  tags?: string[];
}
export interface DayPlan {
  id: string; // YYYY-MM-DD
  dateLabel?: string;
  city: string;
  notes?: string;
  events: EventItem[];
}
export interface LodgingItem {
  nights: string;
  name: string;
  city: string;
}
export interface Itinerary {
  tripTitle: string;
  subtitle: string;
  homeBase: string;
  participants: string[];
  days: DayPlan[];
  lodging: LodgingItem[];
  tips: string[];
}

declare global {
  interface Window { __itin?: Itinerary }
}

// --------------------
// Constants & Helpers
// --------------------
const STORAGE_KEY = "golfTripItinerary_v1";

function toICSDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
}

function buildICSEvent(evt: EventItem): string {
  const uid = `${evt.id || Math.random().toString(36).slice(2)}@golf-itin`;
  const dtStart = toICSDate(new Date(evt.start));
  const dtEnd = toICSDate(new Date(evt.end));
  const desc = (evt.notes || "").replace(/\n/g, "\\n");
  const loc = (evt.location || "").replace(/\n/g, "\\n");
  const title = (evt.title || "Event").replace(/\n/g, " ");
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${title}`,
    `LOCATION:${loc}`,
    `DESCRIPTION:${desc}`,
    "END:VEVENT",
  ].join("\n");
}

function downloadICS(itin: Itinerary, singleEvent?: EventItem): void {
  const header = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Yu Ritual//Golf Trip//EN"];
  const footer = ["END:VCALENDAR"];
  const body = singleEvent
    ? buildICSEvent(singleEvent)
    : itin.days.flatMap((d) => d.events.map(buildICSEvent)).join("\n");
  const ics = [...header, body, ...footer].join("\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = singleEvent ? `${singleEvent.title || "event"}.ics` : `Ireland-Golf-Trip-2025.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function openMaps(query: string): void {
  if (!query) return;
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, "_blank");
}
function openURL(url?: string): void {
  if (!url) return;
  window.open(url, "_blank", "noopener");
}

// Format any date/time as Ireland time for on-screen display
function formatIE(input: string | number | Date): string {
  return new Date(input).toLocaleString("en-IE", {
    timeZone: "Europe/Dublin",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Compute the day label from real timestamps (US order, Europe/Dublin timezone)
function formatDayLabel(day: DayPlan): string {
  const dates = (day.events || [])
    .map((e) => new Date(e.start))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const src = dates.length ? dates[0] : new Date(String(day.id) + "T00:00:00Z");
  return src.toLocaleDateString("en-US", {
    timeZone: "Europe/Dublin",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Trip subtitle helpers (US-style date range, Europe/Dublin timezone)
function monthDayUS(d: Date): string {
  return d.toLocaleDateString("en-US", { timeZone: "Europe/Dublin", month: "short", day: "numeric" });
}
function formatTripDateRange(days: DayPlan[]): string {
  const starts: Date[] = [];
  const ends: Date[] = [];
  (days || []).forEach((day) => {
    if (day?.events?.length) {
      day.events.forEach((e) => { if (e?.start) starts.push(new Date(e.start)); if (e?.end) ends.push(new Date(e.end)); });
    } else if (day?.id) {
      const d = new Date(`${day.id}T00:00:00Z`);
      starts.push(d); ends.push(d);
    }
  });
  if (!starts.length || !ends.length) return "";
  const start = new Date(Math.min(...starts.map(d=>d.getTime())));
  const end = new Date(Math.max(...ends.map(d=>d.getTime())));
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const monthShort = (dt: Date) => dt.toLocaleDateString("en-US", { timeZone:"Europe/Dublin", month:"short" });
  const dayNum = (dt: Date) => dt.toLocaleDateString("en-US", { timeZone:"Europe/Dublin", day:"numeric" });
  const yearStr = end.toLocaleDateString("en-US", { timeZone:"Europe/Dublin", year:"numeric" });
  if (monthShort(start) === monthShort(end) && sameYear) {
    return `${monthShort(start)} ${dayNum(start)}–${dayNum(end)}, ${yearStr}`;
  }
  if (sameYear) {
    return `${monthDayUS(start)} – ${monthDayUS(end)}, ${yearStr}`;
  }
  const startYear = start.toLocaleDateString("en-US", { timeZone:"Europe/Dublin", year:"numeric" });
  return `${monthDayUS(start)}, ${startYear} – ${monthDayUS(end)}, ${yearStr}`;
}
function getSubtitlePrefix(itin: Itinerary): string {
  const s = (itin?.subtitle || "").split("|")[0]?.trim();
  return s || "Ireland";
}
function computedSubtitle(itin: Itinerary): string {
  const range = formatTripDateRange(itin?.days || []);
  return `${getSubtitlePrefix(itin)} | ${range}`;
}

// Pure helper (testable) — filters days by a text query
function filterDays(days: DayPlan[], query: string): DayPlan[] {
  if (!query || !query.trim()) return days;
  const q = query.toLowerCase();
  return days
    .map((d) => ({
      ...d,
      events: d.events.filter((e) => [
        e.title || "",
        e.location || "",
        e.notes || "",
        ...(e.tags || []),
      ].join(" ").toLowerCase().includes(q)),
    }))
    .filter((d) => d.events.length > 0);
}

// --------------------
// Seed Data
// --------------------
const seedData: Itinerary = {
  tripTitle: "Hammer Laddies Roadtrip",
  subtitle: "Dublin • Wicklow • Killarney • Kinsale | Sept 6–13, 2025",
  homeBase: "The Westbury, Dublin (first 3 nights)",
  participants: ["David", "Steve", "Pat", "Bill", "Jeff", "Brit", "Brian", "Rick"],
  days: [
    {
      id: "2025-09-06",
      dateLabel: "Sat, Sept 6",
      city: "Dublin",
      notes: "Check-in Westbury Hotel. Everyone has rooms booked except Rick and Brit.",
      events: [
        {
          id: "sat6-dinner",
          title: "Dinner — Matt the Thresher (7:00 PM)",
          location: "Matt the Thresher, Dublin",
          start: "2025-09-06T18:00:00Z", // 7:00 PM Ireland (UTC+1 in Sept)
          end: "2025-09-06T20:00:00Z",
          notes: "Reservation for 6 people.",
          mapQuery: "Matt the Thresher Dublin",
          tags: ["dining"],
        },
      ],
    },
    {
      id: "2025-09-07",
      dateLabel: "Sun, Sept 7",
      city: "Dublin",
      notes: "Single caddies requested (~€70 + tip). Pick-up Westbury; ~30 min transfer.",
      events: [
        {
          id: "rdg1",
          title: "Royal Dublin — Depart 2:00 PM, Return 9:00 PM",
          location: "Royal Dublin Golf Club, Bull Island, Dublin",
          start: "2025-09-07T13:00:00Z", // 2:00 PM Ireland
          end: "2025-09-07T20:00:00Z",   // 9:00 PM Ireland
          notes: "Links golf; arrive 45–60 min early. Wind likely.",
          mapQuery: "Royal Dublin Golf Club",
          url: "https://www.royaldublingolfclub.com/",
          tags: ["golf", "caddie"],
        },
        {
          id: "boxty-dinner",
          title: "Dinner — Gallagher’s Boxty House (9:30 PM)",
          location: "Gallagher’s Boxty House, Dublin",
          start: "2025-09-07T20:30:00Z", // 9:30 PM Ireland
          end: "2025-09-07T22:00:00Z",
          notes: "~10 minute walk from Westbury Hotel.",
          mapQuery: "Gallagher’s Boxty House Dublin",
          tags: ["dining"],
        },
      ],
    },
    {
      id: "2025-09-08",
      dateLabel: "Mon, Sept 8",
      city: "Dublin → Baltray → Dublin",
      notes: "Departure 8:00 AM. Return 4:00 PM. Transfer ~1h10. Dinner 7:30 PM at Marco Pierre White (for 8).",
      events: [
        {
          id: "clg1",
          title: "County Louth (Baltray) — Day Trip",
          location: "Co. Louth Golf Club, Baltray",
          start: "2025-09-08T07:00:00Z", // 8:00 AM Ireland
          end: "2025-09-08T15:00:00Z",   // 4:00 PM Ireland
          notes: "Classic links; practice green upon arrival.",
          mapQuery: "County Louth Golf Club Baltray",
          url: "https://www.countylouthgolfclub.com/",
          tags: ["golf", "caddie"],
        },
        {
          id: "dinner-mpw",
          title: "Dinner — Marco Pierre White (7:30 PM)",
          location: "Marco Pierre White, Dublin",
          start: "2025-09-08T18:30:00Z",
          end: "2025-09-08T20:30:00Z",
          notes: "Table for 8.",
          mapQuery: "Marco Pierre White Dublin",
          tags: ["dining"],
        },
      ],
    },
    {
      id: "2025-09-09",
      dateLabel: "Tue, Sept 9",
      city: "Dublin",
      notes: "Departure 12:30 PM. Return 7:30 PM. Dinner 8:30 PM at Delahunt.",
      events: [
        {
          id: "pmk1",
          title: "Portmarnock Golf Club — Day Trip",
          location: "Portmarnock Golf Club, Co. Dublin",
          start: "2025-09-09T11:30:00Z", // 12:30 PM Ireland
          end: "2025-09-09T18:30:00Z",   // 7:30 PM Ireland
          notes: "Wind-breaker + layers; ball markers.",
          mapQuery: "Portmarnock Golf Club",
          url: "https://www.portmarnockgolfclub.ie/",
          tags: ["golf", "caddie"],
        },
        {
          id: "dinner-delahunt",
          title: "Dinner — Delahunt (8:30 PM)",
          location: "Delahunt, 39 Camden Street Lower, Dublin",
          start: "2025-09-09T19:30:00Z",
          end: "2025-09-09T21:30:00Z",
          notes: "Irish contemporary.",
          mapQuery: "Delahunt Dublin",
          tags: ["dining"],
        },
      ],
    },
    {
      id: "2025-09-10",
      dateLabel: "Wed, Sept 10",
      city: "Wicklow (The European Club) → Killarney (overnight)",
      notes: "Pick-Up: Westbury Hotel. Drop-Off: The European Club (Tee times: 12:32 PM & 12:40 PM). After golf, continue to Killarney Plaza Hotel (~4 hrs drive). Depart 10:30 AM. ~1 hr to the course.",
      events: [
        {
          id: "euroclub",
          title: "The European Club — Golf (via transfer)",
          location: "The European Club, Brittas Bay, Co. Wicklow",
          start: "2025-09-10T09:30:00Z", // 10:30 AM Ireland
          end: "2025-09-10T21:30:00Z",   // 10:30 PM Ireland
          notes: "Iconic dunes; bring camera. Transfer to Killarney after golf.",
          mapQuery: "The European Club Wicklow",
          url: "https://www.theeuropeanclub.com/",
          tags: ["golf"],
        },
      ],
    },
    {
      id: "2025-09-11",
      dateLabel: "Thu, Sept 11",
      city: "Killarney ↔ Ballybunion (overnight Killarney)",
      notes: "Kinsale Jazz Fest weekend coming up; traffic/parking tighter. Overnight in Killarney.",
      events: [
        {
          id: "ballybunion",
          title: "Ballybunion Old Course — Tee Time 2:00 PM",
          location: "Ballybunion Golf Club, Co. Kerry",
          start: "2025-09-11T13:00:00Z",
          end: "2025-09-11T19:00:00Z",
          notes: "Steep dunes; consider a caddie for lines.",
          mapQuery: "Ballybunion Golf Club",
          url: "https://www.ballybuniongolfclub.com/",
          tags: ["golf", "caddie"],
        },
      ],
    },
    {
      id: "2025-09-12",
      dateLabel: "Fri, Sept 12",
      city: "Killarney → Waterville → Kinsale (overnight)",
      notes: "Early start; coffee + breakfast to-go recommended. Overnight in Kinsale. Dinner TBD.",
      events: [
        {
          id: "waterville",
          title: "Waterville Golf Links — Tee Time 8:10 AM",
          location: "Waterville, Co. Kerry",
          start: "2025-09-12T07:00:00Z",
          end: "2025-09-12T13:00:00Z",
          notes: "Layer up; coastal breeze.",
          mapQuery: "Waterville Golf Links",
          url: "https://www.watervillegolflinks.ie/",
          tags: ["golf"],
        },
        {
          id: "tap-taproom",
          title: "The Tap Taproom — Pint (5:00 PM)",
          location: "The Tap Taproom, Kinsale",
          start: "2025-09-12T16:00:00Z", // 5:00 PM Ireland
          end: "2025-09-12T17:00:00Z",
          notes: "Meet for a pint. Dinner TBD.",
          mapQuery: "The Tap Taproom Kinsale",
          tags: ["drinks"],
        },
      ],
    },
    {
      id: "2025-09-13",
      dateLabel: "Sat, Sept 13",
      city: "Kinsale — Old Head → Dublin",
      notes: "Two groups: morning & late morning. Dramatic cliffs — safety first. Ground Transportation will return to Dublin departing around 4pm. Please book your own room for Saturday night.",
      events: [
        {
          id: "oldhead-early",
          title: "Old Head Golf Links — Tee Time ~8:00 AM",
          location: "Old Head Golf Links, Kinsale",
          start: "2025-09-13T07:00:00Z",
          end: "2025-09-13T12:30:00Z",
          notes: "Photo ops on 4, 7, 12, 18.",
          mapQuery: "Old Head Golf Links Kinsale",
          url: "https://www.oldhead.com/",
          tags: ["golf"],
        },
        {
          id: "oldhead-late",
          title: "Old Head Golf Links — Tee Time ~11:00 AM",
          location: "Old Head Golf Links, Kinsale",
          start: "2025-09-13T10:00:00Z",
          end: "2025-09-13T15:30:00Z",
          notes: "Wind picks up; pack extra balls.",
          mapQuery: "Old Head Golf Links Kinsale",
          url: "https://www.oldhead.com/",
          tags: ["golf"],
        },
      ],
    },
  ],
  lodging: [
    { nights: "Sept 6–9 (Sat–Tue)", name: "The Westbury", city: "Dublin" },
    { nights: "Nights of Sept 10 & 11 (Wed–Thu)", name: "Killarney Plaza Hotel", city: "Killarney" },
    { nights: "Night of Sept 12 (Fri)", name: "Actons / Trident / Old Bank Hotel", city: "Kinsale" },
  ],
  tips: [
    "Singles caddies preferred when available.",
    "Bring rain gloves + waterproofs; pack layers.",
    "Cash for tips; cards for pro shops/dining.",
    "Allow extra transfer buffers for coastal routes.",
    "Everyone books their own hotels.",
    "Sprinter will take us to Dublin on Sat after golf.",
    "Hotel Breakfasts Included",
  ],
};

// --------------------
// UI Components
// --------------------
interface HeaderBarProps {
  title: string;
  subtitle: string;
  onPrint: () => void;
  onReset: () => void;
  onExportAll: () => void;
  search: string;
  setSearch: (v: string) => void;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
}
function HeaderBar({ title, subtitle, onPrint, onReset, onExportAll, search, setSearch, editMode, setEditMode }: HeaderBarProps) {
  const onSearch = (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value);
  return (
    <div className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2">
        <CalendarDays className="h-6 w-6" />
        <div className="flex-1">
          <div className="text-xl font-semibold leading-tight">{title}</div>
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={onSearch} placeholder="Search events, places…" className="pl-8 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-2">
              <Edit3 className="h-4 w-4" />
              <Switch checked={editMode} onCheckedChange={setEditMode} />
              <span className="text-sm">Edit</span>
            </div>
            <Button variant="outline" onClick={onPrint}><Printer className="h-4 w-4 mr-1"/>Print</Button>
            <Button variant="outline" onClick={onExportAll}><Download className="h-4 w-4 mr-1"/>Export .ics</Button>
            <Button variant="secondary" onClick={onReset}><RefreshCw className="h-4 w-4 mr-1"/>Reset</Button>
          </div>
        </div>
      </div>
      <div className="md:hidden px-4 pb-3 flex gap-2">
        <Input value={search} onChange={onSearch} placeholder="Search events, places…" />
        <Button variant="outline" onClick={onExportAll}><Download className="h-4 w-4"/></Button>
        <Button variant="outline" onClick={onPrint}><Printer className="h-4 w-4"/></Button>
        <Button variant="secondary" onClick={onReset}><RefreshCw className="h-4 w-4"/></Button>
      </div>
    </div>
  );
}

interface EventCardProps {
  event: EventItem;
  editMode: boolean;
  onUpdate: (updated: EventItem) => void;
}
function EventCard({ event, editMode, onUpdate }: EventCardProps) {
  const [e, setE] = useState<EventItem>(event);
  useEffect(() => setE(event), [event]);

  function handleChange<K extends keyof EventItem>(key: K, val: EventItem[K]) {
    const updated = { ...e, [key]: val } as EventItem;
    setE(updated);
    onUpdate(updated);
  }

  const onTitle = (x: React.ChangeEvent<HTMLInputElement>) => handleChange("title", x.target.value);
  const onLocation = (x: React.ChangeEvent<HTMLInputElement>) => handleChange("location", x.target.value);
  const onNotes = (x: React.ChangeEvent<HTMLTextAreaElement>) => handleChange("notes", x.target.value);

  return (
    <Card className="border-muted/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-start justify-between gap-2">
          {editMode ? (<Input value={e.title} onChange={onTitle} />) : (<span>{e.title}</span>)}
          <div className="shrink-0 flex gap-2">
            {e.url && <Button variant="outline" size="icon" onClick={()=>openURL(e.url)} title="Open course site"><ExternalLink className="h-4 w-4"/></Button>}
            <Button variant="outline" size="icon" onClick={()=>downloadICS(window.__itin as Itinerary, e)} title="Export single event"><Download className="h-4 w-4"/></Button>
            {e.mapQuery && <Button variant="outline" size="icon" onClick={()=>openMaps(e.mapQuery!)} title="Open in Maps"><MapPin className="h-4 w-4"/></Button>}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm flex items-center gap-2"><CalendarDays className="h-4 w-4"/> <span>{formatIE(e.start)}</span> → <span>{formatIE(e.end)}</span></div>
        <div className="text-sm flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5"/>{editMode ? (<Input value={e.location} onChange={onLocation} />) : (<span>{e.location}</span>)}</div>
        {e.tags && <div className="flex flex-wrap gap-1">{e.tags.map((t)=> (<Badge key={t} variant="outline">{t}</Badge>))}</div>}
        {editMode ? (<Textarea value={e.notes||""} onChange={onNotes} placeholder="Notes" />) : (e.notes && <p className="text-sm text-muted-foreground">{e.notes}</p>)}
      </CardContent>
    </Card>
  );
}

interface DayCardProps {
  day: DayPlan;
  editMode: boolean;
  onUpdateEvent: (dayId: string, evtId: string, updated: EventItem) => void;
}
function DayCard({ day, editMode, onUpdateEvent }: DayCardProps) {
  const [note, setNote] = useState<string>(day.notes || "");
  useEffect(()=>{ setNote(day.notes || ""); }, [day.notes]);

  const onChangeNote = (e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value);
  const onBlurNote = () => { (day as DayPlan).notes = note; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(window.__itin)); } catch { /* noop */ } };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge variant="secondary">{formatDayLabel(day)}</Badge>
              <span className="font-normal text-muted-foreground">{day.city}</span>
            </CardTitle>
          </div>
          <div className="text-sm text-muted-foreground">{day.events.length} event{day.events.length!==1?'s':''}</div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editMode ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Day Notes</label>
              <Textarea value={note} onChange={onChangeNote} onBlur={onBlurNote} placeholder="Logistics, reminders, etc." />
            </div>
          ) : (
            day.notes && <p className="text-sm text-muted-foreground whitespace-pre-line">{day.notes}</p>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {day.events.map((evt) => (
              <EventCard key={evt.id} event={evt} editMode={editMode} onUpdate={(updated)=>onUpdateEvent(day.id, evt.id, updated)} />
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface PeoplePanelProps {
  list: string[];
  setList: (list: string[]) => void;
}
function PeoplePanel({ list, setList }: PeoplePanelProps) {
  const [name, setName] = useState<string>("");
  const onAdd = () => { if(!name.trim()) return; const n = [...list, name.trim()]; setList(n); setName(""); };
  const onRemove = (i: number) => { const n = list.filter((_, idx)=>idx!==i); setList(n); };
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={name} onChange={onChange} placeholder="Add participant"/>
        <Button onClick={onAdd}><Plus className="h-4 w-4 mr-1"/>Add</Button>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {list.map((p,i)=> (
          <Badge key={`${p}-${i}`} variant="secondary" className="flex items-center justify-between gap-2 p-2">
            <Users className="h-4 w-4"/> {p}
            <Button size="sm" variant="ghost" onClick={()=>onRemove(i)}>Remove</Button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

interface LodgingPanelProps {
  lodging: LodgingItem[];
  editMode: boolean;
  setLodging: (items: LodgingItem[]) => void;
}
function LodgingPanel({ lodging, editMode, setLodging }: LodgingPanelProps) {
  function updateItem<K extends keyof LodgingItem>(idx: number, key: K, val: LodgingItem[K]) {
    const copy = lodging.map((x, i)=> i===idx ? { ...x, [key]: val } : x);
    setLodging(copy);
  }
  const onName = (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, "name", e.target.value);
  const onCity = (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, "city", e.target.value);
  const onNights = (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, "nights", e.target.value);
  return (
    <div className="grid md:grid-cols-3 gap-3">
      {lodging.map((l, idx)=> (
        <Card key={idx}>
          <CardHeader>
            <CardTitle className="text-base">
              {editMode ? <Input value={l.name} onChange={onName(idx)} /> : l.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="font-medium">City:</span> {editMode ? <Input value={l.city} onChange={onCity(idx)} /> : l.city}</div>
            <div><span className="font-medium">Nights:</span> {editMode ? <Input value={l.nights} onChange={onNights(idx)} /> : l.nights}</div>
            <Button variant="outline" onClick={()=>openMaps(`${l.name} ${l.city}`)}><ExternalLink className="h-4 w-4 mr-1"/>Map</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface TravelNotesPanelProps {
  tips: string[];
  setTips: (tips: string[]) => void;
  editMode: boolean;
}
function TravelNotesPanel({ tips, setTips, editMode }: TravelNotesPanelProps) {
  const [text, setText] = useState<string>("");
  const add = () => { if(!text.trim()) return; setTips([...(tips||[]), text.trim()]); setText(""); };
  const remove = (i: number) => { setTips(tips.filter((_,idx)=>idx!==i)); };
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value);
  return (
    <div>
      {editMode && (
        <div className="flex gap-2 mb-3">
          <Input value={text} onChange={onChange} placeholder="Add travel note"/>
          <Button onClick={add}><Plus className="h-4 w-4 mr-1"/>Add</Button>
        </div>
      )}
      <ul className="list-disc pl-6 space-y-1 text-sm">
        {tips.map((t,i)=> (
          <li key={i} className="flex items-start gap-2">
            <span className="flex-1">{t}</span>
            {editMode && <Button size="sm" variant="ghost" onClick={()=>remove(i)}>Remove</Button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// --------------------
// Main App
// --------------------
function ItineraryApp(){
  // Load from localStorage after mount (avoids SSR/localStorage issues)
  const [itin, setItin] = useState<Itinerary>(seedData);
  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setItin(JSON.parse(raw) as Itinerary); } catch { /* ignore */ }
  }, []);

  useEffect(()=>{ try { window.__itin = itin; } catch { /* noop */ } }, [itin]);

  const [search, setSearch] = useState<string>("");
  const [editMode, setEditMode] = useState<boolean>(false);

  useEffect(()=>{ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(itin)); } catch { /* ignore */ } }, [itin]);

  const filteredDays = useMemo(() => filterDays(itin.days, search), [search, itin.days]);

  const updateEvent = (dayId: string, evtId: string, updated: EventItem) => {
    setItin((prev)=> ({
      ...prev,
      days: prev.days.map((d)=> d.id===dayId ? { ...d, events: d.events.map((e)=> e.id===evtId? updated : e) } : d)
    }));
  };

  const onReset = () => { setItin(seedData); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(seedData)); } catch { /* ignore */ } };
  const onPrint = () => window.print();
  const onExportAll = () => downloadICS(itin);

  // --------------------
  // Runtime self-tests (non-blocking)
  // --------------------
  useEffect(() => {
    type TestRow = { name: string; passed: boolean; error?: string };
    const results: TestRow[] = [];
    try {
      const evt = seedData.days[0].events[0];
      const ics = buildICSEvent(evt);
      results.push({ name: 'ICS has DTSTART/DTEND', passed: /DTSTART:/.test(ics) && /DTEND:/.test(ics) });
    } catch (e) { results.push({ name: 'ICS has DTSTART/DTEND', passed: false, error: String(e) }); }

    try {
      const allGolfHaveLinks = seedData.days.flatMap((d)=>d.events).filter((e)=> (e.tags||[]).includes('golf')).every((e)=> !!e.url);
      results.push({ name: 'All golf events have course URL', passed: allGolfHaveLinks });
    } catch (e) { results.push({ name: 'All golf events have course URL', passed: false, error: String(e) }); }

    try {
      const none = filterDays(seedData.days, "");
      const bb = filterDays(seedData.days, "ballybunion");
      const pm = filterDays(seedData.days, "portmarnock");
      results.push({ name: 'filterDays(empty) returns all days', passed: none.length === seedData.days.length });
      results.push({ name: 'filterDays finds ballybunion', passed: bb.some((d)=>d.events.length>0) });
      results.push({ name: 'filterDays finds portmarnock', passed: pm.some((d)=>d.events.length>0) });
    } catch (e) { results.push({ name: 'filterDays suite', passed: false, error: String(e) }); }

    try {
      const sample = formatIE("2025-09-07T13:00:00Z");
      results.push({ name: 'IE time formatting returns string', passed: typeof sample === 'string' && /2025/.test(sample) });
    } catch (e) { results.push({ name: 'IE time formatting returns string', passed: false, error: String(e) }); }

    try {
      const lbl = formatDayLabel(seedData.days[0]);
      results.push({ name: 'formatDayLabel returns string', passed: typeof lbl === 'string' && lbl.length > 5 });
    } catch (e) { results.push({ name: 'formatDayLabel returns string', passed: false, error: String(e) }); }

    try {
      const subt = computedSubtitle(seedData);
      results.push({ name: 'computedSubtitle has year', passed: /20\d{2}/.test(subt) });
    } catch (e) { results.push({ name: 'computedSubtitle has year', passed: false, error: String(e) }); }

    console.table(results);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <HeaderBar 
        title={itin.tripTitle} 
        subtitle={computedSubtitle(itin)} 
        onPrint={onPrint} 
        onReset={onReset} 
        onExportAll={onExportAll}
        search={search}
        setSearch={setSearch}
        editMode={editMode}
        setEditMode={setEditMode}
      />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardContent className="py-4 grid md:grid-cols-3 gap-4 items-center">
            <div>
              <div className="text-2xl font-bold leading-tight">{itin.tripTitle}</div>
              <div className="text-muted-foreground">{computedSubtitle(itin)}</div>
            </div>
            <div className="text-sm">
              <div className="font-medium mb-1">Lodging</div>
              <div className="space-y-1">
                {itin.lodging.map((l,i)=> (
                  <div key={i} className="flex items-center gap-2">
                    <Badge variant="outline">{l.city}</Badge>
                    <span className="font-medium">{l.name}</span>
                    <span className="text-muted-foreground">— {l.nights}</span>
                  </div>
                ))}
              </div>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button className="w-full"><Users className="h-4 w-4 mr-1"/>Roster & Settings</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Roster & Settings</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-6">
                  <div>
                    <div className="text-sm font-medium mb-2">Participants</div>
                    <PeoplePanel list={itin.participants} setList={(n)=>setItin({...itin, participants:n})} />
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-2">Lodging</div>
                    <LodgingPanel lodging={itin.lodging} editMode={true} setLodging={(l)=>setItin({...itin, lodging:l})} />
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-2">Travel Notes</div>
                    <TravelNotesPanel tips={itin.tips} setTips={(t)=>setItin({...itin, tips:t})} editMode={true} />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </CardContent>
        </Card>

        <Tabs defaultValue="days" className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="days">Daily Plan</TabsTrigger>
            <TabsTrigger value="lodging">Lodging</TabsTrigger>
            <TabsTrigger value="notes">Travel Notes</TabsTrigger>
          </TabsList>
          <TabsContent value="days" className="space-y-4">
            {filteredDays.map((d)=> (
              <DayCard key={d.id} day={d} editMode={editMode} onUpdateEvent={updateEvent} />
            ))}
            {filteredDays.length===0 && (
              <Card><CardContent className="py-10 text-center text-muted-foreground">No matches. Try another search.</CardContent></Card>
            )}
          </TabsContent>
          <TabsContent value="lodging">
            <LodgingPanel lodging={itin.lodging} editMode={editMode} setLodging={(l)=>setItin({...itin, lodging:l})} />
          </TabsContent>
          <TabsContent value="notes">
            <TravelNotesPanel tips={itin.tips} setTips={(t)=>setItin({...itin, tips:t})} editMode={editMode} />
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={()=>downloadICS(itin)}><Download className="h-4 w-4 mr-1"/>Export entire trip (.ics)</Button>
            <Button variant="outline" onClick={()=>openMaps('The Westbury Dublin')}>Maps: Westbury</Button>
            <Button variant="outline" onClick={()=>openMaps('Killarney Plaza Hotel')}>Maps: Killarney</Button>
            <Button variant="outline" onClick={()=>openMaps('Actons Hotel Kinsale')}>Maps: Kinsale</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Share & Print</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Use <span className="font-medium">Export .ics</span> to drop events into your calendar. Use <span className="font-medium">Print</span> for a clean PDF (browser print dialog).</p>
            <p>Your edits auto‑save to your browser (local storage). Click <span className="font-medium">Reset</span> anytime to restore the starter itinerary.</p>
          </CardContent>
        </Card>
      </main>

      <footer className="py-8 text-center text-xs text-muted-foreground">
        Built for your Ireland golf run — responsive, printable, and calendar‑friendly.
      </footer>
    </div>
  );
}

// Export a React component by default for Next.js App Router
export default function Page() {
  return <ItineraryApp/>;
}
