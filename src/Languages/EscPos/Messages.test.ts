import { expect, describe, it } from 'vitest';
import { getMessageCandidate, MessageCandidates } from './Messages.js';

describe('escpos message candidates', () => {
  it('xon and xoff are exact', () => {
    expect(getMessageCandidate(MessageCandidates.XON)).toBe('xon');
    expect(getMessageCandidate(MessageCandidates.XOFF)).toBe('xoff');
  });

  it('null byte is a response', () => {
    expect(getMessageCandidate(0x00)).toBe('response');
  });

  it('realtime byte is realtime', () => {
    expect(getMessageCandidate(MessageCandidates.Realtime)).toBe('realtime');
  });

  it('asb byte is asb', () => {
    expect(getMessageCandidate(MessageCandidates.AutoStat)).toBe('asb');
  });

  it('Header byte is Header', () => {
    expect(getMessageCandidate(0x37)).toBe('header');
  });

  it('FF to be unknown', () => {
    expect(getMessageCandidate(0xff)).toBe('unknown');
  });
});
