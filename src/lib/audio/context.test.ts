import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { FakeAudioContext } from "#/test-utils/audio";

const settings = vi.hoisted(() => ({ sound: "on" }));

vi.mock("../settings", () => ({ getSettings: () => settings }));

const setUserActivation = (hasBeenActive: boolean) =>
  Object.defineProperty(navigator, "userActivation", {
    value: { hasBeenActive },
    configurable: true,
  });

// The module keeps its context for the session, so each test loads a fresh module instance.
const loadContextModule = async () => await import("./context");

beforeEach(() => {
  vi.resetModules();

  settings.sound = "on";
  FakeAudioContext.reset();

  vi.stubGlobal("AudioContext", FakeAudioContext);
  setUserActivation(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("playSound", () => {
  test("does nothing while sound is off", async () => {
    settings.sound = "off";

    const { playSound } = await loadContextModule();
    const play = vi.fn();

    playSound(play);

    expect(play).not.toHaveBeenCalled();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  test("does nothing before the document has had a user gesture", async () => {
    setUserActivation(false);

    const { playSound } = await loadContextModule();
    const play = vi.fn();

    playSound(play);

    expect(play).not.toHaveBeenCalled();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  test("plays immediately when the context is already running", async () => {
    FakeAudioContext.initialState = "running";

    const { playSound } = await loadContextModule();
    const play = vi.fn();

    playSound(play);

    expect(play).toHaveBeenCalledOnce();
  });

  test("resumes a suspended context and plays when it starts running", async () => {
    const { playSound } = await loadContextModule();
    const play = vi.fn();

    playSound(play);

    const context = FakeAudioContext.instances[0]!;

    expect(context.resumeCount).toBe(1);
    expect(play).not.toHaveBeenCalled();

    context.reachRunning();

    await vi.waitFor(() => expect(play).toHaveBeenCalledOnce());
  });

  test("plays every sound waiting for the same state change", async () => {
    const { playSound } = await loadContextModule();
    const first = vi.fn();
    const second = vi.fn();

    playSound(first);
    playSound(second);

    FakeAudioContext.instances[0]!.reachRunning();

    await vi.waitFor(() => {
      expect(first).toHaveBeenCalledOnce();
      expect(second).toHaveBeenCalledOnce();
    });
  });

  test("uses one context for the session", async () => {
    FakeAudioContext.initialState = "running";

    const { playSound } = await loadContextModule();

    playSound(vi.fn());
    playSound(vi.fn());

    expect(FakeAudioContext.instances).toHaveLength(1);
  });
});

describe("primeAudio", () => {
  test("does nothing while sound is off", async () => {
    settings.sound = "off";

    const { primeAudio } = await loadContextModule();

    primeAudio();

    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  test("resumes the context on every call", async () => {
    const { primeAudio } = await loadContextModule();

    primeAudio();
    primeAudio();

    expect(FakeAudioContext.instances[0]!.resumeCount).toBe(2);
  });

  // The important behaviour is that a rejected resume does not prevent a later
  // gesture from trying again. `ensureResumed` owns the rejection handling.
  test("ignores a rejected resume and recovers on a later gesture", async () => {
    const { playSound, primeAudio } = await loadContextModule();
    const play = vi.fn();

    primeAudio();

    const context = FakeAudioContext.instances[0]!;

    context.resumeResult = Promise.reject(new Error("gesture declined"));
    primeAudio();

    context.resumeResult = Promise.resolve();

    playSound(play);
    context.reachRunning();

    await vi.waitFor(() => expect(play).toHaveBeenCalledOnce());
  });

  test("does not wait for a resume promise that never settles", async () => {
    const { playSound, primeAudio } = await loadContextModule();
    const play = vi.fn();

    primeAudio();

    const context = FakeAudioContext.instances[0]!;

    // Some iOS gestures can leave resume() pending even though a later gesture
    // can successfully start the context. Waiting for that promise would strand audio.
    context.resumeResult = new Promise<void>(() => undefined);

    playSound(play);

    expect(play).not.toHaveBeenCalled();

    context.reachRunning();

    await vi.waitFor(() => expect(play).toHaveBeenCalledOnce());
  });

  test("does not resume an already running context", async () => {
    FakeAudioContext.initialState = "running";

    const { primeAudio } = await loadContextModule();

    primeAudio();

    expect(FakeAudioContext.instances[0]!.resumeCount).toBe(0);
  });
});

describe("needsAudioPriming", () => {
  test("is false while sound is off", async () => {
    settings.sound = "off";

    const { needsAudioPriming } = await loadContextModule();

    expect(needsAudioPriming()).toBe(false);
  });

  test("is true before a context has been opened", async () => {
    const { needsAudioPriming } = await loadContextModule();
    expect(needsAudioPriming()).toBe(true);
  });

  test("is false once the context is running", async () => {
    FakeAudioContext.initialState = "running";

    const { needsAudioPriming, primeAudio } = await loadContextModule();

    primeAudio();

    expect(needsAudioPriming()).toBe(false);
  });

  test("is true while the context is suspended", async () => {
    const { needsAudioPriming, primeAudio } = await loadContextModule();

    primeAudio();

    expect(needsAudioPriming()).toBe(true);
  });
});

describe("getGainNode", () => {
  test("returns one gain node for the session and connects it to the destination", async () => {
    FakeAudioContext.initialState = "running";

    const { getGainNode } = await loadContextModule();
    const context = new FakeAudioContext() as unknown as AudioContext;

    const gain = getGainNode(context);

    expect(getGainNode(context)).toBe(gain);
    expect(FakeAudioContext.connections).toEqual([(context as unknown as FakeAudioContext).destination]);
  });
});
