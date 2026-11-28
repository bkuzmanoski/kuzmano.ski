import { fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { FakeAudioContext } from "#/test-utils/audio.ts";
import { stubVisibilityState } from "#/test-utils/visibility.ts";

const settings = vi.hoisted(() => ({ soundEffects: "on" }));

vi.mock("../settings/settings.ts", () => ({ getSettings: () => settings }));

// Defaults to a page that has had a user gesture, with no gesture in progress.
const setUserActivation = ({ hasBeenActive = true, isActive = false } = {}) =>
  Object.defineProperty(navigator, "userActivation", {
    value: { hasBeenActive, isActive },
    configurable: true,
  });

// The module caches its audio context for the session, so each test imports a fresh instance.
const loadContextModule = async () => await import("./context.ts");

// Flushes queued promise callbacks so tests can assert that a sound did not play.
const settlePromises = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.resetModules();

  settings.soundEffects = "on";
  FakeAudioContext.reset();

  vi.stubGlobal("AudioContext", FakeAudioContext);
  setUserActivation();
  Reflect.deleteProperty(navigator, "audioSession");
});

describe("requestPlayback", () => {
  test("does not play the sound or create an audio context when sound effects are off", async () => {
    settings.soundEffects = "off";

    const { requestPlayback } = await loadContextModule();
    const play = vi.fn();

    requestPlayback(play);

    expect(play).not.toHaveBeenCalled();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  test("does not play the sound or create an audio context before the page has had a user gesture", async () => {
    setUserActivation({ hasBeenActive: false });

    const { requestPlayback } = await loadContextModule();
    const play = vi.fn();

    requestPlayback(play);

    expect(play).not.toHaveBeenCalled();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  test("plays the sound when the audio context is running", async () => {
    FakeAudioContext.initialState = "running";

    const { requestPlayback } = await loadContextModule();
    const play = vi.fn();

    requestPlayback(play);

    expect(play).toHaveBeenCalledOnce();
  });

  test("during a user gesture, resumes a suspended audio context and plays the sound on it", async () => {
    setUserActivation({ isActive: true });

    const { requestPlayback } = await loadContextModule();
    const play = vi.fn();

    requestPlayback(play);

    const context = FakeAudioContext.instances[0]!;

    expect(context.resumeCount).toBe(1);
    expect(play).toHaveBeenCalledExactlyOnceWith(context);
  });

  test("outside a user gesture, drops the sound when the audio context is suspended", async () => {
    const { requestPlayback } = await loadContextModule();
    const play = vi.fn();

    requestPlayback(play);

    const context = FakeAudioContext.instances[0]!;

    // A context can stay suspended until a later gesture, so playing on `running` would play the sound out of step with
    // the user action that triggered it.
    context.transitionToRunning();
    await settlePromises();

    expect(play).not.toHaveBeenCalled();
  });

  test("outside a user gesture, does not resume a suspended audio context", async () => {
    const { requestPlayback } = await loadContextModule();

    requestPlayback(vi.fn());

    // On iOS, a resume outside a user gesture kept the context silent until the next tap.
    expect(FakeAudioContext.instances[0]!.resumeCount).toBe(0);
  });

  test("creates one audio context for the session", async () => {
    FakeAudioContext.initialState = "running";

    const { requestPlayback } = await loadContextModule();

    requestPlayback(vi.fn());
    requestPlayback(vi.fn());

    expect(FakeAudioContext.instances).toHaveLength(1);
  });
  test("sets the audio session type before playing the sound", async () => {
    FakeAudioContext.initialState = "running";

    const audioSession = { type: "playback" }; // Left by a video removed from the document while playing.

    Object.defineProperty(navigator, "audioSession", { value: audioSession, configurable: true });

    const { requestPlayback } = await loadContextModule();

    requestPlayback(vi.fn());

    expect(audioSession.type).toBe("ambient");
  });
});

describe("primeAudio", () => {
  test("does not create an audio context when sound effects are off", async () => {
    settings.soundEffects = "off";

    const { primeAudio } = await loadContextModule();

    primeAudio();

    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  test("resumes a suspended audio context on every call", async () => {
    const { primeAudio } = await loadContextModule();

    // On iOS, a resume issued before WebKit accepts the gesture can stay pending, so a later gesture has to resume
    // again.
    primeAudio();
    primeAudio();

    expect(FakeAudioContext.instances[0]!.resumeCount).toBe(2);
  });

  test("ignores a rejected resume", async () => {
    const { primeAudio } = await loadContextModule();

    primeAudio();
    FakeAudioContext.instances[0]!.resumeResult = Promise.reject(new Error("gesture declined"));

    // Vitest fails the run on an unhandled rejection.
    primeAudio();
    await settlePromises();
  });
});

describe("needsAudioPriming", () => {
  test("is `false` when sound effects are off", async () => {
    settings.soundEffects = "off";

    const { needsAudioPriming } = await loadContextModule();

    expect(needsAudioPriming()).toBe(false);
  });

  test("is `true` before an audio context has been created", async () => {
    const { needsAudioPriming } = await loadContextModule();
    expect(needsAudioPriming()).toBe(true);
  });

  test("is `false` once the audio context is running", async () => {
    FakeAudioContext.initialState = "running";

    const { needsAudioPriming, primeAudio } = await loadContextModule();

    primeAudio();

    expect(needsAudioPriming()).toBe(false);
  });

  test("is `true` while the audio context is suspended", async () => {
    const { needsAudioPriming, primeAudio } = await loadContextModule();

    primeAudio();

    expect(needsAudioPriming()).toBe(true);
  });
});

describe("useAudioUnlock", () => {
  test.each([
    ["a mouse `pointerdown`", () => fireEvent.pointerDown(document, { pointerType: "mouse" })],
    ["a touch `pointerup`", () => fireEvent.pointerUp(document, { pointerType: "touch" })],
    ["a `keydown` of the A key", () => fireEvent.keyDown(document, { key: "a" })],
  ])("creates the audio context on %s", async (_event, dispatch) => {
    const { useAudioUnlock } = await loadContextModule();

    renderHook(useAudioUnlock);
    dispatch();

    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  test.each([
    ["a touch `pointerdown`", () => fireEvent.pointerDown(document, { pointerType: "touch" })],
    ["a mouse `pointerup`", () => fireEvent.pointerUp(document, { pointerType: "mouse" })],
    ["a `keydown` of the Shift key", () => fireEvent.keyDown(document, { key: "Shift" })],
  ])("does not create the audio context on %s", async (_event, dispatch) => {
    const { useAudioUnlock } = await loadContextModule();

    renderHook(useAudioUnlock);
    dispatch();

    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  test("does not suspend the audio context when the page is hidden", async () => {
    FakeAudioContext.initialState = "running";

    const setVisibilityState = stubVisibilityState();
    const { primeAudio, useAudioUnlock } = await loadContextModule();

    renderHook(useAudioUnlock);
    primeAudio();
    setVisibilityState("hidden");

    expect(FakeAudioContext.instances[0]!.suspendCount).toBe(0);
  });

  test("does not resume the audio context when the page becomes visible again", async () => {
    FakeAudioContext.initialState = "running";

    const setVisibilityState = stubVisibilityState();
    const { primeAudio, useAudioUnlock } = await loadContextModule();

    renderHook(useAudioUnlock);
    primeAudio();

    const context = FakeAudioContext.instances[0]!;

    setVisibilityState("hidden");
    context.state = "suspended"; // iOS interrupts the context while the page is hidden.
    setVisibilityState("visible");

    // iOS resumes the context itself, and a resume outside a user gesture kept it silent until the next tap.
    expect(context.resumeCount).toBe(0);
  });
});

describe("getGainNode", () => {
  test("returns the same gain node on every call, connected to the destination", async () => {
    FakeAudioContext.initialState = "running";

    const { getGainNode } = await loadContextModule();
    const context = new FakeAudioContext() as unknown as AudioContext;

    const gain = getGainNode(context);

    expect(getGainNode(context)).toBe(gain);
    expect(FakeAudioContext.connections).toEqual([(context as unknown as FakeAudioContext).destination]);
  });
});
