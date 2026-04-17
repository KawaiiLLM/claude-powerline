import { PricingService, type ModelPricing } from "../src/segments/pricing";

describe("PricingService", () => {
  const opus46Pricing: ModelPricing = {
    name: "Claude Opus 4.6",
    input: 5,
    output: 25,
    cache_write_5m: 6.25,
    cache_write_1h: 10,
    cache_read: 0.5,
  };

  beforeEach(() => {
    (PricingService as any).executionCache = null;
    (PricingService as any).modelPricingCache = new Map();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses Opus 4.7 pricing instead of legacy Opus 4 fallback pricing", async () => {
    jest.spyOn(PricingService as any, "loadDiskCache").mockResolvedValue(null);
    jest.spyOn(PricingService as any, "fetchPricingData").mockResolvedValue(
      null,
    );

    const pricing = await PricingService.getModelPricing("claude-opus-4-7");

    expect(pricing).toMatchObject({
      input: 5,
      output: 25,
      cache_write_5m: 6.25,
      cache_write_1h: 10,
      cache_read: 0.5,
    });
  });

  it("prices 5m and 1h cache writes separately when the transcript includes the split", async () => {
    jest
      .spyOn(PricingService, "getModelPricing")
      .mockResolvedValue(opus46Pricing);

    const entry = {
      message: {
        model: "claude-opus-4-6",
        usage: {
          input_tokens: 1_000,
          output_tokens: 2_000,
          cache_creation_input_tokens: 3_000,
          cache_read_input_tokens: 4_000,
          cache_creation: {
            ephemeral_5m_input_tokens: 1_000,
            ephemeral_1h_input_tokens: 2_000,
          },
        },
      },
    };

    const cost = await PricingService.calculateCostForEntry(entry);

    const expected =
      (1_000 / 1_000_000) * opus46Pricing.input +
      (2_000 / 1_000_000) * opus46Pricing.output +
      (1_000 / 1_000_000) * opus46Pricing.cache_write_5m +
      (2_000 / 1_000_000) * opus46Pricing.cache_write_1h +
      (4_000 / 1_000_000) * opus46Pricing.cache_read;

    expect(cost).toBeCloseTo(expected, 10);
  });
});
