export function readPositiveNumberEnv(name: string, fallback: number): number {
	const raw = process.env[name];
	const value = Number(raw ?? fallback);

	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(`Invalid ${name} value in environment.`);
	}

	return value;
}
