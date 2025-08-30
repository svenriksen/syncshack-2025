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
  const [endLocation, setEndLocation] = useState("");
  const addCoins = api.coin.addCoins.useMutation();
  // Allow both Search Box and Geocoding shapes
  const [suggestions, setSuggestions] = useState<Array<any>>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [activeInput, setActiveInput] = useState<"end" | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<GeolocationPosition | null>(null);
  const [tripStats, setTripStats] = useState({
    distance: 0,       // remaining distance to destination (km)
    duration: 0,       // ETA to destination (min)
    speed: 0,          // current speed (km/h)
    startTime: 0,      // epoch ms when tracking started
    elapsed: 0,        // elapsed time since start (min)
    traveled: 0,       // total distance traveled (km)
  });
  const watchId = useRef<number | null>(null);
  // Track accumulated distance and previous GPS point
  const prevPositionRef = useRef<GeolocationPosition | null>(null);
  const totalMetersRef = useRef(0);
  // Lock when we've set directions origin to avoid overriding it later
  const originLocked = useRef(false);
  // Throttle ETA requests
  const lastEtaFetchRef = useRef(0);
  // Coins: 1 coin per 100m walked
  const coinsAwardedRef = useRef(0); // number of 100m units already awarded
  const [coins, setCoins] = useState(0);

  // === NEW: store destination coords + reward state ===
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [rewarded, setRewarded] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showFsStats, setShowFsStats] = useState(true);

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

  // Bearing (degrees) from point A to B
  function bearingDegrees(a: [number, number], b: [number, number]) {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;
    const [lng1, lat1] = a.map(toRad) as [number, number];
    const [lng2, lat2] = b.map(toRad) as [number, number];
    const dLng = lng2 - lng1;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360; // normalize
  }

  // Prefer collapsed controls on small screens
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        setShowControls(window.innerWidth >= 640);
        setShowStats(window.innerWidth >= 640);
      }
    } catch {}
  }, []);

  // Handle fullscreen side-effects: resize map and lock body scroll
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // Lock/unlock scroll
      const root = document.documentElement;
      const body = document.body;
      if (fullscreen) {
        root.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        // Give layout a tick before resizing map
        setTimeout(() => {
          map.current?.resize();
        }, 50);
      } else {
        root.style.overflow = '';
        body.style.overflow = '';
        // Resize back to container
        setTimeout(() => {
          map.current?.resize();
        }, 50);
      }
    } catch {}
  }, [fullscreen]);

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

  // Helper: update current-location source with latest coords
  const updateCurrentLocationOnMap = (lng: number, lat: number) => {
    const m = map.current;
    if (!m) return;
    const src = m.getSource("current-location") as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {},
      } as GeoJSON.Feature<GeoJSON.Point>);
    }
  };

  // Helper: update bearing arrow towards destination
  const updateBearingArrow = (lng: number, lat: number) => {
    if (!destCoords) return;
    const m = map.current;
    if (!m) return;
    const brng = bearingDegrees([lng, lat], destCoords);
    const src = m.getSource("bearing-arrow") as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: { bearing: brng },
      } as GeoJSON.Feature<GeoJSON.Point>);
    }
    // Ensure visible if destination exists
    if (m.getLayer("bearing-arrow-layer")) {
      m.setLayoutProperty("bearing-arrow-layer", "visibility", "visible");
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

    if (activeInput === "end") {
      setEndLocation(label);
      if (coords) {
        directions.current?.setDestination(coords);
        setDestCoords(coords);   // === NEW: remember destination
        setRewarded(false);      // === NEW: allow reward for new destination
        // If we know current position, update arrow immediately
        const cur = currentPosition?.coords;
        if (cur) updateBearingArrow(cur.longitude, cur.latitude);
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
          // Always use current GPS as origin and recenter map
          directions.current?.setOrigin([longitude, latitude]);
          map.current?.flyTo({ center: [longitude, latitude], zoom: 14 });
          updateCurrentLocationOnMap(longitude, latitude);
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

      // When style loads, add a source/layer for current location dot
      initializedMap.on("load", () => {
        const initLng = currentPosition?.coords.longitude ?? lng;
        const initLat = currentPosition?.coords.latitude ?? lat;
        if (!initializedMap.getSource("current-location")) {
          initializedMap.addSource("current-location", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: { type: "Point", coordinates: [initLng, initLat] },
              properties: {},
            },
          });
        }
        if (!initializedMap.getLayer("current-location-dot")) {
          initializedMap.addLayer({
            id: "current-location-dot",
            type: "circle",
            source: "current-location",
            paint: {
              "circle-radius": 6,
              "circle-color": "#00E5FF",
              "circle-stroke-color": "#FFFFFF",
              "circle-stroke-width": 2,
              "circle-opacity": 0.95,
            },
          });
        }

        // Add a simple arrow image for bearing (drawn on canvas)
        if (!initializedMap.hasImage("bearing-arrow")) {
          const size = 64;
          const canvas = document.createElement("canvas");
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, size, size);
            ctx.translate(size/2, size/2);
            ctx.beginPath();
            // triangle pointing up; rotation handled by icon-rotate
            ctx.moveTo(0, -22);
            ctx.lineTo(14, 18);
            ctx.lineTo(-14, 18);
            ctx.closePath();
            ctx.fillStyle = "#22D3EE"; // cyan-400
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          const imgData = { width: size, height: size, data: ctx?.getImageData(0,0,size,size)!.data } as any;
          try { initializedMap.addImage("bearing-arrow", imgData, { pixelRatio: 2 }); } catch {}
        }

        // Source + layer for bearing arrow
        if (!initializedMap.getSource("bearing-arrow")) {
          initializedMap.addSource("bearing-arrow", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
        }
        if (!initializedMap.getLayer("bearing-arrow-layer")) {
          initializedMap.addLayer({
            id: "bearing-arrow-layer",
            type: "symbol",
            source: "bearing-arrow",
            layout: {
              "icon-image": "bearing-arrow",
              "icon-size": 0.5,
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
              "icon-rotate": ["get", "bearing"],
              visibility: destCoords ? "visible" : "none",
            },
          });
        }
      });

      const directionsControl = new MapboxDirections({
        accessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
        unit: "metric",
        profile: "mapbox/walking",
        alternatives: true,
        congestion: true,
        controls: { inputs: false, instructions: false },
        interactive: true,
        placeholderOrigin: "Your location",
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
            // Do not override distance here; we show straight-line distance elsewhere.
            const etaMin = route.duration / 60; // seconds -> minutes
            setTripStats((prev) => ({ ...prev, duration: etaMin }));
            onRouteUpdate(route.distance / 1000, etaMin);
          }
        });
      }

      navigator.geolocation.getCurrentPosition(
          (position) => {
            initializedMap.flyTo({
              center: [position.coords.longitude, position.coords.latitude],
              zoom: 14,
            });
            // Also seed the current-location source so the dot appears immediately
            updateCurrentLocationOnMap(position.coords.longitude, position.coords.latitude);
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
    if (!destCoords) {
      alert("Please choose a destination before starting your trip.");
      return;
    }
    if (!map.current || !directions.current) return;

    setIsTracking(true);
    setTripStats({ distance: 0, duration: 0, speed: 0, startTime: Date.now(), elapsed: 0, traveled: 0 });
    totalMetersRef.current = 0;
    prevPositionRef.current = null;
    coinsAwardedRef.current = 0;
    setCoins(0);


    // Start watching position
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition(position);
        const { latitude, longitude } = position.coords;

        // Update current position marker (visual only)
        if (map.current) {
          map.current.flyTo({ center: [longitude, latitude], zoom: 16 });
          updateCurrentLocationOnMap(longitude, latitude);
          updateBearingArrow(longitude, latitude);
        }

        // If we have a destination but no locked origin, use first GPS point as origin
        if (endLocation && !originLocked.current) {
          directions.current?.setOrigin([longitude, latitude]);
          originLocked.current = true;
        }

        // Accumulate distance between successive GPS points (ignore jitter < 2m)
        const prev = prevPositionRef.current;
        if (prev) {
          const meters = haversineMeters(
            [prev.coords.longitude, prev.coords.latitude],
            [longitude, latitude]
          );
          if (meters > 2) totalMetersRef.current += meters;
        }
        prevPositionRef.current = position;

        // Calculate stats
        const now = Date.now();
        const speed = position.coords.speed || 0; // m/s
        const distanceToDestKm = destCoords
          ? haversineMeters([longitude, latitude], destCoords) / 1000
          : 0;
        const traveledKm = totalMetersRef.current / 1000;
        const elapsedMin = tripStats.startTime ? (now - tripStats.startTime) / (1000 * 60) : 0;

        // Default to previous values; will update via ETA fetch
        let durationMin = tripStats.duration;
        let remainingKm = distanceToDestKm;

        // Throttled ETA fetch from Mapbox Directions API
        const shouldFetchEta = destCoords && now - lastEtaFetchRef.current > 8000;
        if (shouldFetchEta && process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
          lastEtaFetchRef.current = now;
          const url = new URL(
            `https://api.mapbox.com/directions/v5/mapbox/walking/${longitude},${latitude};${destCoords[0]},${destCoords[1]}`
          );
          url.searchParams.set("alternatives", "false");
          url.searchParams.set("geometries", "geojson");
          url.searchParams.set("overview", "false");
          url.searchParams.set("access_token", process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string);
          fetch(url.toString())
            .then((r) => r.json())
            .then((data) => {
              const route = data?.routes?.[0];
              const secs = route?.duration;
              const meters = route?.distance;
              if (typeof secs === "number" && isFinite(secs)) durationMin = secs / 60;
              if (typeof meters === "number" && isFinite(meters)) remainingKm = meters / 1000;
              setTripStats((prev) => ({
                ...prev,
                distance: remainingKm,
                duration: durationMin,
                speed: speed * 3.6,
              }));
            })
            .catch((e) => {
              // Swallow ETA errors silently; keep last duration
              console.warn("ETA fetch failed", e);
            });
        }

        // Coins awarding: 1 coin per 100m
        const hundredMeterUnits = Math.floor(totalMetersRef.current / 1);
        if (hundredMeterUnits > coinsAwardedRef.current) {
          const newlyEarned = hundredMeterUnits - coinsAwardedRef.current;
          coinsAwardedRef.current = hundredMeterUnits;
          setCoins(hundredMeterUnits);
          if (newlyEarned > 0) {
            addCoins.mutate({ amount: newlyEarned });
          }
        }

        // Immediate update for distance/speed/elapsed/traveled; duration will update when ETA fetch returns
        setTripStats(prev => ({
          ...prev,
          distance: remainingKm,    // remaining (route if available)
          duration: durationMin,    // ETA
          speed: speed * 3.6,       // km/h
          elapsed: elapsedMin,
          traveled: traveledKm,
        }));
      },
      (error) => {
        console.error("Error tracking position:", error);
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  };


  const stopTracking = () => {
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setIsTracking(false);
    prevPositionRef.current = null;
    totalMetersRef.current = 0;
    originLocked.current = false;
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
      <div className={`flex flex-col gap-3 h-full w-full ${fullscreen ? 'fixed inset-0 z-[9999] bg-black' : ''}`}>
        {/* Inputs Panel */}
        {!fullscreen && (
        <div className="flex flex-col gap-2 p-3 bg-black/20 rounded-lg border border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-white/80 text-sm font-medium">Plan your walk</h3>
            <button
              onClick={() => setShowControls(v => !v)}
              className="px-3 py-1 text-xs rounded-md bg-white/10 text-white hover:bg-white/20 active:scale-95"
            >
              {showControls ? "Hide" : "Show"}
            </button>
          </div>
          {showControls && (
          <div className="flex flex-col gap-2">
          {/* Start removed: origin is your current location. Recenter button below. */}

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
                className="w-full px-3 py-2 pr-10 bg-white/10 border border-white/20 rounded-md text-white"
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
          </div>
          )}
        </div>
        )}

        {/* Stats Panel (outside map, collapsible) */}
        {!fullscreen && (
        <div className="flex flex-col gap-2 p-3 bg-black/20 rounded-lg border border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-white/80 text-sm font-medium">Walking stats</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowStats(v => !v)}
                className="px-3 py-1 text-xs rounded-md bg-white/10 text-white hover:bg-white/20 active:scale-95"
              >
                {showStats ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={() => setFullscreen(true)}
                className="px-3 py-1 text-xs rounded-md bg-blue-500 text-white hover:bg-blue-600 active:scale-95"
              >
                Fullscreen walk
              </button>
            </div>
          </div>
          {showStats && (
          <>
            <div className="flex flex-wrap justify-between gap-3 text-sm text-white">
              <div>
                <div className="text-white/60">Elapsed</div>
                <div className="font-semibold">{Math.floor(tripStats.elapsed).toFixed(0)} min</div>
              </div>
              <div>
                <div className="text-white/60">Traveled</div>
                <div className="font-semibold">{tripStats.traveled.toFixed(2)} km</div>
              </div>
              <div>
                <div className="text-white/60">Remaining</div>
                <div className="font-semibold">{tripStats.distance.toFixed(2)} km</div>
              </div>
              <div>
                <div className="text-white/60">ETA</div>
                <div className="font-semibold">{Math.max(0, Math.round(tripStats.duration))} min</div>
              </div>
              <div>
                <div className="text-white/60">Speed</div>
                <div className="font-semibold">{tripStats.speed.toFixed(1)} km/h</div>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-white">
              <div>
                <span className="text-white/60">Coins:</span>
                <span className="ml-2 font-semibold">{coins}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={isTracking ? stopTracking : startTracking}
                  disabled={!destCoords && !isTracking}
                  className={`px-4 py-2 rounded-md font-semibold text-sm active:scale-95 ${isTracking ? 'bg-red-500' : destCoords ? 'bg-green-500' : 'bg-gray-600 cursor-not-allowed'} text-white`}
                >
                  {isTracking ? 'Stop' : 'Start'}
                </button>
                <button
                  onClick={verifyArrival}
                  className="px-4 py-2 rounded-md font-semibold text-sm bg-blue-500 text-white active:scale-95"
                >
                  I’ve arrived
                </button>
              </div>
            </div>

            <div className="text-center text-xs text-white/70">
              {rewarded ? '✅ Reward granted' : destCoords ? 'Destination set' : 'No destination'}
            </div>
          </>
          )}
        </div>
        )}

        {/* Map container */}
        <div className={`relative flex-1 ${fullscreen ? 'fixed inset-0 z-[9999] rounded-none' : 'rounded-[var(--radius-sm)] overflow-hidden'}`}>
          <div ref={mapContainer} className={`${fullscreen ? 'w-screen h-[100svh]' : 'h-full w-full'}`} />

          {/* Floating recenter button */}
          <button
            onClick={getCurrentLocation}
            className={`absolute right-3 ${fullscreen ? 'bottom-24' : 'bottom-3'} z-10 p-3 rounded-full bg-black/60 backdrop-blur text-white shadow-lg active:scale-95`}
            aria-label="Recenter"
          >
            <MdMyLocation className={`w-6 h-6 ${isLoadingLocation ? 'animate-spin' : ''}`} />
          </button>

          {/* Fullscreen walking HUD */}
          {fullscreen && (
            <div className="absolute inset-x-0 bottom-0 z-10 p-4">
              <div className="rounded-2xl bg-black/70 backdrop-blur border border-white/10 text-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white/90 font-semibold">Walking</h3>
                  <button
                    onClick={() => setFullscreen(false)}
                    className="px-3 py-1 text-xs rounded-md bg-white/10 text-white hover:bg-white/20 active:scale-95"
                  >
                    Exit
                  </button>
                </div>
                <div className="mb-3 flex items-center justify-between">
                  <button
                    onClick={() => setShowFsStats(v => !v)}
                    className="px-3 py-1 text-xs rounded-md bg-white/10 text-white hover:bg-white/20 active:scale-95"
                  >
                    {showFsStats ? 'Hide stats' : 'Show stats'}
                  </button>
                </div>

                {showFsStats && (
                <div className="flex flex-wrap justify-between gap-4 text-base sm:text-lg">
                  <div>
                    <div className="text-white/60">Elapsed</div>
                    <div className="font-bold">{Math.floor(tripStats.elapsed).toFixed(0)} min</div>
                  </div>
                  <div>
                    <div className="text-white/60">Traveled</div>
                    <div className="font-bold">{tripStats.traveled.toFixed(2)} km</div>
                  </div>
                  <div>
                    <div className="text-white/60">Remaining</div>
                    <div className="font-bold">{tripStats.distance.toFixed(2)} km</div>
                  </div>
                  <div>
                    <div className="text-white/60">ETA</div>
                    <div className="font-bold">{Math.max(0, Math.round(tripStats.duration))} min</div>
                  </div>
                </div>
                )}

                <div className="mt-8 flex items-center justify-between text-sm">
                  <div>
                    <span className="text-white/60">Speed:</span>
                    <span className="ml-2 font-semibold">{tripStats.speed.toFixed(1)} km/h</span>
                  </div>
                  <div>
                    <span className="text-white/60">Coins:</span>
                    <span className="ml-2 font-semibold">{coins}</span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={isTracking ? stopTracking : startTracking}
                    disabled={!destCoords && !isTracking}
                    className={`w-full py-3 rounded-lg font-semibold text-sm active:scale-95 ${isTracking ? 'bg-red-500' : destCoords ? 'bg-green-500' : 'bg-gray-600 cursor-not-allowed'} text-white`}
                  >
                    {isTracking ? 'Stop' : 'Start'}
                  </button>
                  <button
                    onClick={verifyArrival}
                    className="w-full py-3 rounded-lg font-semibold text-sm bg-blue-500 text-white active:scale-95"
                  >
                    I’ve arrived
                  </button>
                </div>

                <div className="mt-2 text-center text-xs text-white/70">
                  {rewarded ? '✅ Reward granted' : destCoords ? 'Destination set' : 'No destination'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
