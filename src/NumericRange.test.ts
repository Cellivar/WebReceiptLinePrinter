import { test, expect, describe } from 'vitest';
import { clampToRange, numberInRange, repeat } from './NumericRange.js';

describe("clampToRange tests", () => {
  test('high number is clamped down', () => {
    expect(clampToRange(5, 0, 2)).toBe(2);
  });

  test('low number is clamped up', () => {
    expect(clampToRange(-1, 0, 5)).toBe(0);
  });

  test('in-range number is not modified', () => {
    expect(clampToRange(3, 0, 5)).toBe(3);
  });
});

describe('numberInRange', () => {
  test('discard invalid', () => {
    expect(numberInRange(undefined!)).toBe(undefined);
    expect(numberInRange('')).toBe(undefined);
    expect(numberInRange('hello')).toBe(undefined);
    expect(numberInRange('5')).toBe(5);
  });

  test('clamp to range', () => {
    expect(numberInRange('8', -5, 5)).toBe(undefined);
    expect(numberInRange('4', -5, 5)).toBe(4);
    expect(numberInRange('-4', -5, 5)).toBe(-4);
    expect(numberInRange('-10', -5, 5)).toBe(undefined);
  });
});

describe("repeat tests", () => {
  test('Repeat repeats', () => {
    const val = repeat(5, 5);
    expect(val.length).toBe(5);
    expect(val).toEqual([5, 5, 5, 5, 5]);
  })
})
