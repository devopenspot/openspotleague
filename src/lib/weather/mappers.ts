import type { WeatherItem } from "@/types/weather";
import type { WeatherIconName } from "@/lib/types";

export function mapIconName(icon: string | undefined): WeatherIconName {
	if (!icon) return "sunny";
	switch (icon.slice(0, 2)) {
		case "01":
			return "sunny";
		case "02":
			return "partly_cloudy_day";
		case "03":
		case "04":
			return "cloudy";
		case "09":
		case "10":
			return "rain";
		case "13":
			return "snow";
		default:
			return "sunny";
	}
}

export interface MappedCurrentWeather {
	temp: number | null;
	icon: WeatherIconName;
	description: string;
	humidity: number | null;
	precipitationMm: number | null;
}

export function mapCurrentWeather(
	item: WeatherItem | null,
): MappedCurrentWeather {
	if (!item) {
		return {
			temp: null,
			icon: "sunny",
			description: "",
			humidity: null,
			precipitationMm: null,
		};
	}
	const condition = item.weather[0];
	return {
		temp: Math.round(item.main.temp),
		icon: mapIconName(condition?.icon),
		description: condition?.description ?? "",
		humidity: item.main.humidity ?? null,
		precipitationMm:
			item.rain?.["1h"] ??
			item.rain?.["3h"] ??
			item.snow?.["1h"] ??
			item.snow?.["3h"] ??
			null,
	};
}
