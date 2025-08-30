"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDirections from "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions";
import "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css";
import { MdMyLocation } from "react-icons/md";
import { v4 as uuidv4 } from "uuid"; // install with `npm i uuid`
import {api} from "@/trpc/react";

interface MapBoxProps {
  onRouteUpdate?: (distance: number, duration: number) => void;
}

export function MapBox({ onRouteUpdate }: MapBoxProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const directions = useRef<MapboxDirections | null>(null);
  const [lng, setLng] = useState(-70.9);
  const [lat, setLat] = useState(42.35);
  const [zoom, setZoom] = useState(9);
  const [startLocation, setStartLocation] = useState("");
  const [endLocation, setEndLocation] = useState("");
  const addCoins = api.coin.addCoins.useMutation();
  // Allow both Search Box and Geocoding shapes
  const [suggestions, setSuggestions] = useState<Array<any>>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [activeInput, setActiveInput] = useState<"start" | "end" | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<GeolocationPosition | null>(null);
  const [tripStats, setTripStats] = useState({
    distance: 0,
    duration: 0,
    speed: 0,
    startTime: 0,
  });
  const watchId = useRef<number | null>(null);

  // === NEW: store destination coords + reward state ===
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [rewarded, setRewarded] = useState(false);

  // === NEW: haversine helper (meters) ===
  function haversineMeters(a: [number, number], b: [number, number]) {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371000; // meters
    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);
    const s1 = Math.sin(dLat / 2) ** 2;
    const s2 = Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s1 + s2));
  }

  // Suggestions (Mapbox Search Box)
  const getSuggestions = async (query: string) => {
    if (!query) {
      setSuggestions([]);
      return;
    }
    try {
      const sessionToken = uuidv4();
      const url = new URL("https://api.mapbox.com/search/searchbox/v1/suggest");
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "5");
      url.searchParams.set("country", "AU");
      url.searchParams.set("session_token", sessionToken);
      url.searchParams.set("access_token", process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string);
      const response = await fetch(url.toString());
      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setSuggestions([]);
    }
  };

  const setRoute = (start: [number, number], end: [number, number]) => {
    if (directions.current) {
      directions.current.setOrigin(start);
      directions.current.setDestination(end);
    }
  };

  // Selecting a suggestion
  const handleSuggestionSelect = async (suggestion: any) => {
    const sessionToken = uuidv4(); // new token for retrieve step
    let coords: [number, number] | null = null;
    let label = "";

    if (suggestion.mapbox_id) {
      // Search Box → retrieve to get coordinates
      const url = `https://api.mapbox.com/search/searchbox/v1/retrieve/${suggestion.mapbox_id}?session_token=${sessionToken}&access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`;
      const resp = await fetch(url);
      const data = await resp.json();
      coords = data.features?.[0]?.geometry?.coordinates ?? null;
      label = suggestion.name || suggestion.place_formatted;
    } else if (suggestion.center) {
      // Geocoding fallback
      coords = suggestion.center;
      label = suggestion.place_name;
    }

    if (activeInput === "start") {
      setStartLocation(label);
      if (coords) directions.current?.setOrigin(coords);
    } else if (activeInput === "end") {
      setEndLocation(label);
      if (coords) {
        directions.current?.setDestination(coords);
        setDestCoords(coords);   // === NEW: remember destination
        setRewarded(false);      // === NEW: allow reward for new destination
      }
    }

    setSuggestions([]);
    setActiveInput(null);
  };

  // Current location shortcut
  const getCurrentLocation = () => {
    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`
            );
            const data = await response.json();
            const address = data.features[0].place_name;
            setStartLocation(address);
            directions.current?.setOrigin([longitude, latitude]);
            map.current?.flyTo({ center: [longitude, latitude], zoom: 14 });
          } catch (error) {
            console.error("Error reverse geocoding:", error);
          }
          setIsLoadingLocation(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          setIsLoadingLocation(false);
        }
    );
  };

  useEffect(() => {
    if (!mapContainer.current || !process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (!map.current) {
      const initializedMap = new mapboxgl.Map({
        accessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [lng, lat],
        zoom: zoom,
      });

      map.current = initializedMap;

      initializedMap.addControl(new mapboxgl.NavigationControl(), "top-right");

      const directionsControl = new MapboxDirections({
        accessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
        unit: "metric",
        profile: "mapbox/walking",
        alternatives: true,
        congestion: true,
        controls: { inputs: false, instructions: false },
        interactive: true,
        placeholderOrigin: "Choose a starting place",
        placeholderDestination: "Choose destination",
        flyTo: false,
        styles: [
          {
            id: "directions-route-line",
            type: "line",
            source: "directions",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#3BB2D0", "line-width": 4 },
            filter: ["all", ["in", "$type", "LineString"], ["in", "route", "selected"]],
          },
          {
            id: "directions-hover-point",
            type: "circle",
            source: "directions",
            paint: { "circle-radius": 8, "circle-color": "#3BB2D0" },
            filter: ["all", ["in", "$type", "Point"], ["in", "id", "hover"]],
          },
          {
            id: "directions-origin-point",
            type: "circle",
            source: "directions",
            paint: { "circle-radius": 12, "circle-color": "#3BB2D0" },
            filter: ["all", ["in", "$type", "Point"], ["in", "marker-symbol", "A"]],
          },
          {
            id: "directions-destination-point",
            type: "circle",
            source: "directions",
            paint: { "circle-radius": 12, "circle-color": "#FF3B30" },
            filter: ["all", ["in", "$type", "Point"], ["in", "marker-symbol", "B"]],
          },
        ],
      });

      initializedMap.addControl(directionsControl, "top-left");
      directions.current = directionsControl;

      initializedMap.on("moveend", () => {
        const center = initializedMap.getCenter();
        setLng(Number(center.lng.toFixed(4)));
        setLat(Number(center.lat.toFixed(4)));
        setZoom(Number(initializedMap.getZoom().toFixed(2)));
      });

      if (onRouteUpdate) {
        directionsControl.on("route", (event: any) => {
          if (event.route && event.route[0]) {
            const route = event.route[0];
            setTripStats((prev) => ({ ...prev, distance: route.distance / 1000 }));
            onRouteUpdate(route.distance / 1000, route.duration / (60*60));
          }
        });
      }

      navigator.geolocation.getCurrentPosition(
          (position) => {
            initializedMap.flyTo({
              center: [position.coords.longitude, position.coords.latitude],
              zoom: 14,
            });
          },
          (error) => {
            console.error("Error getting location:", error);
          }
      );
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  const startTracking = () => {
    if (!map.current || !directions.current) return;

    setIsTracking(true);
    setTripStats({ distance: 0, duration: 0, speed: 0, startTime: Date.now() });

    watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentPosition(position);
          const { latitude, longitude } = position.coords;

          map.current?.flyTo({ center: [longitude, latitude], zoom: 16 });

          if (endLocation) {
            directions.current?.setOrigin([longitude, latitude]);
          }

          const currentTime = Date.now();
          const duration = (currentTime - tripStats.startTime) / 1000 / 60; // minutes
          const speed = position.coords.speed || 0;

          setTripStats((prev) => ({ ...prev, duration, speed: speed * 3.6 }));
        },
        (error) => {
          console.error("Error tracking position:", error);
          setIsTracking(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const stopTracking = () => {
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setIsTracking(false);
  };

  useEffect(() => {
    return () => {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  // === NEW: verify arrival on demand (button click) ===
  const verifyArrival = async () => {
    if (!destCoords) {
      alert("Please select a destination first.");
      return;
    }
    if (rewarded) {
      alert("Reward already granted for this destination.");
      return;
    }

    const check = (lng: number, lat: number) => {
      const here: [number, number] = [lng, lat];
      const dist = haversineMeters(here, destCoords);
      const threshold = 500; // meters
      if (dist <= threshold) {
        setRewarded(true);
        alert("🎉 Arrived! Reward granted.");
        const coinsEarned = Math.max(1, Math.round(tripStats.distance * 10));
        addCoins.mutate({ amount: coinsEarned });
      } else {
        alert(`Not there yet. You are ~${Math.round(dist)} m away.`);
      }
    };

    if (currentPosition) {
      const { latitude, longitude } = currentPosition.coords;
      check(longitude, latitude);
      return;
    }


    navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          check(longitude, latitude);
        },
        (err) => {
          console.error("Geolocation error:", err);
          alert("Could not verify your current location.");
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  return (
      <div className="flex flex-col gap-4 h-full w-full">
        {/* Input controls outside the map */}
        <div className="flex flex-col gap-2 p-4 bg-black/10 rounded-lg">
          <div className="relative flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center bg-[#3BB2D0] text-white rounded-full">A</div>
            <div className="relative flex-1">
              <div className="flex items-center">
                <input
                    type="text"
                    value={startLocation}
                    onChange={(e) => {
                      setStartLocation(e.target.value);
                      setActiveInput("start");
                      getSuggestions(e.target.value);
                    }}
                    onFocus={() => setActiveInput("start")}
                    placeholder="Choose a starting place"
                    className="w-full px-3 py-2 pr-10 bg-white/10 border border-white/20 rounded-md text-white"
                />
                <button
                    onClick={getCurrentLocation}
                    className="absolute right-2 p-2 text-white/60 hover:text-white transition-colors"
                    disabled={isLoadingLocation}
                >
                  <MdMyLocation className={`w-5 h-5 ${isLoadingLocation ? "animate-spin" : ""}`} />
                </button>
              </div>
              {activeInput === "start" && suggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-gray-900 border border-white/20 rounded-md shadow-lg max-h-60 overflow-auto">
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={index}
                            className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors"
                            onClick={() => handleSuggestionSelect(suggestion)}
                        >
                          {suggestion.name || suggestion.place_formatted || suggestion.place_name || "Unknown"}
                        </button>
                    ))}
                  </div>
              )}
            </div>
          </div>

          <div className="relative flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center bg-[#FF3B30] text-white rounded-full">B</div>
            <div className="relative flex-1">
              <input
                  type="text"
                  value={endLocation}
                  onChange={(e) => {
                    setEndLocation(e.target.value);
                    setActiveInput("end");
                    getSuggestions(e.target.value);
                  }}
                  onFocus={() => setActiveInput("end")}
                  placeholder="Choose destination"
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white"
              />
              {activeInput === "end" && suggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-gray-900 border border-white/20 rounded-md shadow-lg max-h-60 overflow-auto">
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={index}
                            className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors"
                            onClick={() => handleSuggestionSelect(suggestion)}
                        >
                          {suggestion.name || suggestion.place_formatted || suggestion.place_name || "Unknown"}
                        </button>
                    ))}
                  </div>
              )}
            </div>
          </div>

          {/* Trip Stats */}
          <div className="flex justify-between items-center mt-2 text-white">
            <div>
              <span className="text-white/60">Distance:</span>
              <span className="ml-2">{tripStats.distance.toFixed(2)} km</span>
            </div>
            <div>
              <span className="text-white/60">Duration:</span>
              <span className="ml-2">{tripStats.duration.toFixed(0)} min</span>
            </div>
            <div>
              <span className="text-white/60">Speed:</span>
              <span className="ml-2">{tripStats.speed.toFixed(1)} km/h</span>
            </div>
          </div>

          {/* Start/Stop + Arrived Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
                onClick={isTracking ? stopTracking : startTracking}
                className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                    isTracking ? "bg-red-500 hover:bg-red-600 text-white" : "bg-green-500 hover:bg-green-600 text-white"
                }`}
            >
              {isTracking ? "Stop" : "Start"}
            </button>

            {/* === NEW: Arrival verification button === */}
            <button
                onClick={verifyArrival}
                className="w-full py-2 px-4 rounded-md font-medium transition-colors bg-blue-500 hover:bg-blue-600 text-white"
            >
              I’ve arrived
            </button>

            {/* Show quick status */}
            <div className="w-full py-2 px-4 rounded-md bg-white/10 border border-white/20 text-white flex items-center justify-center">
              {rewarded ? "✅ Reward granted" : destCoords ? "Destination set" : "No destination"}
            </div>
          </div>
        </div>

        {/* Map container */}
        <div className="relative flex-1 rounded-[var(--radius-sm)] overflow-hidden">
          <div ref={mapContainer} className="h-full w-full" />
        </div>
      </div>
  );
}
