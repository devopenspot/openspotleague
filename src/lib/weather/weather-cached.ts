import type { WeatherIconName } from "@/lib/types"
import { cacheLife, cacheTag } from "next/cache"
import { fetchCurrentWeather } from "./fetchers"
import { mapCurrentWeather } from "./mappers"
import { log } from "@/lib/utils/log"

export interface SpotWeather {
	current: number | null
	icon: WeatherIconName
	description: string
	tempMin: number | null
	tempMax: number | null
	wind: number | null
	humidity: number | null
	precipitationMm: number | null
	fetchedAt: number
}

import { WEATHER_CACHE_LIFE } from "@/lib/cache/lifetimes"

export async function getSpotWeather({
	spotId,
	latitude,
	longitude,
	language,
}: {
	spotId: string
	latitude: number
	longitude: number
	language?: string
}): Promise<SpotWeather> {
	"use cache"
	cacheTag("weather", `weather:spot:${spotId}`)
	cacheLife(WEATHER_CACHE_LIFE)

	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
		return {
			current: null,
			icon: "sunny",
			description: "",
			tempMin: null,
			tempMax: null,
			wind: null,
			humidity: null,
			precipitationMm: null,
			fetchedAt: Date.now(),
		}
	}

	try {
		const current = await fetchCurrentWeather({ latitude, longitude, language })
		const mapped = mapCurrentWeather(current)
		return {
			current: mapped.temp,
			icon: mapped.icon,
			description: mapped.description,
			tempMin: current ? Math.round(current.main.temp_min) : null,
			tempMax: current ? Math.round(current.main.temp_max) : null,
			wind: current?.wind?.speed ?? null,
			humidity: mapped.humidity,
			precipitationMm: mapped.precipitationMm,
			fetchedAt: Date.now(),
		}
	} catch (error) {
		log.error(`getSpotWeather(${spotId}) failed: ${error}`)
		return {
			current: null,
			icon: "sunny",
			description: "",
			tempMin: null,
			tempMax: null,
			wind: null,
			humidity: null,
			precipitationMm: null,
			fetchedAt: Date.now(),
		}
	}
}
