export interface WeatherMain {
	temp: number
	temp_min: number
	temp_max: number
	humidity?: number
	pressure?: number
	feels_like?: number
}

export interface WeatherCondition {
	icon: string
	description: string
	main?: string
}

export interface WeatherWind {
	speed: number
}

export interface WeatherPrecipitation {
	"1h"?: number
	"3h"?: number
}

export interface WeatherItem {
	dt: number
	main: WeatherMain
	weather: WeatherCondition[]
	pop?: number
	wind?: WeatherWind
	rain?: WeatherPrecipitation
	snow?: WeatherPrecipitation
	weatherIconUrl?: string
}
