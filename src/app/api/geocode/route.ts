import { NextResponse } from "next/server";

type PhotonFeature = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    name?: string;
    street?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
    type?: string;
  };
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query) {
      return NextResponse.json(
        {
          results: [],
          error: "Enter a location to search.",
        },
        { status: 400 }
      );
    }

    const url = new URL(
      "https://photon.komoot.io/api/"
    );

    url.searchParams.set("q", query);
    url.searchParams.set("limit", "5");
    url.searchParams.set(
      "lang",
      "en"
    );

    const response = await fetch(
      url.toString(),
      {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "CivicLens/1.0 hackathon",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(
        `Geocoder returned ${response.status}`
      );
    }

    const data = await response.json();

    const features: PhotonFeature[] =
      Array.isArray(data?.features)
        ? data.features
        : [];

    const results = features
      .map((feature) => {
        const coordinates =
          feature.geometry?.coordinates;

        const properties =
          feature.properties ?? {};

        if (
          !coordinates ||
          coordinates.length < 2
        ) {
          return null;
        }

        const longitude = Number(
          coordinates[0]
        );

        const latitude = Number(
          coordinates[1]
        );

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          return null;
        }

        const parts = [
          properties.name,
          properties.street,
          properties.district,
          properties.city,
          properties.state,
          properties.postcode,
        ].filter(Boolean);

        return {
          latitude,
          longitude,
          displayName:
            parts.join(", ") || query,
          type:
            properties.type ??
            "location",
        };
      })
      .filter(
        (
          result
        ): result is {
          latitude: number;
          longitude: number;
          displayName: string;
          type: string;
        } => result !== null
      );

    return NextResponse.json({
      results,
      query,
    });
  } catch (error) {
    console.error(
      "Geocoding error:",
      error
    );

    return NextResponse.json(
      {
        results: [],
        error:
          "Location search service is unavailable.",
      },
      { status: 502 }
    );
  }
}
