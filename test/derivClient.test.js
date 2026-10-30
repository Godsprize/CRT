import test from "node:test";
import assert from "node:assert/strict";
import { mapActiveSymbolForMenu } from "../src/derivClient.js";

test("adds familiar aliases for major stock indices", () => {
  assert.equal(
    mapActiveSymbolForMenu({
      symbol: "OTC_NDX",
      display_name: "US Tech 100",
      market_display_name: "Stock Indices",
      exchange_is_open: 0
    }).displayName,
    "US Tech 100 / NAS100"
  );

  assert.equal(
    mapActiveSymbolForMenu({
      symbol: "OTC_DJI",
      display_name: "Wall Street 30",
      market_display_name: "Stock Indices",
      exchange_is_open: 0
    }).displayName,
    "Wall Street 30 / US30"
  );
});

test("cleans derived index display names", () => {
  const instrument = mapActiveSymbolForMenu({
      symbol: "R_100",
      display_name: "Volatility 100 Index",
      market_display_name: "Derived",
      exchange_is_open: 1
    });

  assert.equal(instrument.displayName, "Volatility 100");
  assert.equal(instrument.category, "volatility");
});

test("categorizes gold separately", () => {
  assert.equal(
    mapActiveSymbolForMenu({
      symbol: "frxXAUUSD",
      display_name: "Gold/USD",
      market_display_name: "Commodities",
      exchange_is_open: 1
    }).category,
    "gold"
  );
});

test("maps symbols returned by the current Deriv public API", () => {
  const instrument = mapActiveSymbolForMenu({
    underlying_symbol: "R_100",
    underlying_symbol_name: "Volatility 100 Index",
    market: "synthetic_index"
  });

  assert.equal(instrument.symbol, "R_100");
  assert.equal(instrument.displayName, "Volatility 100");
  assert.equal(instrument.category, "volatility");
});

test("categorizes current API market codes", () => {
  assert.equal(
    mapActiveSymbolForMenu({
      underlying_symbol: "frxEURUSD",
      underlying_symbol_name: "EUR/USD",
      market: "forex"
    }).category,
    "currency_pairs"
  );

  assert.equal(
    mapActiveSymbolForMenu({
      underlying_symbol: "OTC_SPC",
      underlying_symbol_name: "US 500",
      market: "stock_index"
    }).category,
    "indices"
  );
});
