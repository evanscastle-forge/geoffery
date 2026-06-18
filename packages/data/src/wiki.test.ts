import { afterEach, expect, test, vi } from "vitest";
import { fetchTimeseries } from "./wiki.ts";

afterEach(() => vi.unstubAllGlobals());

test("fetchTimeseries maps the timeseries array to snapshots (nulls preserved)", async () => {
  const body = {
    data: [
      { timestamp: 1000, avgHighPrice: 110, avgLowPrice: 100, highPriceVolume: 5, lowPriceVolume: 3 },
      { timestamp: 2000, avgHighPrice: null, avgLowPrice: 90, highPriceVolume: null, lowPriceVolume: 1 },
    ],
  };
  const fetchMock = vi.fn(async (_url: string, _opts?: unknown) => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const snaps = await fetchTimeseries("ua", 4151, "6h");

  expect(fetchMock).toHaveBeenCalledOnce();
  expect(String(fetchMock.mock.calls[0]![0])).toContain("/timeseries?timestep=6h&id=4151");
  expect(snaps).toEqual([
    { itemId: 4151, ts: 1000, avgHigh: 110, avgLow: 100, highVol: 5, lowVol: 3 },
    { itemId: 4151, ts: 2000, avgHigh: null, avgLow: 90, highVol: null, lowVol: 1 },
  ]);
});
