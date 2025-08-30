"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDirections from "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions";
import "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css";
import { MdMyLocation } from "react-icons/md";

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
  const [suggestions, setSuggestions] = useState<Array<{place_name: string; center: [number, number]}>>([]);
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

  // Function to get suggestions from Mapbox Geocoding API
  const getSuggestions = async (query: string) => {
    if (!query) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}&country=AU`
      );
      const data = await response.json();
      setSuggestions(data.features);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setSuggestions([]);
    }
  };

  // Function to set route
  const setRoute = (start: [number, number], end: [number, number]) => {
    if (directions.current) {
      directions.current.setOrigin(start);
      directions.current.setDestination(end);
    }
  };

  // Function to handle suggestion selection
  const handleSuggestionSelect = (suggestion: {place_name: string; center: [number, number]}) => {
    if (activeInput === "start") {
      setStartLocation(suggestion.place_name);
      if (directions.current) {
        directions.current.setOrigin(suggestion.center);
      }
    } else if (activeInput === "end") {
      setEndLocation(suggestion.place_name);
      if (directions.current) {
        directions.current.setDestination(suggestion.center);
      }
    }
    setSuggestions([]);
    setActiveInput(null);
  };

  // Function to get current location
  const getCurrentLocation = () => {
    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Reverse geocode to get address
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`
          );
          const data = await response.json();
          const address = data.features[0].place_name;
          setStartLocation(address);
          if (directions.current) {
            directions.current.setOrigin([longitude, latitude]);
          }
          if (map.current) {
            map.current.flyTo({
              center: [longitude, latitude],
              zoom: 14
            });
          }
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
    if (map.current || !mapContainer.current || !process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) return;

    // Set the access token globally for Mapbox GL
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    // Initialize map only once
    const initializedMap = new mapboxgl.Map({
      accessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [lng, lat],
      zoom: zoom,
    });

    map.current = initializedMap;

    // Add navigation controls
    initializedMap.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Add directions control
    const directionsControl = new MapboxDirections({
      accessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
      unit: "metric",
      profile: "mapbox/walking",
      alternatives: true,
      congestion: true,
      controls: {
        inputs: false,
        instructions: false,
      },
      interactive: true,
      placeholderOrigin: "Choose a starting place",
      placeholderDestination: "Choose destination",
      flyTo: false,
      styles: [
        {
          "id": "directions-route-line",
          "type": "line",
          "source": "directions",
          "layout": {
            "line-cap": "round",
            "line-join": "round"
          },
          "paint": {
            "line-color": "#3BB2D0",
            "line-width": 4
          },
          "filter": [
            "all",
            ["in", "$type", "LineString"],
            ["in", "route", "selected"]
          ]
        },
        {
          "id": "directions-hover-point",
          "type": "circle",
          "source": "directions",
          "paint": {
            "circle-radius": 8,
            "circle-color": "#3BB2D0"
          },
          "filter": [
            "all",
            ["in", "$type", "Point"],
            ["in", "id", "hover"]
          ]
        },
        {
          "id": "directions-origin-point",
          "type": "circle",
          "source": "directions",
          "paint": {
            "circle-radius": 12,
            "circle-color": "#3BB2D0"
          },
          "filter": [
            "all",
            ["in", "$type", "Point"],
            ["in", "marker-symbol", "A"]
          ]
        },
        {
          "id": "directions-destination-point",
          "type": "circle",
          "source": "directions",
          "paint": {
            "circle-radius": 12,
            "circle-color": "#FF3B30"
          },
          "filter": [
            "all",
            ["in", "$type", "Point"],
            ["in", "marker-symbol", "B"]
          ]
        }
      ]
    });

    map.current.addControl(directionsControl, "top-left");
    directions.current = directionsControl;

    // Update coordinates when map moves
    initializedMap.on("moveend", () => {
      if (!initializedMap) return;
      const center = initializedMap.getCenter();
      setLng(Number(center.lng.toFixed(4)));
      setLat(Number(center.lat.toFixed(4)));
      setZoom(Number(initializedMap.getZoom().toFixed(2)));
    });

    // Listen for route updates
    if (onRouteUpdate) {
      directionsControl.on("route", (event: any) => {
        if (event.route && event.route[0]) {
          const route = event.route[0];
          onRouteUpdate(route.distance / 1000, route.duration / 60);
        }
      });
    }

    // Get user's location and center map
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (map.current) {
          map.current.flyTo({
            center: [position.coords.longitude, position.coords.latitude],
            zoom: 14,
          });
        }
      },
      (error) => {
        console.error("Error getting location:", error);
      }
    );

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  // Function to start tracking
  const startTracking = () => {
    if (!map.current || !directions.current) return;

    setIsTracking(true);
    setTripStats({
      distance: 0,
      duration: 0,
      speed: 0,
      startTime: Date.now(),
    });

    // Start watching position
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition(position);
        const { latitude, longitude } = position.coords;

        // Update current position marker
        if (map.current) {
          map.current.flyTo({
            center: [longitude, latitude],
            zoom: 16
          });

          // Update route if we have a destination
          if (endLocation) {
            directions.current?.setOrigin([longitude, latitude]);
          }
        }

        // Calculate stats
        const currentTime = Date.now();
        const duration = (currentTime - tripStats.startTime) / 1000 / 60; // minutes
        const speed = position.coords.speed || 0;

        setTripStats(prev => ({
          ...prev,
          duration,
          speed: speed * 3.6, // convert m/s to km/h
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

  // Function to stop tracking
  const stopTracking = () => {
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setIsTracking(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

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
                <MdMyLocation className={`w-5 h-5 ${isLoadingLocation ? 'animate-spin' : ''}`} />
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
                    {suggestion.place_name}
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
                    {suggestion.place_name}
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

        {/* Start/Stop Button */}
        <button
          onClick={isTracking ? stopTracking : startTracking}
          className={`mt-2 w-full py-2 px-4 rounded-md font-medium transition-colors ${
            isTracking 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {isTracking ? 'Stop' : 'Start'}
        </button>
      </div>

      {/* Map container */}
      <div className="relative flex-1 rounded-[var(--radius-sm)] overflow-hidden">
        <div ref={mapContainer} className="h-full w-full" />
      </div>
    </div>
  );
}
