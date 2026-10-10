
"use client";

import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

type LocationSource = "photo" | "device" | "user";

type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  source: LocationSource;
  displayName?: string;
};

type ComplaintStatus =
  | "Submitted"
  | "Assigned"
  | "In Progress"
  | "Resolved";

type Complaint = {
  id: string;
  category: string;
  title: string;
  severity: number;
  department: string;
  status: ComplaintStatus;
  location: LocationData | null;
};

function severityColor(severity: number) {
  if (severity >= 9) return "#ef4444";
  if (severity >= 7) return "#f97316";
  if (severity >= 5) return "#eab308";
  return "#22c55e";
}

function FitMap({
  complaints,
  selectedId,
}: {
  complaints: Complaint[];
  selectedId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    const selected = complaints.find(
      (complaint) => complaint.id === selectedId
    );

    if (selected?.location) {
      map.flyTo(
        [selected.location.latitude, selected.location.longitude],
        15,
        { duration: 0.7 }
      );
      return;
    }

    const locations = complaints
      .filter((complaint) => complaint.location)
      .map((complaint) => [
        complaint.location!.latitude,
        complaint.location!.longitude,
      ] as [number, number]);

    if (locations.length > 1) {
      map.fitBounds(locations, {
        padding: [35, 35],
        maxZoom: 14,
      });
    } else if (locations.length === 1) {
      map.setView(locations[0], 14);
    }
  }, [complaints, selectedId, map]);

  return null;
}

export default function MapView({
  complaints,
  selectedId,
  onSelect,
}: {
  complaints: Complaint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const fallback: [number, number] = [19.9975, 73.7898];

  return (
    <MapContainer
      center={fallback}
      zoom={12}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitMap complaints={complaints} selectedId={selectedId} />

      {complaints.map((complaint) => {
        if (!complaint.location) return null;

        const position: [number, number] = [
          complaint.location.latitude,
          complaint.location.longitude,
        ];

        const active = complaint.id === selectedId;
        const radius = active ? 11 : complaint.severity >= 8 ? 9 : 7;

        return (
          <span key={complaint.id}>
            <CircleMarker
              center={position}
              radius={radius}
              pathOptions={{
                color: severityColor(complaint.severity),
                fillColor: severityColor(complaint.severity),
                fillOpacity: active ? 0.95 : 0.75,
                weight: active ? 4 : 2,
              }}
              eventHandlers={{
                click: () => onSelect(complaint.id),
              }}
            >
              <Popup>
                <div className="min-w-[220px] text-black">
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    {complaint.status}
                  </div>
                  <div className="mt-1 text-sm font-bold">
                    {complaint.title}
                  </div>
                  <div className="mt-2 text-xs">
                    Severity: <strong>{complaint.severity}/10</strong>
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {complaint.department}
                  </div>
                </div>
              </Popup>
            </CircleMarker>

            {complaint.severity >= 8 && (
              <Circle
                center={position}
                radius={180}
                pathOptions={{
                  color: severityColor(complaint.severity),
                  fillColor: severityColor(complaint.severity),
                  fillOpacity: 0.05,
                  weight: 1,
                }}
              />
            )}
          </span>
        );
      })}
    </MapContainer>
  );
}
