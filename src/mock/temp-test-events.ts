import type { ProviderPayload, StreamEvent } from "../ringBuffer.js";

const baseTs = Date.now() - 60_000; // 1 min atrás

export const tempTestEvents: Array<StreamEvent<ProviderPayload>> = [
	{
		id: 1,
		type: "timeseries.temperature",
		data: {
			series: "temperature",
			sensorId: "sensor-a",
			value: 21.3,
			unit: "C",
		},
		timestamp: baseTs + 5_000,
	},
	{
		id: 2,
		type: "timeseries.temperature",
		data: {
			series: "temperature",
			sensorId: "sensor-a",
			value: 21.6,
			unit: "C",
		},
		timestamp: baseTs + 10_000,
	},
	{
		id: 3,
		type: "timeseries.humidity",
		data: { series: "humidity", sensorId: "sensor-a", value: 55.2, unit: "%" },
		timestamp: baseTs + 15_000,
	},
	{
		id: 4,
		type: "timeseries.temperature",
		data: {
			series: "temperature",
			sensorId: "sensor-a",
			value: 21.9,
			unit: "C",
		},
		timestamp: baseTs + 20_000,
	},
	{
		id: 5,
		type: "timeseries.humidity",
		data: { series: "humidity", sensorId: "sensor-a", value: 54.8, unit: "%" },
		timestamp: baseTs + 25_000,
	},
	{
		id: 6,
		type: "timeseries.pressure",
		data: {
			series: "pressure",
			sensorId: "sensor-a",
			value: 1012.7,
			unit: "hPa",
		},
		timestamp: baseTs + 30_000,
	},
];
